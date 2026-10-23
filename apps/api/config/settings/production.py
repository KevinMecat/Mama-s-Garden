import os
import runpy

from django.core.exceptions import ImproperlyConfigured

from .base import *
from .base import ALLOWED_HOSTS as BASE_ALLOWED_HOSTS
from .base import MIDDLEWARE as BASE_MIDDLEWARE
from .base import REPOSITORY_ROOT
from .base import STORAGES as BASE_STORAGES

_validator = runpy.run_path(str(REPOSITORY_ROOT / "scripts/verify_prod_env.py"))
if _validator["validate_env"](os.environ):
    raise ImproperlyConfigured("Entorno de producción inválido; ejecutar verify-prod-env.sh.")

DEBUG = False
ALLOWED_HOSTS = [*BASE_ALLOWED_HOSTS, "api"]

SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
X_FRAME_OPTIONS = "DENY"
SECURE_SSL_REDIRECT = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = False
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
MIDDLEWARE = [
    BASE_MIDDLEWARE[0],
    "whitenoise.middleware.WhiteNoiseMiddleware",
    *BASE_MIDDLEWARE[1:],
]
STORAGES = {
    **BASE_STORAGES,
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
