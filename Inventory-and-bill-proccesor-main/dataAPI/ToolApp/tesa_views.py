"""Own-day TESA presence, separate from the selfie/NFC attendance contract."""
import json
import math
from datetime import datetime, time

from django.db import transaction
from django.db.models import Q
from django.http import JsonResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.views.decorators.csrf import csrf_exempt

from ToolApp.models import AttendanceAbsenceMark, AttendanceAlertCase, AttendanceSession, LeaveDay, PresenceEvent, Users
from ToolApp.team_portal_views import _portal_actor
from ToolApp.views import _gps_distance_meters, recompute_daily_pay
from ToolApp.worksites import ATTENDANCE_WORKSITES, InvalidWorksite, normalize_worksite, worksite_perimeters


def _allowed(employee):
    return (employee.is_tesa and employee.active
            and employee.person_type == Users.PersonType.EMPLOYEE
            and employee.employment_status == Users.EmploymentStatus.ACTIVE)


def _session_payload(session):
    return {
        'id': session.pk, 'worksite': session.worksite,
        'work_date': session.work_date.isoformat(),
        'in_time': timezone.localtime(session.in_time).isoformat(),
        'out_time': timezone.localtime(session.out_time).isoformat() if session.out_time else None,
        'hours': session.duration_seconds / 3600,
        'confirmed_at': session.tesa_confirmed_at.isoformat() if session.tesa_confirmed_at else None,
    }


def _day_status(employee, day):
    start = timezone.make_aware(datetime.combine(day, time(8)))
    end = timezone.make_aware(datetime.combine(day, time(16)))
    sessions = AttendanceSession.objects.filter(user_fk=employee)
    confirmed = sessions.filter(work_date=day, source='tesa').first()
    reason = None
    if not confirmed:
        if sessions.filter(Q(work_date=day) | Q(out_time__isnull=True)
                           | Q(in_time__lt=end, out_time__gt=start)).exists():
            reason = 'Ai deja pontaj în această zi sau o sesiune deschisă. Solicită verificarea pontajului înainte de confirmare.'
        elif LeaveDay.objects.filter(user_fk=employee, work_date=day).exclude(pk__in=_automatic_absence(employee, day)).exists():
            reason = 'Ai concediu sau absență înregistrată astăzi. Solicită corectarea înregistrării înainte de confirmare.'
    return confirmed, reason, start, end


def _automatic_absence(employee, day):
    """A late confirmation can resolve a system absence; manual leave stays protected."""
    leaves = LeaveDay.objects.filter(user_fk=employee, work_date=day,
        reason=LeaveDay.Reason.UNEXCUSED, source_leave_request__isnull=True,
        note='Marcat automat absent la escaladarea Nivel 2')
    if not AttendanceAbsenceMark.objects.filter(employee=employee, work_date=day,
            source=AttendanceAbsenceMark.Source.AUTOMATIC_LEVEL_2, marked_by__isnull=True).exists():
        return leaves.none()
    return leaves


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
    perimeters = worksite_perimeters(worksite)
    if not any(_gps_distance_meters(lat, lng, p['latitude'], p['longitude']) <= p['radius_meters']
               for p in perimeters):
        raise ValueError('Poziția curentă este în afara perimetrului șantierului ales.')
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
        confirmed, reason, _, _ = _day_status(actor.employee, day)
        return JsonResponse({
            'employee': {'id': actor.employee_id, 'name': actor.employee.UserName},
            'work_date': day.isoformat(), 'worksites': list(ATTENDANCE_WORKSITES),
            'session': _session_payload(confirmed) if confirmed else None,
            'can_confirm': not confirmed and not reason, 'blocked_reason': reason,
        })
    try:
        data = json.loads(request.body or '{}')
        if not isinstance(data, dict):
            raise ValueError('JSON invalid.')
        worksite = normalize_worksite(data.get('worksite'))
        if worksite not in {site['name'] for site in ATTENDANCE_WORKSITES}:
            raise ValueError('Alege un șantier din lista de pontaj.')
        lat, lng, accuracy = _gps(data, now, worksite)
    except (ValueError, TypeError, InvalidWorksite) as exc:
        return JsonResponse({'error': str(exc)}, status=400)
    with transaction.atomic():
        employee = Users.objects.select_for_update().get(pk=actor.employee_id)
        if not _allowed(employee):
            return JsonResponse({'error': 'Nu mai ai acces la confirmarea TESA.'}, status=403)
        confirmed, reason, start, end = _day_status(employee, day)
        if confirmed:
            if confirmed.worksite != worksite:
                return JsonResponse({'error': 'Prezența este deja confirmată pe alt șantier astăzi.'}, status=409)
            return JsonResponse({'ok': True, 'already_confirmed': True, 'session': _session_payload(confirmed)})
        if reason:
            return JsonResponse({'error': reason}, status=409)
        session = AttendanceSession.objects.create(
            user_fk=employee, work_date=day, in_time=start, out_time=end,
            duration_seconds=8 * 3600, source='tesa', worksite=worksite,
            in_gps_latitude=lat, in_gps_longitude=lng, in_gps_accuracy_m=accuracy,
            tesa_confirmed_at=now,
        )
        PresenceEvent.objects.bulk_create([
            PresenceEvent(user_fk=employee, timestamp=start, kind=PresenceEvent.Kind.ENTER, worksite=worksite),
            PresenceEvent(user_fk=employee, timestamp=end, kind=PresenceEvent.Kind.EXIT, worksite=worksite),
        ])
        _automatic_absence(employee, day).delete()
        AttendanceAlertCase.objects.filter(employee=employee, work_date=day, resolved_at__isnull=True).update(
            resolved_at=now, resolution_method=AttendanceAlertCase.ResolutionMethod.CHECK_IN)
        recompute_daily_pay(employee, day)
    return JsonResponse({'ok': True, 'already_confirmed': False, 'session': _session_payload(session)}, status=201)
