import json
from datetime import date
from pathlib import Path

from django.core.exceptions import ValidationError
from django.db import transaction
from django.http import FileResponse, JsonResponse
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.views.decorators.csrf import csrf_exempt

from ToolApp.models import (
    Accommodation,
    AccommodationRoom,
    EmployeeDocument,
    EmployeeDocumentType,
    Users,
)


DOCUMENT_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}
MAX_DOCUMENT_SIZE = 15 * 1024 * 1024


def _json_body(request):
    try:
        return json.loads(request.body or "{}")
    except (TypeError, ValueError):
        return None


def _error(message, status=400, details=None):
    payload = {"error": message}
    if details:
        payload["details"] = details
    return JsonResponse(payload, status=status)


def _as_bool(value):
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def _date_or_none(value):
    if not value:
        return None
    try:
        return date.fromisoformat(str(value))
    except ValueError:
        raise ValidationError({"expiry_date": "Data expirării nu este validă."})


def _accommodation_payload(item):
    rooms = list(item.rooms.all())
    active_employees = {
        "active": True,
        "person_type": Users.PersonType.EMPLOYEE,
        "employment_status": Users.EmploymentStatus.ACTIVE,
    }
    employee_count = item.employees.filter(**active_employees).count()
    return {
        "id": item.pk,
        "name": item.name,
        "address": item.address,
        "notes": item.notes,
        "total_places": item.total_places,
        "number_of_rooms": item.number_of_rooms,
        "available_places": max(0, item.total_places - employee_count) if item.total_places else None,
        "rooms": [
            {
                "id": room.pk,
                "position": room.position,
                "name": room.name,
                "employee_count": room.employees.filter(**active_employees).count(),
            }
            for room in rooms
        ],
        "active": item.active,
        "employee_count": employee_count,
    }


def _employee_accommodation_payload(employee):
    return {
        "id": employee.pk,
        "name": employee.UserName,
        "serie": employee.UserSerie,
        "trade": employee.trade or "",
        "company": employee.Company or "",
        "accommodation_id": employee.accommodation_id,
        "accommodation_room_id": employee.accommodation_room_id,
        "accommodation_room_name": employee.accommodation_room.name if employee.accommodation_room_id else "",
        "housing_location": employee.accommodation.name if employee.accommodation_id else employee.housing_location,
    }


def _non_negative_int(value, field_label):
    try:
        parsed = int(value or 0)
    except (TypeError, ValueError):
        raise ValidationError({field_label: f"{field_label} trebuie să fie un număr întreg."})
    if parsed < 0:
        raise ValidationError({field_label: f"{field_label} nu poate fi negativ."})
    return parsed


def _room_names(body, number_of_rooms):
    raw_rooms = body.get("rooms") or []
    if not isinstance(raw_rooms, list):
        raise ValidationError({"rooms": "Lista camerelor nu este validă."})
    names = []
    for position in range(1, number_of_rooms + 1):
        raw = raw_rooms[position - 1] if position <= len(raw_rooms) else ""
        name = str(raw.get("name") if isinstance(raw, dict) else raw or "").strip()
        if len(name) > 100:
            raise ValidationError({"rooms": "Denumirea unei camere poate avea cel mult 100 de caractere."})
        names.append(name or f"Camera {position}")
    return names


def _sync_accommodation_rooms(item, names):
    for position, name in enumerate(names, start=1):
        AccommodationRoom.objects.update_or_create(
            accommodation=item,
            position=position,
            defaults={"name": name},
        )
    item.rooms.filter(position__gt=len(names)).delete()


@csrf_exempt
def accommodations(request):
    if request.method == "GET":
        items = Accommodation.objects.prefetch_related("employees", "rooms__employees").order_by("name")
        employees = Users.objects.select_related("accommodation", "accommodation_room").filter(
            active=True,
            person_type=Users.PersonType.EMPLOYEE,
            employment_status=Users.EmploymentStatus.ACTIVE,
        ).order_by("UserName")
        return JsonResponse({
            "accommodations": [_accommodation_payload(item) for item in items],
            "employees": [_employee_accommodation_payload(employee) for employee in employees],
        })

    if request.method not in ("POST", "PUT", "PATCH"):
        return _error("Metodă nepermisă.", 405)
    body = _json_body(request)
    if body is None:
        return _error("JSON invalid.")
    name = str(body.get("name") or "").strip()
    if not name:
        return _error("Denumirea cazării este obligatorie.")
    if len(name) > 160:
        return _error("Denumirea cazării poate avea cel mult 160 de caractere.")
    item = None
    if request.method in ("PUT", "PATCH"):
        item = Accommodation.objects.filter(pk=body.get("id")).first()
        if not item:
            return _error("Cazarea nu există.", 404)
    duplicate = Accommodation.objects.filter(name__iexact=name)
    if item:
        duplicate = duplicate.exclude(pk=item.pk)
    if duplicate.exists():
        return _error("Există deja o cazare cu această denumire.")
    try:
        total_places = _non_negative_int(body.get("total_places"), "Numărul total de locuri")
        number_of_rooms = _non_negative_int(body.get("number_of_rooms"), "Numărul de camere")
        room_names = _room_names(body, number_of_rooms)
    except ValidationError as exc:
        return _error("Datele cazării nu sunt valide.", details=exc.message_dict)
    current_employee_count = item.employees.filter(
        active=True,
        person_type=Users.PersonType.EMPLOYEE,
        employment_status=Users.EmploymentStatus.ACTIVE,
    ).count() if item else 0
    if total_places and total_places < current_employee_count:
        return _error(f"Cazarea are deja {current_employee_count} angajați atribuiți.")
    if item and item.rooms.filter(
        position__gt=number_of_rooms,
        employees__active=True,
        employees__person_type=Users.PersonType.EMPLOYEE,
        employees__employment_status=Users.EmploymentStatus.ACTIVE,
    ).exists():
        return _error("Nu poți elimina camere care au angajați atribuiți. Mută mai întâi angajații în alte camere.")
    with transaction.atomic():
        item = item or Accommodation()
        item.name = name
        item.address = str(body.get("address") or "").strip()
        if len(item.address) > 255:
            return _error("Adresa poate avea cel mult 255 de caractere.")
        item.notes = str(body.get("notes") or "").strip()
        item.total_places = total_places
        item.number_of_rooms = number_of_rooms
        item.active = _as_bool(body.get("active", True))
        item.save()
        _sync_accommodation_rooms(item, room_names)
    item = Accommodation.objects.prefetch_related("employees", "rooms__employees").get(pk=item.pk)
    return JsonResponse({"accommodation": _accommodation_payload(item)}, status=201 if request.method == "POST" else 200)


@csrf_exempt
def accommodation_assignment(request):
    if request.method != "POST":
        return _error("Metodă nepermisă.", 405)
    body = _json_body(request)
    if body is None:
        return _error("JSON invalid.")
    employee = Users.objects.select_related("accommodation", "accommodation_room").filter(
        pk=body.get("employee_id"),
        active=True,
        person_type=Users.PersonType.EMPLOYEE,
        employment_status=Users.EmploymentStatus.ACTIVE,
    ).first()
    if not employee:
        return _error("Angajatul nu există.", 404)
    accommodation_id = body.get("accommodation_id")
    accommodation = None
    if accommodation_id not in (None, ""):
        accommodation = Accommodation.objects.prefetch_related("rooms").filter(pk=accommodation_id, active=True).first()
        if not accommodation:
            return _error("Cazarea selectată nu există sau este inactivă.", 404)
    room = None
    room_id = body.get("accommodation_room_id")
    if accommodation:
        has_rooms = accommodation.rooms.exists()
        if has_rooms and room_id in (None, ""):
            return _error("Selectează camera pentru cazarea aleasă.")
        if room_id not in (None, ""):
            room = accommodation.rooms.filter(pk=room_id).first()
            if not room:
                return _error("Camera selectată nu aparține cazării alese.")
        assigned_count = accommodation.employees.filter(
            active=True,
            person_type=Users.PersonType.EMPLOYEE,
            employment_status=Users.EmploymentStatus.ACTIVE,
        ).exclude(pk=employee.pk).count()
        if accommodation.total_places and assigned_count >= accommodation.total_places:
            return _error("Cazarea selectată nu mai are locuri disponibile.")
    employee.accommodation = accommodation
    employee.accommodation_room = room
    employee.housing_location = accommodation.name if accommodation else ""
    employee.save(update_fields=("accommodation", "accommodation_room", "housing_location"))
    return JsonResponse({"employee": _employee_accommodation_payload(employee)})


def _document_type_payload(item):
    return {
        "id": item.pk,
        "name": item.name,
        "category": item.category,
        "category_label": item.get_category_display(),
    }


def _document_payload(item):
    return {
        "id": item.pk,
        "employee_id": item.employee_id,
        "document_type": _document_type_payload(item.document_type),
        "original_file_name": item.original_file_name or Path(item.file.name).name,
        "has_expiry": item.has_expiry,
        "expiry_date": item.expiry_date.isoformat() if item.expiry_date else None,
        "uploaded_at": item.uploaded_at.isoformat(),
        "download_url": reverse("employee_document_download", args=[item.pk]),
    }


@csrf_exempt
def employee_document_types(request):
    if request.method == "GET":
        items = EmployeeDocumentType.objects.filter(active=True).order_by("category", "name")
        return JsonResponse({"types": [_document_type_payload(item) for item in items]})
    if request.method != "POST":
        return _error("Metodă nepermisă.", 405)
    body = _json_body(request)
    if body is None:
        return _error("JSON invalid.")
    name = str(body.get("name") or "").strip()
    category = str(body.get("category") or "").strip()
    if not name:
        return _error("Denumirea tipului este obligatorie.")
    if len(name) > 160:
        return _error("Denumirea tipului poate avea cel mult 160 de caractere.")
    if category not in EmployeeDocumentType.Category.values:
        return _error("Categoria documentului nu este validă.")
    existing = EmployeeDocumentType.objects.filter(category=category, name__iexact=name).first()
    if existing:
        return JsonResponse({"type": _document_type_payload(existing)})
    item = EmployeeDocumentType.objects.create(name=name, category=category)
    return JsonResponse({"type": _document_type_payload(item)}, status=201)


def _selected_document_type(request):
    type_id = request.POST.get("document_type_id")
    if type_id:
        item = EmployeeDocumentType.objects.filter(pk=type_id, active=True).first()
        if not item:
            raise ValidationError({"document_type_id": "Tipul selectat nu există."})
        return item
    name = str(request.POST.get("document_type_name") or "").strip()
    category = str(request.POST.get("category") or "").strip()
    if not name:
        raise ValidationError({"document_type_name": "Selectează sau creează tipul documentului."})
    if len(name) > 160:
        raise ValidationError({"document_type_name": "Denumirea tipului poate avea cel mult 160 de caractere."})
    if category not in EmployeeDocumentType.Category.values:
        raise ValidationError({"category": "Categoria documentului nu este validă."})
    item = EmployeeDocumentType.objects.filter(category=category, name__iexact=name).first()
    return item or EmployeeDocumentType.objects.create(name=name, category=category)


@csrf_exempt
def employee_documents(request, employee_id):
    employee = Users.objects.filter(pk=employee_id).first()
    if not employee:
        return _error("Angajatul nu există.", 404)
    if request.method == "GET":
        items = employee.documents.select_related("document_type").all()
        return JsonResponse({"documents": [_document_payload(item) for item in items]})
    if request.method != "POST":
        return _error("Metodă nepermisă.", 405)
    uploaded = request.FILES.get("file")
    if not uploaded:
        return _error("Scanarea documentului este obligatorie.")
    if uploaded.size > MAX_DOCUMENT_SIZE:
        return _error("Fișierul depășește limita de 15 MB.")
    if Path(uploaded.name).suffix.lower() not in DOCUMENT_EXTENSIONS:
        return _error("Sunt acceptate doar fișiere PDF, PNG, JPG sau WEBP.")
    try:
        document_type = _selected_document_type(request)
        has_expiry = _as_bool(request.POST.get("has_expiry"))
        expiry_date = _date_or_none(request.POST.get("expiry_date")) if has_expiry else None
        item = EmployeeDocument(
            employee=employee,
            document_type=document_type,
            file=uploaded,
            original_file_name=Path(uploaded.name).name[:255],
            has_expiry=has_expiry,
            expiry_date=expiry_date,
        )
        item.save()
    except ValidationError as exc:
        return _error("Documentul nu a putut fi salvat.", details=getattr(exc, "message_dict", None))
    return JsonResponse({"document": _document_payload(item)}, status=201)


@csrf_exempt
def employee_document_detail(request, document_id):
    item = get_object_or_404(EmployeeDocument.objects.select_related("document_type"), pk=document_id)
    if request.method != "DELETE":
        return _error("Metodă nepermisă.", 405)
    storage = item.file.storage
    file_name = item.file.name
    item.delete()
    if file_name:
        storage.delete(file_name)
    return JsonResponse({"ok": True})


def employee_document_download(request, document_id):
    item = get_object_or_404(EmployeeDocument, pk=document_id)
    return FileResponse(
        item.file.open("rb"),
        as_attachment=False,
        filename=item.original_file_name or Path(item.file.name).name,
    )
