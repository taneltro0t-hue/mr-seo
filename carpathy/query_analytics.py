"""
query_analytics — точные метрики Яндекс.Вебмастера (per-query временные ряды).

Зачем (vs search-queries/popular в daily_scan):
- popular отдаёт СКОЛЬЗЯЩЕЕ ОКНО топ-запросов → состав плавает день ко дню,
  даёт ложные «просадки» (101→64→125 запросов без реального движения позиций).
- query-analytics/list даёт ВРЕМЕННЫЕ РЯДЫ по конкретному запросу: POSITION,
  CLICKS, CTR, IMPRESSIONS, DEMAND по датам + URL, который ранжируется.
  → стабильное отслеживание конкретного таргета + CTR по страницам + объём спроса.

Лог: memory/{site}/query_analytics/YYYY-MM-DD.json
Запуск: venv/bin/python carpathy/query_analytics.py
        + еженедельно из daily_scan (среда, рядом с serp_check)
"""
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import quote

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
TODAY = datetime.now().strftime("%Y-%m-%d")

# те же site_key → host_id, что в sites_config
sys.path.insert(0, str(ROOT))
try:
    from sites_config import SITES
except Exception:
    SITES = {}


def fetch(site_key: str, limit: int = 300) -> dict:
    """Per-query метрики с временными рядами. Возвращает {query: {...последние значения + series}}."""
    tok = os.getenv("YANDEX_OAUTH_TOKEN")
    uid = os.getenv("YANDEX_USER_ID")
    if not tok or not uid:
        return {"error": "YANDEX_OAUTH_TOKEN/YANDEX_USER_ID не заданы"}
    info = SITES.get(site_key, {})
    host_id = info.get("yandex_host_id")
    if not host_id:
        return {"error": f"нет yandex_host_id для {site_key}"}

    he = quote(host_id, safe="")
    url = f"https://api.webmaster.yandex.net/v4/user/{uid}/hosts/{he}/query-analytics/list"
    h = {"Authorization": f"OAuth {tok}", "Content-Type": "application/json"}

    out = {}
    offset = 0
    page = 100
    try:
        while offset < limit:
            body = {"offset": offset, "limit": min(page, limit - offset),
                    "device_type_indicator": "ALL", "text_indicator": "QUERY"}
            r = requests.post(url, headers=h, json=body, timeout=25)
            r.raise_for_status()
            data = r.json()
            items = data.get("text_indicator_to_statistics", [])
            if not items:
                break
            for it in items:
                q = it.get("text_indicator", {}).get("value", "")
                if not q:
                    continue
                page_url = it.get("popular_complementary_indicator", {}).get("value", "")
                # собрать по датам: {date: {field: value}}
                by_date = {}
                for s in it.get("statistics", []):
                    by_date.setdefault(s["date"], {})[s["field"]] = s["value"]
                if not by_date:
                    continue
                last_date = max(by_date)
                last = by_date[last_date]
                out[q] = {
                    "url": page_url,
                    "position": round(float(last.get("POSITION", 0) or 0), 2),
                    "clicks": int(last.get("CLICKS", 0) or 0),
                    "ctr": round(float(last.get("CTR", 0) or 0), 2),
                    "impressions": int(last.get("IMPRESSIONS", 0) or 0),
                    "demand": int(last.get("DEMAND", 0) or 0),  # объём спроса в Яндексе
                    "last_date": last_date,
                    # компактный ряд позиции для тренда
                    "position_series": {d: round(float(v.get("POSITION", 0) or 0), 2)
                                        for d, v in sorted(by_date.items()) if v.get("POSITION")},
                }
            if len(items) < page:
                break
            offset += page
        return out
    except Exception as e:
        return {"error": str(e)[:200]}


def save(site_key: str, data: dict):
    d = ROOT / "memory" / site_key / "query_analytics"
    d.mkdir(parents=True, exist_ok=True)
    (d / f"{TODAY}.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def run(site_keys: list[str] | None = None) -> dict:
    """Снимок query-analytics по сайтам. Пропускает paused."""
    keys = site_keys or [k for k in SITES if not SITES[k].get("paused")]
    summary = {}
    for sk in keys:
        data = fetch(sk)
        if "error" in data:
            summary[sk] = {"error": data["error"]}
            continue
        save(sk, data)
        # CTR-проблемы: позиция топ-10, показы >20, CTR 0 — точки для CTR-фиксов
        ctr_gaps = [(q, v) for q, v in data.items()
                    if 0 < v["position"] <= 10 and v["impressions"] >= 20 and v["ctr"] == 0]
        summary[sk] = {"queries": len(data), "ctr_gaps": len(ctr_gaps),
                       "ctr_gap_examples": [q for q, _ in sorted(ctr_gaps, key=lambda x: -x[1]["impressions"])[:3]]}
    return summary


if __name__ == "__main__":
    s = run()
    print(f"query-analytics {TODAY}:")
    for sk, info in s.items():
        if "error" in info:
            print(f"  {sk}: ⚠ {info['error']}")
        else:
            print(f"  {sk}: {info['queries']} запросов, CTR-gaps={info['ctr_gaps']}")
            for q in info["ctr_gap_examples"]:
                print(f"      🎯 CTR=0 при показах: «{q}»")
