"""
serp_check — независимая проверка РЕАЛЬНОЙ выдачи по PRIMARY ВЧ.

Зачем (аудит 2026-06-12 finding moscow-head-vch-unmeasurable):
Yandex Webmaster popular-queries API отдаёт скользящее окно по показам —
число запросов колеблется (101→64) без реальной потери позиций. SERP-чек
даёт второй независимый источник: видим себя в выдаче или нет, на какой позиции,
кто конкуренты. Канал — DuckDuckGo HTML (Bing-бэкенд, без captcha).
Бонус: это прямая проверка Bing-индексации (Bing = ось ChatGPT Search).

Лог: memory/serp/YYYY-MM-DD.json
Запуск: venv/bin/python carpathy/serp_check.py
        еженедельно из daily_scan (среда) → дельты позиций в Telegram
"""
import json
import sys
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "research"))
OUT_DIR = ROOT / "memory" / "serp"
OUT_DIR.mkdir(parents=True, exist_ok=True)
TODAY = datetime.now().strftime("%Y-%m-%d")

# PRIMARY ВЧ + ключевые коммерческие варианты по сайтам
CHECKS = {
    "mysite": {
        "domain": "example.com",
        "queries": [
            "студия звукозаписи столица",
            "студия звукозаписи город",
            "записать песню столица",
            "аренда студии звукозаписи столица",
            "сведение трека столица",
            "заказать съемку клипа столица",
        ],
    },
    "demo2": {
        "domain": "example.org",
        "queries": [
            "пример запроса",
            "ночной клуб город",
            "мальчишник город",
            "куда сходить вечером город",
        ],
    },
}


def run() -> dict:
    from ddg_serp import search
    snap = {"date": TODAY, "engine": "ddg/bing", "sites": {}}
    for site, cfg in CHECKS.items():
        dom = cfg["domain"]
        rows = {}
        for q in cfg["queries"]:
            try:
                res = search(q, max_results=20)
                ours = next((r for r in res if dom in r["domain"]), None)
                rows[q] = {
                    "pos": ours["position"] if ours else None,
                    "top5": [r["domain"] for r in res[:5]],
                }
            except Exception as e:
                rows[q] = {"error": str(e)[:120]}
            time.sleep(1.5)
        snap["sites"][site] = rows
    (OUT_DIR / f"{TODAY}.json").write_text(json.dumps(snap, ensure_ascii=False, indent=2))
    return snap


def deltas_vs_prev(snap: dict) -> list[str]:
    files = sorted(OUT_DIR.glob("*.json"))
    files = [f for f in files if f.stem < TODAY]
    if not files:
        return []
    prev = json.loads(files[-1].read_text())
    out = []
    for site, rows in snap["sites"].items():
        for q, cur in rows.items():
            pc = cur.get("pos")
            pp = prev.get("sites", {}).get(site, {}).get(q, {}).get("pos")
            if pc != pp:
                a = pp if pp else "нет"
                b = pc if pc else "нет"
                out.append(f"{CHECKS[site]['domain']} «{q}»: {a} → {b}")
    return out


if __name__ == "__main__":
    snap = run()
    print(f"SERP-чек {TODAY} (DDG/Bing):\n")
    for site, rows in snap["sites"].items():
        print(f"  {CHECKS[site]['domain']}:")
        for q, r in rows.items():
            if "error" in r:
                print(f"    ⚠ «{q}»: {r['error']}")
            elif r["pos"]:
                print(f"    🎯 #{r['pos']:<2} «{q}»")
            else:
                print(f"    —    «{q}»  (топ-5: {', '.join(r['top5'][:3])})")
    d = deltas_vs_prev(snap)
    if d:
        print("\nИзменения с прошлого чека:")
        for x in d:
            print(f"  {x}")
