"""
Verify — проверяет статус гипотез в hypotheses.json.

Логика (v2, 2026-06-12 — после аудита, фикс ложных вердиктов на разреженных данных):
  - baseline = средневзвешенная (по показам) позиция за ОКНО 7 дней ДО commit_date
  - current  = средневзвешенная позиция за ПОСЛЕДНИЕ 7 дней
  - снапшоты с {'error': ...} в источнике игнорируются (None из-за error ≠ вылет из выдачи)
  - если по источнику в окне < MIN_COVERAGE валидных снапшотов, а baseline по нему был —
    источник исключается из сравнения (данных мало, вердикт не выносим)
  - «❌ dropped out» только если current-окно имеет достаточно валидных данных и запроса нет
  - после verify_due: все таргеты None→None = falsified (reason=no-entry) — изменение не дало входа
  - verify_method='manual' — скрипт пропускает, печатает чек-лист

Запуск: venv/bin/python carpathy/verify.py
        venv/bin/python carpathy/verify.py --apply   # обновляет JSON (только для созревших)
"""
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HYP_FILE = ROOT / "carpathy" / "hypotheses.json"
SNAP_DIR = ROOT / "memory"
TODAY = datetime.now().strftime("%Y-%m-%d")

WINDOW_DAYS = 7      # окно агрегации
MIN_COVERAGE = 3     # минимум валидных снапшотов источника в окне для вынесения вердикта


def _norm(q: str) -> str:
    return q.lower().strip().replace("ё", "е")


def snaps_in_window(site: str, end_date: str, days: int = WINDOW_DAYS) -> list[dict]:
    """Все снапшоты сайта за [end_date - days + 1 .. end_date]."""
    d = SNAP_DIR / site / "daily_snapshots"
    if not d.exists():
        return []
    end = datetime.strptime(end_date, "%Y-%m-%d")
    start = end - timedelta(days=days - 1)
    out = []
    for f in sorted(d.glob("*.json")):
        try:
            fd = datetime.strptime(f.stem, "%Y-%m-%d")
        except ValueError:
            continue
        if start <= fd <= end:
            try:
                out.append(json.loads(f.read_text(encoding="utf-8")))
            except Exception:
                continue
    return out


def source_valid(snap: dict, source: str) -> bool:
    data = snap.get(source)
    return isinstance(data, dict) and "error" not in data


def weighted_pos(snaps: list[dict], source: str, q: str) -> tuple[float | None, int]:
    """Средневзвешенная по показам позиция запроса в окне.
    Возвращает (позиция|None, число валидных снапшотов источника в окне)."""
    qn = _norm(q)
    num = 0.0
    den = 0.0
    valid = 0
    for snap in snaps:
        if not source_valid(snap, source):
            continue
        valid += 1
        data = snap[source]
        for k, v in data.items():
            if not isinstance(v, dict) or "position" not in v:
                continue
            if _norm(k) != qn:
                continue
            shows = v.get("impressions") or v.get("shows") or 1
            try:
                shows = max(float(shows), 1.0)
            except (TypeError, ValueError):
                shows = 1.0
            num += float(v["position"]) * shows
            den += shows
    return (round(num / den, 2) if den > 0 else None), valid


def verify_one(h: dict) -> dict:
    site = h["site"]
    targets = h.get("targets_moved", [])
    base_snaps = snaps_in_window(site, h["commit_date"])
    cur_snaps = snaps_in_window(site, TODAY)

    rows = []
    improved = entered = fell = skipped = 0
    none_to_none = 0
    total = len(targets)

    for q in targets:
        best_b, best_c = None, None
        for source in ("yandex", "google"):
            b, b_cov = weighted_pos(base_snaps, source, q)
            c, c_cov = weighted_pos(cur_snaps, source, q)
            # Источник участвует в сравнении только при достаточном покрытии current-окна.
            # Иначе None мог означать «нет данных», а не «вылетел».
            if b is not None and c is None and c_cov < MIN_COVERAGE:
                continue  # данных мало — источник не учитываем
            if b is not None and (best_b is None or b < best_b):
                best_b = b
            if c is not None and (best_c is None or c < best_c):
                best_c = c

        verdict = "·"
        if best_b is None and best_c is not None:
            verdict = "✨ entered"
            entered += 1
        elif best_b is not None and best_c is not None:
            delta = round(best_b - best_c, 2)
            if delta > 0.5:
                verdict = f"↑ +{delta}"
                improved += 1
            elif delta < -0.5:
                verdict = f"↓ {delta}"
                fell += 1
        elif best_b is not None and best_c is None:
            verdict = "❌ dropped out"
            fell += 1
        else:
            none_to_none += 1
        rows.append((q, best_b, best_c, verdict))

    positive = improved + entered
    new_status = "pending"
    reason = ""
    if total > 0 and none_to_none == total and TODAY >= h.get("verify_due", h["commit_date"]):
        # изменение не дало входа в выдачу за всё окно наблюдения
        new_status = "falsified"
        reason = "no-entry"
    elif positive >= total * 0.5 and total > 0:
        new_status = "confirmed"
    elif positive >= total * 0.25 and total > 0:
        new_status = "partial"
    elif fell > positive:
        new_status = "falsified"

    return {
        "rows": rows,
        "improved": improved,
        "entered": entered,
        "fell": fell,
        "none_to_none": none_to_none,
        "total": total,
        "new_status": new_status,
        "reason": reason,
        "base_coverage": len(base_snaps),
        "cur_coverage": len(cur_snaps),
    }


def main(apply_changes: bool = False):
    data = json.loads(HYP_FILE.read_text(encoding="utf-8"))
    for h in data["hypotheses"]:
        if h["status"] not in ("pending", "partial"):
            continue

        if h.get("verify_method") == "manual":
            print(f"\n{'='*70}")
            print(f"[manual] {h['id']} → ручная проверка, скрипт пропускает:")
            for item in h.get("verify_checklist", []):
                print(f"    ☐ {item}")
            continue

        due = h.get("verify_due", h["commit_date"])
        result = verify_one(h)
        early = TODAY < due
        marker = "[предварительно]" if early else "[проверка]"
        print(f"\n{'='*70}")
        print(f"{marker} {h['id']} ({h.get('commit','?')}, {h['commit_date']}) → {h['site']}")
        print(f"  due: {due}  |  today: {TODAY}  |  окно: {WINDOW_DAYS}д "
              f"(base: {result['base_coverage']} снапшотов, cur: {result['cur_coverage']})")
        print(f"  change: {h['change'][:90]}...")
        print(f"  ИТОГ: ↑{result['improved']} entered={result['entered']} ↓{result['fell']} "
              f"none→none={result['none_to_none']} / total={result['total']}")
        status_line = result["new_status"] + (f" ({result['reason']})" if result["reason"] else "")
        print(f"  предложение статуса: {status_line}")
        if result["rows"]:
            print(f"  detail:")
            for q, b, c, v in result["rows"]:
                bs = "—" if b is None else f"{b:g}"
                cs = "—" if c is None else f"{c:g}"
                print(f"    {v:18}  base={bs:>6} → cur={cs:>6}  | {q}")

        if apply_changes and not early and result["new_status"] != "pending":
            h["status"] = result["new_status"]
            h["verified_at"] = TODAY
            h["effect_summary"] = (
                f"improved={result['improved']}, entered={result['entered']}, "
                f"fell={result['fell']}, none_to_none={result['none_to_none']}, "
                f"total={result['total']}"
                + (f", reason={result['reason']}" if result["reason"] else "")
            )

    if apply_changes:
        HYP_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\n✓ hypotheses.json обновлён")


if __name__ == "__main__":
    apply = "--apply" in sys.argv
    main(apply_changes=apply)
