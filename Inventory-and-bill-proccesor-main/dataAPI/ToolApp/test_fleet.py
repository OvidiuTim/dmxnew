import json
import tempfile
from datetime import timedelta
from unittest.mock import patch

from django.test import Client, TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from django.utils.timezone import localdate

from ToolApp import views
from ToolApp.fleet_services import due_fleet_document_expiry_notifications
from ToolApp.document_expiry_email import process_due_fleet_document_expiry_notifications
from ToolApp.models import (
    AttendanceSession,
    AppModuleAccess,
    AppUser,
    DocumentUtilaj,
    DocumentUtilajVersiune,
    EmployeeDocument,
    EmployeeDocumentType,
    FleetDocumentExpiryNotification,
    FleetDocumentResponsible,
    FleetDocumentUsageAlert,
    FleetRecommendationSubmission,
    FleetTechnicalRecommendation,
    FleetTechnicalResponsible,
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
        self._media = tempfile.TemporaryDirectory()
        self._settings = self.settings(MEDIA_ROOT=self._media.name)
        self._settings.enable()
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
        self.itp, _ = TipDocumentUtilaj.objects.update_or_create(
            nume="ITP",
            defaults={"importanta": TipDocumentUtilaj.Importance.HIGH, "zile_avertizare": 30},
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

    def tearDown(self):
        self._settings.disable()
        self._media.cleanup()

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

    def test_fleet_expiry_notification_is_due_once_and_resets_after_renewal(self):
        due = due_fleet_document_expiry_notifications()
        self.assertEqual([item.pk for item in due], [self.document.pk])
        self.document.expiry_notification_sent_for = self.document.data_expirare
        self.document.expiry_notification_sent_at = timezone.now()
        self.document.save()
        self.assertEqual(due_fleet_document_expiry_notifications(), [])
        self.document.data_expirare = localdate() + timedelta(days=20)
        self.document.save()
        self.document.refresh_from_db()
        self.assertIsNone(self.document.expiry_notification_sent_for)
        self.assertEqual([item.pk for item in due_fleet_document_expiry_notifications()], [self.document.pk])

    def test_admin_can_assign_multiple_document_responsibles_to_selected_or_all_equipment(self):
        first = Users.objects.create(
            UserName="Responsabil Unu", UserSerie="RESP-1", email="unu@example.com"
        )
        second = Users.objects.create(
            UserName="Responsabil Doi", UserSerie="RESP-2", email="doi@example.com"
        )
        selected = self.admin_client.post(
            "/api/fleet/equipment/responsibles/",
            data=json.dumps({
                "employee_id": first.pk,
                "email": first.email,
                "all_equipment": False,
                "equipment_ids": [self.utilaj.pk],
            }),
            content_type="application/json",
        )
        all_equipment = self.admin_client.post(
            "/api/fleet/equipment/responsibles/",
            data=json.dumps({
                "employee_id": second.pk,
                "email": second.email,
                "all_equipment": True,
                "equipment_ids": [],
            }),
            content_type="application/json",
        )

        self.assertEqual(selected.status_code, 201, selected.content)
        self.assertEqual(all_equipment.status_code, 201, all_equipment.content)
        payload = self.admin_client.get("/api/fleet/equipment/responsibles/").json()
        self.assertEqual(len(payload["responsibles"]), 2)
        selected_payload = next(item for item in payload["responsibles"] if item["employee"]["id"] == first.pk)
        self.assertEqual(selected_payload["equipment_ids"], [self.utilaj.pk])
        self.assertFalse(selected_payload["all_equipment"])
        self.assertTrue(next(item for item in payload["responsibles"] if item["employee"]["id"] == second.pk)["all_equipment"])

    @patch("ToolApp.document_expiry_email._send_fleet_document_expiry_email")
    def test_each_fleet_responsible_receives_only_assigned_expirations_once(self, send_email):
        other_equipment = Utilaj.objects.create(cod_intern="DMX-U-099", denumire="Excavator alertă")
        other_document = DocumentUtilaj.objects.create(
            utilaj=other_equipment,
            tip=self.itp,
            data_expirare=localdate() + timedelta(days=8),
            fisier="utilaj_documents/other.pdf",
        )
        first_employee = Users.objects.create(
            UserName="Responsabil Selectiv", UserSerie="RESP-SEL", email="selectiv@example.com"
        )
        second_employee = Users.objects.create(
            UserName="Responsabil General", UserSerie="RESP-ALL", email="general@example.com"
        )
        selected = FleetDocumentResponsible.objects.create(
            responsabil=first_employee, email=first_employee.email
        )
        selected.utilaje.add(self.utilaj)
        FleetDocumentResponsible.objects.create(
            responsabil=second_employee, email=second_employee.email, toate_utilajele=True
        )

        notified = process_due_fleet_document_expiry_notifications()

        self.assertEqual({item.pk for item in notified}, {self.document.pk, other_document.pk})
        self.assertEqual(send_email.call_count, 2)
        deliveries = {
            call.args[1][0]: {item.pk for item in call.args[0]}
            for call in send_email.call_args_list
        }
        self.assertEqual(deliveries["selectiv@example.com"], {self.document.pk})
        self.assertEqual(deliveries["general@example.com"], {self.document.pk, other_document.pk})
        self.assertEqual(FleetDocumentExpiryNotification.objects.count(), 3)

        send_email.reset_mock()
        self.assertEqual(process_due_fleet_document_expiry_notifications(), [])
        send_email.assert_not_called()

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

    @patch("ToolApp.fleet_views.send_employee_push")
    def test_medium_expired_document_warns_responsible_but_allows_take(self, send_push):
        self.itp.importanta = TipDocumentUtilaj.Importance.MEDIUM
        self.itp.save()
        self.document.data_expirare = localdate() - timedelta(days=1)
        self.document.save()
        responsible_employee = Users.objects.create(
            UserName="Responsabil Acte", UserSerie="DOC-1", email="acte@example.com"
        )
        responsible_user = AppUser.objects.create(
            employee=responsible_employee, username="documente.user", pin_hash="unused"
        )
        FleetDocumentResponsible.objects.create(
            responsabil=responsible_employee,
            email=responsible_employee.email,
            toate_utilajele=True,
        )
        responsible_client = Client()
        responsible_client.cookies["appj"] = make_app_user_token(responsible_user)
        self.check_in()

        response = self.take()

        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["document_warnings"][0]["type"], "ITP")
        alert = FleetDocumentUsageAlert.objects.get()
        self.assertFalse(alert.blocata)
        send_push.assert_called_once()
        summary = responsible_client.get("/api/team-portal/notifications/summary/")
        self.assertEqual(summary.status_code, 200, summary.content)
        self.assertEqual(summary.json()["unread_count"], 1)

    @patch("ToolApp.fleet_views.send_employee_push")
    def test_high_expired_document_blocks_and_alerts_responsible_once(self, send_push):
        self.document.data_expirare = localdate() - timedelta(days=1)
        self.document.save()
        responsible_employee = Users.objects.create(
            UserName="Responsabil Blocare", UserSerie="DOC-2", email="blocare@example.com"
        )
        FleetDocumentResponsible.objects.create(
            responsabil=responsible_employee,
            email=responsible_employee.email,
            toate_utilajele=True,
        )
        self.check_in()

        first = self.take()
        second = self.take()

        self.assertEqual(first.status_code, 409, first.content)
        self.assertEqual(first.json()["error_code"], "BLOCKED_DOCUMENTS")
        self.assertEqual(len(first.json()["responsibles"]), 1)
        self.assertEqual(second.status_code, 409, second.content)
        self.assertEqual(FleetDocumentUsageAlert.objects.filter(blocata=True).count(), 1)
        send_push.assert_called_once()

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

    def test_low_importance_due_recommendation_does_not_block_usage(self):
        FleetTechnicalRecommendation.objects.create(
            utilaj=self.utilaj,
            titlu="Curăță cabina",
            prima_scadenta=localdate(),
            importanta=FleetTechnicalRecommendation.Importance.LOW,
        )
        self.check_in()

        response = self.take()

        self.assertEqual(response.status_code, 201, response.content)

    @patch("ToolApp.fleet_views.send_employee_push")
    def test_high_recommendation_blocks_until_photo_is_approved(self, send_push):
        recommendation = FleetTechnicalRecommendation.objects.create(
            utilaj=self.utilaj,
            titlu="Schimbă uleiul",
            instructiuni="Fotografiază joja și recipientul nou.",
            prima_scadenta=localdate(),
            importanta=FleetTechnicalRecommendation.Importance.HIGH,
        )
        technician_employee = Users.objects.create(
            UserName="Responsabil Tehnic", UserSerie="TECH-1", email="tech@example.com"
        )
        technician = AppUser.objects.create(
            employee=technician_employee, username="tech.user", pin_hash="unused"
        )
        FleetTechnicalResponsible.objects.create(app_user=technician)
        technician_client = Client()
        technician_client.cookies["appj"] = make_app_user_token(technician)
        self.check_in()
        blocked = self.take()
        self.assertEqual(blocked.status_code, 409)
        self.assertEqual(blocked.json()["error_code"], "TECHNICAL_RECOMMENDATION_REQUIRED")

        photo = SimpleUploadedFile("ulei.jpg", b"photo-test", content_type="image/jpeg")
        submitted = self.client.post(
            f"{self.detail_url}recommendations/{recommendation.pk}/submit/",
            {"pin": "4321", "photo": photo},
        )
        self.assertEqual(submitted.status_code, 201, submitted.content)
        submission_id = submitted.json()["submission"]["id"]
        send_push.assert_called_once()
        self.assertEqual(
            technician_client.get("/api/team-portal/notifications/summary/").json()["unread_count"],
            1,
        )
        self.assertEqual(self.take().status_code, 409)

        approved = technician_client.post(
            f"/api/fleet/qr/recommendation-submissions/{submission_id}/decision/",
            data=json.dumps({"action": "approve"}),
            content_type="application/json",
        )
        self.assertEqual(approved.status_code, 200, approved.content)
        self.assertEqual(FleetRecommendationSubmission.objects.get(pk=submission_id).status, "approved")
        self.assertEqual(self.take().status_code, 201)
        self.assertEqual(
            technician_client.get("/api/team-portal/notifications/summary/").json()["unread_count"],
            0,
        )

    def test_medium_recommendation_unlocks_fifteen_minutes_after_submission(self):
        recommendation = FleetTechnicalRecommendation.objects.create(
            utilaj=self.utilaj,
            titlu="Verifică presiunea",
            prima_scadenta=localdate(),
            importanta=FleetTechnicalRecommendation.Importance.MEDIUM,
        )
        self.check_in()
        self.assertEqual(self.take().status_code, 409)
        photo = SimpleUploadedFile("presiune.jpg", b"photo-test", content_type="image/jpeg")
        submitted = self.client.post(
            f"{self.detail_url}recommendations/{recommendation.pk}/submit/",
            {"pin": "4321", "photo": photo},
        )
        self.assertEqual(submitted.status_code, 201, submitted.content)
        self.assertEqual(self.take().status_code, 409)
        FleetRecommendationSubmission.objects.filter(pk=submitted.json()["submission"]["id"]).update(
            submitted_at=timezone.now() - timedelta(minutes=16)
        )

        self.assertEqual(self.take().status_code, 201)

    def test_admin_configures_technical_responsible_and_recommendation(self):
        technician_employee = Users.objects.create(UserName="Tehnic Admin", UserSerie="TECH-2")
        technician = AppUser.objects.create(employee=technician_employee, username="tech.admin", pin_hash="unused")
        configured = self.admin_client.post(
            "/api/fleet/equipment/technical-responsible/",
            data=json.dumps({"app_user_id": technician.pk}),
            content_type="application/json",
        )
        self.assertEqual(configured.status_code, 200, configured.content)
        recommendation = self.admin_client.post(
            "/api/fleet/equipment/recommendations/",
            data=json.dumps({
                "equipment_id": self.utilaj.pk,
                "title": "Curățare săptămânală",
                "instructions": "Curăță exteriorul și cabina.",
                "frequency_value": 1,
                "frequency_unit": "week",
                "first_due_date": localdate().isoformat(),
                "importance": "low",
            }),
            content_type="application/json",
        )
        self.assertEqual(recommendation.status_code, 201, recommendation.content)
        detail = self.admin_client.get(f"/api/fleet/equipment/{self.utilaj.pk}/").json()["equipment"]
        self.assertEqual(detail["recommendations"][0]["title"], "Curățare săptămânală")
        self.assertTrue(FleetTechnicalResponsible.objects.filter(app_user=technician).exists())

    def test_admin_can_manage_equipment_documents_and_maintenance(self):
        authorization = EmployeeDocumentType.objects.create(
            name="Autorizație excavator",
            category=EmployeeDocumentType.Category.PERSONAL,
        )
        configured_type = self.admin_client.post(
            "/api/fleet/equipment/document-types/",
            data=json.dumps({
                "id": self.itp.pk,
                "name": "ITP",
                "blocking": True,
                "warning_days": 45,
                "required_employee_document_type_ids": [authorization.pk],
            }),
            content_type="application/json",
        )
        self.assertEqual(configured_type.status_code, 200, configured_type.content)
        self.assertEqual(configured_type.json()["type"]["required_employee_document_type_ids"], [authorization.pk])

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
