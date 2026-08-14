import logging

from django.core.cache import cache


logger = logging.getLogger(__name__)


class DismissedEmployeeRetentionMiddleware:
    """Rulează cel mult o dată pe zi curățarea angajaților demiși de peste doi ani."""

    cache_key = "dismissed-employees-retention-v1"

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if cache.add(self.cache_key, True, timeout=24 * 60 * 60):
            try:
                from ToolApp.employee_retention import purge_expired_dismissed_employees

                purge_expired_dismissed_employees()
            except Exception:
                logger.exception("Curățarea automată a angajaților demiși nu a putut rula.")
        return self.get_response(request)
