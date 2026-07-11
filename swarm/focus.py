"""
swarm/focus — «Фокус недели»: мозг читает ВСЁ и выбирает 3 дела максимального ROI.

Против превращения в комбайн-Semrush: не 40 строк на 6 панелях, а три дела
с обоснованием. Кладёт swarm/runs/focus-<ISO-неделя>.json — /api/focus отдаёт
кеш недели мгновенно.

Запуск: venv/bin/python swarm/focus.py [--force]
Cron:   понедельник 10:10 (после ai_visibility), com.mrseo.seo-focus.
"""
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

CLAUDE_BIN = os.path.expanduser("~/.npm-global/bin/claude")
RUNS = ROOT / "swarm" / "runs"
WEEK = datetime.now().strftime("%G-W%V")
OUT = RUNS / f"focus-{WEEK}.json"

SITES = ["mysite", "demo2", "demo3"]


def collect() -> str:
    """Компактная выжимка всех инсайтов для мозга."""
    from swarm.insights import quick_wins, cannibalization, decay, reviews
    from swarm.yandex_webmaster import excluded, sqi
    from swarm.orchestrator import build_digest, watchman

    parts = [build_digest(watchman())]
    for s in SITES:
        try:
            qw = quick_wins(s)
            parts.append(f"\nQUICK WINS {s}: " + "; ".join(
                f"«{w['query']}» поз{w['position']} спрос{w.get('demand') or w['impressions']}"
                for w in qw["wins"][:6]))
        except Exception:
            pass
        for fn, tag in ((cannibalization, "КАННИБАЛИЗАЦИЯ"), (decay, "УГАСАНИЕ")):
            try:
                d = fn(s)
                key = "conflicts" if "conflicts" in d else "losing"
                if d.get("count"):
                    parts.append(f"{tag} {s} ({d['count']}): " + "; ".join(
                        str(x.get("query", ""))[:40] for x in d[key][:4]))
            except Exception:
                pass
        try:
            ex = excluded(s)
            mpk = [x for x in ex["removed"] if "МПК" in x.get("reason_ru", "") or "качество" in x.get("reason_ru", "")]
            if mpk:
                parts.append(f"ВЫПАЛИ (МПК) {s}: " + "; ".join(x["url"].split("/")[-1] or x["url"] for x in mpk[:5]))
        except Exception:
            pass
    try:
        rv = reviews()
        fresh = [p for p in rv.get("points", []) if p.get("new_7d", 0) > 0]
        if fresh:
            parts.append("СВЕЖИЕ ОТЗЫВЫ: " + "; ".join(f"{p['label']} +{p['new_7d']}" for p in fresh))
    except Exception:
        pass
    return "\n".join(parts)


PROMPT = """Ты — Mr.Seo, главный SEO-стратег трёх проектов. Ниже — все данные недели.
Выбери РОВНО ТРИ дела с максимальной отдачей на ближайшую неделю. Правила выбора:
- ROI прежде всего: спрос × близость к топу × усилие. Учитывай уроки: CTR-правки вне топ-10 бесполезны; on-page для головы Столица не работает (нужен off-page: DTF-рейтинг); Город двигается репутацией.
- Не дублируй уже идущее (verify зреет сам). Дела должны быть РАЗНЫЕ (не три про один сайт).
- Каждое дело: для кого (сайт), что сделать (конкретно), почему сейчас (цифры из данных), кто делает (рой сам / человек).

Выведи СТРОГО JSON без обёрток:
{"focus":[{"site":"...","title":"...","why":"...","action":"[фокус site] <задача для роя или пометь ЧЕЛОВЕК: ...>","executor":"рой"|"человек"}]}"""


def run(force: bool = False) -> dict:
    if OUT.exists() and not force:
        return json.loads(OUT.read_text(encoding="utf-8"))
    digest = collect()
    r = subprocess.run([CLAUDE_BIN, "-p", PROMPT + "\n\n# ДАННЫЕ\n" + digest, "--model", "sonnet"],
                       capture_output=True, text=True, timeout=480, cwd=str(ROOT))
    raw = r.stdout.strip()
    start, end = raw.find("{"), raw.rfind("}")
    data = json.loads(raw[start:end + 1])
    data["week"] = WEEK
    data["generated"] = datetime.now().strftime("%Y-%m-%d %H:%M")
    RUNS.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    try:
        from telegram_notifier import send_long_message
        send_long_message(f"🎯 Фокус недели {WEEK}:\n" + "\n".join(
            f"{i+1}. [{f['site']}] {f['title']} — {f['why'][:100]}" for i, f in enumerate(data["focus"])))
    except Exception:
        pass
    return data


if __name__ == "__main__":
    print(json.dumps(run("--force" in sys.argv), ensure_ascii=False))
