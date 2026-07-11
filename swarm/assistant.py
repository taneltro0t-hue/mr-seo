"""
swarm/assistant — ИИ-ассистент Mr.Seo v2: полноценный агент, а не одноразовый ответчик.

Отличия от orchestrator.chat (v1):
  • ПАМЯТЬ ДИАЛОГА: каждый тред чата = сессия Claude Code (--resume session_id),
    контекст сохраняется между сообщениями — общение «как в чате с Клодом».
  • ИНСТРУМЕНТЫ: ассистент сам читает файлы seo-agent (Read/Glob/Grep) и сам
    ЗАПУСКАЕТ модули роя (Bash-allowlist: insights, ops, verify, timeline,
    bridge PLAN, focus, today, forge...) — т.е. задачи исполняет, а не пересказывает.
  • Правки сайтов — по-прежнему только через мост/очередь (безопасность та же).

Запуск: echo "вопрос" | venv/bin/python swarm/assistant.py chat --thread main
Сессии: swarm/assistant_sessions.json (thread → claude session_id).
"""
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

CLAUDE_BIN = os.path.expanduser("~/.npm-global/bin/claude")
SESS_FILE = ROOT / "swarm" / "assistant_sessions.json"
TIMEOUT = 600

# Что ассистенту МОЖНО: читать всё в seo-agent + запускать модули роя.
ALLOWED_TOOLS = ",".join([
    "Read", "Glob", "Grep",
    # наш venv-python в любой форме записи пути (относительный/абсолютный)
    "Bash(./venv/bin/python:*)",
    "Bash(venv/bin/python:*)",
    "Bash(/venv/bin/python:*)",
])

SYSTEM = """Ты — Mr.Seo, ИИ-ассистент SEO-приложения. Работаешь в репозитории seo-agent (у тебя есть Read/Glob/Grep и запуск модулей роя через Bash из allowlist).

Твой пользователь — владелец сайтов без SEO-жаргона. Правила:
1. Говори просто, коротко, по-русски. Цифры — с человеческим объяснением.
2. Ты ИСПОЛНИТЕЛЬ: если просят данные — запусти модуль и дай ответ по факту. ЗАПУСК СТРОГО через ./venv/bin/python (например: ./venv/bin/python swarm/ops.py recrawl_quota demo2) — системный python3 заблокирован (insights quick_wins/cannibalization/decay, yandex_webmaster excluded/sqi, ops recrawl/aibots, timeline, verify). Не выдумывай значения.
3. Задачи на правки сайтов: bridge.py <site> "<задача>" — ТОЛЬКО план (без --apply, НИКОГДА). Публикации/merge — только человек.
4. Контент: content_forge.py <site> "<запрос>" — черновик в файл, скажи путь и что нужна вычитка.
5. Постановка в очередь роя: добавляй строку в swarm/tasks/inbox.md формата «- [ISO-время] [chat {site}] текст» через Bash НЕЛЬЗЯ (нет в allowlist) — вместо этого закончи ответ строкой ACTION: [chat site] <текст>, приложение само поставит.
6. Шум vs сигнал: агрегаты Яндекса плавают — тренды только по якорям. Уроки в carpathy/graveyard.md — не противоречь им.
7. Не трогай .env, credentials, чужие директории. Ты только в seo-agent."""


def _sessions() -> dict:
    try:
        return json.loads(SESS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save_sessions(s: dict):
    SESS_FILE.write_text(json.dumps(s, ensure_ascii=False, indent=1), encoding="utf-8")


def chat(thread: str, message: str) -> dict:
    sess = _sessions()
    sid = sess.get(thread)
    cmd = [CLAUDE_BIN, "-p", message, "--model", "sonnet",
           "--allowedTools", ALLOWED_TOOLS,
           "--permission-mode", "default",
           "--output-format", "json"]
    if sid:
        cmd += ["--resume", sid]
    else:
        cmd += ["--append-system-prompt", SYSTEM]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=TIMEOUT, cwd=str(ROOT))
    raw = r.stdout.strip()
    try:
        data = json.loads(raw)
    except Exception:
        # не-json (ошибка CLI) — отдать как текст
        return {"ok": r.returncode == 0, "text": raw or (r.stderr or "")[:400], "thread": thread}
    new_sid = data.get("session_id") or sid
    if new_sid:
        sess[thread] = new_sid
        _save_sessions(sess)
    return {"ok": not data.get("is_error", False),
            "text": data.get("result", ""), "thread": thread,
            "cost_usd": data.get("total_cost_usd"), "turns": data.get("num_turns")}


def reset(thread: str) -> dict:
    sess = _sessions()
    sess.pop(thread, None)
    _save_sessions(sess)
    return {"ok": True, "note": f"тред {thread} сброшен"}


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "chat"
    thread = "main"
    if "--thread" in sys.argv:
        thread = sys.argv[sys.argv.index("--thread") + 1]
    if cmd == "reset":
        print(json.dumps(reset(thread), ensure_ascii=False))
    else:
        msg = sys.stdin.read().strip()
        if not msg:
            print(json.dumps({"ok": False, "text": "пустое сообщение"}, ensure_ascii=False))
        else:
            print(json.dumps(chat(thread, msg), ensure_ascii=False))
