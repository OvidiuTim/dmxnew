import json
from datetime import timedelta

from django.test import Client, TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from django.utils.timezone import localdate

from ToolApp import views
from ToolApp.models import (
    AttendanceSession,
    AppModuleAccess,
    AppUser,
    DocumentUtilaj,
    DocumentUtilajVersiune,
    EmployeeDocument,
    EmployeeDocumentType,
    SesiuneUtilaj,
    IncercareUtilajBlocata,
    RevizieUtilaj,
    TipDocumentUtilaj,
    Users,
    Utilaj,
)
from ToolApp.views import close_open_sessions_for_day_at_1730
from ToolApp.security import make_admin_token, make_app_user_token


class FleetFlowTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.employee = Users.objects.create(UserName="Șofer Test", UserSerie="DRV-1", UserPin="4321")
        self.utilaj = Utilaj.objects.create(
            cod_intern="DMX-U-012",
            denumire="Autoutilitară test",
            nr_inmatriculare="SB-12-DMX",
            categorie=Utilaj.Categorie.AUTOUTILITARA,
            tip_contor=Utilaj.TipContor.KM,
            contor_curent="100.00",
        )
        self.itp = TipDocumentUtilaj.objects.create(
            nume="ITP",
            blocheaza_utilizarea=True,
            zile_avertizare=30,
        )
        self.utilaj.tipuri_document_necesare.add(self.itp)
        self.document = DocumentUtilaj.objects.create(
            utilaj=self.utilaj,
            tip=self.itp,
            data_expirare=localdate() + timedelta(days=9),
            fisier="utilaj_documents/itp.pdf",
        )
        self.admin_client = Client()
        self.admin_client.cookies["ptj"] = make_admin_token()

    @property
    def detail_url(self):
        return f"/api/fleet/qr/{self.utilaj.token_qr}/"

    def take(self, **extra):
        return self.client.post(
            f"{self.detail_url}take/",
            data=json.dumps({"pin": "4321", "counter": 101, **extra}),
            content_type="application/json",
        )

    def check_in(self):
        return AttendanceSession.objects.create(user_fk=self.employee, work_date=localdate(), in_time=timezone.now())

    def test_qr_and_exact_registration_lookup_show_traffic_light_documents(self):
        detail = self.client.get(self.detail_url)
        lookup = self.client.get("/api/fleet/lookup/", {"q": "sb-12-dmx"})

        self.assertEqual(detail.status_code, 200)
        self.assertEqual(lookup.status_code, 200)
        payload = detail.json()["equipment"]
        self.assertEqual(payload["code"], "DMX-U-012")
        self.assertEqual(payload["documents"][0]["status"], "warning")
        self.assertEqual(payload["documents"][0]["days_remaining"], 9)

    def test_registry_requires_fleet_module_but_qr_card_is_public(self):
        app_user = AppUser.objects.create(employee=self.employee, username="driver.test", pin_hash="unused")
        app_client = Client()
        app_client.cookies["appj"] = make_app_user_token(app_user)
        self.assertEqual(app_client.get("/api/fleet/equipment/").status_code, 403)
        self.assertEqual(app_client.get(self.detail_url).status_code, 200)
        AppModuleAccess.objects.create(app_user=app_user, module_code=AppModuleAccess.ModuleCode.FLEET)
        self.assertEqual(app_client.get("/api/fleet/equipment/").status_code, 200)

    def test_take_requires_active_attendance_and_valid_blocking_document(self):
        self.assertEqual(self.take().json()["error_code"], "ATTENDANCE_REQUIRED")
        self.assertTrue(IncercareUtilajBlocata.objects.filter(cod="ATTENDANCE_REQUIRED").exists())
        self.check_in()
        self.document.data_expirare = localdate() - timedelta(days=1)
        self.document.save()

        response = self.take()

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error_code"], "BLOCKED_DOCUMENTS")
        self.assertFalse(SesiuneUtilaj.objects.exists())

    def test_take_requires_employee_authorization_configured_for_equipment(self):
        authorization = EmployeeDocumentType.objects.create(
            name="Permis categoria B",
            category=EmployeeDocumentType.Category.PERSONAL,
        )
        self.itp.documente_angajat_necesare.add(authorization)
        self.check_in()
        missing = self.take()
        self.assertEqual(missing.json()["error_code"], "EMPLOYEE_AUTHORIZATION_REQUIRED")
        EmployeeDocument.objects.create(
            employee=self.employee,
            document_type=authorization,
            file="employee_documents/permis.pdf",
            has_expiry=True,
            expiry_date=localdate() + timedelta(days=100),
        )
        self.assertEqual(self.take().status_code, 201)

    def test_employee_can_take_and_return_equipment(self):
        self.check_in()
        taken = self.take()
        self.assertEqual(taken.status_code, 201, taken.content)
        self.utilaj.refresh_from_db()
        self.assertEqual(self.utilaj.stare, Utilaj.Stare.IN_LUCRU)

        returned = self.client.post(
            f"{self.detail_url}return/",
            data=json.dumps({"pin": "4321", "counter": 115}),
            content_type="application/json",
        )

        self.assertEqual(returned.status_code, 200, returned.content)
        session = SesiuneUtilaj.objects.get()
        self.assertIsNotNone(session.sfarsit)
        self.assertEqual(session.motiv_inchidere, SesiuneUtilaj.MotivInchidere.PREDARE)
        self.assertEqual(session.contor_sfarsit, 115)
        self.utilaj.refresh_from_db()
        self.assertEqual(self.utilaj.stare, Utilaj.Stare.DISPONIBIL)
        self.assertEqual(self.utilaj.contor_curent, 115)

    def test_admin_can_manage_equipment_documents_and_maintenance(self):
        created = self.admin_client.post(
            "/api/fleet/equipment/",
            data=json.dumps({"code": "EXC-02", "name": "Excavator 2", "category": "excavator"}),
            content_type="application/json",
        )
        self.assertEqual(created.status_code, 201, created.content)
        equipment_id = created.json()["equipment"]["id"]
        uploaded = SimpleUploadedFile("rca.pdf", b"document-test", content_type="application/pdf")
        document = self.admin_client.post(
            "/api/fleet/equipment/documents/",
            {"equipment_id": equipment_id, "type_id": self.itp.pk,
             "expiry_date": (localdate() + timedelta(days=365)).isoformat(), "file": uploaded},
        )
        self.assertEqual(document.status_code, 200, document.content)
        self.assertTrue(DocumentUtilajVersiune.objects.filter(document__utilaj_id=equipment_id).exists())

        maintenance = self.admin_client.post(
            "/api/fleet/equipment/maintenance/",
            data=json.dumps({"equipment_id": equipment_id, "name": "Revizie 500 ore", "due_counter": 500}),
            content_type="application/json",
        )
        self.assertEqual(maintenance.status_code, 201, maintenance.content)
        maintenance_id = maintenance.json()["maintenance"]["id"]
        completed = self.admin_client.patch(
            f"/api/fleet/equipment/maintenance/{maintenance_id}/",
            data=json.dumps({"status": "finalizata", "cost": 1200}),
            content_type="application/json",
        )
        self.assertEqual(completed.status_code, 200, completed.content)
        self.assertEqual(RevizieUtilaj.objects.get(pk=maintenance_id).status, RevizieUtilaj.Status.FINALIZATA)

        detail = self.admin_client.get(f"/api/fleet/equipment/{equipment_id}/")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(len(detail.json()["equipment"]["document_history"]), 1)
        self.assertEqual(len(detail.json()["equipment"]["maintenance"]), 1)
        qr = self.admin_client.get(f"/api/fleet/equipment/{equipment_id}/qr.png")
        self.assertEqual(qr.status_code, 200)
        self.assertEqual(qr["Content-Type"], "image/png")

    def test_team_dashboard_always_exposes_employee_fleet_action(self):
        app_user = AppUser.objects.create(employee=self.employee, username="operator.portal", pin_hash="unused")
        AppModuleAccess.objects.create(app_user=app_user, module_code=AppModuleAccess.ModuleCode.TEAM_DASHBOARD)
        app_client = Client()
        app_client.cookies["appj"] = make_app_user_token(app_user)

        response = app_client.get("/api/team-portal/dashboard/")

        self.assertEqual(response.status_code, 200, response.content)
        self.assertTrue(response.json()["can_access_fleet"])

    def test_attendance_checkout_closes_equipment_session(self):
        attendance = self.check_in()
        self.assertEqual(self.take().status_code, 201)
        views._last_seen.clear()

        checkout = self.client.post(
            "/api/nfc/scan/",
            data=json.dumps({
                "uid": "TEST-CARD",
                "tag_type": "pin",
                "content": "4321",
                "timestamp": timezone.now().isoformat(),
            }),
            content_type="application/json",
        )

        self.assertEqual(checkout.status_code, 200, checkout.content)
        self.assertEqual(checkout.json()["state"], "EXIT")
        attendance.refresh_from_db()
        equipment_session = SesiuneUtilaj.objects.get()
        self.assertEqual(equipment_session.sfarsit, attendance.out_time)
        self.assertEqual(equipment_session.motiv_inchidere, SesiuneUtilaj.MotivInchidere.DEPONTARE)

    def test_end_of_day_closes_equipment_session_idempotently(self):
        attendance = self.check_in()
        self.assertEqual(self.take().status_code, 201)

        self.assertEqual(close_open_sessions_for_day_at_1730(localdate()), 1)
        self.assertEqual(close_open_sessions_for_day_at_1730(localdate()), 0)

        equipment_session = SesiuneUtilaj.objects.get()
        attendance.refresh_from_db()
        self.assertEqual(equipment_session.sfarsit, attendance.out_time)
        self.assertEqual(equipment_session.motiv_inchidere, SesiuneUtilaj.MotivInchidere.FINAL_ZI)
        self.utilaj.refresh_from_db()
        self.assertEqual(self.utilaj.stare, Utilaj.Stare.DISPONIBIL)
