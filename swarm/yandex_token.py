"""
swarm/yandex_token — перевыпуск Яндекс OAuth-токена через Device Flow (волна 2).

Решает боль «токен умер → ручная возня»: короткий код вводится с любого
устройства, скрипт получает access+refresh_token и дальше обновляет сам.

ТРЕБУЕТ одноразовой настройки (Антон, 5 мин):
  1. oauth.yandex.ru → «Создать приложение» → Веб-сервисы,
     доступы: Яндекс.Вебмастер (webmaster:verify + webmaster:hostinfo), Метрика (по желанию)
  2. В .env добавить: YANDEX_CLIENT_ID=... и YANDEX_CLIENT_SECRET=...

Запуск: venv/bin/python swarm/yandex_token.py         (выдаст код и ссылку)
        venv/bin/python swarm/yandex_token.py refresh (обновить по refresh_token)
"""
import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import requests
from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

TOKENS_FILE = ROOT / "credentials" / "yandex_tokens.json"


def _env_update(key: str, value: str):
    p = ROOT / ".env"
    lines = p.read_text(encoding="utf-8").splitlines()
    out, found = [], False
    for ln in lines:
        if ln.startswith(f"{key}="):
            out.append(f"{key}={value}"); found = True
        else:
            out.append(ln)
    if not found:
        out.append(f"{key}={value}")
    p.write_text("\n".join(out) + "\n", encoding="utf-8")


def device_flow():
    cid, secret = os.getenv("YANDEX_CLIENT_ID"), os.getenv("YANDEX_CLIENT_SECRET")
    if not cid or not secret:
        print(json.dumps({"ok": False, "error": "нет YANDEX_CLIENT_ID/SECRET в .env",
                          "fix": "oauth.yandex.ru → создать приложение (доступ Вебмастер) → id+secret в .env"}, ensure_ascii=False))
        return
    r = requests.post("https://oauth.yandex.ru/device/code",
                      data={"client_id": cid}, timeout=15).json()
    if "device_code" not in r:
        print(json.dumps({"ok": False, "error": str(r)[:200]}, ensure_ascii=False))
        return
    print(f"\n➡️  Откройте {r.get('verification_url', 'https://ya.ru/device')} и введите код: {r['user_code']}\n")
    interval, deadline = r.get("interval", 5), time.time() + r.get("expires_in", 300)
    while time.time() < deadline:
        time.sleep(interval)
        t = requests.post("https://oauth.yandex.ru/token", data={
            "grant_type": "device_code", "code": r["device_code"],
            "client_id": cid, "client_secret": secret}, timeout=15).json()
        if "access_token" in t:
            TOKENS_FILE.write_text(json.dumps(t, ensure_ascii=False, indent=2), encoding="utf-8")
            _env_update("YANDEX_OAUTH_TOKEN", t["access_token"])
            print(json.dumps({"ok": True, "note": "токен получен и сохранён (.env + credentials/yandex_tokens.json), refresh_token есть — обновление навсегда"}, ensure_ascii=False))
            return
        if t.get("error") not in ("authorization_pending", None):
            print(json.dumps({"ok": False, "error": t.get("error_description", t.get("error"))}, ensure_ascii=False))
            return
    print(json.dumps({"ok": False, "error": "код истёк — запустите заново"}, ensure_ascii=False))


def refresh():
    cid, secret = os.getenv("YANDEX_CLIENT_ID"), os.getenv("YANDEX_CLIENT_SECRET")
    if not TOKENS_FILE.exists():
        print(json.dumps({"ok": False, "error": "нет сохранённых токенов — сначала device flow"}, ensure_ascii=False))
        return
    saved = json.loads(TOKENS_FILE.read_text(encoding="utf-8"))
    t = requests.post("https://oauth.yandex.ru/token", data={
        "grant_type": "refresh_token", "refresh_token": saved.get("refresh_token", ""),
        "client_id": cid, "client_secret": secret}, timeout=15).json()
    if "access_token" in t:
        t.setdefault("refresh_token", saved.get("refresh_token"))
        TOKENS_FILE.write_text(json.dumps(t, ensure_ascii=False, indent=2), encoding="utf-8")
        _env_update("YANDEX_OAUTH_TOKEN", t["access_token"])
        print(json.dumps({"ok": True, "note": "токен обновлён"}, ensure_ascii=False))
    else:
        print(json.dumps({"ok": False, "error": str(t)[:200]}, ensure_ascii=False))


if __name__ == "__main__":
    (refresh if (len(sys.argv) > 1 and sys.argv[1] == "refresh") else device_flow)()
