"""
swarm/timeline — ROI-таймлайн: «Это дало результат».

Склеивает ЛЕНТУ СОБЫТИЙ (коммиты сайта, гипотезы carpathy, работы моста)
с РЯДАМИ ПОЗИЦИЙ якорных запросов по дням → UI рисует события на графике,
и глазами видно: правка → движение.

Команда: venv/bin/python swarm/timeline.py <site> [days=45]
Выход: {"series":{query:[{date,pos}]}, "events":[{date,type,title}]}
"""
import glob
import json
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from carpathy.register import REPO_PATHS

ANCHORS = {
    "mysite": [("студия звукозаписи город", "yandex"), ("сведение и мастеринг столица", "yandex"),
                 ("заказать съемку клипа в столица", "yandex")],
    "demo2": [("пример запроса", "yandex"), ("пример запроса", "google")],
    "demo3": [("реабилитационный центр город-2", "yandex"), ("кодировка минеральные воды", "yandex")],
}


def series(site: str, days: int) -> dict:
    out = {f"{q} [{s[0].upper()}]": [] for q, s in ANCHORS.get(site, [])}
    files = sorted(glob.glob(str(ROOT / "memory" / site / "daily_snapshots" / "*.json")))[-days:]
    for f in files:
        try:
            snap = json.loads(Path(f).read_text(encoding="utf-8"))
        except Exception:
            continue
        date = Path(f).stem
        for q, src in ANCHORS.get(site, []):
            d = snap.get(src, {})
            if not isinstance(d, dict):
                continue
            qn = q.lower().replace("ё", "е")
            for k, v in d.items():
                if k.lower().replace("ё", "е") == qn and isinstance(v, dict) and v.get("position"):
                    out[f"{q} [{src[0].upper()}]"].append({"date": date, "pos": v["position"]})
                    break
    return {k: v for k, v in out.items() if v}


def events(site: str, days: int) -> list:
    since = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    ev = []
    # 1) коммиты репозитория сайта (правки)
    repo = REPO_PATHS.get(site)
    if repo and Path(repo).exists():
        try:
            log = subprocess.run(["git", "-C", repo, "log", "--all", f"--since={since}",
                                  "--format=%cs|%s"], capture_output=True, text=True, timeout=20).stdout
            for ln in log.splitlines():
                date, _, subj = ln.partition("|")
                low = subj.lower()
                if any(t in low for t in ("seo", "mrseo", "blog", "бридж", "bridge", "статья", "llms")):
                    ev.append({"date": date, "type": "commit", "title": subj[:90]})
        except Exception:
            pass
    # 2) гипотезы carpathy
    try:
        hyps = json.loads((ROOT / "carpathy" / "hypotheses.json").read_text(encoding="utf-8"))["hypotheses"]
        for h in hyps:
            if site not in str(h.get("site", "")):
                continue
            cd = h.get("commit_date") or ""
            if cd >= since:
                ev.append({"date": cd, "type": "hypothesis",
                           "title": f"Гипотеза {h['id']}: {str(h.get('change',''))[:70]}", "status": h.get("status")})
            va = h.get("verified_at") or ""
            if va >= since and h.get("status") in ("confirmed", "falsified", "partial"):
                mark = {"confirmed": "✅ подтверждена", "falsified": "❌ провалена", "partial": "🟡 частично"}[h["status"]]
                ev.append({"date": va, "type": "verdict", "title": f"{h['id']} — {mark}", "status": h["status"]})
    except Exception:
        pass
    # 3) работы моста и воркера
    for f in glob.glob(str(ROOT / "swarm" / "runs" / "bridge-*.md")):
        stem = Path(f).stem  # bridge-YYYYMMDD-HHMM
        try:
            d = datetime.strptime(stem.split("-")[1], "%Y%m%d").strftime("%Y-%m-%d")
        except Exception:
            continue
        if d >= since:
            head = Path(f).read_text(encoding="utf-8").splitlines()
            task = next((ln.replace("**Задача:**", "").strip() for ln in head if ln.startswith("**Задача:**")), "")
            if site in Path(f).read_text(encoding="utf-8")[:200]:
                ev.append({"date": d, "type": "bridge", "title": f"Мост: {task[:80]}"})
    ev.sort(key=lambda x: x["date"], reverse=True)
    return ev[:60]


if __name__ == "__main__":
    site = sys.argv[1] if len(sys.argv) > 1 else "mysite"
    days = int(sys.argv[2]) if len(sys.argv) > 2 else 45
    print(json.dumps({"site": site, "days": days,
                      "series": series(site, days), "events": events(site, days)}, ensure_ascii=False))
