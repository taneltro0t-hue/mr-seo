"""
swarm/today — панель «Сегодня»: inbox zero для SEO.

Две колонки:
  night   — что рой сделал за последние 24ч (сводки, воркер, мост, сканы)
  actions — что ждёт ТВОЕГО клика (merge веток, свежие отзывы, черновики,
            созревшие verify, заявки new-site, алерты сторожа)

Команда: venv/bin/python swarm/today.py
"""
import glob
import json
import re
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from carpathy.register import REPO_PATHS

NOW = datetime.now()
DAY_AGO = NOW - timedelta(hours=24)
TODAY = NOW.strftime("%Y-%m-%d")


def _mtime(p) -> datetime:
    return datetime.fromtimestamp(Path(p).stat().st_mtime)


def night() -> list:
    done = []
    # сводки/мосты/аудиты за 24ч
    for f in glob.glob(str(ROOT / "swarm" / "runs" / "*.md")):
        if _mtime(f) >= DAY_AGO:
            name = Path(f).stem
            kind = "Сводка Аналитика" if "analyst" in name else "Работа моста" if "bridge" in name else name
            done.append({"time": _mtime(f).strftime("%H:%M"), "what": kind, "ref": f"swarm/runs/{Path(f).name}"})
    # обработанные воркером задачи (✓ со свежей датой)
    inbox = ROOT / "swarm" / "tasks" / "inbox.md"
    if inbox.exists():
        stamp = NOW.strftime("%m-%d")
        for ln in inbox.read_text(encoding="utf-8").splitlines():
            if f"✓ {stamp}" in ln:
                m = re.search(r"[«\"]([^»\"]+)[»\"]", ln)
                done.append({"time": "", "what": f"Рой исполнил: «{(m.group(1) if m else ln[:40])}» (переобход+план)", "ref": "swarm/tasks/inbox.md"})
    # свежий скан
    from sites_config import SITES as _SS
    for site in _SS:
        fs = sorted(glob.glob(str(ROOT / "memory" / site / "daily_snapshots" / f"{TODAY}.json")))
        if fs:
            done.append({"time": _mtime(fs[0]).strftime("%H:%M"), "what": f"Скан позиций {site}", "ref": ""})
            break  # одного упоминания достаточно
    done.sort(key=lambda x: x["time"], reverse=True)
    return done[:12]


def actions() -> list:
    todo = []
    # 1) незамерженные ветки моста
    for site, repo in REPO_PATHS.items():
        if not Path(repo or "").exists():
            continue
        try:
            br = subprocess.run(["git", "-C", repo, "branch", "--list", "mrseo/*"],
                                capture_output=True, text=True, timeout=10).stdout
            for b in [x.strip().lstrip("* ") for x in br.splitlines() if x.strip()]:
                todo.append({"kind": "merge", "priority": 1,
                             "title": f"Merge ветки {b} ({site}) — правки готовы, билд проверен",
                             "hint": f"cd в репо → git merge {b} → push = автодеплой"})
        except Exception:
            pass
    # 2) свежие отзывы (ответить)
    try:
        from swarm.insights import reviews
        for p in reviews().get("points", []):
            if p.get("new_7d", 0) > 0:
                todo.append({"kind": "review", "priority": 2,
                             "title": f"{p['label']}: +{p['new_7d']} новых отзывов — прочитать и ответить",
                             "url": p["reply_url"]})
    except Exception:
        pass
    # 3) черновики контента (вычитать)
    for f in glob.glob(str(ROOT / "content_drafts" / "**" / "*.md"), recursive=True):
        if _mtime(f) >= NOW - timedelta(days=7):
            todo.append({"kind": "draft", "priority": 2,
                         "title": f"Черновик ждёт вычитки: {Path(f).stem}",
                         "hint": f"content_drafts/{Path(f).relative_to(ROOT / 'content_drafts')}"})
    # 4) созревшие verify
    try:
        hyps = json.loads((ROOT / "carpathy" / "hypotheses.json").read_text(encoding="utf-8"))["hypotheses"]
        ripe = [h["id"] for h in hyps if h.get("status") in ("pending", "observe") and h.get("verify_due", "9999") <= TODAY]
        if ripe:
            todo.append({"kind": "verify", "priority": 3,
                         "title": f"Созрели гипотезы: {', '.join(ripe[:4])} — прогнать verify",
                         "fix": {"type": "run", "agent": "verify", "label": "Прогнать verify сейчас"}})
    except Exception:
        pass
    # 5) заявки new-site и свободные задачи без ✓
    inbox = ROOT / "swarm" / "tasks" / "inbox.md"
    if inbox.exists():
        for ln in inbox.read_text(encoding="utf-8").splitlines():
            s = ln.strip()
            if s.startswith("- [") and "✓" not in s and "[quick-win" not in s and s:
                todo.append({"kind": "task", "priority": 3, "title": f"Задача в очереди: {s[s.find(']')+1:][:80]}"})
    # 6) алерты сторожа — с кнопкой исправления
    try:
        from swarm.orchestrator import watchman
        for a in watchman():
            fix = None
            if "снапшот" in a or "daily_scan" in a:
                fix = {"type": "run", "agent": "scan", "label": "Запустить скан сейчас"}
            elif "диск" in a:
                fix = {"type": "task", "label": "Поручить рою разбор диска",
                       "task": f"[fix] {a} — найти что чистить безопасно (кэши, старые логи, node_modules заброшенных проектов), список на подтверждение"}
            else:
                fix = {"type": "task", "label": "Поручить исправление",
                       "task": f"[fix] {a} — разобраться и предложить решение"}
            todo.append({"kind": "alert", "priority": 0, "title": f"⚠️ {a}", "fix": fix})
    except Exception:
        pass
    todo.sort(key=lambda x: x["priority"])
    return todo[:10]


if __name__ == "__main__":
    print(json.dumps({"date": TODAY, "night": night(), "actions": actions()}, ensure_ascii=False))
