import os
import urllib.parse
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

DEBUG = os.environ.get("DJANGO_DEBUG", "0") == "1"
DJANGO_ENV = os.environ.get("DJANGO_ENV", "development").strip().lower()
IS_PRODUCTION = DJANGO_ENV == "production"

if IS_PRODUCTION and DEBUG:
    raise RuntimeError("DJANGO_DEBUG_NAO_PODE_SER_1_EM_PRODUCAO")

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "").strip()
if not SECRET_KEY:
    if DEBUG and not IS_PRODUCTION:
        SECRET_KEY = "dev-only-change-me"
    else:
        raise RuntimeError("DJANGO_SECRET_KEY_OBRIGATORIA")
if IS_PRODUCTION and len(SECRET_KEY) < 40:
    raise RuntimeError("DJANGO_SECRET_KEY_DEVE_TER_AO_MENOS_40_CARACTERES")

raw_allowed_hosts = os.environ.get("DJANGO_ALLOWED_HOSTS", "").strip()
if IS_PRODUCTION and not raw_allowed_hosts:
    raise RuntimeError("DJANGO_ALLOWED_HOSTS_OBRIGATORIO")
ALLOWED_HOSTS = [
    x.strip()
    for x in (raw_allowed_hosts or "localhost,127.0.0.1").split(",")
    if x.strip()
]
if IS_PRODUCTION and "*" in ALLOWED_HOSTS:
    raise RuntimeError("DJANGO_ALLOWED_HOSTS_NAO_PODE_USAR_WILDCARD_EM_PRODUCAO")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "core",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "core.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "contacerta_backend.urls"
WSGI_APPLICATION = "contacerta_backend.wsgi.application"

TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "DIRS": [],
    "APP_DIRS": True,
    "OPTIONS": {"context_processors": [
        "django.template.context_processors.request",
        "django.contrib.auth.context_processors.auth",
        "django.contrib.messages.context_processors.messages",
    ]},
}]

database_url = os.environ.get("DATABASE_URL", "").strip()
if IS_PRODUCTION and not database_url:
    raise RuntimeError("DATABASE_URL_OBRIGATORIA_EM_PRODUCAO")

if database_url:
    url = urllib.parse.urlparse(database_url)
    if url.scheme not in {"postgres", "postgresql"}:
        raise RuntimeError("DATABASE_URL_DEVE_SER_POSTGRESQL")
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": url.path.lstrip("/"),
            "USER": urllib.parse.unquote(url.username or ""),
            "PASSWORD": urllib.parse.unquote(url.password or ""),
            "HOST": url.hostname,
            "PORT": url.port or 5432,
            "OPTIONS": {"sslmode": "require"},
            "CONN_MAX_AGE": 60,
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 10}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Fortaleza"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "no-referrer"
X_FRAME_OPTIONS = "DENY"
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Strict"
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = "Strict"
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

SECURE_SSL_REDIRECT = IS_PRODUCTION
SESSION_COOKIE_SECURE = IS_PRODUCTION
CSRF_COOKIE_SECURE = IS_PRODUCTION
SECURE_HSTS_SECONDS = int(os.environ.get("DJANGO_HSTS_SECONDS", "3600" if IS_PRODUCTION else "0"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = os.environ.get("DJANGO_HSTS_INCLUDE_SUBDOMAINS", "0") == "1"
SECURE_HSTS_PRELOAD = os.environ.get("DJANGO_HSTS_PRELOAD", "0") == "1"

DATA_UPLOAD_MAX_MEMORY_SIZE = int(os.environ.get("DJANGO_MAX_REQUEST_BYTES", str(12 * 1024 * 1024)))
DATA_UPLOAD_MAX_NUMBER_FIELDS = 1000

raw_cors = os.environ.get("CORS_ALLOWED_ORIGINS", "").strip()
if IS_PRODUCTION and not raw_cors:
    raise RuntimeError("CORS_ALLOWED_ORIGINS_OBRIGATORIO")

CORS_ALLOWED_ORIGINS = {
    x.strip().rstrip("/")
    for x in (
        raw_cors
        or "https://priscillacahino.github.io,https://conta-certa-dusky-seven.vercel.app"
    ).split(",")
    if x.strip()
}
if IS_PRODUCTION and any(not origin.startswith("https://") for origin in CORS_ALLOWED_ORIGINS):
    raise RuntimeError("CORS_ALLOWED_ORIGINS_DEVE_USAR_HTTPS_EM_PRODUCAO")

SESSION_HOURS = max(1, int(os.environ.get("SESSION_HOURS", "12")))
RESIDENT_SESSION_DAYS = max(1, int(os.environ.get("RESIDENT_SESSION_DAYS", "30")))
ADMIN_LOGIN_MAX_ATTEMPTS = max(3, int(os.environ.get("ADMIN_LOGIN_MAX_ATTEMPTS", "5")))
ADMIN_LOGIN_BLOCK_MINUTES = max(1, int(os.environ.get("ADMIN_LOGIN_BLOCK_MINUTES", "10")))
ENABLE_DJANGO_ADMIN = os.environ.get("ENABLE_DJANGO_ADMIN", "1" if DEBUG else "0") == "1"
