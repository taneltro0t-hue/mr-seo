"""
swarm/merge_watch — замыкание петли: merge правки моста → авто-гипотеза.

Сканирует main сайтовых репо на новые mrseo-bridge коммиты, которых ещё нет
в hypotheses.json → регистрирует гипотезу (baseline из снапшота, verify 14д).
Итог: каждая смерженная правка автоматически станет экспериментом, и через
2 недели её вердикт появится на ROI-таймлайне.

Вызывается из queue_worker (2ч цикл) или вручную.
"""
import json
import re
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from carpathy.register import REPO_PATHS, baseline_from_snapshot

HYP = ROOT / "carpathy" / "hypotheses.json"

# якоря по умолчанию, если из текста коммита запрос не извлёкся
DEFAULT_TARGETS = {
    "mysite": ["студия звукозаписи город", "сведение и мастеринг столица"],
    "demo2": ["пример запроса"],
    "demo3": ["реабилитационный центр город-2"],
}


def scan() -> list[str]:
    data = json.loads(HYP.read_text(encoding="utf-8"))
    known = {h.get("commit") for h in data["hypotheses"] if h.get("commit")}
    added = []
    for site, repo in REPO_PATHS.items():
        if not Path(repo or "").exists():
            continue
        try:
            log = subprocess.run(
                ["git", "-C", repo, "log", "main", "--since=30 days ago",
                 "--grep=mrseo-bridge", "--format=%h|%cs|%s"],
                capture_output=True, text=True, timeout=15).stdout
        except Exception:
            continue
        for ln in log.splitlines():
            sha, date, subj = (ln.split("|", 2) + ["", ""])[:3]
            if not sha or sha in known:
                continue
            qm = re.search(r"[«\"]([^»\"]{4,60})[»\"]", subj)
            targets = [qm.group(1)] if qm else DEFAULT_TARGETS.get(site, [])
            verify_due = (datetime.strptime(date, "%Y-%m-%d") + timedelta(days=14)).strftime("%Y-%m-%d")
            data["hypotheses"].append({
                "id": f"h-{sha}", "commit": sha, "commit_date": date, "site": site,
                "urls": [], "change": f"[авто/merge моста] {subj[:90]}",
                "targets_moved": targets,
                "expected": f"улучшение по {len(targets)} таргетам за 14 дней (правка моста смержена)",
                "baseline": baseline_from_snapshot(site, targets, date),
                "status": "pending", "verify_due": verify_due,
                "registered_by": "swarm/merge_watch (авто)"})
            known.add(sha)
            added.append(f"h-{sha} [{site}] {subj[:60]}")
    if added:
        HYP.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return added


if __name__ == "__main__":
    res = scan()
    print("\n".join(res) if res else "новых merge моста нет")
