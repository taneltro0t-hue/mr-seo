# Mr.Seo — AI SEO workstation that actually does the work

[![Release](https://img.shields.io/github/v/release/taneltro0t-hue/mr-seo?include_prereleases&label=release)](https://github.com/taneltro0t-hue/mr-seo/releases) [![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-8b93ff.svg)](https://github.com/taneltro0t-hue/mr-seo/pulls) [![Telegram](https://img.shields.io/badge/TG-@lowlightconnect-26A5E4)](https://t.me/lowlightconnect)

**v0.1.1-alpha** · Русский ниже ↓ · [Telegram @lowlightconnect](https://t.me/lowlightconnect)

> An open-source SEO command center for **Yandex + Google**: a swarm of AI agents that
> tracks your positions daily, explains complex data in plain words, finds
> "one-move wins", drafts fixes for your site in an isolated git branch — and
> **proves** every action with position charts. AI inference runs through **your own
> Claude subscription** (via the official Claude Code CLI) — $0 in API costs.

---

## 👋 From the author

Hi everyone, brothers! My name is **Anton** — I'm an entrepreneur and a beginner
developer from Russia. I decided to share a product packed with the knowledge base
I use to grow my own websites organically.

**Mr.Seo** is an app that combines analytics, hands-on work with your sites, and a
bridge for your AI agent — so you don't overload your IDE, and all your agents live
under one roof. I've just started developing this project and I'll be grateful for
your comments and support. My current goal is to buy a 3D printer in our
"sanctioned" country 🙂

I'd love to find like-minded people and new friends around the world.
Telegram: **[@lowlightconnect](https://t.me/lowlightconnect)**

If you'd like to support the project — USDT (TRC20):
`TWAZuHMjpBwVMJTKACbd4m3B19CYeuyD4R`

---

## Why it's different

Most SEO tools **show** you data. Mr.Seo is built like an employee, not a dashboard:

| | |
|---|---|
| 👁 **Eyes** | Daily scans: Yandex Webmaster (incl. query-analytics time series), Google Search Console, Bing, Yandex Maps reputation |
| 🧠 **Brain** | An AI analyst that reads everything each morning and answers in plain language; a chat assistant with conversation memory that **runs tools itself** |
| ✋ **Hands** | The Bridge: give it a task → it edits your site **in an isolated git branch**, verifies the build, and waits for *your* merge. Auto-recrawl + IndexNow |
| ⚖️ **Conscience** | The Karpathy loop: every change becomes a hypothesis → verified against real positions in 14 days → confirmed or buried in the "graveyard of lessons" so mistakes are never repeated |
| 🧬 **Evolution** | A weekly GitHub scanner hunts for new SEO/GEO tools worth absorbing |

**RU-specific superpowers** you won't find elsewhere: pages dropped from Yandex
with human-readable reasons (MPK/low-quality filter!), SQI history, cannibalization
& decay reports, Neuro/Alice (AI search) readiness.

## Requirements

- macOS / Linux (Windows via WSL — untested)
- **Node.js 20+**, **Python 3.11+**
- **[Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)** with an active
  Claude Pro/Max subscription (`npm i -g @anthropic-ai/claude-code`, then log in once)
- Free API tokens: Yandex Webmaster OAuth, Google Search Console service account
  (optional: Bing Webmaster key, Telegram bot for morning digests)

## Quick start

**Lazy mode (recommended):** open [INSTALL_AI.md](INSTALL_AI.md) in any AI-powered IDE
(Cursor / Claude Code / Windsurf / Copilot) and say *"install this following INSTALL_AI.md"* —
the agent sets everything up and only asks you for tokens.

Manual mode:

```bash
git clone https://github.com/taneltro0t-hue/mr-seo && cd mr-seo

# 1. Python side (the swarm)
python3 -m venv venv && ./venv/bin/pip install -r requirements.txt
cp .env.example .env                    # fill in your tokens
cp sites_config.example.py sites_config.py   # describe your sites

# 2. The app
cd app && npm install
echo "SEO_AGENT_ROOT=$(pwd)/.." > .env.local
npm run dev                             # → http://localhost:3000

# 3. First scan (data appears in the app after this)
cd .. && ./venv/bin/python daily_scan.py
```

Then open the app: **Today** (your morning inbox), **Dashboard** (health score +
"finish-in-one-move" wins), **Pult** (tokens, recrawl, AI-bot check, cabinet
deep-links), **Swarm** (agents topology), and the chat orb in the corner — that's
the assistant. Schedule `daily_scan.py` and `swarm/orchestrator.py analyst` via
cron/launchd for full autopilot.

## Security model (read this)

- **Your tokens never leave your machine** — everything runs locally, `.env` is
  git-ignored.
- The Bridge **never pushes to your main branch**: edits land in an isolated
  `mrseo/*` branch, build-checked; merging is always your click.
- Content drafts are files awaiting your review — nothing gets published by itself.
- The in-app assistant runs with a strict tool allowlist (read-only access +
  whitelisted swarm modules only).

## Status: honest alpha

Built and battle-tested on the author's own three websites (confirmed top-3/top-10
results), but installation is still hands-on and rough edges are guaranteed.
Issues and PRs are very welcome. Free while we polish the machine together.

---

---

# 🇷🇺 Mr.Seo — ИИ-станция для SEO, которая работает руками

**v0.1.1-alpha** · [Telegram @lowlightconnect](https://t.me/lowlightconnect)

> Open-source SEO-центр для **Яндекса и Google**: рой ИИ-агентов ежедневно снимает
> позиции, объясняет сложные данные простым языком, находит запросы «дожать за один
> ход», сам готовит правки сайта в отдельной git-ветке — и **доказывает** каждое
> действие графиком позиций. Инференс — через **вашу подписку Claude** (официальный
> Claude Code CLI): $0 расходов на API.

## 👋 От автора

Всем привет, братья! Меня зовут **Антон**, я предприниматель и начинающий
разработчик из России. Решил поделиться с вами продуктом, который насыщен базой
знаний для того, чтобы ваши сайты органически росли.

**Mr.Seo** — это приложение, в котором собрана аналитика, возможность работать
с вашими сайтами и мост для вашего агента, чтобы не грузить ваши IDE — все агенты
под одной крышей. Проект я только начал развивать и буду благодарен вашим
комментариям и поддержке. Нынешняя цель — приобрести 3D-принтер в нашей
«санкционной» стране 🙂

Буду рад обрести единомышленников и новых друзей по всему миру.
Телеграм для связи: **[@lowlightconnect](https://t.me/lowlightconnect)**

Кто решит поддержать проект — USDT (TRC20):
`TWAZuHMjpBwVMJTKACbd4m3B19CYeuyD4R`

## Чем отличается

Обычные SEO-сервисы **показывают** данные. Mr.Seo устроен как сотрудник:

| | |
|---|---|
| 👁 **Глаза** | Ежедневные сканы: Яндекс.Вебмастер (включая точные временные ряды query-analytics), Google Search Console, Bing, репутация Я.Карт |
| 🧠 **Мозг** | ИИ-аналитик каждое утро читает всё и пишет сводку по-человечески; чат-ассистент с памятью диалога **сам запускает инструменты** |
| ✋ **Руки** | Мост: даёте задачу → он правит сайт **в отдельной git-ветке**, проверяет билд и ждёт вашего merge. Переобход Яндекса + IndexNow в один клик |
| ⚖️ **Совесть** | Петля Карпаты: каждая правка становится гипотезой → через 14 дней проверяется реальными позициями → подтверждается или хоронится в «кладбище уроков», чтобы ошибки не повторялись |
| 🧬 **Эволюция** | Еженедельный сканер GitHub ищет новые SEO/GEO-инструменты для поглощения |

**Фишки под рунет, которых нет нигде**: страницы, выпавшие из Яндекса, — с
причинами по-русски (МПК!), история ИКС, отчёты каннибализации и угасания,
готовность к Нейро/Алисе.

## Что нужно

- macOS / Linux (Windows через WSL — не проверялось)
- **Node.js 20+**, **Python 3.11+**
- **[Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)** и активная
  подписка Claude Pro/Max (`npm i -g @anthropic-ai/claude-code`, один раз войти)
- Бесплатные токены: OAuth Яндекс.Вебмастера, service account Google Search Console
  (опционально: ключ Bing, Telegram-бот для утренних сводок)

## Быстрый старт

**Ленивый режим (рекомендую):** откройте [INSTALL_AI.md](INSTALL_AI.md) в любой IDE с ИИ
(Cursor / Claude Code / Windsurf / Copilot) и скажите «установи по INSTALL_AI.md» —
агент всё поставит сам и спросит только токены.

Ручной режим:

```bash
git clone https://github.com/taneltro0t-hue/mr-seo && cd mr-seo

# 1. Python-часть (рой)
python3 -m venv venv && ./venv/bin/pip install -r requirements.txt
cp .env.example .env                    # впишите свои токены
cp sites_config.example.py sites_config.py   # опишите свои сайты

# 2. Приложение
cd app && npm install
echo "SEO_AGENT_ROOT=$(pwd)/.." > .env.local
npm run dev                             # → http://localhost:3000

# 3. Первый скан (после него в приложении появятся данные)
cd .. && ./venv/bin/python daily_scan.py
```

Дальше: **Сегодня** (утренний инбокс), **Дашборд** (скор здоровья + «дожать за
один ход»), **Пульт** (токены, переобход, AI-боты, двери в кабинеты), **Рой**
(топология агентов) и орб чата в углу — это ассистент. Повесьте `daily_scan.py`
и `swarm/orchestrator.py analyst` на cron/launchd — получите автопилот.

## Модель безопасности (важно)

- **Ваши токены не покидают вашу машину** — всё локально, `.env` в git-ignore.
- Мост **никогда не пушит в main**: правки в отдельной ветке `mrseo/*` с
  проверкой билда; merge — всегда ваш клик.
- Черновики контента — файлы на вычитку, само ничего не публикуется.
- Ассистент работает со строгим allowlist инструментов.

## Статус: честная альфа

Собрано и обкатано на трёх живых сайтах автора (подтверждённые топ-3/топ-10),
но установка пока ручная и шероховатости гарантированы. Issues и PR очень
приветствуются. Бесплатно, пока вместе полируем машину.

## License

MIT © Anton (@lowlightconnect)
