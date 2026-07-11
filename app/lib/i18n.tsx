"use client";

/**
 * Лёгкая интернационализация Mr.Seo (RU/EN) — без next-intl, один бандл.
 *
 *  • DICT — плоский словарь: ключ вида "nav.today" → строка на каждый язык.
 *    Блок DICT ниже собирается из фрагментов скриптом scripts/build-i18n.mjs
 *    (между маркерами i18n:dict:start / i18n:dict:end) — правьте фрагменты в
 *    scripts/i18n-frags/*.json, а не руками этот массив.
 *  • LangProvider — контекст + localStorage 'mrseo-lang'. Дефолт: язык браузера
 *    (navigator.language.startsWith('ru') ? 'ru' : 'en').
 *  • useT() → { t, tn, lang, setLang }.
 *      t(key, params?) — строка с подстановкой {name}.
 *      tn(nounKey, n)  — слово во множественной форме (noun.<key>.<form>),
 *                        для en — one/other, для ru — one/few/many.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Lang = "ru" | "en";

/* i18n:dict:start */
export const DICT: Record<Lang, Record<string, string>> = {
  ru: {
    "chat.ask": "Спросить Mr.Seo",
    "chat.close_chat": "Закрыть чат",
    "chat.disclaimer": "Мозг подключается отдельно · сейчас демо-ответы",
    "chat.fetch_failed": "Не удалось получить ответ. Мозг Mr.Seo ещё подключается.",
    "chat.greet_body": "Слежу за позициями и объясняю простым языком, что происходит и что делать.",
    "chat.greet_title": "Привет, я Mr.Seo",
    "chat.input_aria": "Сообщение для Mr.Seo",
    "chat.placeholder": "Спросите про своё SEO…",
    "chat.status_idle": "Готов помочь",
    "chat.status_speaking": "Отвечаю…",
    "chat.status_thinking": "Думаю…",
    "chat.sugg_1": "Что сделать на этой неделе?",
    "chat.sugg_2": "Почему просела Столица?",
    "chat.sugg_3": "Как дела у проекта?",
    "chat.suggests": "Mr.Seo предлагает",
    "common.cancel": "Отмена",
    "common.prio_high": "Высокий",
    "common.prio_medium": "Средний",
    "common.prio_low": "Низкий",
    // wizard
    "wiz.step_site": "Сайт", "wiz.step_connect": "Подключения", "wiz.step_done": "Готово",
    "wiz.new_project": "Новый проект", "wiz.connect_site": "Подключить сайт",
    "wiz.submit": "Отправить заявку рою", "wiz.name_label": "Название проекта",
    "wiz.name_ph": "Напр. Кофейня «Тёплый»", "wiz.url_label": "Адрес сайта",
    "wiz.url_hint": "Достаточно главной страницы — рой сам обойдёт остальные.",
    "wiz.oauth_label": "OAuth-токен", "wiz.apikey_label": "API-ключ", "wiz.optional": "необязательно",
    "wiz.bing_hint": "Резервный источник. Ключ выдаётся в Bing Webmaster Tools → Settings → API access.",
    "wiz.sa_confirm": "Я добавил сервисный аккаунт в Search Console",
    "wiz.done_title": "Заявка принята роем",
    "wiz.connect_intro": "Подключите то, что есть под рукой. Любой источник можно добавить позже — рой начнёт собирать данные, как только появится доступ.",
    "wiz.yandex_hint": "Токен берётся в кабинете Яндекс.OAuth, user_id — в адресной строке Вебмастера. Пара даёт доступ к позициям и запросам.",
    "wiz.sa_intro": "Добавьте этот сервисный аккаунт пользователем в Search Console (Настройки → Пользователи и разрешения → Добавить, роль «Полный»):",
    "wiz.done_body": "Mr.Seo начнёт собирать данные по «{name}», как только подключения станут активны. Первый скан появится в ближайшем ночном прогоне.",
    "wiz.new_site": "новому сайту", "wiz.yandex_title": "Яндекс.Вебмастер",
    // analytics
    "analytics.eyebrow": "Глубокая аналитика", "analytics.title": "Что под капотом",
    "analytics.llm_title": "Нейросети про вас", "analytics.llm_sub": "упоминаний бренда в ответах нейросетей",
    "analytics.llm_empty_t": "Замер ещё не проводился",
    "analytics.llm_empty_b": "LLM-видимость снимается по понедельникам. Как только пройдёт ближайший прогон — здесь появится результат.",
    "analytics.llm_rivals": "Кого цитируют вместо / рядом",
    "analytics.qa_title": "Точные метрики Яндекса", "analytics.qa_empty_t": "Детальная выгрузка ещё не собрана",
    "analytics.qa_empty_b": "Как только Яндекс.Вебмастер отдаст статистику запросов, здесь появятся позиции, CTR и спрос.",
    "analytics.demand": "спрос",
    "analytics.serp_title": "Независимая проверка", "analytics.serp_empty_t": "Контрольный замер ещё не делали",
    "analytics.serp_empty_b": "Раз в несколько дней рой проверяет выдачу через сторонний движок — без нашего доступа к аналитике.",
    "analytics.serp_sub": "Позиции глазами постороннего ({engine}) — независимо от того, что показывает наш Вебмастер.",
    "analytics.serp_top": "топ выдачи", "analytics.out30": "вне топ-30", "common.pos_short": "поз.",
    "account.valid_until": "Лицензия действует до", "account.this_device": "Это устройство",
    "account.sign_out": "Выйти", "account.signing_out": "Выходим…", "account.your_account": "вашего аккаунта",
    "dash.queries": "запросов", "dash.in_top10": "в топ-10", "dash.no_answer": "нет ответа от источника",
    "runs.eyebrow": "Рой · дневник", "runs.title": "Сводки аналитика",
    "runs.lede": "Ежедневный разбор: что изменилось, где шум окна, а где реальный тренд, и что делать.",
    "bell.on": "Уведомления включены", "bell.blocked": "Уведомления заблокированы в браузере",
    "bell.enable": "Включить уведомления о делах",
    "bell.enabled_body": "Уведомления включены — сообщу, когда появятся дела.",
    "bell.one_waits": "дело ждёт клика", "bell.many_wait": "дел(а) ждут клика",
    "common.back": "Назад", "common.next": "Дальше",
    "common.close": "Закрыть",
    "common.copied": "Скопировано",
    "common.copy": "Скопировать",
    "common.copy_label": "Копировать",
    "common.copy_path": "Путь",
    "common.dispatch": "Поручить рою",
    "common.dispatch_short": "Поручить",
    "common.empty_dash": "—",
    "common.loading": "Загрузка…",
    "common.queued": "в очереди",
    "common.read": "Читать",
    "common.reply": "Ответить",
    "common.retry": "Ещё раз",
    "common.save": "Сохранить",
    "common.send": "Отправить",
    "common.sending": "Отправляю…",
    "common.update_key": "Обновить ключ",
    "diag.appeared": "появилось",
    "diag.cannibal_empty_body": "Ни один запрос не тянут за собой сразу несколько страниц — сигналы не размываются.",
    "diag.cannibal_empty_title": "Каннибализации нет",
    "diag.cannibal_title": "Каннибализация",
    "diag.decay_empty_body": "За 28 дней позиции целевых запросов держатся или растут — проседающих нет.",
    "diag.decay_empty_title": "Ничего не угасает",
    "diag.decay_title": "Угасание",
    "diag.dropped_on": "выпала {date}",
    "diag.excl_ok_body": "За период ни одна страница не выпала из поиска. Так и держим.",
    "diag.excl_ok_title": "Яндекс ничего не выкинул",
    "diag.excluded_title": "Выпавшие из поиска",
    "diag.eyebrow": "Диагноз",
    "diag.imp_abbr": "{n} пок.",
    "diag.links_empty_body": "Как только Вебмастер отдаст внешние ссылки, здесь появятся тотал и свежие доноры.",
    "diag.links_empty_title": "Данных по ссылкам пока нет",
    "diag.links_short": "Ссылки",
    "diag.links_title": "Внешние ссылки",
    "diag.note": "Что Яндекс выкинул из поиска, где страницы конкурируют друг с другом и где позиции угасают.",
    "diag.removed": "выпало",
    "diag.shown_of": "показаны {n} из {total} — остальные в Вебмастере",
    "diag.sqi_caption": "индекс качества сайта",
    "diag.sqi_ctx": "изменение за период: {delta}; метрика Яндекса",
    "diag.sqi_empty_body": "Индекс качества сайта Яндекс отдаёт не сразу. Появится после ближайшей синхронизации Вебмастера.",
    "diag.sqi_empty_title": "ИКС ещё не приходил",
    "diag.sqi_metric": "ИКС (индекс качества сайта)",
    "diag.sqi_short": "ИКС",
    "diag.sqi_title": "ИКС · Яндекс",
    "diag.title": "Что болит",
    "explain.error": "Мозг сейчас недоступен — попробуйте ещё раз чуть позже.",
    "explain.explain_metric": "Объяснить: {metric}",
    "explain.explanation_of": "Объяснение: {metric}",
    "explain.thinking": "думаю над ответом…",
    "explain.title": "Mr.Seo объясняет",
    "focus.exec_human": "делает человек",
    "focus.exec_roy": "рой сделает сам",
    "focus.subtitle": "Три дела с максимальной отдачей на эту неделю — мозг выбрал их из всех данных.",
    "focus.thinking": "Мозг думает над фокусом…",
    "focus.thinking_sub": "это может занять пару минут",
    "focus.title": "Фокус недели",
    "insights.demand": "спрос {n}",
    "insights.dispatch_done": "в очереди роя",
    "insights.forge_chars": "· {n}к зн.",
    "insights.forge_cta": "Статья",
    "insights.forge_done": "Черновик готов",
    "insights.forge_eta": "· ~2–4 мин",
    "insights.forge_writing": "Мозг пишет…",
    "insights.has_new": "есть новые!",
    "insights.new_in_7d": "+{n} {word} за 7 дней — ответьте им",
    "insights.no_new": "без новых",
    "insights.on_edge": "На грани топа",
    "insights.out_of_top": "вне топа",
    "insights.pos_abbr": "поз",
    "insights.position_of": "Позиция «{query}»",
    "insights.qp_desc": "Какая страница за какие запросы отвечает. Разверните страницу — увидите её запросы и позиции.",
    "insights.qp_empty_body": "Как только Вебмастер отдаст статистику по URL, здесь появится карта: какая страница за что отвечает.",
    "insights.qp_empty_title": "Связка запрос ↔ страница ещё не собрана",
    "insights.qp_title": "Запрос ↔ страница",
    "insights.qw_ctx": "источник {src}, {demand}; запрос у границы топа",
    "insights.qw_empty_body": "Здесь появятся запросы у самой границы топа — те, что можно дожать одним точечным движением. Ближайший скан соберёт их автоматически.",
    "insights.qw_empty_title": "Быстрых побед пока нет",
    "insights.rating_ctx": "{n} отзывов на Яндекс.Картах; шкала 1–5★",
    "insights.rating_of": "Рейтинг · {label}",
    "insights.reputation": "Репутация · Я.Карты",
    "insights.reviews_empty_body": "Мониторить отзывы можно только по карточкам организации на Яндекс.Картах. Как только точка появится и подключится — рейтинг и свежие отзывы придут сюда.",
    "insights.reviews_empty_title": "У этого проекта нет точек на Я.Картах",
    "insights.shown": "показаны {n}",
    "nav.account": "Аккаунт",
    "nav.badge_actions": "{label} · {count} действий ждут",
    "nav.brand_home": "Mr.Seo — на главную",
    "nav.channel": "КАНАЛ",
    "nav.dashboard": "Дашборд",
    "nav.hypotheses": "Гипотезы",
    "nav.lang": "Язык",
    "nav.nodes": "Узлы",
    "nav.pult": "Пульт",
    "nav.report": "Отчёт",
    "nav.roy": "Рой",
    "nav.roy_connecting": "Рой подключается…",
    "nav.roy_node_fail": " · сбой узла",
    "nav.roy_working": "Рой: {count} в работе",
    "nav.runs": "Сводки",
    "nav.timeline": "Динамика",
    "nav.today": "Сегодня",
    "noun.conflict.few": "конфликта",
    "noun.conflict.many": "конфликтов",
    "noun.conflict.one": "конфликт",
    "noun.conflict.other": "конфликтов",
    "noun.donor.few": "донора",
    "noun.donor.many": "доноров",
    "noun.donor.one": "донор",
    "noun.donor.other": "доноров",
    "noun.impression.few": "показа",
    "noun.impression.many": "показов",
    "noun.impression.one": "показ",
    "noun.impression.other": "показов",
    "noun.new.few": "новых",
    "noun.new.many": "новых",
    "noun.new.one": "новый",
    "noun.new.other": "новых",
    "noun.query.few": "запроса",
    "noun.query.many": "запросов",
    "noun.query.one": "запрос",
    "noun.query.other": "запросов",
    "noun.review.few": "отзыва",
    "noun.review.many": "отзывов",
    "noun.review.one": "отзыв",
    "noun.review.other": "отзывов",
    "noun.task.few": "задачи",
    "noun.task.many": "задач",
    "noun.task.one": "задача",
    "noun.task.other": "задач",
    "today.awaits_click": "Ждёт твоего клика",
    "today.eyebrow": "Утренняя сводка",
    "today.inbox_zero_body": "Ни одной задачи, требующей вашего решения. Рой продолжает работать в фоне — новые появятся здесь.",
    "today.inbox_zero_title": "Inbox zero — всё разгребено 🎉",
    "today.kind_alert": "Тревога",
    "today.kind_draft": "Черновик",
    "today.kind_merge": "Слить ветку",
    "today.kind_review": "Ответить",
    "today.kind_task": "В очереди",
    "today.kind_verify": "Проверить",
    "today.lede": "Что рой сделал ночью и что ждёт вашего клика. За полминуты — вся картина дня.",
    "today.night_did": "Ночью рой сделал",
    "today.night_empty_body": "За ночь не было ни сканов, ни правок. Ближайший цикл соберёт свежие данные автоматически.",
    "today.night_empty_title": "Рой спал",
    "today.roy_history": "История роя",
    "today.roy_will": "рой займётся",
    "today.run_busy": "запускаю…",
    "today.run_done": "✓ запущено",
    "today.run_failed": "не вышло",
    "today.run_started": "запущено",
    "today.scan": "скан {date}",
    "today.tasks_done": "{count} {word} выполнено",
    "today.to_blog": "В блог",
    "today.to_blog_hint": "Перенесём в блог после вашей вычитки",
  },
  en: {
    "chat.ask": "Ask Mr.Seo",
    "chat.close_chat": "Close chat",
    "chat.disclaimer": "The brain connects separately · demo replies for now",
    "chat.fetch_failed": "Couldn't get a reply. Mr.Seo's brain is still connecting.",
    "chat.greet_body": "I track your rankings and explain in plain words what's happening and what to do.",
    "chat.greet_title": "Hi, I'm Mr.Seo",
    "chat.input_aria": "Message to Mr.Seo",
    "chat.placeholder": "Ask about your SEO…",
    "chat.status_idle": "Ready to help",
    "chat.status_speaking": "Answering…",
    "chat.status_thinking": "Thinking…",
    "chat.sugg_1": "What should I do this week?",
    "chat.sugg_2": "Why did Moscow slip?",
    "chat.sugg_3": "How's the project doing?",
    "chat.suggests": "Mr.Seo suggests",
    "common.cancel": "Cancel",
    "common.prio_high": "High",
    "common.prio_medium": "Medium",
    "common.prio_low": "Low",
    // wizard
    "wiz.step_site": "Site", "wiz.step_connect": "Connections", "wiz.step_done": "Done",
    "wiz.new_project": "New project", "wiz.connect_site": "Connect a site",
    "wiz.submit": "Send to the swarm", "wiz.name_label": "Project name",
    "wiz.name_ph": "e.g. Warm Coffee Shop", "wiz.url_label": "Site URL",
    "wiz.url_hint": "The homepage is enough — the swarm will crawl the rest.",
    "wiz.oauth_label": "OAuth token", "wiz.apikey_label": "API key", "wiz.optional": "optional",
    "wiz.bing_hint": "Backup source. Get the key in Bing Webmaster Tools → Settings → API access.",
    "wiz.sa_confirm": "I've added the service account to Search Console",
    "wiz.done_title": "Request accepted by the swarm",
    "wiz.connect_intro": "Connect whatever you have at hand. Any source can be added later — the swarm starts collecting as soon as access appears.",
    "wiz.yandex_hint": "Get the token at Yandex.OAuth; user_id is in the Webmaster address bar. Together they unlock positions and queries.",
    "wiz.sa_intro": "Add this service account as a user in Search Console (Settings → Users and permissions → Add, Full access):",
    "wiz.done_body": "Mr.Seo will start collecting data for “{name}” once connections go live. The first scan lands in the next nightly run.",
    "wiz.new_site": "the new site", "wiz.yandex_title": "Yandex.Webmaster",
    // analytics
    "analytics.eyebrow": "Deep analytics", "analytics.title": "Under the hood",
    "analytics.llm_title": "AI engines about you", "analytics.llm_sub": "brand mentions in AI answers",
    "analytics.llm_empty_t": "No measurement yet",
    "analytics.llm_empty_b": "LLM visibility is measured on Mondays. Results appear right after the next run.",
    "analytics.llm_rivals": "Cited instead / alongside",
    "analytics.qa_title": "Precise Yandex metrics", "analytics.qa_empty_t": "Detailed export not collected yet",
    "analytics.qa_empty_b": "Once Yandex Webmaster returns query stats, positions, CTR and demand appear here.",
    "analytics.demand": "demand",
    "analytics.serp_title": "Independent check", "analytics.serp_empty_t": "No control check yet",
    "analytics.serp_empty_b": "Every few days the swarm checks rankings via a third-party engine — no access to our analytics.",
    "analytics.serp_sub": "Rankings through a stranger's eyes ({engine}) — independent of what our Webmaster shows.",
    "analytics.serp_top": "top result", "analytics.out30": "outside top-30", "common.pos_short": "pos.",
    "account.valid_until": "License valid until", "account.this_device": "This device",
    "account.sign_out": "Sign out", "account.signing_out": "Signing out…", "account.your_account": "your account",
    "dash.queries": "queries", "dash.in_top10": "in top-10", "dash.no_answer": "no response from source",
    "runs.eyebrow": "Swarm · journal", "runs.title": "Analyst digests",
    "runs.lede": "Daily breakdown: what changed, what is window noise vs a real trend, and what to do.",
    "bell.on": "Notifications enabled", "bell.blocked": "Notifications blocked by the browser",
    "bell.enable": "Enable task notifications",
    "bell.enabled_body": "Notifications on — I'll ping you when tasks appear.",
    "bell.one_waits": "task awaits your click", "bell.many_wait": "tasks await your click",
    "common.back": "Back", "common.next": "Next",
    "common.close": "Close",
    "common.copied": "Copied",
    "common.copy": "Copy",
    "common.copy_label": "Copy",
    "common.copy_path": "Path",
    "common.dispatch": "Dispatch to swarm",
    "common.dispatch_short": "Dispatch",
    "common.empty_dash": "—",
    "common.loading": "Loading…",
    "common.queued": "queued",
    "common.read": "Read",
    "common.reply": "Reply",
    "common.retry": "Try again",
    "common.save": "Save",
    "common.send": "Send",
    "common.sending": "Sending…",
    "common.update_key": "Update key",
    "diag.appeared": "appeared",
    "diag.cannibal_empty_body": "No query is split across several pages — signals stay focused.",
    "diag.cannibal_empty_title": "No cannibalization",
    "diag.cannibal_title": "Cannibalization",
    "diag.decay_empty_body": "Over 28 days target queries hold or climb — none are slipping.",
    "diag.decay_empty_title": "Nothing is fading",
    "diag.decay_title": "Decay",
    "diag.dropped_on": "dropped {date}",
    "diag.excl_ok_body": "No page fell out of search this period. Keep it up.",
    "diag.excl_ok_title": "Yandex dropped nothing",
    "diag.excluded_title": "Dropped from search",
    "diag.eyebrow": "Diagnosis",
    "diag.imp_abbr": "{n} impr.",
    "diag.links_empty_body": "Once Webmaster returns external links, the total and fresh donors will show here.",
    "diag.links_empty_title": "No link data yet",
    "diag.links_short": "Links",
    "diag.links_title": "External links",
    "diag.note": "What Yandex dropped from search, where pages compete with each other, and where positions are fading.",
    "diag.removed": "removed",
    "diag.shown_of": "showing {n} of {total} — the rest are in Webmaster",
    "diag.sqi_caption": "site quality index",
    "diag.sqi_ctx": "change over the period: {delta}; a Yandex metric",
    "diag.sqi_empty_body": "Yandex's Site Quality Index isn't returned instantly. It'll appear after the next Webmaster sync.",
    "diag.sqi_empty_title": "SQI hasn't arrived yet",
    "diag.sqi_metric": "SQI (Site Quality Index)",
    "diag.sqi_short": "SQI",
    "diag.sqi_title": "SQI · Yandex",
    "diag.title": "What hurts",
    "explain.error": "The brain is unavailable right now — try again in a moment.",
    "explain.explain_metric": "Explain: {metric}",
    "explain.explanation_of": "Explanation: {metric}",
    "explain.thinking": "thinking it over…",
    "explain.title": "Mr.Seo explains",
    "focus.exec_human": "you do it",
    "focus.exec_roy": "swarm handles it",
    "focus.subtitle": "The three highest-leverage moves for this week — the brain picked them from all the data.",
    "focus.thinking": "The brain is choosing the focus…",
    "focus.thinking_sub": "this can take a couple of minutes",
    "focus.title": "Focus of the week",
    "insights.demand": "demand {n}",
    "insights.dispatch_done": "in swarm queue",
    "insights.forge_chars": "· {n}k chars",
    "insights.forge_cta": "Article",
    "insights.forge_done": "Draft ready",
    "insights.forge_eta": "· ~2–4 min",
    "insights.forge_writing": "Brain is writing…",
    "insights.has_new": "new ones!",
    "insights.new_in_7d": "+{n} {word} in 7 days — reply to them",
    "insights.no_new": "no new",
    "insights.on_edge": "On the edge of the top",
    "insights.out_of_top": "out of top",
    "insights.pos_abbr": "pos",
    "insights.position_of": "Position of “{query}”",
    "insights.qp_desc": "Which page answers which queries. Expand a page to see its queries and positions.",
    "insights.qp_empty_body": "Once Webmaster returns per-URL stats, a map appears here: which page is responsible for what.",
    "insights.qp_empty_title": "The query ↔ page map isn't built yet",
    "insights.qp_title": "Query ↔ page",
    "insights.qw_ctx": "source {src}, {demand}; query on the edge of the top",
    "insights.qw_empty_body": "This is where queries right on the edge of the top show up — the ones you can push over with a single move. The next scan collects them automatically.",
    "insights.qw_empty_title": "No quick wins yet",
    "insights.rating_ctx": "{n} reviews on Yandex Maps; 1–5★ scale",
    "insights.rating_of": "Rating · {label}",
    "insights.reputation": "Reputation · Ya.Maps",
    "insights.reviews_empty_body": "Review monitoring works only through a business listing on Yandex Maps. As soon as a location is added and linked, its rating and fresh reviews land here.",
    "insights.reviews_empty_title": "This project has no locations on Ya.Maps",
    "insights.shown": "showing {n}",
    "nav.account": "Account",
    "nav.badge_actions": "{label} · {count} awaiting you",
    "nav.brand_home": "Mr.Seo — home",
    "nav.channel": "CHANNEL",
    "nav.dashboard": "Dashboard",
    "nav.hypotheses": "Hypotheses",
    "nav.lang": "Language",
    "nav.nodes": "Nodes",
    "nav.pult": "Console",
    "nav.report": "Report",
    "nav.roy": "Swarm",
    "nav.roy_connecting": "Swarm is connecting…",
    "nav.roy_node_fail": " · node fault",
    "nav.roy_working": "Swarm: {count} working",
    "nav.runs": "Digests",
    "nav.timeline": "Trends",
    "nav.today": "Today",
    "noun.conflict.few": "conflicts",
    "noun.conflict.many": "conflicts",
    "noun.conflict.one": "conflict",
    "noun.conflict.other": "conflicts",
    "noun.donor.few": "donors",
    "noun.donor.many": "donors",
    "noun.donor.one": "donor",
    "noun.donor.other": "donors",
    "noun.impression.few": "impressions",
    "noun.impression.many": "impressions",
    "noun.impression.one": "impression",
    "noun.impression.other": "impressions",
    "noun.new.few": "new",
    "noun.new.many": "new",
    "noun.new.one": "new",
    "noun.new.other": "new",
    "noun.query.few": "queries",
    "noun.query.many": "queries",
    "noun.query.one": "query",
    "noun.query.other": "queries",
    "noun.review.few": "reviews",
    "noun.review.many": "reviews",
    "noun.review.one": "review",
    "noun.review.other": "reviews",
    "noun.task.few": "tasks",
    "noun.task.many": "tasks",
    "noun.task.one": "task",
    "noun.task.other": "tasks",
    "today.awaits_click": "Waiting for your click",
    "today.eyebrow": "Morning briefing",
    "today.inbox_zero_body": "Nothing needs your decision right now. The swarm keeps working in the background — new items will show up here.",
    "today.inbox_zero_title": "Inbox zero — all cleared 🎉",
    "today.kind_alert": "Alert",
    "today.kind_draft": "Draft",
    "today.kind_merge": "Merge branch",
    "today.kind_review": "Reply",
    "today.kind_task": "Queued",
    "today.kind_verify": "Verify",
    "today.lede": "What the swarm did overnight and what's waiting for your click. The whole day in half a minute.",
    "today.night_did": "Overnight the swarm did",
    "today.night_empty_body": "No scans or edits overnight. The next cycle collects fresh data automatically.",
    "today.night_empty_title": "The swarm slept",
    "today.roy_history": "Swarm history",
    "today.roy_will": "swarm will handle it",
    "today.run_busy": "starting…",
    "today.run_done": "✓ started",
    "today.run_failed": "didn't work",
    "today.run_started": "started",
    "today.scan": "scan {date}",
    "today.tasks_done": "{count} {word} done",
    "today.to_blog": "To blog",
    "today.to_blog_hint": "We'll move it to the blog after your proofread",
  },
};
/* i18n:dict:end */

const STORAGE_KEY = "mrseo-lang";

function detectLang(): Lang {
  if (typeof navigator === "undefined") return "ru";
  return navigator.language?.toLowerCase().startsWith("ru") ? "ru" : "en";
}

/** Форма множественного числа: en → one/other, ru → one/few/many. */
function pluralForm(lang: Lang, n: number): "one" | "few" | "many" | "other" {
  const abs = Math.abs(n);
  if (lang === "en") return abs === 1 ? "one" : "other";
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return "one";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "few";
  return "many";
}

function interpolate(str: string, params?: Record<string, string | number>): string {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (m, k) =>
    k in params ? String(params[k]) : m
  );
}

export interface TApi {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Строка по плоскому ключу с подстановкой {name}. Фолбэк: ru → сам ключ. */
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Слово во множественной форме по ключу noun.<nounKey>.<form>. */
  tn: (nounKey: string, n: number) => string;
}

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
}
const LangContext = createContext<LangCtx | null>(null);

export function LangProvider({ children }: { children: React.ReactNode }) {
  // SSR-стабильный дефолт 'ru' (html lang="ru"); реальный язык подхватываем на клиенте.
  const [lang, setLangState] = useState<Lang>("ru");

  useEffect(() => {
    const saved = (typeof localStorage !== "undefined"
      ? (localStorage.getItem(STORAGE_KEY) as Lang | null)
      : null);
    const next = saved === "ru" || saved === "en" ? saved : detectLang();
    setLangState(next);
  }, []);

  // держим <html lang> в синхроне
  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useT(): TApi {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useT must be used within LangProvider");
  const { lang, setLang } = ctx;

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const raw = DICT[lang][key] ?? DICT.ru[key] ?? key;
      return interpolate(raw, params);
    },
    [lang]
  );

  const tn = useCallback(
    (nounKey: string, n: number) => {
      const form = pluralForm(lang, n);
      const base = `noun.${nounKey}`;
      const val =
        DICT[lang][`${base}.${form}`] ??
        DICT[lang][`${base}.other`] ??
        DICT[lang][`${base}.many`] ??
        DICT.ru[`${base}.${form}`] ??
        nounKey;
      return val;
    },
    [lang]
  );

  return { lang, setLang, t, tn };
}
