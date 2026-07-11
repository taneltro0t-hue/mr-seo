"""
github_scanner — еженедельный мониторинг новых SEO/GEO/AEO-инструментов на GitHub.

Закрывает дыру: новый инструмент выходит → мы узнаём через месяц (вручную дёргая Ищейку).
Сканер тянет trending-репозитории по нашим темам, дедупит против sources_db.json
(где уже 240 github-URL), новое пишет в findings + кандидаты для Ищейки.

Дедуп — по URL репозитория против knowledge_research/sources/sources_db.json.
Свежесть — pushed за последние SINCE_DAYS, звёзды >= MIN_STARS.

Запуск: venv/bin/python carpathy/github_scanner.py
Cron: еженедельно (воскресенье), рядом с explorer.
GitHub API без токена = 10 req/min (хватает). С GITHUB_TOKEN в .env — 30 req/min.
"""
import json
import os
from datetime import datetime, timedelta
from pathlib import Path

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
TODAY = datetime.now().strftime("%Y-%m-%d")
SOURCES_DB = ROOT / "knowledge_research" / "sources" / "sources_db.json"
FINDINGS_DIR = ROOT / "knowledge_research" / "findings" / TODAY

MIN_STARS = 25
MAX_STARS = 40000  # отсечь мега-листы/фреймворки (awesome, transformers) — не нишевые инструменты
SINCE_DAYS = 120  # репо, обновлённые за последние N дней
QUERIES = [
    "generative engine optimization",
    "answer engine optimization",
    "llm citation seo",
    "geo optimization ai search",
    "seo tool claude skill",
    "ai search visibility tracker",
    "yandex seo tool",
]
# репо релевантно только если name/desc содержит наш домен-термин (отсекает awesome/llama.cpp)
RELEVANT = ("seo", "geo ", "geo-", "aeo", "answer engine", "generative engine",
            "search optimization", "serp", "llm citation", "ai search", "ai visibility",
            "schema markup", "structured data", "yandex", "google search console", "gsc")
NOISE = ("awesome-", "awesome ", "free-for-dev", "public-apis", "framework for", "inference")


def existing_urls() -> set:
    if not SOURCES_DB.exists():
        return set()
    db = json.loads(SOURCES_DB.read_text(encoding="utf-8"))
    out = set()
    for s in db.get("sources", []):
        u = s.get("url", "").rstrip("/").lower()
        if u:
            out.add(u)
    return out


def search_github(query: str, since: str) -> list:
    tok = os.getenv("GITHUB_TOKEN")
    h = {"Accept": "application/vnd.github+json"}
    if tok:
        h["Authorization"] = f"Bearer {tok}"
    q = f"{query} in:name,description,readme pushed:>{since} stars:>={MIN_STARS}"
    url = "https://api.github.com/search/repositories"
    try:
        r = requests.get(url, headers=h, params={"q": q, "sort": "updated", "order": "desc", "per_page": 30}, timeout=25)
        r.raise_for_status()
        return r.json().get("items", [])
    except Exception as e:
        print(f"  ⚠ '{query[:30]}': {str(e)[:80]}")
        return []


def run() -> dict:
    seen = existing_urls()
    since = (datetime.now() - timedelta(days=SINCE_DAYS)).strftime("%Y-%m-%d")
    found, new = {}, []
    for q in QUERIES:
        for it in search_github(q, since):
            full = it.get("full_name", "")
            html = it.get("html_url", "")
            if not html or html in found:
                continue
            stars = it.get("stargazers_count", 0)
            blob = f"{full} {it.get('description') or ''}".lower()
            # фильтр: в нише + не мега-репо + не шум
            if stars > MAX_STARS or any(n in blob for n in NOISE) or not any(r in blob for r in RELEVANT):
                continue
            found[html] = it
            if html.rstrip("/").lower() not in seen:
                new.append({
                    "url": html,
                    "name": full,
                    "stars": it.get("stargazers_count", 0),
                    "desc": (it.get("description") or "")[:200],
                    "pushed": it.get("pushed_at", "")[:10],
                    "lang": it.get("language") or "",
                    "matched_query": q,
                })
    # дедуп new по url, сорт по звёздам
    uniq = {x["url"]: x for x in new}
    new = sorted(uniq.values(), key=lambda x: -x["stars"])
    return {"scanned": len(found), "new": new}


def save(result: dict):
    new = result["new"]
    if not new:
        return None
    FINDINGS_DIR.mkdir(parents=True, exist_ok=True)
    f = FINDINGS_DIR / "github_scanner.md"
    lines = [
        f"# GitHub auto-scanner — {TODAY}",
        f"\nНовых репозиториев (не в sources_db): **{len(new)}** из {result['scanned']} просканированных.",
        f"Фильтр: звёзды ≥ {MIN_STARS}, pushed за {SINCE_DAYS} дней.\n",
        "| ⭐ | Репозиторий | Язык | Push | Описание | Запрос |",
        "|---|---|---|---|---|---|",
    ]
    for x in new:
        d = x["desc"].replace("|", "\\|")
        lines.append(f"| {x['stars']} | [{x['name']}]({x['url']}) | {x['lang']} | {x['pushed']} | {d} | {x['matched_query'][:20]} |")
    lines.append("\n> Кандидаты для разбора Ищейкой. APPLY/WATCH/SKIP — после verify-against-reality (не дублирует ли graveyard, реально ли решает нашу задачу).")
    f.write_text("\n".join(lines), encoding="utf-8")

    # добавить в sources_db чтобы не повторять
    db = json.loads(SOURCES_DB.read_text(encoding="utf-8"))
    now = datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")
    for x in new:
        db["sources"].append({"url": x["url"], "fetched_at": now, "title": x["name"],
                              "source": "github_scanner", "stars": x["stars"]})
    db["_meta"]["updated_at"] = TODAY
    SOURCES_DB.write_text(json.dumps(db, ensure_ascii=False, indent=2), encoding="utf-8")
    return f


if __name__ == "__main__":
    print(f"github_scanner {TODAY}: сканирую {len(QUERIES)} тем...")
    res = run()
    f = save(res)
    print(f"  просканировано: {res['scanned']}  |  новых: {len(res['new'])}")
    for x in res["new"][:10]:
        print(f"    ⭐{x['stars']:>5}  {x['name']}  — {x['desc'][:60]}")
    if f:
        print(f"  → {f.relative_to(ROOT)}")
