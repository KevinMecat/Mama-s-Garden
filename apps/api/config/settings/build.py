"""Static asset compilation only. Never select this settings module at runtime."""

from .base import *  # noqa: F403
from .base import STORAGES as BASE_STORAGES

STORAGES = {
    **BASE_STORAGES,
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
