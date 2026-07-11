"""
swarm/orchestrator — рой агентов на headless Claude Code (аналог Zoey OS, ядро).

Трюк Zoey (teardown «Фея» 2026-07-04): инференс через первосторонний `claude`
бинарь = $0 сверх Max-подписки. Здесь — минимальный оркестратор:

  • Сторож (watchman)  — детерминированный Python, LLM не нужен: мёртвые
    источники в снапшотах, протухшие краны, просроченные verify, диск.
  • Аналитик (analyst) — headless `claude -p`: получает компактный дайджест
    данных ИНЛАЙНОМ (без tool-вызовов — надёжно в headless), пишет сводку
    в Telegram + swarm/runs/.

Запуск:  venv/bin/python swarm/orchestrator.py analyst   (сторож входит в него)
         venv/bin/python swarm/orchestrator.py watchman  (только проверки)
Cron:    com.mrseo.seo-swarm (ежедневно 09:50, после daily_scan 09:00).

Рой никогда не умирает молча: любая ошибка агента → алерт в Telegram.
"""
import glob
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
TODAY = datetime.now().strftime("%Y-%m-%d")
RUNS = ROOT / "swarm" / "runs"
AGENTS = ROOT / "swarm" / "agents"

CLAUDE_BIN = os.path.expanduser("~/.npm-global/bin/claude")
MODEL = "sonnet"  # дешевле к лимитам Max, для сводки хватает
TIMEOUT = 480

SITES = ["mysite", "demo2", "demo3"]
# Якорные ВЧ — единственный надёжный сигнал позиции (не шум окна)
ANCHORS = [
    ("mysite", "студия звукозаписи город", "yandex"),
    ("mysite", "студия звукозаписи город", "google"),
    ("mysite", "сведение и мастеринг столица", "yandex"),
    ("mysite", "заказать съемку клипа в столица", "yandex"),
    ("demo2", "пример запроса", "yandex"),
    ("demo2", "пример запроса", "google"),
    ("demo3", "кодировка минеральные воды", "yandex"),
    ("demo3", "реабилитационный центр город-2", "yandex"),
]


def _snap_files(site: str, n: int = 5):
    return sorted(glob.glob(str(ROOT / "memory" / site / "daily_snapshots" / "*.json")))[-n:]


def _load(f):
    try:
        return json.loads(Path(f).read_text(encoding="utf-8"))
    except Exception:
        return {}


# ─────────────────────────── СТОРОЖ ───────────────────────────

def watchman() -> list[str]:
    alerts = []
    # 1. источники в последнем снапшоте
    for site in SITES:
        fs = _snap_files(site, 1)
        if not fs:
            alerts.append(f"{site}: нет снапшотов вообще")
            continue
        day = Path(fs[-1]).stem
        # скан идёт в 09:00 — до 10:00 отсутствие сегодняшнего снапшота не тревога
        if day != TODAY and datetime.now().hour >= 10:
            alerts.append(f"{site}: последний снапшот {day} (daily_scan не отработал?)")
        snap = _load(fs[-1])
        for src in ("yandex", "google"):
            d = snap.get(src, {})
            if isinstance(d, dict) and "error" in d:
                alerts.append(f"{site}/{src}: {str(d['error'])[:80]}")
    # 2. просроченные verify
    try:
        hyps = _load(ROOT / "carpathy" / "hypotheses.json")["hypotheses"]
        overdue = [h["id"] for h in hyps
                   if h.get("status") in ("pending", "proposed") and h.get("verify_due", "9999") < TODAY]
        if overdue:
            alerts.append(f"просрочен verify: {', '.join(overdue[:5])}")
    except Exception as e:
        alerts.append(f"hypotheses.json не читается: {e}")
    # 3. диск (урок mac-инцидента 01.05: <50GB свободных = беда)
    free_gb = shutil.disk_usage("/").free // 2**30
    if free_gb < 50:
        alerts.append(f"диск: свободно {free_gb} GB (<50)")
    return alerts


# ─────────────────────── ДАЙДЖЕСТ ДЛЯ АНАЛИТИКА ───────────────────────

def _agg(snap: dict, src: str):
    d = snap.get(src, {})
    if not isinstance(d, dict) or "error" in d:
        return None
    qs = {k: v for k, v in d.items() if isinstance(v, dict) and v.get("position", 0) > 0}
    if not qs:
        return None
    return {"зпр": len(qs),
            "топ3": sum(1 for v in qs.values() if v["position"] <= 3),
            "топ10": sum(1 for v in qs.values() if v["position"] <= 10),
            "клики": int(sum(v.get("clicks", 0) for v in qs.values()))}


def _anchor_series(site, query, src, days=5):
    qn = query.lower().replace("ё", "е")
    out = []
    for f in _snap_files(site, days):
        d = _load(f).get(src, {})
        if isinstance(d, dict):
            for k, v in d.items():
                if k.lower().replace("ё", "е") == qn and isinstance(v, dict) and v.get("position"):
                    out.append(f"{Path(f).stem[5:]}:{v['position']}")
                    break
    return out


def build_digest(alerts: list[str]) -> str:
    lines = [f"Дата: {TODAY}", ""]
    if alerts:
        lines.append("АЛЕРТЫ СТОРОЖА:")
        lines += [f"  ⚠️ {a}" for a in alerts]
        lines.append("")
    lines.append("АГРЕГАТЫ (окно 7д; помни — состав окна плавает, это НЕ позиции):")
    for site in SITES:
        fs = _snap_files(site, 5)
        for src in ("yandex", "google", "bing"):
            row = []
            for f in fs[-3:]:
                a = _agg(_load(f), src)
                row.append(f"{Path(f).stem[5:]}={a['зпр']}зпр/{a['топ3']}т3/{a['клики']}клк" if a else f"{Path(f).stem[5:]}=—")
            lines.append(f"  {site}/{src}: " + "  ".join(row))
    lines.append("")
    lines.append("ЯКОРНЫЕ ВЧ (ряд позиций по дням — вот это реальный сигнал):")
    for site, q, src in ANCHORS:
        s = _anchor_series(site, q, src)
        lines.append(f"  [{site}/{src[0].upper()}] «{q}»: {' → '.join(s) if s else 'нет в окне (не значит упали)'}")
    # репутация
    reps = sorted(glob.glob(str(ROOT / "memory" / "reputation" / "*.json")))
    if len(reps) >= 2:
        old, new = _load(reps[max(0, len(reps) - 8)]), _load(reps[-1])
        lines.append("")
        lines.append("РЕПУТАЦИЯ (неделя назад → сейчас):")
        for k in new:
            if isinstance(new.get(k), dict) and "reviews" in new[k]:
                o = old.get(k, {})
                lines.append(f"  {k}: {o.get('rating','?')}★/{o.get('reviews','?')} → {new[k]['rating']}★/{new[k]['reviews']}")
    # созревающие гипотезы
    try:
        hyps = _load(ROOT / "carpathy" / "hypotheses.json")["hypotheses"]
        soon = [(h["id"], h["verify_due"]) for h in hyps
                if h.get("status") in ("pending", "observe", "proposed")
                and TODAY <= h.get("verify_due", "") <= (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")]
        if soon:
            lines.append("")
            lines.append("ГИПОТЕЗЫ СОЗРЕВАЮТ (3 дня): " + ", ".join(f"{i} ({d})" for i, d in soon))
    except Exception:
        pass
    return "\n".join(lines)


# ─────────────────────────── АГЕНТЫ ───────────────────────────

def run_claude(system_md: Path, digest: str) -> str:
    prompt = system_md.read_text(encoding="utf-8") + "\n\n# ДАННЫЕ\n\n" + digest
    env = {**os.environ}
    last = ""
    for attempt, delay in enumerate((0, 60, 300)):  # сеть утром бывает мёртвой пару минут
        if delay:
            import time
            time.sleep(delay)
        r = subprocess.run(
            [CLAUDE_BIN, "-p", prompt, "--model", MODEL],
            capture_output=True, text=True, timeout=TIMEOUT, env=env, cwd=str(ROOT / "swarm"),
        )
        if r.returncode == 0 and r.stdout.strip():
            return r.stdout.strip()
        last = (r.stderr or r.stdout)[:300]
    raise RuntimeError(f"claude после 3 попыток: {last}")


def notify(text: str):
    try:
        from telegram_notifier import send_long_message
        send_long_message(text)
    except Exception as e:
        print(f"[swarm] telegram недоступен: {e}")


def run_analyst():
    alerts = watchman()
    digest = build_digest(alerts)
    RUNS.mkdir(parents=True, exist_ok=True)
    try:
        out = run_claude(AGENTS / "analyst.md", digest)
    except Exception as e:
        notify(f"⚠️ РОЙ: Аналитик упал: {str(e)[:300]}\n\nАлерты сторожа:\n" + ("\n".join(alerts) or "нет"))
        raise
    (RUNS / f"{TODAY}-analyst.md").write_text(
        f"# Аналитик {TODAY}\n\n## Сводка\n\n{out}\n\n## Дайджест (вход)\n\n```\n{digest}\n```\n",
        encoding="utf-8")
    notify("🤖 Рой·Аналитик\n\n" + out)
    print(out)


def run_watchman():
    alerts = watchman()
    if alerts:
        notify("⚠️ РОЙ·Сторож:\n" + "\n".join(f"• {a}" for a in alerts))
    print("\n".join(alerts) if alerts else "всё чисто")


def run_digest():
    """Печатает дайджест в stdout — для Mr.Seo chat-бэкенда и отладки."""
    print(build_digest(watchman()))


def run_chat():
    """Mr.Seo Chat: вопрос из stdin → ответ в stdout (зовётся из mrseo /api/chat)."""
    question = sys.stdin.read().strip()
    if not question:
        print("Задай вопрос о своём SEO — отвечу по свежим данным.")
        return
    digest = build_digest(watchman())
    out = run_claude(AGENTS / "chat.md", digest + f"\n\n# ВОПРОС ПОЛЬЗОВАТЕЛЯ\n\n{question}")
    print(out)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "analyst"
    {"analyst": run_analyst, "watchman": run_watchman,
     "digest": run_digest, "chat": run_chat}[cmd]()
