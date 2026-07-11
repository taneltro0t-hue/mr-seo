"""
Ежедневный скан позиций по всем 3 сайтам.
Запускается локально через launchd 09:00 МСК.

Что делает:
1. Собирает GSC + Yandex Webmaster данные (без вызова Anthropic API)
2. Вытягивает позиции по target_keywords + всем queries
3. Сохраняет snapshot в memory/{site}/daily_snapshots/YYYY-MM-DD.json
4. Считает дельты vs вчера и vs 7 дней назад
5. Пишет markdown-отчёт в reports/daily_YYYY-MM-DD.md
"""
import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import quote

import requests
from dotenv import load_dotenv

from sites_config import SITES

load_dotenv()
ROOT = Path(__file__).parent
MEM = ROOT / "memory"
REPORTS = ROOT / "reports"
TODAY = datetime.now().strftime("%Y-%m-%d")


def gsc_positions(site_url: str) -> dict:
    """Тянет GSC search analytics за последние 7 дней. Возвращает {query: {position, clicks, impressions}}.

    Использует OAuth user-credentials (credentials/gsc_token.json), а не service account,
    т.к. service account не Owner ни одного сайта (даёт 403).
    """
    try:
        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request
        from googleapiclient.discovery import build
    except ImportError:
        return {"error": "google-api-python-client не установлен"}

    # Единый клиент: retry на SSL-флейки + атомарная запись токена — gsc_client.py
    try:
        from gsc_client import get_service, GSCAuthError
        svc = get_service()
    except Exception as e:
        return {"error": str(e)[:300]}
    end = datetime.now().strftime("%Y-%m-%d")
    start = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")

    try:
        all_rows = []
        start_row = 0
        while True:
            resp = svc.searchanalytics().query(siteUrl=site_url, body={
                "startDate": start, "endDate": end,
                "dimensions": ["query"], "rowLimit": 1000, "startRow": start_row,
            }).execute()
            rows = resp.get("rows", [])
            all_rows.extend(rows)
            if len(rows) < 1000:
                break
            start_row += 1000
        return {
            r["keys"][0]: {
                "position": round(r.get("position", 0), 2),
                "clicks": r.get("clicks", 0),
                "impressions": r.get("impressions", 0),
                "ctr": round(r.get("ctr", 0) * 100, 2),
            }
            for r in all_rows
        }
    except Exception as e:
        return {"error": str(e)[:300]}


def yandex_positions(host_id: str) -> dict:
    """Тянет популярные запросы из Yandex Webmaster. Возвращает {query: {position, shows, clicks, ctr}}.

    Yandex Webmaster v4 возвращает только ОДИН query_indicator за вызов,
    поэтому делаем 3 параллельных запроса и сливаем по query_text.
    """
    token = os.getenv("YANDEX_OAUTH_TOKEN")
    uid = os.getenv("YANDEX_USER_ID")
    if not token or not uid:
        return {"error": "YANDEX_OAUTH_TOKEN/YANDEX_USER_ID не заданы"}

    host_enc = quote(host_id, safe="")
    base = f"https://api.webmaster.yandex.net/v4/user/{uid}/hosts/{host_enc}"
    h = {"Authorization": f"OAuth {token}"}

    def fetch(indicator: str) -> dict:
        out = {}
        r = requests.get(
            f"{base}/search-queries/popular/", headers=h,
            params={"order_by": "TOTAL_SHOWS", "query_indicator": indicator},
            timeout=20,
        )
        r.raise_for_status()
        payload = r.json()
        # Яндекс на 401/403/прочие беды возвращает JSON с error_code —
        # без проверки это превращалось в тихие «Yandex: 0 зпр»
        if isinstance(payload, dict) and "error_code" in payload:
            raise RuntimeError(f"{payload['error_code']}: {payload.get('error_message', '')[:200]}")
        for item in payload.get("queries", []):
            text = item.get("query_text") or item.get("text", "")
            if text:
                out[text] = item.get("indicators", {}).get(indicator, 0)
        return out

    try:
        shows = fetch("TOTAL_SHOWS")
        clicks = fetch("TOTAL_CLICKS")
        positions = fetch("AVG_SHOW_POSITION")
        merged = {}
        for q in shows:
            sh = float(shows.get(q, 0) or 0)
            cl = float(clicks.get(q, 0) or 0)
            merged[q] = {
                "shows": int(sh),
                "clicks": int(cl),
                "position": round(float(positions.get(q, 0) or 0), 2),
                "ctr": round((cl / sh * 100), 2) if sh else 0.0,
            }
        return merged
    except Exception as e:
        return {"error": str(e)[:300]}


def load_snapshot(site_key: str, date: str) -> dict | None:
    p = MEM / site_key / "daily_snapshots" / f"{date}.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def save_snapshot(site_key: str, snap: dict):
    d = MEM / site_key / "daily_snapshots"
    d.mkdir(parents=True, exist_ok=True)
    (d / f"{TODAY}.json").write_text(json.dumps(snap, ensure_ascii=False, indent=2))


def compute_deltas(today: dict, prev: dict | None, source: str) -> list:
    """Возвращает список изменений: [(query, today_pos, delta), ...]"""
    if not prev:
        return []
    today_q = today.get(source, {})
    prev_q = prev.get(source, {})
    if not isinstance(today_q, dict) or not isinstance(prev_q, dict):
        return []
    deltas = []
    for q, data in today_q.items():
        if not isinstance(data, dict) or "position" not in data:
            continue
        cur_pos = data["position"]
        if cur_pos == 0:
            continue
        prev_pos = prev_q.get(q, {}).get("position", 0)
        if prev_pos == 0:
            continue
        delta = round(prev_pos - cur_pos, 2)  # positive = улучшение
        if abs(delta) < 0.5:
            continue
        deltas.append((q, cur_pos, delta, data.get("clicks", 0)))
    deltas.sort(key=lambda x: -x[2])
    return deltas


def bing_positions(site_url: str) -> dict:
    """Тянет Bing Webmaster QueryStats. Возвращает {query: {position, clicks, impressions}}.
    Bing = ось ChatGPT Search — прямой замер AI-канала. РФ-трафик мал, но индикативен.
    """
    key = os.getenv("BING_API_KEY")
    if not key:
        return {"error": "BING_API_KEY не задан"}
    if not site_url.endswith("/"):
        site_url += "/"
    try:
        r = requests.get("https://ssl.bing.com/webmaster/api.svc/json/GetQueryStats",
                         params={"apikey": key, "siteUrl": site_url}, timeout=25)
        r.raise_for_status()
        rows = r.json().get("d", [])
        out = {}
        for q in rows:
            text = q.get("Query", "")
            if not text:
                continue
            out[text] = {
                "position": round(float(q.get("AvgImpressionPosition", 0) or 0), 2),
                "clicks": int(q.get("Clicks", 0) or 0),
                "impressions": int(q.get("Impressions", 0) or 0),
            }
        return out
    except Exception as e:
        return {"error": str(e)[:200]}


def scan_site(site_key: str) -> dict:
    info = SITES[site_key]
    print(f"\n=== {info['domain']} ===")
    snap = {
        "site_key": site_key,
        "domain": info["domain"],
        "date": TODAY,
        "scanned_at": datetime.now().isoformat(),
        "google": gsc_positions(info.get("gsc_site_url", info["url"])),
        "yandex": yandex_positions(info["yandex_host_id"]),
        "bing": bing_positions(info["url"]),
    }
    g = snap["google"]
    y = snap["yandex"]
    g_count = len([k for k in g if k != "error"]) if isinstance(g, dict) else 0
    y_count = len([k for k in y if k != "error"]) if isinstance(y, dict) else 0
    b = snap["bing"]
    b_count = len([k for k in b if k != "error"]) if isinstance(b, dict) else 0
    print(f"  Google: {g_count} запросов")
    print(f"  Yandex: {y_count} запросов")
    print(f"  Bing:   {b_count} запросов")
    save_snapshot(site_key, snap)
    return snap


def render_report(snapshots: dict):
    REPORTS.mkdir(exist_ok=True)
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    week_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")

    md = [f"# SEO Daily Scan — {TODAY}\n"]
    for site_key, snap in snapshots.items():
        info = SITES[site_key]
        md.append(f"\n## {info['domain']}\n")
        prev_day = load_snapshot(site_key, yesterday)
        prev_week = load_snapshot(site_key, week_ago)

        for source in ("google", "yandex"):
            today_data = snap.get(source, {})
            if "error" in today_data:
                md.append(f"\n**{source.upper()}**: {today_data['error']}\n")
                continue
            md.append(f"\n### {source.upper()} (запросов: {len(today_data)})\n")

            d_day = compute_deltas(snap, prev_day, source)
            d_week = compute_deltas(snap, prev_week, source)

            if d_day:
                md.append(f"\n**Δ за день (топ-10 движений):**\n")
                for q, pos, delta, clicks in d_day[:10]:
                    arrow = "↑" if delta > 0 else "↓"
                    md.append(f"- `{q}` → поз {pos} ({arrow}{abs(delta)}), кликов: {clicks}")
            if d_week:
                md.append(f"\n**Δ за неделю (топ-10 движений):**\n")
                for q, pos, delta, clicks in d_week[:10]:
                    arrow = "↑" if delta > 0 else "↓"
                    md.append(f"- `{q}` → поз {pos} ({arrow}{abs(delta)}), кликов: {clicks}")

            # target_keywords из конфига
            targets = info.get("target_keywords", [])
            if targets:
                md.append(f"\n**Target queries:**\n")
                for t in targets:
                    data = today_data.get(t.lower(), today_data.get(t, {}))
                    if data and "position" in data:
                        md.append(f"- `{t}` → поз {data['position']}, показов: {data.get('impressions') or data.get('shows', 0)}")
                    else:
                        md.append(f"- `{t}` → нет в выдаче")

    out = REPORTS / f"daily_{TODAY}.md"
    # utf-8-sig добавляет BOM — iOS Telegram preview без BOM путает кодировку
    # и показывает кириллицу как иероглифы (Ð× / Ñ×). С BOM Mail/Files/Telegram
    # корректно детектят UTF-8.
    out.write_text("\n".join(md), encoding="utf-8-sig")
    print(f"\n✓ Отчёт: {out}")
    return out


def send_telegram_digest(snapshots: dict, report_path: Path):
    """Digest + полный отчёт телом сообщений (UTF-8 body не ломается на iOS).
    Файл шлём как архив с правильным MIME — на случай, если хочется скачать.
    """
    try:
        from telegram_notifier import send_message, send_long_message, send_file
    except Exception as e:
        print(f"  ⚠ telegram_notifier недоступен: {e}")
        return

    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    lines = [f"📊 SEO Daily Scan — {TODAY}", ""]
    source_errors = []  # громкие алерты деградации — наверх digest
    for site_key, snap in snapshots.items():
        if SITES[site_key].get("paused"):
            continue  # monitoring-only: снапшот собран, в digest не показываем
        domain = SITES[site_key]["domain"]
        prev = load_snapshot(site_key, yesterday)
        g = snap.get("google", {})
        y = snap.get("yandex", {})
        g_count = len([k for k in g if k != "error"]) if isinstance(g, dict) else 0
        y_count = len([k for k in y if k != "error"]) if isinstance(y, dict) else 0
        lines.append(f"🌐 {domain}")
        b = snap.get("bing", {})
        b_count = len([k for k in b if k != "error"]) if isinstance(b, dict) else 0
        lines.append(f"  Google: {g_count} зпр · Yandex: {y_count} зпр · Bing: {b_count} зпр")
        # Ошибка источника = деградация, о которой надо КРИЧАТЬ, а не показывать «0 зпр»
        if isinstance(g, dict) and "error" in g:
            source_errors.append(f"🔴 {domain} GSC: {str(g['error'])[:140]}")
        if isinstance(y, dict) and "error" in y:
            source_errors.append(f"🔴 {domain} Yandex: {str(y['error'])[:140]}")

        # Top-3 движений (Yandex чаще даёт сигнал)
        d = compute_deltas(snap, prev, "yandex")
        if d:
            lines.append("  Δ Yandex за день:")
            for q, pos, delta, clicks in d[:3]:
                arrow = "↑" if delta > 0 else "↓"
                lines.append(f"    {arrow}{abs(delta)} «{q[:40]}» → {pos}")
        lines.append("")

    # Алерты деградации — отдельным заметным блоком в начале digest
    if source_errors:
        alert = ["🚨 ДЕГРАДАЦИЯ ИСТОЧНИКОВ ДАННЫХ:"] + source_errors
        if any("invalid_grant" in e for e in source_errors):
            alert.append("")
            alert.append("→ GSC-токен умер. Реанимация: cd seo-agent && ./venv/bin/python auto_oauth_flow.py")
            alert.append("→ Корень: OAuth-app в Testing mode (токен живёт 7 дней). Фикс навсегда: GCP Console → OAuth consent screen → Publish app")
        lines = alert + [""] + lines

    try:
        # 1) Короткий digest
        send_message("\n".join(lines))
        # 2) Полный отчёт ТЕЛОМ сообщений — кириллица гарантированно ок на iOS.
        report_text = report_path.read_text(encoding="utf-8-sig")
        send_long_message(report_text)
        # 3) Файл с правильным MIME — как архив (скачать/переслать).
        send_file(str(report_path), caption=f"daily_{TODAY}.md")
        print("  ✓ Telegram-digest отправлен (body + file)")
    except Exception as e:
        print(f"  ✗ Telegram-отправка упала: {e}")


def run_carpathy_hooks():
    """Замыкание петли обучения (P1 аудита 2026-06-12):
    1) vch_tracker — ежедневный Δ1/Δ7/Δ30 по PRIMARY ВЧ + алерты просадок;
    2) созревшие гипотезы (verify_due <= today, status=pending) — предварительный
       вердикт verify v2 + Telegram-алерт «подтверди».
    Ошибки хуков не валят основной скан.
    """
    import sys as _sys
    _sys.path.insert(0, str(ROOT / "carpathy"))

    # --- 1. VCH tracker ---
    try:
        import vch_tracker
        vch_path = vch_tracker.render()
        print(f"  ✓ vch_tracker: {vch_path}")
        # алерты из отчёта — в Telegram (секция 🚨 если непустая)
        try:
            txt = Path(vch_path).read_text(encoding="utf-8")
            alert_sec = txt.split("# 🚨 АЛЕРТЫ")[-1] if "# 🚨 АЛЕРТЫ" in txt else ""
            alert_lines = [l for l in alert_sec.split("\n") if l.startswith("- ")]
            if alert_lines:
                from telegram_notifier import send_message
                send_message("🚨 VCH-алерты (просадки за день):\n" + "\n".join(alert_lines[:10]))
        except Exception as e:
            print(f"  ⚠ vch-алерты не отправлены: {e}")
    except Exception as e:
        print(f"  ⚠ vch_tracker упал: {e}")

    # --- 1b. Reputation tracker (Я.Карты: новые отзывы = ответить в 24ч) ---
    try:
        import reputation_tracker
        rep_alerts = reputation_tracker.run()
        if rep_alerts:
            from telegram_notifier import send_message
            send_message("💬 Репутация (Я.Карты):\n" + "\n".join(rep_alerts[:8]))
            print(f"  ✓ reputation: {len(rep_alerts)} алертов")
        else:
            print("  · reputation: изменений нет")
    except Exception as e:
        print(f"  ⚠ reputation_tracker упал: {e}")

    # --- 1d. SERP-чек (по средам): реальная выдача DDG/Bing по PRIMARY ВЧ ---
    try:
        if datetime.now().weekday() == 2:  # Wednesday
            import serp_check
            ssnap = serp_check.run()
            sdeltas = serp_check.deltas_vs_prev(ssnap)
            if sdeltas:
                from telegram_notifier import send_message
                send_message("🔎 SERP-чек (DDG/Bing) — изменения позиций:\n" + "\n".join(sdeltas[:12]))
            print(f"  ✓ serp_check: {sum(1 for s in ssnap['sites'].values() for r in s.values() if r.get('pos'))} попаданий в топ-20")
    except Exception as e:
        print(f"  ⚠ serp_check упал: {e}")

    # --- 1e. query-analytics (по средам): точные per-query метрики + CTR-gaps ---
    try:
        if datetime.now().weekday() == 2:  # Wednesday
            import query_analytics
            qa = query_analytics.run()
            gap_lines = []
            for sk, info in qa.items():
                if info.get("ctr_gaps", 0) > 0:
                    gap_lines.append(f"{sk}: {info['ctr_gaps']} запросов с CTR=0 (позиция есть) — {', '.join(info['ctr_gap_examples'])}")
            if gap_lines:
                from telegram_notifier import send_message
                send_message("📉 CTR-gaps (точки для title-фиксов):\n" + "\n".join(gap_lines))
            print(f"  ✓ query_analytics: {sum(i.get('queries',0) for i in qa.values())} запросов")
    except Exception as e:
        print(f"  ⚠ query_analytics упал: {e}")

    # --- 1c. AI-visibility (по понедельникам): цитируемость брендов в LLM-поиске ---
    try:
        if datetime.now().weekday() == 0:  # Monday
            import ai_visibility
            av = ai_visibility.run()
            from telegram_notifier import send_message
            lines = [f"🤖 {av['summary']}"]
            for r in av["results"]:
                if r.get("brand_mentioned") or r.get("our_domain_cited"):
                    lines.append(f"  ✅ {r['query'][:60]}")
            send_message("\n".join(lines))
            print(f"  ✓ ai_visibility: {av['summary']}")
    except Exception as e:
        print(f"  ⚠ ai_visibility упал: {e}")

    # --- 2. Авто-verify созревших гипотез ---
    try:
        import verify as carpathy_verify
        hyp = json.loads((ROOT / "carpathy" / "hypotheses.json").read_text(encoding="utf-8"))
        ripe = []
        for h in hyp["hypotheses"]:
            if h.get("status") != "pending" or h.get("verify_method") == "manual":
                continue
            if h.get("verify_due", "9999") <= TODAY:
                res = carpathy_verify.verify_one(h)
                ripe.append((h, res))
        if ripe:
            lines = ["🔬 Гипотезы созрели — предварительные вердикты (verify v2, окно 7д):", ""]
            for h, res in ripe:
                status = res["new_status"] + (f" ({res['reason']})" if res.get("reason") else "")
                lines.append(f"• {h['id']} [{h['site']}] → предложение: {status}")
                lines.append(f"  ↑{res['improved']} ✨{res['entered']} ↓{res['fell']} ∅{res['none_to_none']} / {res['total']}")
            lines.append("")
            lines.append("Применить: ./venv/bin/python carpathy/verify.py --apply")
            from telegram_notifier import send_message
            send_message("\n".join(lines))
            print(f"  ✓ verify-алерт: {len(ripe)} созревших гипотез")
        else:
            print("  · verify: созревших гипотез нет")
    except Exception as e:
        print(f"  ⚠ авто-verify упал: {e}")


def main():
    snapshots = {}
    for site_key in SITES:
        snapshots[site_key] = scan_site(site_key)
    report_path = render_report(snapshots)
    send_telegram_digest(snapshots, report_path)
    run_carpathy_hooks()


if __name__ == "__main__":
    import traceback as _tb
    try:
        main()
    except Exception as _exc:
        # Не молчать. Если падаем под launchd — отправляем в Telegram алерт,
        # чтобы было видно что бот живой (и в чём проблема).
        import html as _html
        _err = f"⚠️ daily_scan упал:\n\n<code>{_html.escape(f'{type(_exc).__name__}: {_exc}')}</code>\n\nstderr → logs/daily-scan.err.log"
        try:
            from telegram_notifier import send_message
            send_message(_err, parse_mode="HTML")
        except Exception:
            pass
        print(_tb.format_exc())
        raise
