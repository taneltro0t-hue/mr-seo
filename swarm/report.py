"""
swarm/report — «Отчёт в 1 клик»: что сделано за период и что это дало.

Язык клиента: цифры-дельты + список работ + вывод. JSON для красивой
страницы в Mr.Seo (и markdown-версия в swarm/runs/ для отправки).

Команда: venv/bin/python swarm/report.py <site> [days=30]
"""
import glob
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from swarm.timeline import series, events  # переиспользуем ленту и ряды


def _agg_clicks(site: str, day_file: str) -> dict:
    try:
        snap = json.loads(Path(day_file).read_text(encoding="utf-8"))
    except Exception:
        return {}
    out = {}
    for src in ("yandex", "google"):
        d = snap.get(src, {})
        if isinstance(d, dict) and "error" not in d:
            qs = [v for v in d.values() if isinstance(v, dict) and v.get("position", 0) > 0]
            out[src] = {"клики7д": int(sum(v.get("clicks", 0) for v in qs)),
                        "топ10": sum(1 for v in qs if v["position"] <= 10)}
    return out


def report(site: str, days: int = 30) -> dict:
    files = sorted(glob.glob(str(ROOT / "memory" / site / "daily_snapshots" / "*.json")))
    if len(files) < 2:
        return {"error": "мало данных"}
    old_f = files[max(0, len(files) - days - 1)]
    then, now = _agg_clicks(site, old_f), _agg_clicks(site, files[-1])

    # якоря: первая и последняя точка ряда
    anchors = []
    for name, pts in series(site, days).items():
        if len(pts) >= 2:
            a, b = pts[0]["pos"], pts[-1]["pos"]
            anchors.append({"query": name, "was": a, "now": b, "delta": round(a - b, 1)})  # + = рост

    # работы за период (только видимые человеку типы)
    evs = [e for e in events(site, days) if e["type"] in ("commit", "bridge", "verdict")]

    # репутация
    reps = sorted(glob.glob(str(ROOT / "memory" / "reputation" / "*.json")))
    rep = {}
    if len(reps) >= 2:
        n = json.loads(Path(reps[-1]).read_text(encoding="utf-8"))
        o = json.loads(Path(reps[max(0, len(reps) - days)]).read_text(encoding="utf-8"))
        for k, v in n.items():
            if isinstance(v, dict) and "reviews" in v and k.startswith(site.split("_")[0][:4]) or k == site:
                pass
        for k, v in n.items():
            if isinstance(v, dict) and "reviews" in v and (k == site or k.startswith(site + "_")):
                ov = o.get(k, {})
                rep[k] = {"rating": v.get("rating"), "reviews": v["reviews"],
                          "new": v["reviews"] - ov.get("reviews", v["reviews"])}

    # ИКС
    sqi = None
    try:
        from swarm.yandex_webmaster import sqi as _sqi
        s = _sqi(site)
        sqi = {"current": s.get("current"), "delta": s.get("delta_period")}
    except Exception:
        pass

    grown = [a for a in anchors if a["delta"] > 0.5]
    verdict = ("Позиции растут — работа двигает график." if len(grown) >= max(1, len(anchors) // 2)
               else "Период рабочий: часть запросов растёт, часть держится — продолжаем по плану.")

    data = {"site": site, "period_days": days,
            "generated": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "clicks": {"was": then, "now": now},
            "anchors": anchors, "works": evs[:25], "works_total": len(evs),
            "reputation": rep, "sqi": sqi, "verdict": verdict}

    # markdown-версия для отправки
    md = [f"# Отчёт {site} · {days} дней · {data['generated']}", "", f"**Вывод:** {verdict}", "", "## Позиции (ключевые запросы)"]
    for a in anchors:
        arrow = "▲" if a["delta"] > 0 else ("▼" if a["delta"] < 0 else "•")
        md.append(f"- {arrow} {a['query']}: {a['was']} → {a['now']}")
    md += ["", f"## Сделано работ: {len(evs)}"] + [f"- {e['date']} · {e['title']}" for e in evs[:20]]
    p = ROOT / "swarm" / "runs" / f"report-{site}-{datetime.now().strftime('%Y%m%d')}.md"
    p.write_text("\n".join(md), encoding="utf-8")
    data["md_path"] = f"swarm/runs/{p.name}"
    return data


if __name__ == "__main__":
    site = sys.argv[1] if len(sys.argv) > 1 else "mysite"
    days = int(sys.argv[2]) if len(sys.argv) > 2 else 30
    print(json.dumps(report(site, days), ensure_ascii=False))
