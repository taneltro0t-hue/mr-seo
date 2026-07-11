"""
gsc_client — единая точка работы с Google Search Console API.

До 2026-06-13 было ДВЕ независимые реализации (daily_scan.gsc_positions и
data_collector._get_gsc_service): retry на SSL-флейки был только в одной,
запись токена — неатомарная. Аудит 2026-06-12, finding dup-gsc-implementations.

С 2026-07-02 ОСНОВНОЙ путь — SERVICE ACCOUNT (credentials/gsc.json):
seo-agent-bot@... добавлен пользователем в Search Console всех 3 ресурсов.
SA подписывает запросы ключом (JWT) — refresh-токенов нет → умирать нечему
(5 смертей OAuth-токена за май-июль, включая одну ПОСЛЕ Publish app).
OAuth user-token (credentials/gsc_token.json) остаётся запасным путём.

Использование:
    from gsc_client import get_service
    svc = get_service()                       # кэшированный client с retry
    svc.searchanalytics().query(...)
"""
import os
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SA_FILE = Path(os.getenv("GSC_SERVICE_ACCOUNT_FILE", str(ROOT / "credentials" / "gsc.json")))
TOKEN_FILE = Path(os.getenv("GSC_OAUTH_TOKEN_FILE", str(ROOT / "credentials" / "gsc_token.json")))
SCOPES = ["https://www.googleapis.com/auth/webmasters"]

# 8 попыток с экспонентой — Mac+VPN/DPI режут TLS к oauth2.googleapis.com по утрам
RETRY_DELAYS = [1, 2, 4, 8, 16, 32, 60, 60]

_service = None


class GSCAuthError(RuntimeError):
    pass


def _refresh_with_retry(creds):
    from google.auth.transport.requests import Request
    last_err = None
    for attempt, delay in enumerate(RETRY_DELAYS):
        try:
            creds.refresh(Request())
            return
        except Exception as e:
            last_err = e
            if attempt < len(RETRY_DELAYS) - 1:
                time.sleep(delay)
    raise GSCAuthError(f"GSC OAuth refresh failed after {len(RETRY_DELAYS)} attempts: {last_err}")


def _save_token_atomic(creds):
    tmp = str(TOKEN_FILE) + ".tmp"
    with open(tmp, "w") as f:
        f.write(creds.to_json())
    os.replace(tmp, TOKEN_FILE)


def _build_sa_service():
    """Основной путь: service account — бессрочный, без refresh-токенов."""
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    creds = service_account.Credentials.from_service_account_file(str(SA_FILE), scopes=SCOPES)
    svc = build("searchconsole", "v1", credentials=creds, cache_discovery=False)
    # smoke-test с retry (утренние DPI-флейки TLS): без него тихо вернём клиент,
    # который упадёт на первом запросе, и daily_scan запишет error в снапшот
    last_err = None
    for attempt, delay in enumerate(RETRY_DELAYS):
        try:
            svc.sites().list().execute()
            return svc
        except Exception as e:
            last_err = e
            if attempt < len(RETRY_DELAYS) - 1:
                time.sleep(delay)
    raise GSCAuthError(f"SA smoke-test failed after {len(RETRY_DELAYS)} attempts: {last_err}")


def _build_oauth_service():
    """Запасной путь: OAuth user-token (умирал 5 раз — см. docstring)."""
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

    if not TOKEN_FILE.exists():
        raise GSCAuthError(f"нет {TOKEN_FILE}. Запусти: ./venv/bin/python auto_oauth_flow.py")

    creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)
    if not creds.valid:
        if creds.expired and creds.refresh_token:
            _refresh_with_retry(creds)
            _save_token_atomic(creds)
        else:
            raise GSCAuthError("GSC OAuth токен невалиден и не может быть обновлён")

    return build("searchconsole", "v1", credentials=creds, cache_discovery=False)


def get_service(force_new: bool = False):
    """Кэшированный searchconsole-client: SA (бессрочный) → fallback OAuth.

    Бросает GSCAuthError только если оба пути мертвы.
    """
    global _service
    if _service is not None and not force_new:
        return _service

    sa_err = None
    if SA_FILE.exists():
        try:
            _service = _build_sa_service()
            return _service
        except Exception as e:
            sa_err = e  # SA сломан (ключ отозван/выкинули из GSC) — пробуем OAuth

    try:
        _service = _build_oauth_service()
        return _service
    except Exception as oauth_err:
        raise GSCAuthError(
            f"оба пути мертвы. SA: {str(sa_err)[:150] if sa_err else 'файл отсутствует'} | OAuth: {str(oauth_err)[:150]}"
        )
