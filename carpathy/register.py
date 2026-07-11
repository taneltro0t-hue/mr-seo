"""
register — быстрая регистрация гипотезы из git-коммита сайта.

Закрывает дыру «коммит запушен, гипотезу забыли завести» (P1 аудита 2026-06-12).
Тянет из git message/дату, baseline — из последнего снапшота автоматически.

Примеры:
  venv/bin/python carpathy/register.py mysite abc1234 \
      --urls /page1 /page2 \
      --targets "запрос 1" "запрос 2" \
      --expected "⭐-сниппет за 14-21 день"

  venv/bin/python carpathy/register.py mysite HEAD --urls / --targets "ваш запрос"

Пути репозиториев берутся из REPO_PATHS ниже.
"""
import argparse
import json
import subprocess
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HYP_FILE = ROOT / "carpathy" / "hypotheses.json"
SNAP_DIR = ROOT / "memory"

# Пути к git-репозиториям ВАШИХ сайтов (ключ = site_key из sites_config.py)
REPO_PATHS = {
    # "mysite": "/path/to/site-repo",
}


def git(repo: str, *args) -> str:
    return subprocess.run(
        ["git", "-C", repo, *args], capture_output=True, text=True, check=True
    ).stdout.strip()


def baseline_from_snapshot(site: str, targets: list[str], date: str) -> dict:
    """Позиции таргетов из последнего снапшота <= date — фиксируем стартовую точку."""
    d = SNAP_DIR / site / "daily_snapshots"
    snap_file = None
    for f in sorted(d.glob("*.json")):
        if f.stem <= date:
            snap_file = f
    if not snap_file:
        return {"_note": "снапшотов до даты коммита нет"}
    snap = json.loads(snap_file.read_text(encoding="utf-8"))
    out = {"_snapshot": snap_file.stem}
    for q in targets:
        qn = q.lower().replace("ё", "е")
        for source in ("yandex", "google"):
            data = snap.get(source, {})
            if not isinstance(data, dict) or "error" in data:
                continue
            for k, v in data.items():
                if k.lower().replace("ё", "е") == qn and isinstance(v, dict) and "position" in v:
                    out[f"{q} [{source[0].upper()}]"] = v["position"]
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("site", choices=list(REPO_PATHS.keys()))
    ap.add_argument("commit", help="hash или HEAD")
    ap.add_argument("--urls", nargs="+", required=True)
    ap.add_argument("--targets", nargs="+", required=True, help="запросы из targets.json")
    ap.add_argument("--expected", default="", help="ожидаемый эффект")
    ap.add_argument("--days", type=int, default=14, help="verify-окно (дней)")
    args = ap.parse_args()

    repo = REPO_PATHS[args.site]
    sha = git(repo, "rev-parse", "--short", args.commit)
    subject = git(repo, "log", "-1", "--format=%s", sha)
    cdate = git(repo, "log", "-1", "--format=%cs", sha)

    hyp_id = f"h-{sha}"
    data = json.loads(HYP_FILE.read_text(encoding="utf-8"))
    if any(h["id"] == hyp_id for h in data["hypotheses"]):
        print(f"✗ {hyp_id} уже существует")
        return

    verify_due = (datetime.strptime(cdate, "%Y-%m-%d") + timedelta(days=args.days)).strftime("%Y-%m-%d")
    baseline = baseline_from_snapshot(args.site, args.targets, cdate)

    h = {
        "id": hyp_id,
        "commit": sha,
        "commit_date": cdate,
        "site": args.site,
        "urls": args.urls,
        "change": subject,
        "targets_moved": args.targets,
        "expected": args.expected or f"улучшение позиций по {len(args.targets)} таргетам за {args.days} дней",
        "baseline": baseline,
        "status": "pending",
        "verify_due": verify_due,
        "registered_by": "carpathy/register.py",
    }
    data["hypotheses"].append(h)
    HYP_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"✓ {hyp_id} зарегистрирована: {subject[:70]}")
    print(f"  site={args.site}  commit_date={cdate}  verify_due={verify_due}")
    print(f"  baseline: {json.dumps(baseline, ensure_ascii=False)[:200]}")


if __name__ == "__main__":
    main()
