# Метод аудита SEO/GEO — scoring + reference-analyzer

> Взято из website-builder-template (Yury Demin) 2026-06-29, адаптировано под наш стек.
> Два инструмента: (1) числовой scoring 1-100 для трекинга готовности, (2) 3-level анализ референсов/конкурентов.

## 1. SEO/GEO Scoring (1-100) — измеримость прогресса

Прогонять при каждом живом аудите, писать число рядом с позициями. Цель — видеть динамику готовности (60→75→85), а не только позиции.

### SEO score (вес 100)
- Техника 25: title<60/meta<155/canonical/OG/sitemap/robots/CWV — есть=full
- Позиции 35: доля ВЧ-таргетов в топ-10 (×20) + топ-3 (×15)
- Динамика 20: тренд позиций за 30д (растёт=20, плато=10, падает=0)
- Покрытие 20: число ранжируемых запросов vs потенциал ниши

### GEO score (вес 100)
- Schema 25: Organization/FAQPage/Speakable/AggregateRating/Breadcrumb
- Цитируемость 25: списки/FAQ-формат/факт-блоки/E-E-A-T
- LLM-видимость 30: реальные цитаты в Нейро/ChatGPT/Perplexity (ai_visibility.py SoV)
- Off-page/co-citation 20: 2ГИС+Я.Бизнес+Zoon согласованы, упоминания бренда

Источники чисел: daily_snapshots (позиции), query_analytics (покрытие/CTR),
ai_visibility (LLM SoV), reputation (co-citation сигнал).

## 2. Reference-analyzer — 3-level fallback (для саитодела/конкурентов)

Анализ референса/конкурента с деградацией по доступным инструментам:

- **L1 MCP (HIGH)**: Chrome DevTools/Firecrawl/Apify → DOM, CSS-переменные, шрифты, цвета, скриншоты → полный структурный разбор
- **L2 Web (MEDIUM)**: web_search + web_open_url → видимые секции, заголовки, CTA, общая схема → черновик с пометками [APPROXIMATE]
- **L3 Manual (LOW)**: шаблон с полями для ручного заполнения

Multi-source: каждый источник (primary/secondary/competitor) обрабатывается
независимо со своим confidence, затем merge в единый отчёт со сводной таблицей
| Source | URL | Type | Focus | Confidence |.

Применять: при разборе конкурентов (дополняет competitors_scan) и в saytodel
перед DESIGN-BRIEF.
