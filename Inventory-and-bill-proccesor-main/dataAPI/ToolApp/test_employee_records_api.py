import json
import shutil
import tempfile
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from ToolApp.models import (
    Accommodation,
    AccommodationRoom,
    AppModuleAccess,
    AppPagePermission,
    AppUser,
    AttendanceSession,
    EmployeeDocument,
    EmployeeDocumentType,
    LeaveDay,
    Users,
)
from ToolApp.security import make_admin_token, make_app_user_token
from ToolApp.document_expiry_email import (
    DOCUMENT_EXPIRY_RECIPIENTS,
    build_document_expiry_email,
    process_due_document_expiry_notifications,
)


TEST_MEDIA_ROOT = tempfile.mkdtemp(prefix="dmx-test-documents-")


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class EmployeeRecordsApiTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEST_MEDIA_ROOT, ignore_errors=True)

    def setUp(self):
        self.employee = Users.objects.create(
            UserName="Angajat Test",
            UserSerie="EMP-REC-1",
            trade="Dulgher",
        )
        self.admin = Client()
        self.admin.cookies["ptj"] = make_admin_token()

    def test_attendance_day_exposes_employee_trade(self):
        AttendanceSession.objects.create(
            user_fk=self.employee,
            work_date=timezone.localdate(),
            in_time=timezone.now(),
        )

        response = self.admin.get(reverse("attendance_day"), {"date": str(timezone.localdate())})

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["rows"][0]["trade"], "Dulgher")

    def test_employee_can_be_created_with_total_salary_in_ron(self):
        response = self.admin.post(
            "/api/user/",
            data=json.dumps({
                "UserName": "Angajat Salariu",
                "UserSerie": "EMP-SALARY-CREATE",
                "UserPin": "8877",
                "hourly_rate": "25.00",
                "total_salary_ron": "4750.50",
                "salary_advance_ron": "1200.00",
                "salary_remainder_ron": "3550.50",
                "meal_vouchers_ron": "600.00",
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["total_salary_ron"], "4750.50")
        self.assertEqual(response.json()["salary_advance_ron"], "1200.00")
        self.assertEqual(response.json()["salary_remainder_ron"], "3550.50")
        self.assertEqual(response.json()["meal_vouchers_ron"], "600.00")
        employee = Users.objects.get(UserSerie="EMP-SALARY-CREATE")
        self.assertEqual(employee.total_salary_ron, Decimal("4750.50"))
        self.assertEqual(employee.salary_advance_ron, Decimal("1200.00"))
        self.assertEqual(employee.salary_remainder_ron, Decimal("3550.50"))
        self.assertEqual(employee.meal_vouchers_ron, Decimal("600.00"))

    def test_employee_total_salary_can_be_edited_and_loaded_again(self):
        response = self.admin.put(
            "/api/user/",
            data=json.dumps({
                "UserId": self.employee.pk,
                "UserName": self.employee.UserName,
                "UserSerie": self.employee.UserSerie,
                "hourly_rate": "23.00",
                "total_salary_ron": "5125.75",
                "salary_advance_ron": "1000.00",
                "salary_remainder_ron": "4125.75",
                "meal_vouchers_ron": "700.00",
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["total_salary_ron"], "5125.75")
        self.assertEqual(response.json()["salary_advance_ron"], "1000.00")
        self.assertEqual(response.json()["salary_remainder_ron"], "4125.75")
        self.assertEqual(response.json()["meal_vouchers_ron"], "700.00")
        loaded = self.admin.get(f"/api/user/{self.employee.pk}")
        self.assertEqual(loaded.status_code, 200, loaded.content)
        self.assertEqual(loaded.json()["total_salary_ron"], "5125.75")
        self.assertEqual(loaded.json()["salary_advance_ron"], "1000.00")
        self.assertEqual(loaded.json()["salary_remainder_ron"], "4125.75")
        self.assertEqual(loaded.json()["meal_vouchers_ron"], "700.00")

    def test_attendance_day_exposes_leave_without_marking_employee_absent(self):
        LeaveDay.objects.create(
            user_fk=self.employee,
            work_date=timezone.localdate(),
            reason=LeaveDay.Reason.CO,
        )

        response = self.admin.get(reverse("attendance_day"), {"date": str(timezone.localdate())})

        self.assertEqual(response.status_code, 200, response.content)
        row = next(item for item in response.json()["rows"] if item["UserId"] == self.employee.pk)
        self.assertEqual(row["status"], "LEAVE")
        self.assertEqual(row["leave"]["label"], "Concediu de odihnă")
        self.assertEqual(row["sessions"], [])

    def test_leave_has_priority_over_an_attendance_session(self):
        LeaveDay.objects.create(
            user_fk=self.employee,
            work_date=timezone.localdate(),
            reason=LeaveDay.Reason.CM,
        )
        AttendanceSession.objects.create(
            user_fk=self.employee,
            work_date=timezone.localdate(),
            in_time=timezone.now(),
        )

        response = self.admin.get(reverse("attendance_day"), {"date": str(timezone.localdate())})

        self.assertEqual(response.status_code, 200, response.content)
        row = next(item for item in response.json()["rows"] if item["UserId"] == self.employee.pk)
        self.assertEqual(row["status"], "LEAVE")
        self.assertEqual(row["leave"]["label"], "Concediu medical")

    def test_accommodation_can_be_created_and_assigned(self):
        created = self.admin.post(
            reverse("accommodations"),
            data=json.dumps({"name": "Cazare Centrală", "address": "Strada Florilor 1"}),
            content_type="application/json",
        )
        self.assertEqual(created.status_code, 201, created.content)
        accommodation_id = created.json()["accommodation"]["id"]

        assigned = self.admin.post(
            reverse("accommodation_assignment"),
            data=json.dumps({"employee_id": self.employee.pk, "accommodation_id": accommodation_id}),
            content_type="application/json",
        )

        self.assertEqual(assigned.status_code, 200, assigned.content)
        self.employee.refresh_from_db()
        self.assertEqual(self.employee.accommodation_id, accommodation_id)
        self.assertEqual(self.employee.housing_location, "Cazare Centrală")
        listing = self.admin.get(reverse("accommodations")).json()
        self.assertEqual(listing["accommodations"][0]["employee_count"], 1)
        self.assertEqual(listing["employees"][0]["accommodation_id"], accommodation_id)

    def test_accommodation_rooms_are_named_and_saved_with_employee_assignment(self):
        created = self.admin.post(
            reverse("accommodations"),
            data=json.dumps({
                "name": "Cazare cu camere",
                "address": "Strada Camerelor 2",
                "total_places": 8,
                "number_of_rooms": 2,
                "rooms": [{"name": "Parter"}, {"name": "Etaj 1"}],
            }),
            content_type="application/json",
        )
        self.assertEqual(created.status_code, 201, created.content)
        accommodation = created.json()["accommodation"]
        self.assertEqual(accommodation["total_places"], 8)
        self.assertEqual(accommodation["number_of_rooms"], 2)
        self.assertEqual([room["name"] for room in accommodation["rooms"]], ["Parter", "Etaj 1"])

        missing_room = self.admin.post(
            reverse("accommodation_assignment"),
            data=json.dumps({"employee_id": self.employee.pk, "accommodation_id": accommodation["id"]}),
            content_type="application/json",
        )
        self.assertEqual(missing_room.status_code, 400)

        room_id = accommodation["rooms"][1]["id"]
        assigned = self.admin.post(
            reverse("accommodation_assignment"),
            data=json.dumps({
                "employee_id": self.employee.pk,
                "accommodation_id": accommodation["id"],
                "accommodation_room_id": room_id,
            }),
            content_type="application/json",
        )
        self.assertEqual(assigned.status_code, 200, assigned.content)
        self.employee.refresh_from_db()
        self.assertEqual(self.employee.accommodation_room_id, room_id)
        self.assertEqual(assigned.json()["employee"]["accommodation_room_name"], "Etaj 1")

        updated = self.admin.put(
            reverse("accommodations"),
            data=json.dumps({
                "id": accommodation["id"],
                "name": "Cazare cu camere",
                "total_places": 10,
                "number_of_rooms": 2,
                "rooms": ["Camera A", "Camera B"],
                "active": True,
            }),
            content_type="application/json",
        )
        self.assertEqual(updated.status_code, 200, updated.content)
        self.assertEqual([room["name"] for room in updated.json()["accommodation"]["rooms"]], ["Camera A", "Camera B"])
        self.assertEqual(AccommodationRoom.objects.get(pk=room_id).name, "Camera B")

        remove_occupied_room = self.admin.put(
            reverse("accommodations"),
            data=json.dumps({
                "id": accommodation["id"],
                "name": "Cazare cu camere",
                "total_places": 10,
                "number_of_rooms": 1,
                "rooms": ["Camera A"],
            }),
            content_type="application/json",
        )
        self.assertEqual(remove_occupied_room.status_code, 400)
        self.assertIn("angajați atribuiți", remove_occupied_room.json()["error"])
        self.assertTrue(AccommodationRoom.objects.filter(pk=room_id).exists())

    def test_user_serializer_accepts_accommodation_field(self):
        accommodation = Accommodation.objects.create(name="Cazare Vest")
        payload = {
            "UserId": self.employee.pk,
            "UserName": self.employee.UserName,
            "UserSerie": self.employee.UserSerie,
            "trade": self.employee.trade,
            "accommodation_id": accommodation.pk,
        }

        response = self.admin.put("/api/user/", data=json.dumps(payload), content_type="application/json")

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["accommodation_id"], accommodation.pk)
        self.assertEqual(response.json()["accommodation"]["name"], "Cazare Vest")

    def test_document_upload_supports_new_type_category_and_expiry(self):
        response = self.admin.post(
            reverse("employee_documents", args=[self.employee.pk]),
            data={
                "category": "personal",
                "document_type_name": "Pașaport",
                "has_expiry": "true",
                "expiry_date": "2030-12-31",
                "file": SimpleUploadedFile("pasaport.pdf", b"%PDF-1.4 test", content_type="application/pdf"),
            },
        )

        self.assertEqual(response.status_code, 201, response.content)
        document = EmployeeDocument.objects.select_related("document_type").get()
        self.assertEqual(document.document_type.name, "Pașaport")
        self.assertEqual(document.document_type.category, EmployeeDocumentType.Category.PERSONAL)
        self.assertTrue(document.has_expiry)
        self.assertEqual(str(document.expiry_date), "2030-12-31")
        self.assertEqual(response.json()["document"]["download_url"], reverse("employee_document_download", args=[document.pk]))

        downloaded = self.admin.get(reverse("employee_document_download", args=[document.pk]))
        self.assertEqual(downloaded.status_code, 200)

    def test_expiry_date_is_required_only_when_option_is_enabled(self):
        invalid = self.admin.post(
            reverse("employee_documents", args=[self.employee.pk]),
            data={
                "category": "employment",
                "document_type_name": "Contract",
                "has_expiry": "true",
                "file": SimpleUploadedFile("contract.pdf", b"%PDF-1.4 test", content_type="application/pdf"),
            },
        )
        self.assertEqual(invalid.status_code, 400)

        valid = self.admin.post(
            reverse("employee_documents", args=[self.employee.pk]),
            data={
                "category": "employment",
                "document_type_name": "Contract",
                "has_expiry": "false",
                "file": SimpleUploadedFile("contract.pdf", b"%PDF-1.4 test", content_type="application/pdf"),
            },
        )
        self.assertEqual(valid.status_code, 201, valid.content)
        self.assertIsNone(EmployeeDocument.objects.get().expiry_date)

    @patch("ToolApp.document_expiry_email.send_document_expiry_email")
    def test_document_expiry_notification_is_sent_once_with_required_details(self, send_email_mock):
        document_type = EmployeeDocumentType.objects.create(
            name="Pașaport",
            category=EmployeeDocumentType.Category.PERSONAL,
        )
        expiry_date = timezone.localdate() + timedelta(days=14)
        document = EmployeeDocument.objects.create(
            employee=self.employee,
            document_type=document_type,
            file=SimpleUploadedFile("pasaport.pdf", b"%PDF-1.4 test", content_type="application/pdf"),
            original_file_name="pasaport.pdf",
            has_expiry=True,
            expiry_date=expiry_date,
        )

        notified = process_due_document_expiry_notifications()
        document.refresh_from_db()

        self.assertEqual([item.pk for item in notified], [document.pk])
        send_email_mock.assert_called_once()
        self.assertEqual(send_email_mock.call_args.kwargs.get("recipients"), None)
        self.assertEqual(document.expiry_notification_sent_for, expiry_date)
        self.assertIsNotNone(document.expiry_notification_sent_at)
        self.assertEqual(process_due_document_expiry_notifications(), [])

        subject, text, html = build_document_expiry_email([document])
        self.assertIn(self.employee.UserName, text)
        self.assertIn("Pașaport", text)
        self.assertIn(expiry_date.strftime("%d.%m.%Y"), text)
        self.assertIn(self.employee.UserName, html)
        self.assertTrue(subject)
        self.assertEqual(
            DOCUMENT_EXPIRY_RECIPIENTS,
            ("info@novarion.ro", "achizitii2@dmxconstruction.ro", "hr@xuxinvestment.ro"),
        )

    def test_module_allows_reads_but_granular_permission_controls_writes(self):
        app_user = AppUser.objects.create(employee=self.employee, username="records.user", pin_hash="unused")
        AppModuleAccess.objects.create(app_user=app_user, module_code="attendance")
        client = Client()
        client.cookies["appj"] = make_app_user_token(app_user)

        self.assertEqual(client.get(reverse("accommodations")).status_code, 200)
        self.assertEqual(client.get(reverse("employee_documents", args=[self.employee.pk])).status_code, 200)
        denied = client.post(
            reverse("accommodations"),
            data=json.dumps({"name": "Cazare Nord"}),
            content_type="application/json",
        )
        self.assertEqual(denied.status_code, 403)

        AppPagePermission.objects.create(app_user=app_user, route="/pontaj/cazari", can_access=True)
        allowed = client.post(
            reverse("accommodations"),
            data=json.dumps({"name": "Cazare Nord"}),
            content_type="application/json",
        )
        self.assertEqual(allowed.status_code, 201, allowed.content)
