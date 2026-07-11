"""
swarm/bridge — мост Mr.Seo ↔ Claude Code для правок сайтов.

Полный аналог claude_bridge из Zoey (teardown «Фея»), но под нашу задачу:
задача на рост сайта → headless Claude Code В РЕПОЗИТОРИИ сайта → правки.

Безопасность (не обсуждается):
  • plan-режим (по умолчанию): Claude только ЧИТАЕТ репо и выдаёт план правок.
  • --apply: правки строго в ветке mrseo/bridge-<ts>; после — build-проверка
    (урок L-007: молчаливый краш билда), коммит в ветку, возврат на main.
  • push НИКОГДА не делается автоматически: деплой у сайтов триггерится
    пушем в main — merge остаётся за человеком (утреннее ревью).

Запуск:
  venv/bin/python swarm/bridge.py mysite "усилить перелинковку блога" [--apply]
Отчёт: swarm/runs/bridge-<ts>.md + Telegram.
"""
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from carpathy.register import REPO_PATHS  # единый источник путей к репо

CLAUDE_BIN = os.path.expanduser("~/.npm-global/bin/claude")
RUNS = ROOT / "swarm" / "runs"
TS = datetime.now().strftime("%Y%m%d-%H%M")

PLAN_TOOLS = "Read,Glob,Grep"
APPLY_TOOLS = "Read,Glob,Grep,Edit,Write,Bash(npm run build:*),Bash(npm run build)"

GUARDRAILS = """
# Жёсткие рамки (нарушение = провал задачи)
- НЕ трогать: .env*, credentials, ключи, .git внутренности, node_modules.
- НЕ делать git push / merge / rebase — только правки файлов.
- Уважать уроки проекта из carpathy/graveyard.md.
- Правки должны быть минимальными и по задаче, в стиле окружающего кода.
- В конце выведи короткий итог: какие файлы менял и зачем (или план, если read-only).
"""


def git(repo, *args, check=True):
    return subprocess.run(["git", "-C", repo, *args], capture_output=True, text=True, check=check).stdout.strip()


def run_claude_in_repo(repo: str, prompt: str, tools: str, permission_mode: str, timeout: int):
    # ИЗВЕСТНОЕ ОГРАНИЧЕНИЕ (06.07): пути с пробелами («LOW LIGHT/Low Light web »)
    # триггерят suspicious-path гейт headless Claude → Edit/Write блокируются.
    # В этом случае bridge честно возвращает готовый план, а правки применяет
    # основная Claude-сессия (у неё есть права) или человек. НЕ обходить гейт.
    r = subprocess.run(
        [CLAUDE_BIN, "-p", prompt, "--model", "sonnet",
         "--allowedTools", tools, "--permission-mode", permission_mode],
        capture_output=True, text=True, timeout=timeout, cwd=repo, env={**os.environ},
    )
    if r.returncode != 0 and not r.stdout.strip():
        raise RuntimeError(f"claude rc={r.returncode}: {(r.stderr or '')[:400]}")
    return r.stdout.strip()


def notify(text: str):
    try:
        from telegram_notifier import send_long_message
        send_long_message(text)
    except Exception as e:
        print(f"[bridge] telegram: {e}")


def main():
    args = [a for a in sys.argv[1:] if a != "--apply"]
    apply_mode = "--apply" in sys.argv
    if len(args) < 2:
        print(__doc__)
        sys.exit(1)
    site, task = args[0], args[1]
    repo = REPO_PATHS.get(site)
    if not repo or not Path(repo).exists():
        print(f"✗ неизвестный сайт или нет репо: {site}")
        sys.exit(1)

    base = f"Ты работаешь в репозитории сайта ({site}). Задача от Mr.Seo:\n\n{task}\n{GUARDRAILS}"
    report = [f"# Bridge {TS} · {site} · {'APPLY' if apply_mode else 'PLAN'}", "", f"**Задача:** {task}", ""]

    if not apply_mode:
        out = run_claude_in_repo(repo, base + "\nРежим: ТОЛЬКО АНАЛИЗ. Изучи код и выдай конкретный план правок (файлы, что менять, риски). Ничего не редактируй.",
                                 PLAN_TOOLS, "default", 600)
        report += ["## План от Claude", "", out]
        verdict = f"🌉 Bridge·PLAN {site}: план готов"
    else:
        branch = f"mrseo/bridge-{TS}"
        prev = git(repo, "rev-parse", "--abbrev-ref", "HEAD")
        dirty = git(repo, "status", "--porcelain")
        if dirty:
            print("✗ репо грязный (незакоммиченные правки) — apply отменён, чтобы ничего не потерять")
            report += ["## Отменено", "", "Рабочая копия содержит незакоммиченные изменения."]
            (RUNS / f"bridge-{TS}.md").write_text("\n".join(report), encoding="utf-8")
            sys.exit(2)
        git(repo, "checkout", "-b", branch)
        try:
            out = run_claude_in_repo(repo, base + "\nРежим: ПРАВКИ РАЗРЕШЕНЫ (ты в отдельной ветке). Внеси изменения по задаче.",
                                     APPLY_TOOLS, "acceptEdits", 1200)
            report += ["## Отчёт Claude", "", out, ""]
            # build-проверка (L-007)
            build_note = "build: пропущен (нет package.json)"
            if (Path(repo) / "package.json").exists():
                b = subprocess.run(["npm", "run", "build"], capture_output=True, text=True, cwd=repo, timeout=600)
                build_note = "build: ✅ OK" if b.returncode == 0 else f"build: ❌ FAIL\n```\n{(b.stdout + b.stderr)[-800:]}\n```"
            report += [f"## Проверка\n\n{build_note}", ""]
            changed = git(repo, "status", "--porcelain")
            if changed:
                git(repo, "add", "-A")
                git(repo, "commit", "-m", f"mrseo-bridge: {task[:70]}\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>")
                diff = git(repo, "show", "--stat", "HEAD")
                report += ["## Коммит (в ветке, БЕЗ push)", "", f"ветка `{branch}`", "```", diff[:1500], "```"]
                verdict = f"🌉 Bridge·APPLY {site}: правки в ветке {branch} ({'билд ОК' if '✅' in build_note else 'БИЛД УПАЛ'}), merge за тобой"
            else:
                report += ["## Итог", "", "Claude не внёс изменений."]
                verdict = f"🌉 Bridge·APPLY {site}: изменений не потребовалось"
        finally:
            git(repo, "checkout", prev, check=False)

    RUNS.mkdir(parents=True, exist_ok=True)
    p = RUNS / f"bridge-{TS}.md"
    p.write_text("\n".join(report), encoding="utf-8")
    notify(verdict + f"\n\nЗадача: {task[:150]}\nОтчёт: swarm/runs/{p.name}")
    print(verdict)
    print(f"отчёт: {p}")


if __name__ == "__main__":
    main()
