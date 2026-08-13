import json
import shutil
import tempfile
from datetime import timedelta
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from ToolApp.models import (
    Accommodation,
    AppModuleAccess,
    AppPagePermission,
    AppUser,
    AttendanceSession,
    EmployeeDocument,
    EmployeeDocumentType,
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
