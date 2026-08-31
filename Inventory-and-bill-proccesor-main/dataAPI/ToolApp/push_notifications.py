import logging

from django.conf import settings
from django.utils import timezone

from ToolApp.models import MobileDevice


logger = logging.getLogger(__name__)
_firebase_initialized = False


def _firebase_messaging():
    global _firebase_initialized
    try:
        import firebase_admin
        from firebase_admin import credentials, messaging
    except ImportError:
        logger.warning("Push dezactivat: pachetul firebase-admin nu este instalat.")
        return None

    if not _firebase_initialized:
        try:
            if not firebase_admin._apps:
                credentials_path = str(getattr(settings, "FIREBASE_CREDENTIALS_PATH", "") or "").strip()
                if credentials_path:
                    firebase_admin.initialize_app(credentials.Certificate(credentials_path))
                else:
                    firebase_admin.initialize_app()
            _firebase_initialized = True
        except Exception:
            logger.exception("Inițializarea Firebase Admin a eșuat.")
            return None
    return messaging


def send_employee_push(employee_ids, title, body, data=None):
    messaging = _firebase_messaging()
    if messaging is None:
        return {"sent": 0, "invalid": 0, "failed": 0}
    devices = list(MobileDevice.objects.filter(employee_id__in=set(employee_ids), active=True))
    result = {"sent": 0, "invalid": 0, "failed": 0}
    payload = {str(key): str(value) for key, value in (data or {}).items()}
    for device in devices:
        try:
            messaging.send(messaging.Message(
                token=device.push_token,
                notification=messaging.Notification(title=title, body=body),
                data=payload,
                android=messaging.AndroidConfig(
                    priority="high",
                    notification=messaging.AndroidNotification(channel_id="team_notifications"),
                ),
            ))
            result["sent"] += 1
        except Exception as exc:
            error_name = exc.__class__.__name__
            if error_name in {"UnregisteredError", "SenderIdMismatchError", "InvalidArgumentError"}:
                device.active = False
                device.invalidated_at = timezone.now()
                device.save(update_fields=("active", "invalidated_at", "last_seen_at"))
                result["invalid"] += 1
            else:
                logger.exception("Push-ul către dispozitivul %s a eșuat.", device.pk)
                result["failed"] += 1
    return result
