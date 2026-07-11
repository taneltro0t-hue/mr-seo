"""
swarm/insights — рабочие инсайты Mr.Seo (не обвязка): что конкретно дожимать.

Команды (stdout=JSON):
  quick_wins <site>   — запросы на пороге топа (поз 4-15): дожать = быстрый трафик.
                        Google (GSC SA, 7д) + Яндекс (query_analytics: спрос+URL).
  query_page <site>   — матрица запрос↔страница: какая страница ранжируется
                        по какому запросу (Google dims query+page; Яндекс из qa.url).
  reviews             — отзывы по всем точкам: рейтинг/число/дельта 7д + ссылки
                        «читать» (Я.Карты) и «ответить» (Я.Бизнес).

Запуск: venv/bin/python swarm/insights.py quick_wins mysite
"""
import glob
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

GSC_SITES = {
    "mysite": "https://example.com/",
    "demo2": "https://example.org/",
    "demo3": "sc-domain:example.net",
}

MAPS_ORG = {  # из carpathy/reputation_tracker.py
    "mysite_point": ("Демо-бренд · Столица", "000000000"),
    "mysite_point": ("Демо-бренд · Город", "000000000"),
    "demo2": ("Демо-бренд · Город", "000000000"),
}


def _gsc_rows(site: str, dims: list[str], days: int = 7, limit: int = 1000):
    from gsc_client import get_service
    svc = get_service()
    end = datetime.now().strftime("%Y-%m-%d")
    start = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    r = svc.searchanalytics().query(siteUrl=GSC_SITES[site], body={
        "startDate": start, "endDate": end, "dimensions": dims, "rowLimit": limit}).execute()
    return r.get("rows", [])


def _last_qa(site: str) -> dict:
    fs = sorted(glob.glob(str(ROOT / "memory" / site / "query_analytics" / "*.json")))
    return json.loads(Path(fs[-1]).read_text(encoding="utf-8")) if fs else {}


def quick_wins(site: str) -> dict:
    out = []
    # Google: позиции 4-15 с показами — дожать до топ-3
    try:
        for r in _gsc_rows(site, ["query"]):
            pos, imp = r.get("position", 99), r.get("impressions", 0)
            if 4 <= pos <= 15 and imp >= 3:
                out.append({"query": r["keys"][0], "src": "google", "position": round(pos, 1),
                            "impressions": imp, "clicks": r.get("clicks", 0), "demand": None, "url": None})
    except Exception as e:
        out.append({"error": f"gsc: {str(e)[:120]}"})
    # Яндекс: из query_analytics — спрос + какая страница ранжируется
    qa = _last_qa(site)
    for q, v in qa.items():
        if not isinstance(v, dict):
            continue
        pos, dem = v.get("position", 0), v.get("demand", 0)
        if 4 <= pos <= 15 and dem >= 3:
            out.append({"query": q, "src": "yandex", "position": pos,
                        "impressions": v.get("impressions", 0), "clicks": v.get("clicks", 0),
                        "demand": dem, "url": v.get("url") or None})
    wins = [x for x in out if "error" not in x]
    wins.sort(key=lambda x: -(x.get("demand") or x.get("impressions") or 0))
    errs = [x["error"] for x in out if "error" in x]
    return {"site": site, "count": len(wins), "wins": wins[:20], "errors": errs,
            "note": "запросы на пороге топа: правка страницы/перелинковка/переобход = быстрый прирост"}


def query_page(site: str) -> dict:
    pages: dict[str, list] = {}
    try:
        for r in _gsc_rows(site, ["query", "page"], limit=500):
            q, page = r["keys"][0], r["keys"][1]
            pages.setdefault(page, []).append({"query": q, "src": "google",
                                               "position": round(r.get("position", 0), 1),
                                               "impressions": r.get("impressions", 0)})
    except Exception:
        pass
    for q, v in _last_qa(site).items():
        if isinstance(v, dict) and v.get("url"):
            pages.setdefault(v["url"], []).append({"query": q, "src": "yandex",
                                                   "position": v.get("position", 0),
                                                   "demand": v.get("demand", 0)})
    ranked = sorted(pages.items(),
                    key=lambda kv: -sum(x.get("impressions", 0) + (x.get("demand") or 0) for x in kv[1]))
    return {"site": site, "pages": [
        {"page": p, "queries": sorted(qs, key=lambda x: x["position"])[:8], "total_queries": len(qs)}
        for p, qs in ranked[:12]]}


def reviews() -> dict:
    files = sorted(glob.glob(str(ROOT / "memory" / "reputation" / "*.json")))
    if not files:
        return {"error": "нет данных репутации"}
    now = json.loads(Path(files[-1]).read_text(encoding="utf-8"))
    week = json.loads(Path(files[max(0, len(files) - 8)]).read_text(encoding="utf-8"))
    out = []
    for key, (label, org) in MAPS_ORG.items():
        cur, old = now.get(key, {}), week.get(key, {})
        if not isinstance(cur, dict) or "reviews" not in cur:
            continue
        delta = cur["reviews"] - old.get("reviews", cur["reviews"])
        sprav = {"mysite_point": "000000000", "mysite_point": "000000000"}.get(key)
        out.append({
            "key": key, "label": label,
            "rating": cur.get("rating"), "reviews": cur["reviews"], "new_7d": delta,
            "read_url": f"https://yandex.ru/maps/org/{org}/reviews/",
            "reply_url": f"https://yandex.ru/sprav/{sprav}/p/reviews" if sprav
                         else f"https://yandex.ru/maps/org/{org}/reviews/",
        })
    return {"date": now.get("date"), "points": out,
            "note": "Свежие отзывы стоит читать и отвечать — активность владельца усиливает карточку в Я.Картах"}


def cannibalization(site: str) -> dict:
    """Запросы, по которым конкурируют НЕСКОЛЬКО наших страниц (Google, 28д).
    Каннибализация размывает релевантность — выбрать главную и слить сигналы."""
    by_q: dict[str, list] = {}
    for r in _gsc_rows(site, ["query", "page"], days=28, limit=2000):
        q, page = r["keys"][0], r["keys"][1]
        if r.get("impressions", 0) >= 2:
            by_q.setdefault(q, []).append({"page": page, "position": round(r.get("position", 0), 1),
                                           "impressions": r.get("impressions", 0)})
    conflicts = []
    for q, pages in by_q.items():
        if len(pages) >= 2:
            pages.sort(key=lambda x: x["position"])
            conflicts.append({"query": q, "pages": pages[:4],
                              "total_impressions": sum(p["impressions"] for p in pages)})
    conflicts.sort(key=lambda x: -x["total_impressions"])
    return {"site": site, "count": len(conflicts), "conflicts": conflicts[:12],
            "note": "две страницы на один запрос делят сигналы: главную усилить, со второй — ссылку/canonical на главную"}


def decay(site: str) -> dict:
    """Угасание: запросы, потерявшие позиции за 28д vs предыдущие 28д (Google)."""
    from gsc_client import get_service
    svc = get_service()

    def rows(start_off, end_off):
        end = (datetime.now() - timedelta(days=end_off)).strftime("%Y-%m-%d")
        start = (datetime.now() - timedelta(days=start_off)).strftime("%Y-%m-%d")
        r = svc.searchanalytics().query(siteUrl=GSC_SITES[site], body={
            "startDate": start, "endDate": end, "dimensions": ["query"], "rowLimit": 1000}).execute()
        return {x["keys"][0]: x for x in r.get("rows", [])}

    cur, prev = rows(28, 0), rows(56, 28)
    losing = []
    for q, c in cur.items():
        p = prev.get(q)
        if not p or p.get("impressions", 0) < 3:
            continue
        dpos = round(c.get("position", 0) - p.get("position", 0), 1)
        if dpos >= 2 and c.get("position", 99) <= 30:
            losing.append({"query": q, "was": round(p["position"], 1), "now": round(c["position"], 1),
                           "drop": dpos, "impressions": c.get("impressions", 0)})
    losing.sort(key=lambda x: -(x["drop"] * max(x["impressions"], 1)))
    return {"site": site, "count": len(losing), "losing": losing[:12],
            "note": "позиции тают 28д к 28д: страницу освежить (дата, контент, перелинковка) и на переобход"}


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "reviews"
    if cmd == "quick_wins":
        print(json.dumps(quick_wins(sys.argv[2]), ensure_ascii=False))
    elif cmd == "query_page":
        print(json.dumps(query_page(sys.argv[2]), ensure_ascii=False))
    elif cmd == "reviews":
        print(json.dumps(reviews(), ensure_ascii=False))
    elif cmd == "cannibalization":
        print(json.dumps(cannibalization(sys.argv[2]), ensure_ascii=False))
    elif cmd == "decay":
        print(json.dumps(decay(sys.argv[2]), ensure_ascii=False))
    else:
        print(json.dumps({"error": f"неизвестная команда {cmd}"}))
