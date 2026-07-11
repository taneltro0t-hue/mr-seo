"""
swarm/ops — операции экосистемы для Mr.Seo («Пульт»).

Команды (stdout = JSON, зовутся из Next /api/ops):
  status                     — здоровье токенов/ключей всех источников
  gsc_reauth                 — перевыпуск OAuth-токена GSC (detached, откроет браузер)
  recrawl <site> <url>       — Яндекс.Вебмастер: отправить URL на переобход
  recrawl_quota <site>       — остаток дневной квоты переобхода

Запуск: venv/bin/python swarm/ops.py status
"""
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import requests
from dotenv import load_dotenv
load_dotenv(ROOT / ".env")


def _yandex_headers():
    return {"Authorization": f"OAuth {os.getenv('YANDEX_OAUTH_TOKEN')}"}


def _host_id(site: str) -> str | None:
    from sites_config import SITES
    return SITES.get(site, {}).get("yandex_host_id")


def status() -> dict:
    out = {"checked_at": datetime.now().isoformat(timespec="seconds")}
    # GSC: service account (основной) + oauth (запасной)
    try:
        from gsc_client import _build_sa_service
        _build_sa_service()
        out["gsc_sa"] = {"ok": True, "note": "service account жив (бессрочный)"}
    except Exception as e:
        out["gsc_sa"] = {"ok": False, "error": str(e)[:160]}
    try:
        from gsc_client import _build_oauth_service
        _build_oauth_service()
        out["gsc_oauth"] = {"ok": True, "note": "запасной OAuth жив"}
    except Exception as e:
        out["gsc_oauth"] = {"ok": False, "error": str(e)[:160], "fix": "gsc_reauth"}
    # Яндекс.Вебмастер
    try:
        uid = os.getenv("YANDEX_USER_ID")
        r = requests.get(f"https://api.webmaster.yandex.net/v4/user/{uid}/hosts",
                         headers=_yandex_headers(), timeout=15)
        out["yandex"] = {"ok": r.status_code == 200,
                         "note": f"{len(r.json().get('hosts', []))} хостов" if r.status_code == 200 else f"HTTP {r.status_code}"}
    except Exception as e:
        out["yandex"] = {"ok": False, "error": str(e)[:160]}
    # Bing
    try:
        key = os.getenv("BING_API_KEY", "")
        if not key:
            out["bing"] = {"ok": False, "error": "ключ не задан"}
        else:
            r = requests.get("https://ssl.bing.com/webmaster/api.svc/json/GetUserSites",
                             params={"apikey": key}, timeout=15)
            out["bing"] = {"ok": r.status_code == 200,
                           "note": f"{len(r.json().get('d', []))} сайтов" if r.status_code == 200 else f"HTTP {r.status_code}"}
    except Exception as e:
        out["bing"] = {"ok": False, "error": str(e)[:160]}
    return out


def gsc_reauth() -> dict:
    """Detached-запуск auto_oauth_flow.py — откроет браузер для перевыпуска."""
    flow = ROOT / "auto_oauth_flow.py"
    if not flow.exists():
        return {"ok": False, "error": "auto_oauth_flow.py не найден"}
    subprocess.Popen([str(ROOT / "venv" / "bin" / "python"), str(flow)],
                     cwd=str(ROOT), start_new_session=True,
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return {"ok": True, "note": "Открылся браузер — войдите под yosixrecords и подтвердите доступ. Токен сохранится сам."}


def recrawl(site: str, url: str) -> dict:
    uid = os.getenv("YANDEX_USER_ID")
    host = _host_id(site)
    if not host:
        return {"ok": False, "error": f"нет yandex_host_id для {site}"}
    he = quote(host, safe="")
    r = requests.post(f"https://api.webmaster.yandex.net/v4/user/{uid}/hosts/{he}/recrawl/queue",
                      headers={**_yandex_headers(), "Content-Type": "application/json"},
                      json={"url": url}, timeout=20)
    if r.status_code in (200, 201, 202):
        return {"ok": True, "note": f"URL в очереди переобхода (task {r.json().get('task_id', '?')})"}
    return {"ok": False, "error": f"HTTP {r.status_code}: {r.text[:160]}"}


def recrawl_quota(site: str) -> dict:
    uid = os.getenv("YANDEX_USER_ID")
    host = _host_id(site)
    if not host:
        return {"ok": False, "error": f"нет yandex_host_id для {site}"}
    he = quote(host, safe="")
    r = requests.get(f"https://api.webmaster.yandex.net/v4/user/{uid}/hosts/{he}/recrawl/quota",
                     headers=_yandex_headers(), timeout=15)
    if r.status_code == 200:
        d = r.json()
        return {"ok": True, "daily_quota": d.get("daily_quota"), "remainder": d.get("quota_remainder")}
    return {"ok": False, "error": f"HTTP {r.status_code}"}


AI_BOTS = ["GPTBot", "OAI-SearchBot", "ClaudeBot", "Claude-SearchBot", "PerplexityBot",
           "Perplexity-User", "YandexBot", "Bingbot", "Google-Extended", "Amazonbot", "meta-externalagent"]


def aibots(site: str) -> dict:
    """P0 из ECOSYSTEM_TOOLS: проверка, не заблокированы ли AI-боты в robots.txt."""
    from sites_config import SITES
    url = SITES.get(site, {}).get("url")
    if not url:
        return {"ok": False, "error": f"нет url для {site}"}
    try:
        txt = requests.get(url.rstrip("/") + "/robots.txt", timeout=15,
                           headers={"User-Agent": "Mozilla/5.0"}).text
    except Exception as e:
        return {"ok": False, "error": str(e)[:160]}
    blocked, lines = [], [ln.strip() for ln in txt.splitlines()]
    cur = None
    for ln in lines:
        low = ln.lower()
        if low.startswith("user-agent:"):
            cur = ln.split(":", 1)[1].strip()
        elif low.startswith("disallow:") and ln.split(":", 1)[1].strip() == "/" and cur:
            for b in AI_BOTS:
                if cur.lower() == b.lower() or cur == "*":
                    blocked.append(cur if cur != "*" else "* (все боты!)")
    return {"ok": True, "blocked": sorted(set(blocked)), "checked": AI_BOTS,
            "note": "все AI-боты допущены" if not blocked else f"заблокировано: {', '.join(sorted(set(blocked)))}"}


def indexnow(site: str, url: str) -> dict:
    """IndexNow ping (мгновенная индексация Bing/Yandex). Ключ per-site из .env."""
    key = os.getenv(f"INDEXNOW_KEY_{site.upper()}", "")
    if not key:
        return {"ok": False, "error": f"INDEXNOW_KEY_{site.upper()} не задан в .env"}
    from urllib.parse import urlparse
    host = urlparse(url).netloc
    try:
        r = requests.post("https://api.indexnow.org/indexnow", timeout=20, json={
            "host": host, "key": key, "urlList": [url]})
        return {"ok": r.status_code in (200, 202), "note": f"HTTP {r.status_code}"}
    except Exception as e:
        return {"ok": False, "error": str(e)[:160]}


def set_bing_key(key: str) -> dict:
    """Обновить BING_API_KEY в .env (перевыпуск делается в кабинете Bing → сюда вставить новый)."""
    key = key.strip()
    if not (16 <= len(key) <= 128) or not key.replace("-", "").isalnum():
        return {"ok": False, "error": "ключ выглядит неправильно (16-128 символов, буквы/цифры)"}
    env_path = ROOT / ".env"
    lines = env_path.read_text(encoding="utf-8").splitlines()
    out, found = [], False
    for ln in lines:
        if ln.startswith("BING_API_KEY="):
            out.append(f"BING_API_KEY={key}"); found = True
        else:
            out.append(ln)
    if not found:
        out.append(f"BING_API_KEY={key}")
    env_path.write_text("\n".join(out) + "\n", encoding="utf-8")
    os.environ["BING_API_KEY"] = key
    # проверка нового ключа сразу
    try:
        r = requests.get("https://ssl.bing.com/webmaster/api.svc/json/GetUserSites",
                         params={"apikey": key}, timeout=20)
        ok = r.status_code == 200
        return {"ok": ok, "note": "ключ сохранён и работает" if ok else f"сохранён, но Bing ответил HTTP {r.status_code} — проверьте ключ"}
    except Exception as e:
        return {"ok": False, "note": f"сохранён, проверка не удалась: {str(e)[:100]}"}


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    if cmd == "status":
        print(json.dumps(status(), ensure_ascii=False))
    elif cmd == "gsc_reauth":
        print(json.dumps(gsc_reauth(), ensure_ascii=False))
    elif cmd == "recrawl":
        print(json.dumps(recrawl(sys.argv[2], sys.argv[3]), ensure_ascii=False))
    elif cmd == "recrawl_quota":
        print(json.dumps(recrawl_quota(sys.argv[2]), ensure_ascii=False))
    elif cmd == "aibots":
        print(json.dumps(aibots(sys.argv[2]), ensure_ascii=False))
    elif cmd == "indexnow":
        print(json.dumps(indexnow(sys.argv[2], sys.argv[3]), ensure_ascii=False))
    elif cmd == "set_bing_key":
        print(json.dumps(set_bing_key(sys.argv[2]), ensure_ascii=False))
    else:
        print(json.dumps({"ok": False, "error": f"неизвестная команда {cmd}"}))
