"""
swarm/queue_worker — исполнитель очереди роя (swarm/tasks/inbox.md).

Замыкает кнопку «Поручить рою» из Mr.Seo реальными действиями. Пока умеет
задачи вида `[quick-win <site>] ... страница <url> ...`:
  1) переобход Яндекса (ops.recrawl) + IndexNow (если ключ есть),
  2) план правок от моста (bridge PLAN — read-only, безопасно),
  3) помечает задачу ✓ с результатом, шлёт сводку в Telegram.

Прочие задачи (свободный текст, [new-site]) не трогает — их разбирает человек
или чат-мозг. Автоправки (bridge --apply) сознательно НЕ запускаются без
человека: план готовится, merge/apply — решение Антона.

Запуск: venv/bin/python swarm/queue_worker.py           (разобрать очередь)
Cron:   каждые 2 часа (com.mrseo.seo-queue).
"""
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

INBOX = ROOT / "swarm" / "tasks" / "inbox.md"
PY = str(ROOT / "venv" / "bin" / "python")

# универсально: [любой-тег site] — quick-win/decay/cannibal/chat/фокус и будущие
TASK_RE = re.compile(r"^- \[(?P<ts>[^\]✓]+)\] \[(?P<tag>[\w-]+|фокус) (?P<site>\w+)\] (?P<text>.+)$")
MAX_PER_RUN = 6  # не переполняем 2ч-цикл: хвост доберёт следующий прогон
URL_RE = re.compile(r"страница (\S+)")
QUERY_RE = re.compile(r"[Дд]ожать запрос [«\"]([^»\"]+)[»\"]")


def run_ops(*args) -> str:
    r = subprocess.run([PY, str(ROOT / "swarm" / "ops.py"), *args],
                       capture_output=True, text=True, timeout=120, cwd=str(ROOT))
    return r.stdout.strip()


STATUS = ROOT / "swarm" / "tasks" / "worker_status.json"

def _status(state: str, current: str = ""):
    import json as _j
    from datetime import datetime as _dt
    try:
        STATUS.write_text(_j.dumps({"state": state, "current": current[:120],
                                    "at": _dt.now().isoformat(timespec="seconds")}, ensure_ascii=False), encoding="utf-8")
    except Exception:
        pass


def process() -> list[str]:
    if not INBOX.exists():
        return []
    _status("running")
    lines = INBOX.read_text(encoding="utf-8").splitlines()
    done_reports = []
    out_lines = []
    handled = 0
    for ln in lines:
        # [fix]-задачи: мозг разбирается и пишет решение в swarm/runs/fix-*.md
        fx = re.match(r"^- \[(?P<ts>[^\]✓]+)\] \[fix\] (?P<text>.+)$", ln.strip())
        if fx and "✓" not in ln:
            try:
                q = f"Задача от сторожа Mr.Seo: {fx.group('text')}. Разберись и дай конкретное решение шагами (или скажи, что делать человеку)."
                r = subprocess.run([PY, str(ROOT / "swarm" / "orchestrator.py"), "chat"],
                                   input=q, capture_output=True, text=True, timeout=600, cwd=str(ROOT))
                fixp = ROOT / "swarm" / "runs" / f"fix-{datetime.now().strftime('%Y%m%d-%H%M')}.md"
                fixp.write_text(f"# Fix-разбор\n\n**Задача:** {fx.group('text')}\n\n{r.stdout.strip()}", encoding="utf-8")
                stamp = datetime.now().strftime("%m-%d %H:%M")
                out_lines.append(ln + f"  → ✓ {stamp}: решение в swarm/runs/{fixp.name}")
                done_reports.append(f"[fix] {fx.group('text')[:60]}: решение готово ({fixp.name})")
            except Exception as e:
                out_lines.append(ln + f"  → ✗ fix-разбор упал: {str(e)[:60]}")
            continue
        m = TASK_RE.match(ln.strip())
        if not m or "✓" in ln or handled >= MAX_PER_RUN:
            out_lines.append(ln)
            continue
        handled += 1
        site, text = m.group("site"), m.group("text")
        _status("running", text)
        um, qm = URL_RE.search(text), QUERY_RE.search(text)
        path = um.group(1).rstrip(":,") if um else "/"
        query = qm.group(1) if qm else text[:50]
        base = {"mysite": "https://example.com", "demo2": "https://example.org",
                "demo3": "https://example.net"}.get(site, "")
        url = path if path.startswith("http") else base + path
        steps = []
        # 1) переобход + indexnow
        import json as _j
        rc = _j.loads(run_ops("recrawl", site, url) or "{}")
        steps.append("переобход ✓" if rc.get("ok") else f"переобход ✗ ({rc.get('error','')[:40]})")
        ix = _j.loads(run_ops("indexnow", site, url) or "{}")
        steps.append("indexnow ✓" if ix.get("ok") else "indexnow —")
        # 2) план моста (read-only)
        plan_note = "план моста —"
        try:
            r = subprocess.run([PY, str(ROOT / "swarm" / "bridge.py"), site,
                                f"Запрос «{query}» на грани топа (страница {url}). Предложи 2-3 минимальные правки этой страницы (контент/перелинковка/заголовки) для роста"],
                               capture_output=True, text=True, timeout=700, cwd=str(ROOT))
            mm = re.search(r"отчёт: (\S+)", r.stdout)
            if mm:
                plan_note = f"план моста ✓ ({Path(mm.group(1)).name})"
        except Exception as e:
            plan_note = f"план моста ✗ ({str(e)[:40]})"
        steps.append(plan_note)
        stamp = datetime.now().strftime("%m-%d %H:%M")
        out_lines.append(ln + f"  → ✓ {stamp}: {'; '.join(steps)}")
        done_reports.append(f"«{query}» [{site}]: {'; '.join(steps)}")
    INBOX.write_text("\n".join(out_lines) + "\n", encoding="utf-8")
    _status("idle")
    return done_reports


def _alive(pid: int) -> bool:
    try:
        import os
        os.kill(pid, 0)
        return True
    except Exception:
        return False


if __name__ == "__main__":
    import os, json as _j
    LOCK = ROOT / "swarm" / "tasks" / "worker.pid"
    if LOCK.exists():
        try:
            old = int(LOCK.read_text().strip())
            if _alive(old):
                print(f"воркер уже работает (pid {old}) — выходим")
                sys.exit(0)
        except Exception:
            pass
    LOCK.write_text(str(os.getpid()), encoding="utf-8")
    # авто-гипотезы на свежие merge правок моста (замыкание петли)
    try:
        from swarm.merge_watch import scan as _merge_scan
        for _m in _merge_scan():
            print(f"[merge_watch] авто-гипотеза: {_m}")
    except Exception as _e:
        print(f"[merge_watch] {str(_e)[:80]}")
    try:
        reports = process()
    finally:
        _status("idle")            # статус не врёт даже при падении
        LOCK.unlink(missing_ok=True)
    if reports:
        try:
            from telegram_notifier import send_long_message
            send_long_message("🐝 Рой отработал очередь:\n" + "\n".join(f"• {r}" for r in reports))
        except Exception:
            pass
        print("\n".join(reports))
    else:
        print("очередь пуста или без quick-win задач")
