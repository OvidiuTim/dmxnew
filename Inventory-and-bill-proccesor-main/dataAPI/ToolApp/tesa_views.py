"""Pontajul propriu al personalului TESA, fără fotografie."""
import json
import math

from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.views.decorators.csrf import csrf_exempt

from ToolApp.models import AttendanceAbsenceMark, AttendanceSession, LeaveDay, PresenceEvent, Users
from ToolApp.team_portal_views import _portal_actor
from ToolApp.views import (
    MISSING_EXIT_SOURCE_TAG,
    _gps_distance_meters,
    _mark_session_missing_exit,
    recompute_daily_pay,
)
from ToolApp.worksites import (
    InvalidWorksite,
    TEAM_DASHBOARD_WORKSITES,
    TEAM_DASHBOARD_WORKSITE_BY_NAME,
    normalize_worksite,
)


ATTENDANCE_CONFLICT = 'Ai deja pontaj în această zi sau o sesiune deschisă. Solicită verificarea pontajului înainte de confirmare.'
LEAVE_CONFLICT = 'Ai concediu sau absență înregistrată astăzi. Solicită corectarea înregistrării înainte de confirmare.'


def _blocked_reason_code(reason):
    return {ATTENDANCE_CONFLICT: 'ATTENDANCE_CONFLICT', LEAVE_CONFLICT: 'LEAVE_CONFLICT'}.get(reason)


def _allowed(employee):
    return (employee.is_tesa and employee.active
            and employee.person_type == Users.PersonType.EMPLOYEE
            and employee.employment_status == Users.EmploymentStatus.ACTIVE)


def _session_payload(session):
    in_distance = in_inside = out_distance = out_inside = None
    if session.in_gps_latitude is not None and session.in_gps_longitude is not None:
        in_distance, in_inside = _worksite_distance(
            session.in_gps_latitude, session.in_gps_longitude, session.worksite)
    if session.out_gps_latitude is not None and session.out_gps_longitude is not None:
        out_distance, out_inside = _worksite_distance(
            session.out_gps_latitude, session.out_gps_longitude, session.worksite)
    duration_seconds = session.duration_seconds
    if session.out_time is None:
        duration_seconds = max(0, int((timezone.now() - session.in_time).total_seconds()))
    return {
        'id': session.pk, 'worksite': session.worksite,
        'work_date': session.work_date.isoformat(),
        'in_time': timezone.localtime(session.in_time).isoformat(),
        'out_time': timezone.localtime(session.out_time).isoformat() if session.out_time else None,
        'hours': round(duration_seconds / 3600, 2),
        'state': 'closed' if session.out_time else 'open',
        'confirmed_at': session.tesa_confirmed_at.isoformat() if session.tesa_confirmed_at else None,
        'distance_m': round(in_distance) if in_distance is not None else None,
        'inside_perimeter': in_inside,
        'checkout_distance_m': round(out_distance) if out_distance is not None else None,
        'checkout_inside_perimeter': out_inside,
    }


def _day_status(employee, day):
    sessions = AttendanceSession.objects.filter(user_fk=employee)
    # Dacă angajatul TESA a început ziua prin vechiul flux de pontaj, preluăm
    # sesiunea existentă și permitem check-out-ul, în loc să blocăm pagina.
    confirmed = sessions.filter(work_date=day).order_by('-in_time').first()
    reason = None
    if not confirmed:
        if LeaveDay.objects.filter(user_fk=employee, work_date=day).exclude(pk__in=_attendance_absence(employee, day)).exists():
            reason = LEAVE_CONFLICT
    return confirmed, reason


def _attendance_absence(employee, day):
    """Absența din escaladare poate fi înlocuită de un check-in real.

    Marcajul de audit rămâne. Concediile și absențele introduse fără un marcaj
    al fluxului de alerte rămân protejate și continuă să blocheze pontajul TESA.
    """
    leaves = LeaveDay.objects.filter(user_fk=employee, work_date=day,
        reason=LeaveDay.Reason.UNEXCUSED, source_leave_request__isnull=True)
    if not AttendanceAbsenceMark.objects.filter(employee=employee, work_date=day).exists():
        return leaves.none()
    return leaves


def _worksite_distance(lat, lng, worksite):
    """Distanța până la cel mai apropiat perimetru acceptat și dacă e înăuntru.

    TESA se poate ponta și din afara perimetrului (birou, deplasare, alt punct
    de lucru), spre deosebire de pontajul obișnuit. Distanța se calculează
    oricum, se salvează în GPS-ul sesiunii și se întoarce clientului, ca
    verificarea ulterioară să fie posibilă.
    """
    best_distance = None
    inside = False
    configured_perimeter = TEAM_DASHBOARD_WORKSITE_BY_NAME.get(worksite)
    for perimeter in ((configured_perimeter,) if configured_perimeter else ()):
        distance = _gps_distance_meters(lat, lng, perimeter['latitude'], perimeter['longitude'])
        if best_distance is None or distance < best_distance:
            best_distance = distance
        if distance <= perimeter['radius_meters']:
            inside = True
    return best_distance, inside


def _gps(data, now, worksite):
    gps = data.get('gps')
    if not isinstance(gps, dict):
        raise ValueError('Permite accesul la locație pentru a confirma prezența.')
    try:
        values = [gps[key] for key in ('lat', 'lng', 'accuracy')]
        if any(isinstance(value, bool) for value in values):
            raise ValueError
        lat, lng, accuracy = map(float, values)
        if not all(math.isfinite(value) for value in (lat, lng, accuracy)):
            raise ValueError
        if not (-90 <= lat <= 90 and -180 <= lng <= 180 and accuracy >= 0):
            raise ValueError
        captured = parse_datetime(gps.get('captured_at', ''))
        if captured is None or timezone.is_naive(captured):
            raise ValueError
    except (ValueError, TypeError, KeyError, OverflowError):
        raise ValueError('Locația GPS este invalidă. Actualizează poziția și încearcă din nou.') from None
    if not -60 <= (now - captured).total_seconds() <= 600:
        raise ValueError('Locația GPS a expirat. Actualizează poziția și încearcă din nou.')
    # Fără verificare de perimetru: personalul TESA confirmă și din afara
    # șantierului. Locația rămâne obligatorie și se înregistrează ca atare.
    return lat, lng, accuracy


@csrf_exempt
def tesa_presence(request):
    if request.method not in ('GET', 'POST'):
        return JsonResponse({'error': 'Metodă nepermisă.'}, status=405)
    actor = _portal_actor(request)
    if not actor or not _allowed(actor.employee):
        return JsonResponse({'error': 'Pagina este disponibilă numai personalului TESA activ.'}, status=403)
    # The date, employee and paid hours always come from the server.
    now = timezone.now()
    day = timezone.localdate(now)
    if request.method == 'GET':
        confirmed, reason = _day_status(actor.employee, day)
        can_check_in = not confirmed and not reason
        can_check_out = bool(confirmed and confirmed.out_time is None)
        return JsonResponse({
            'employee': {
                'id': actor.employee_id,
                'name': actor.employee.UserName,
                'is_tesa': actor.employee.is_tesa,
                'is_driver': actor.employee.is_driver,
            },
            'unrestricted_location': bool(actor.employee.is_tesa and actor.employee.is_driver),
            'work_date': day.isoformat(), 'worksites': list(TEAM_DASHBOARD_WORKSITES),
            'session': _session_payload(confirmed) if confirmed else None,
            'state': 'checked_out' if confirmed and confirmed.out_time else 'checked_in' if confirmed else 'not_checked_in',
            'can_check_in': can_check_in,
            'can_check_out': can_check_out,
            # Păstrat temporar pentru clienții vechi; înseamnă acum că există o acțiune disponibilă.
            'can_confirm': can_check_in or can_check_out,
            'blocked_reason': reason,
            'blocked_reason_code': _blocked_reason_code(reason),
        })
    try:
        data = json.loads(request.body or '{}')
        if not isinstance(data, dict):
            raise ValueError('JSON invalid.')
        action = str(data.get('action') or '').strip().lower()
        if action not in {'check_in', 'check_out'}:
            raise ValueError('Acțiunea de pontaj nu este validă.')
        unrestricted_location = bool(actor.employee.is_tesa and actor.employee.is_driver)
        worksite = None if unrestricted_location else normalize_worksite(data.get('worksite'))
        if not unrestricted_location and worksite not in {site['name'] for site in TEAM_DASHBOARD_WORKSITES}:
            raise ValueError('Alege un șantier din lista de pontaj.')
        lat, lng, accuracy = _gps(data, now, worksite)
    except (ValueError, TypeError, InvalidWorksite) as exc:
        return JsonResponse({'error': str(exc)}, status=400)
    with transaction.atomic():
        employee = Users.objects.select_for_update().get(pk=actor.employee_id)
        if not _allowed(employee):
            return JsonResponse({'error': 'Nu mai ai acces la confirmarea TESA.'}, status=403)
        if action == 'check_in':
            # O ieșire uitată într-o zi anterioară este o problemă de audit,
            # nu un motiv să blocăm pontarea reală din ziua curentă.
            stale_sessions = (
                AttendanceSession.objects.select_for_update()
                .filter(user_fk=employee, work_date__lt=day, out_time__isnull=True)
                .exclude(source__contains=MISSING_EXIT_SOURCE_TAG)
            )
            for stale_session in stale_sessions:
                _mark_session_missing_exit(stale_session)
                stale_session.save(update_fields=('out_time', 'duration_seconds', 'source'))
        session, reason = _day_status(employee, day)
        if action == 'check_in':
            if session and session.out_time is None:
                return JsonResponse({'ok': True, 'already_checked_in': True, 'session': _session_payload(session)})
            if session:
                return JsonResponse({'error': 'Pontajul TESA pentru astăzi este deja încheiat.',
                                     'error_code': 'TESA_DAY_COMPLETED'}, status=409)
            if reason:
                return JsonResponse({'error': reason, 'error_code': _blocked_reason_code(reason)}, status=409)
            session = AttendanceSession.objects.create(
                user_fk=employee, work_date=day, in_time=now, out_time=None,
                duration_seconds=0, source='tesa', worksite=worksite,
                in_gps_latitude=lat, in_gps_longitude=lng, in_gps_accuracy_m=accuracy,
                checkin_photo='', checkout_photo='', tesa_confirmed_at=now,
            )
            PresenceEvent.objects.create(
                user_fk=employee, timestamp=now, kind=PresenceEvent.Kind.ENTER, worksite=worksite)
            from ToolApp.attendance_alert_escalation import resolve_absence_by_late_check_in
            resolve_absence_by_late_check_in(employee, day, session.in_time)
            recompute_daily_pay(employee, day)
            response_status = 201
        else:
            if not session:
                return JsonResponse({'error': 'Nu există un check-in TESA activ.',
                                     'error_code': 'TESA_CHECK_IN_REQUIRED'}, status=409)
            if session.out_time is not None:
                return JsonResponse({'ok': True, 'already_checked_out': True, 'session': _session_payload(session)})
            if not unrestricted_location and session.worksite != worksite:
                return JsonResponse({'error': 'Ieșirea trebuie înregistrată pentru același șantier ca intrarea.'}, status=409)
            session.out_time = max(now, session.in_time)
            session.duration_seconds = max(0, int((session.out_time - session.in_time).total_seconds()))
            session.out_gps_latitude = lat
            session.out_gps_longitude = lng
            session.out_gps_accuracy_m = accuracy
            session.checkout_photo = ''
            session.save(update_fields=(
                'out_time', 'duration_seconds', 'out_gps_latitude', 'out_gps_longitude',
                'out_gps_accuracy_m', 'checkout_photo',
            ))
            PresenceEvent.objects.create(
                user_fk=employee, timestamp=session.out_time, kind=PresenceEvent.Kind.EXIT, worksite=session.worksite)
            from ToolApp.fleet_services import close_open_utilaj_sessions
            close_open_utilaj_sessions(employee, closed_at=session.out_time, reason='depontare')
            recompute_daily_pay(employee, day)
            response_status = 200
    return JsonResponse({'ok': True, 'action': action, 'session': _session_payload(session)}, status=response_status)
