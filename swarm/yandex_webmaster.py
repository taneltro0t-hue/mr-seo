"""
swarm/yandex_webmaster — волна 2 эволюции: порт ценных эндпоинтов Вебмастер API v4
(по ECOSYSTEM_TOOLS: донор-референс yandex-webmaster-mcp/Crash-SV, 34-37 tools).

Команды (stdout=JSON):
  excluded <site>   — страницы, ВЫПАВШИЕ из поиска (события REMOVED с причинами!)
                      + появившиеся. Наша боль: Яндекс тихо удаляет МПК-страницы.
  sqi <site>        — история ИКС (индекс качества сайта).
  links <site>      — внешние ссылки: свежие доноры (кто сослался).

Запуск: venv/bin/python swarm/yandex_webmaster.py excluded mysite
"""
import json
import os
import sys
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import requests
from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

API = "https://api.webmaster.yandex.net/v4"


def _call(path: str, params: dict | None = None):
    uid = os.getenv("YANDEX_USER_ID")
    r = requests.get(f"{API}/user/{uid}{path}",
                     headers={"Authorization": f"OAuth {os.getenv('YANDEX_OAUTH_TOKEN')}"},
                     params=params or {}, timeout=25)
    if r.status_code != 200:
        raise RuntimeError(f"HTTP {r.status_code}: {r.text[:150]}")
    return r.json()


def _host(site: str) -> str:
    from sites_config import SITES
    h = SITES.get(site, {}).get("yandex_host_id")
    if not h:
        raise RuntimeError(f"нет yandex_host_id для {site}")
    return quote(h, safe="")


def excluded(site: str) -> dict:
    """События поиска: REMOVED (с причиной) и APPEARED. Лимит 100 свежих."""
    he = _host(site)
    d = _call(f"/hosts/{he}/search-urls/events/samples", {"limit": 100})
    removed, appeared = [], []
    for s in d.get("samples", []):
        item = {"url": s.get("url"), "date": s.get("event_date", "")[:10]}
        ev = s.get("event", "")
        if ev == "REMOVED_FROM_SEARCH":
            item["reason"] = s.get("excluded_url_status", "?")
            removed.append(item)
        elif ev == "APPEARED_IN_SEARCH":
            appeared.append(item)
    # человеческие причины
    RU = {"LOW_DEMAND": "малый спрос (МПК)", "DUPLICATE": "дубль", "REDIRECT_NOTSEARCHABLE": "редирект",
          "NOT_CANONICAL": "неканоническая", "HOST_ERROR": "ошибка хоста", "PARSER_ERROR": "ошибка разбора",
          "INDEXING_PROHIBITED_BY_META_TAG": "noindex", "CLEAN_PARAMS": "clean-param", "OTHER": "прочее", "LOW_QUALITY": "низкое качество (МПК!)", "NOTHING_FOUND": "страница не найдена (404)"}
    for x in removed:
        x["reason_ru"] = RU.get(x["reason"], x["reason"])
    return {"site": site, "removed": removed[:40], "appeared": appeared[:20],
            "removed_count": len(removed), "appeared_count": len(appeared),
            "note": "REMOVED с причиной «малый спрос» = МПК-фильтр: страницу усилить контентом или склеить (урок L-006)"}


def sqi(site: str) -> dict:
    he = _host(site)
    d = _call(f"/hosts/{he}/sqi-history")
    pts = [{"date": p.get("date", "")[:10], "value": p.get("value")} for p in d.get("points", [])]
    delta = (pts[-1]["value"] - pts[0]["value"]) if len(pts) >= 2 else 0
    return {"site": site, "current": pts[-1]["value"] if pts else None,
            "delta_period": delta, "history": pts[-24:]}


def links(site: str) -> dict:
    he = _host(site)
    hist = _call(f"/hosts/{he}/links/external/history", {"indicator": "LINKS_TOTAL_COUNT"})
    pts = []
    for ind in hist.get("indicators", {}).get("LINKS_TOTAL_COUNT", []):
        pts.append({"date": ind.get("date", "")[:10], "total": ind.get("value")})
    samples = _call(f"/hosts/{he}/links/external/samples", {"limit": 30})
    donors = [{"source": s.get("source_url"), "dest": s.get("destination_url"),
               "discovered": (s.get("discovery_date") or "")[:10]}
              for s in samples.get("links", [])]
    donors.sort(key=lambda x: x["discovered"], reverse=True)
    return {"site": site, "total_history": pts[-12:], "fresh_donors": donors[:15],
            "note": "свежие доноры — проверять руками: мусорные ссылки в Яндексе лучше не наращивать"}


if __name__ == "__main__":
    cmd, site = (sys.argv[1] if len(sys.argv) > 1 else ""), (sys.argv[2] if len(sys.argv) > 2 else "")
    try:
        fn = {"excluded": excluded, "sqi": sqi, "links": links}[cmd]
        print(json.dumps(fn(site), ensure_ascii=False))
    except KeyError:
        print(json.dumps({"error": "команды: excluded|sqi|links <site>"}))
    except Exception as e:
        print(json.dumps({"error": str(e)[:200]}, ensure_ascii=False))
