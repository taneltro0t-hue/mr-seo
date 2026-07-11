"""
Telegram-уведомления SEO-бота.

Использование:
    from telegram_notifier import send_message
    send_message("Привет!")           # plain text
    send_message("*bold*", parse_mode="Markdown")
    send_file("/path/to/report.md")   # отправить файл

ENV:
    TELEGRAM_SEO_BOT_TOKEN — токен @Seoebaka_bot
    TELEGRAM_SEO_CHAT_ID   — chat_id пользователя (получить через grab_chat_id.py)
"""
import os
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

TOKEN = os.getenv("TELEGRAM_SEO_BOT_TOKEN")
CHAT_ID = os.getenv("TELEGRAM_SEO_CHAT_ID")
API = f"https://api.telegram.org/bot{TOKEN}"


def _ensure():
    if not TOKEN:
        raise RuntimeError("TELEGRAM_SEO_BOT_TOKEN не задан в .env")
    if not CHAT_ID:
        raise RuntimeError(
            "TELEGRAM_SEO_CHAT_ID пуст. Запусти: python grab_chat_id.py "
            "после того как напишешь /start боту @Seoebaka_bot"
        )


def send_message(text: str, parse_mode: str | None = None, disable_preview: bool = True) -> dict:
    _ensure()
    payload = {
        "chat_id": CHAT_ID,
        "text": text,
        "disable_web_page_preview": disable_preview,
    }
    if parse_mode:
        payload["parse_mode"] = parse_mode
    # data=… c utf-8 кодировкой по умолчанию; requests шлёт application/x-www-form-urlencoded.
    # JSON-вариант ниже надёжнее: requests сериализует через json.dumps(ensure_ascii=False по умолч.False, но dumps делает escape) → utf-8 bytes.
    r = requests.post(f"{API}/sendMessage", json=payload, timeout=15)
    r.raise_for_status()
    return r.json()


def send_long_message(text: str, parse_mode: str | None = None, chunk_size: int = 3800) -> list[dict]:
    """Отправляет длинный текст несколькими сообщениями (Telegram лимит 4096).
    Режет по строкам, не разрывая markdown-блоки посередине.
    iOS Telegram рендерит body всегда как UTF-8 — нет проблем с иероглифами в превью.
    """
    _ensure()
    if len(text) <= chunk_size:
        return [send_message(text, parse_mode=parse_mode)]

    lines = text.split("\n")
    chunks: list[str] = []
    buf: list[str] = []
    cur = 0
    for ln in lines:
        # +1 за \n
        if cur + len(ln) + 1 > chunk_size and buf:
            chunks.append("\n".join(buf))
            buf = [ln]
            cur = len(ln) + 1
        else:
            buf.append(ln)
            cur += len(ln) + 1
    if buf:
        chunks.append("\n".join(buf))

    results = []
    total = len(chunks)
    for i, c in enumerate(chunks, 1):
        prefix = f"📄 ({i}/{total})\n\n" if total > 1 else ""
        results.append(send_message(prefix + c, parse_mode=parse_mode))
    return results


# MIME по расширению — для iOS Telegram preview критично, без этого
# Telegram отдаёт application/octet-stream и iOS детектит кодировку
# эвристикой → кириллица ломается в иероглифы.
_MIME_BY_EXT = {
    ".md": "text/plain; charset=utf-8",   # md как plain, иначе iOS не превьюит
    ".txt": "text/plain; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".csv": "text/csv; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".pdf": "application/pdf",
}


def send_file(path: str, caption: str | None = None) -> dict:
    _ensure()
    p = Path(path)
    mime = _MIME_BY_EXT.get(p.suffix.lower(), "application/octet-stream")
    with open(path, "rb") as f:
        # tuple (filename, fileobj, content_type) — заставляет requests
        # выставить корректный Content-Type для multipart-части.
        files = {"document": (p.name, f, mime)}
        data = {"chat_id": CHAT_ID}
        if caption:
            data["caption"] = caption
        r = requests.post(f"{API}/sendDocument", data=data, files=files, timeout=30)
    r.raise_for_status()
    return r.json()


if __name__ == "__main__":
    print(send_message("✅ Тестовое сообщение от SEO-бота — связь работает."))
