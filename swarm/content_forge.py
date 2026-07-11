"""
swarm/content_forge — контент-станок: quick-win → черновик статьи по канонам.

Мозг (headless Claude на подписке) пишет черновик В ФАЙЛ content_drafts/ —
публикация ВСЕГДА за человеком (вычитка обязательна, красная зона контента).

Каноны зашиты в промпт: L-007 (keywords массив для блога mysite), стиль
существующего блога, ЭПОС (польза/факты/без воды), запрет канцелярита,
брендинг («Low Light»/«Демо-бренд», «Демо-бренд» — feedback_brand_naming).

Запуск: venv/bin/python swarm/content_forge.py <site> "<запрос>" ["<url-страницы>"]
Выход: JSON {ok, draft_path} + файл черновика.
"""
import json
import os
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

CLAUDE_BIN = os.path.expanduser("~/.npm-global/bin/claude")
DRAFTS = ROOT / "content_drafts"

SITE_CTX = {
    "mysite": "Студия звукозаписи Low Light (кан. «Демо-бренд»), Столица (Башня Федерация, Столица-Сити) + Город (Советская 6). Услуги: запись, сведение (от 5000₽), мастеринг (от 3000₽), аранжировки, клипы, песни в подарок. Артисты: Miyagi & Эндшпиль, DSPRITE, Boulevard Depo, LIZER, MIA BOYKA. Тон блога: экспертно, тепло, без воды, конкретные цифры/цены. Формат блога: заголовок H2/H3-структура, FAQ в конце.",
    "demo2": "Демо-бренд (Демо-бренд Show Bar) — шоу-бар в центре Города (наб. 62-й Армии 6), 22:00-06:00, вход по пригласительному. Нейтральные формулировки для широкой аудитории («шоу-бар», «вечер», «мальчишник»). Главную не трогаем — контент только для блога/журнала.",
    "demo3": "РЦ Основа — реабилитационный центр (Город-2). ЖЁСТКИЕ рамки YMYL: никаких гарантий излечения (штрафы!), упоминание лицензии, факты и этика, автор-эксперт. Тон: поддерживающий, без осуждения.",
}


def forge(site: str, query: str, url: str = "") -> dict:
    ctx = SITE_CTX.get(site)
    if not ctx:
        return {"ok": False, "error": f"неизвестный сайт {site}"}
    slug = re.sub(r"[^a-z0-9-]", "", re.sub(r"\s+", "-", query.lower()
                  .translate(str.maketrans("абвгдеёжзийклмнопрстуфхцчшщъыьэюя", "abvgdeejzijklmnoprstufhccss_y_eua"))))[:60] or "draft"
    ts = datetime.now().strftime("%Y-%m-%d")
    out_dir = DRAFTS / site
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{ts}-{slug}.md"

    prompt = f"""Напиши черновик SEO-статьи для блога сайта.

Контекст сайта: {ctx}

Целевой запрос: «{query}»{f" (сейчас ранжируется страница {url} — статья должна её ПОДДЕРЖАТЬ ссылкой, не конкурировать)" if url else ""}

Требования:
- Русский язык, 700-1100 слов, БЕЗ воды и канцелярита. Конкретика: цифры, цены, шаги, примеры.
- Структура: цепляющий заголовок (с запросом), лид-абзац с прямым ответом (для Нейро/AI-цитирования, 40-60 слов), 3-5 секций с H2, FAQ из 3-4 вопросов в конце (вопрос = реальный поисковый запрос).
- Точное вхождение запроса: в заголовке, лиде и одном H2. Без переспама.
- 2-3 внутренние ссылки на страницы сайта (релевантные услуги{f", обязательно на {url}" if url else ""}).
- В начале файла — метаблок:
  TITLE: <title до 60 симв>
  DESCRIPTION: <до 155 симв>
  KEYWORDS: <5-7 через запятую — ВАЖНО: при переносе в blog low-light это МАССИВ (урок L-007)>
  SLUG: {slug}
- Это ЧЕРНОВИК для вычитки человеком — в конце добавь блок «⚠️ ПРОВЕРИТЬ:» со списком мест, где ты не уверен в фактах (цены/адреса/имена).

Выведи только markdown статьи."""

    r = subprocess.run([CLAUDE_BIN, "-p", prompt, "--model", "sonnet"],
                       capture_output=True, text=True, timeout=600, cwd=str(ROOT))
    text = r.stdout.strip()
    if r.returncode != 0 or len(text) < 400:
        return {"ok": False, "error": f"claude rc={r.returncode}: {(r.stderr or text)[:200]}"}
    path.write_text(f"<!-- Mr.Seo content_forge · {ts} · запрос: {query} · НЕ ПУБЛИКОВАТЬ БЕЗ ВЫЧИТКИ -->\n\n" + text,
                    encoding="utf-8")
    try:
        from telegram_notifier import send_long_message
        send_long_message(f"📝 Станок: черновик готов — «{query}» [{site}]\ncontent_drafts/{site}/{path.name}\nЖдёт вычитки.")
    except Exception:
        pass
    return {"ok": True, "draft_path": f"content_drafts/{site}/{path.name}", "chars": len(text)}


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"ok": False, "error": "usage: content_forge.py <site> <query> [url]"}))
    else:
        print(json.dumps(forge(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else ""),
                         ensure_ascii=False))
