from datetime import timedelta
import json
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from django.utils.timezone import localdate, localtime

from ToolApp.models import AttendanceSession, Users
from ToolApp.security import make_admin_token
from ToolApp import views as tool_views
from ToolApp.worksites import ACCEPTED_WORKSITES, worksite_perimeters


class MonitorPontajTests(TestCase):
    def test_monitor_white_embeds_initial_events_for_existing_attendance(self):
        user = Users.objects.create(
            UserName="Ion Pop",
            UserSerie="SER-100",
        )
        now = timezone.now()
        AttendanceSession.objects.create(
            user_fk=user,
            work_date=localdate(now),
            in_time=now - timedelta(hours=2),
            out_time=now - timedelta(hours=1),
            duration_seconds=3600,
            source="nfc",
            worksite="Tractorului Bloc B2",
        )

        response = self.client.get("/pontaj/monitor/white/")

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "monitorInitialEvents")
        self.assertContains(response, "Ion Pop")
        self.assertContains(response, "Tractorului Bloc B2")

    def test_pontaj_stream_is_public_without_admin_login(self):
        response = self.client.get("/api/pontaj/stream/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/event-stream")


class CollaboratorCreationTests(TestCase):
    def setUp(self):
        self.auth = {"HTTP_AUTHORIZATION": f"Bearer {make_admin_token()}"}

    def test_collaborator_can_be_created_with_only_company_responsible_and_contact(self):
        response = self.client.post(
            "/api/user/",
            data=json.dumps({
                "person_type": Users.PersonType.COLLABORATOR,
                "Company": "Partener Test SRL",
                "UserName": "Responsabil Test",
                "phone_number": "0712 345 678",
            }),
            content_type="application/json",
            **self.auth,
        )

        self.assertEqual(response.status_code, 201)
        collaborator = Users.objects.get(pk=response.json()["UserId"])
        self.assertEqual(collaborator.Company, "Partener Test SRL")
        self.assertEqual(collaborator.UserName, "Responsabil Test")
        self.assertEqual(collaborator.phone_number, "0712 345 678")
        self.assertTrue(collaborator.UserSerie.startswith("COL-"))
        self.assertEqual(collaborator.person_type, Users.PersonType.COLLABORATOR)

    def test_collaborator_contact_is_required(self):
        response = self.client.post(
            "/api/user/",
            data=json.dumps({
                "person_type": Users.PersonType.COLLABORATOR,
                "Company": "Partener Test SRL",
                "UserName": "Responsabil Test",
            }),
            content_type="application/json",
            **self.auth,
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("phone_number", response.json()["details"])


class AttendanceExemptionApiTests(TestCase):
    def setUp(self):
        self.client.cookies["ptj"] = make_admin_token()
        self.user = Users.objects.create(UserName="Fără pontaj obligatoriu", UserSerie="EXEMPT-1")

    def test_toggle_excludes_employee_from_daily_attendance_payload(self):
        AttendanceSession.objects.create(
            user_fk=self.user,
            work_date=localdate(),
            in_time=timezone.now() - timedelta(hours=1),
        )
        response = self.client.post(
            f"/api/user/{self.user.pk}/attendance-exempt/",
            data=json.dumps({"attendance_exempt": True}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200, response.content)
        self.assertTrue(response.json()["attendance_exempt"])
        self.assertEqual(self.client.get(f"/api/pontaj/day/?date={localdate()}").json()["rows"], [])


class ManualAttendanceSecurityTests(TestCase):
    chef_center = {
        "lat": 45.79680855369633,
        "lng": 24.14230494031001,
        "accuracy": 8,
    }

    def create_chef_user(self):
        user = Users(UserName="Chef autorizat", UserSerie="CHEF-1165")
        user.set_pin("1165")
        user.save()
        return user

    def chef_payload(self, **overrides):
        payload = {
            "pin": "1165",
            "mode": "chef",
            "device_key": "chef-browser",
            "timestamp": timezone.now().isoformat(),
            "gps": {
                **self.chef_center,
                "captured_at": timezone.now().isoformat(),
            },
            "data_processing_consent": True,
            "attendance_photo": "data:image/webp;base64,MTIz",
        }
        payload.update(overrides)
        return payload

    def post_clock(self, payload):
        return self.client.post(
            "/api/pontaj/clock/",
            data=json.dumps(payload),
            content_type="application/json",
        )

    def worker_location(self):
        return {
            "worksite": "The Lake Home Bloc B2",
            "gps": {
                "lat": 45.81027575048179,
                "lng": 24.130539205078342,
                "accuracy": 8,
                "captured_at": timezone.now().isoformat(),
            },
        }

    def test_chef_mode_rejects_every_other_pin(self):
        other = Users(UserName="Alt angajat", UserSerie="CHEF-OTHER")
        other.set_pin("2211")
        other.save()

        response = self.post_clock(self.chef_payload(pin="2211"))

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error_code"], "CHEF_PIN_ONLY")
        self.assertFalse(AttendanceSession.objects.exists())

    def test_chef_pin_cannot_bypass_location_using_manual_mode(self):
        self.create_chef_user()

        response = self.post_clock(self.chef_payload(mode="manual", gps=None))

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error_code"], "CHEF_MODE_REQUIRED")
        self.assertFalse(AttendanceSession.objects.exists())

    def test_chef_pin_cannot_bypass_location_through_nfc_endpoint(self):
        self.create_chef_user()

        response = self.client.post(
            "/api/nfc/scan/",
            data=json.dumps({
                "uid": "356337EF",
                "tag_type": "nfc",
                "content": "",
                "timestamp": timezone.now().isoformat(),
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error_code"], "CHEF_MODE_REQUIRED")
        self.assertFalse(AttendanceSession.objects.exists())

    def test_chef_mode_rejects_missing_or_outside_gps(self):
        self.create_chef_user()

        missing_response = self.post_clock(self.chef_payload(gps=None))
        outside_response = self.post_clock(self.chef_payload(gps={
            "lat": 45.79880855369633,
            "lng": 24.14230494031001,
            "accuracy": 8,
            "captured_at": timezone.now().isoformat(),
        }))

        self.assertEqual(missing_response.status_code, 400)
        self.assertEqual(missing_response.json()["error_code"], "CHEF_GPS_REQUIRED")
        self.assertEqual(outside_response.status_code, 403)
        self.assertEqual(outside_response.json()["error_code"], "CHEF_OUTSIDE_ALLOWED_AREA")
        self.assertGreater(outside_response.json()["distance_meters"], 100)
        self.assertFalse(AttendanceSession.objects.exists())

    def test_chef_checkin_and_checkout_succeed_inside_100_meters(self):
        user = self.create_chef_user()

        checkin_response = self.post_clock(self.chef_payload())
        self.assertEqual(checkin_response.status_code, 200)
        self.assertEqual(checkin_response.json()["state"], "ENTER")

        session = AttendanceSession.objects.get(user_fk=user)
        self.assertEqual(session.source, "manual-chef")
        self.assertEqual(session.worksite, "Birou ingineri")
        self.assertAlmostEqual(session.in_gps_latitude, self.chef_center["lat"])

        tool_views._last_seen.clear()
        checkout_response = self.post_clock(self.chef_payload())
        self.assertEqual(checkout_response.status_code, 200)
        self.assertEqual(checkout_response.json()["state"], "EXIT")

        session.refresh_from_db()
        self.assertIsNotNone(session.out_time)
        self.assertAlmostEqual(session.out_gps_longitude, self.chef_center["lng"])

    def test_regular_employee_can_clock_in_at_engineering_office(self):
        user = Users(UserName="Inginer cu pontaj normal", UserSerie="ING-001")
        user.set_pin("1177")
        user.save()

        response = self.post_clock({
            "pin": "1177",
            "mode": "manual",
            "device_key": "telefon-inginer",
            "worksite": "Birou ingineri",
            "timestamp": timezone.now().isoformat(),
            "gps": {
                **self.chef_center,
                "captured_at": timezone.now().isoformat(),
            },
            "data_processing_consent": True,
            "attendance_photo": "data:image/webp;base64,MTIz",
        })

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["state"], "ENTER")
        session = AttendanceSession.objects.get(user_fk=user)
        self.assertEqual(session.worksite, "Birou ingineri")
        self.assertAlmostEqual(session.in_gps_latitude, self.chef_center["lat"])

    def test_legacy_android_engineering_office_center_is_accepted(self):
        """APK-urile vechi valideaza local alt centru pentru «Birou ingineri»."""
        user = Users(UserName="Inginer APK vechi", UserSerie="ING-002")
        user.set_pin("1178")
        user.save()

        response = self.post_clock({
            "pin": "1178",
            "mode": "manual",
            "device_key": "telefon-vechi",
            "worksite": "Birou ingineri",
            "timestamp": timezone.now().isoformat(),
            "gps": {
                "lat": 45.810126261224724,
                "lng": 24.13046096426116,
                "accuracy": 12,
                "captured_at": timezone.now().isoformat(),
            },
            "data_processing_consent": True,
            "attendance_photo": "data:image/webp;base64,MTIz",
        })

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["state"], "ENTER")

    def test_regular_employee_can_clock_in_at_warehouse(self):
        user = Users(UserName="Magazioner cu pontaj", UserSerie="MAG-001")
        user.set_pin("1179")
        user.save()

        response = self.post_clock({
            "pin": "1179",
            "mode": "manual",
            "device_key": "telefon-magazie",
            "worksite": "magazie/depozit",
            "timestamp": timezone.now().isoformat(),
            "gps": {
                "lat": 45.81011221451825,
                "lng": 24.13080757832596,
                "accuracy": 10,
                "captured_at": timezone.now().isoformat(),
            },
            "data_processing_consent": True,
            "attendance_photo": "data:image/webp;base64,MTIz",
        })

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["state"], "ENTER")
        self.assertEqual(
            AttendanceSession.objects.get(user_fk=user).worksite, "magazie/depozit"
        )

    def test_every_accepted_worksite_has_gps_perimeter(self):
        """Regresie: nici un santier acceptat nu poate ramane fara perimetru."""
        for name in ACCEPTED_WORKSITES:
            self.assertTrue(worksite_perimeters(name), f"{name} nu are perimetru GPS")

    def test_collaborator_cannot_log_in_or_clock(self):
        collaborator = Users(
            UserName="Colaborator fără pontaj",
            UserSerie="COL-PONTAJ",
            person_type=Users.PersonType.COLLABORATOR,
        )
        collaborator.set_pin("9988")
        collaborator.save()

        login_response = self.client.post(
            "/api/pontaj/login/",
            data=json.dumps({"pin": "9988", "device_key": "collaborator-device"}),
            content_type="application/json",
        )
        self.assertEqual(login_response.status_code, 404)
        self.assertEqual(login_response.json()["error_code"], "INVALID_PIN")

        clock_response = self.client.post(
            "/api/pontaj/clock/",
            data=json.dumps({
                "pin": "9988",
                "device_key": "collaborator-device",
                "data_processing_consent": True,
                "attendance_photo": "data:image/webp;base64,MTIz",
            }),
            content_type="application/json",
        )
        self.assertEqual(clock_response.status_code, 200)
        self.assertIsNone(clock_response.json()["match"])
        self.assertFalse(AttendanceSession.objects.filter(user_fk=collaborator).exists())

    def test_collaborator_is_excluded_from_attendance_day_even_for_legacy_session(self):
        collaborator = Users.objects.create(
            UserName="Colaborator vechi",
            UserSerie="COL-LEGACY",
            person_type=Users.PersonType.COLLABORATOR,
        )
        AttendanceSession.objects.create(
            user_fk=collaborator,
            work_date=localdate(),
            in_time=timezone.now(),
            source="legacy",
        )

        response = self.client.get(
            f"/api/pontaj/day/?date={localdate().isoformat()}",
            HTTP_AUTHORIZATION=f"Bearer {make_admin_token()}",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["rows"], [])

    def test_checkout_allows_a_different_browser_for_manual_and_driver(self):
        now = timezone.now()

        for index, mode in enumerate(("manual", "driver"), start=1):
            with self.subTest(mode=mode):
                pin = f"81{index}0"
                user = Users(UserName=f"Muncitor checkout {mode}", UserSerie=f"SER-21{index}")
                user.set_pin(pin)
                user.save()
                session = AttendanceSession.objects.create(
                    user_fk=user,
                    work_date=localdate(now),
                    in_time=now - timedelta(hours=8),
                    source="manual-driver" if mode == "driver" else "manual-web",
                    worksite="Tractorului Bloc B2",
                    manual_device_key="browser-normal-dimineata",
                )

                payload = {
                    "pin": pin,
                    "device_key": "browser-privat-seara",
                    "timestamp": now.isoformat(),
                    "worksite": "Tractorului Bloc B2",
                    "mode": mode,
                    "data_processing_consent": True,
                    "attendance_photo": "data:image/webp;base64,MTIz",
                    **self.worker_location(),
                }

                response = self.client.post(
                    "/api/pontaj/clock/",
                    data=json.dumps(payload),
                    content_type="application/json",
                    REMOTE_ADDR="1.2.3.4",
                )

                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()["state"], "EXIT")
                session.refresh_from_db()
                self.assertIsNotNone(session.out_time)

    def test_checkout_is_allowed_even_if_current_browser_has_another_open_session(self):
        now = timezone.now()
        target = Users(UserName="Muncitor de depontat", UserSerie="SER-213")
        target.set_pin("8130")
        target.save()
        other = Users(UserName="Alt muncitor", UserSerie="SER-214")
        other.set_pin("8140")
        other.save()

        target_session = AttendanceSession.objects.create(
            user_fk=target,
            work_date=localdate(now),
            in_time=now - timedelta(hours=8),
            source="manual-web",
            manual_device_key="browser-dimineata",
        )
        other_session = AttendanceSession.objects.create(
            user_fk=other,
            work_date=localdate(now),
            in_time=now - timedelta(hours=1),
            source="manual-web",
            manual_device_key="browser-privat-seara",
        )

        response = self.client.post(
            "/api/pontaj/clock/",
            data=json.dumps({
                "pin": "8130",
                "device_key": "browser-privat-seara",
                "timestamp": now.isoformat(),
                "mode": "manual",
                "data_processing_consent": True,
                "attendance_photo": "data:image/webp;base64,MTIz",
                **self.worker_location(),
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["state"], "EXIT")
        target_session.refresh_from_db()
        other_session.refresh_from_db()
        self.assertIsNotNone(target_session.out_time)
        self.assertIsNone(other_session.out_time)

    def test_same_ip_different_devices_can_clock_in(self):
        first = Users(UserName="Muncitor 1", UserSerie="SER-201")
        first.set_pin("1201")
        first.save()

        second = Users(UserName="Muncitor 2", UserSerie="SER-202")
        second.set_pin("1202")
        second.save()

        base_payload = {
            "uid": "MANUAL",
            "tag_type": "manual",
            "timestamp": timezone.now().isoformat(),
            "worksite": "Tractorului Bloc B2",
            **self.worker_location(),
            "mode": "manual",
            "data_processing_consent": True,
            "attendance_photo": "data:image/webp;base64,MTIz",
            **self.worker_location(),
        }

        first_response = self.client.post(
            "/api/pontaj/clock/",
            data=json.dumps({**base_payload, "pin": "1201", "device_key": "device-a"}),
            content_type="application/json",
            REMOTE_ADDR="1.2.3.4",
        )
        second_response = self.client.post(
            "/api/pontaj/clock/",
            data=json.dumps({**base_payload, "pin": "1202", "device_key": "device-b"}),
            content_type="application/json",
            REMOTE_ADDR="1.2.3.4",
        )

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)
        self.assertEqual(first_response.json()["state"], "ENTER")
        self.assertEqual(second_response.json()["state"], "ENTER")

    def test_same_device_can_clock_in_multiple_employees_and_saves_checkin_photo(self):
        first = Users(UserName="Muncitor acelasi telefon 1", UserSerie="SER-205")
        first.set_pin("1205")
        first.save()
        second = Users(UserName="Muncitor acelasi telefon 2", UserSerie="SER-206")
        second.set_pin("1206")
        second.save()

        base_payload = {
            "uid": "MANUAL",
            "tag_type": "manual",
            "timestamp": timezone.now().isoformat(),
            "mode": "manual",
            "device_key": "telefon-comun",
            "data_processing_consent": True,
            **self.worker_location(),
            "attendance_photo": "data:image/webp;base64,MTIz",
        }
        for pin in ("1205", "1206"):
            response = self.client.post(
                "/api/pontaj/clock/",
                data=json.dumps({**base_payload, "pin": pin}),
                content_type="application/json",
            )
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["state"], "ENTER")

        first_session = AttendanceSession.objects.get(user_fk=first)
        self.assertTrue(first_session.data_processing_consent)
        self.assertEqual(first_session.checkin_photo, base_payload["attendance_photo"])

    def test_manual_checkin_and_checkout_save_their_own_selfies(self):
        user = Users(UserName="Muncitor cu doua selfie-uri", UserSerie="SER-209")
        user.set_pin("1209")
        user.save()
        base_payload = {
            "pin": "1209",
            "mode": "manual",
            "data_processing_consent": True,
            **self.worker_location(),
        }

        enter_photo = "data:image/webp;base64,SU4="
        exit_photo = "data:image/webp;base64,T1VU"
        enter_response = self.client.post(
            "/api/pontaj/clock/",
            data=json.dumps({**base_payload, "attendance_photo": enter_photo}),
            content_type="application/json",
        )
        self.assertEqual(enter_response.status_code, 200)
        self.assertEqual(enter_response.json()["state"], "ENTER")
        user.refresh_from_db()
        self.assertEqual(user.photo, enter_photo)

        tool_views._last_seen.clear()
        exit_response = self.client.post(
            "/api/pontaj/clock/",
            data=json.dumps({**base_payload, "attendance_photo": exit_photo}),
            content_type="application/json",
        )

        self.assertEqual(exit_response.status_code, 200)
        self.assertEqual(exit_response.json()["state"], "EXIT")
        session = AttendanceSession.objects.get(user_fk=user)
        self.assertEqual(session.checkin_photo, enter_photo)
        self.assertEqual(session.checkout_photo, exit_photo)
        user.refresh_from_db()
        self.assertEqual(user.photo, enter_photo)

    def test_manual_selfies_never_overwrite_an_existing_profile_photo(self):
        existing_photo = "data:image/webp;base64,UFJPRklMRQ=="
        user = Users(UserName="Profil existent", UserSerie="SER-PROFILE", photo=existing_photo)
        user.set_pin("1299")
        user.save()
        payload = {
            "pin": "1299",
            "mode": "manual",
            "data_processing_consent": True,
            "attendance_photo": "data:image/webp;base64,U0VMRklF",
            **self.worker_location(),
        }

        response = self.client.post(
            "/api/pontaj/clock/",
            data=json.dumps(payload),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        user.refresh_from_db()
        self.assertEqual(user.photo, existing_photo)
        self.assertEqual(AttendanceSession.objects.get(user_fk=user).checkin_photo, payload["attendance_photo"])

    def test_android_payload_requires_and_saves_consent_and_selfie(self):
        for index, mode in enumerate(("manual", "driver"), start=1):
            with self.subTest(mode=mode):
                user = Users(UserName=f"Android {mode}", UserSerie=f"ANDROID-{index}")
                user.set_pin(f"991{index}")
                user.save()
                payload = {
                    "pin": f"991{index}",
                    "device_key": f"android-device-{index}",
                    "mode": mode,
                    "worksite": "The Lake Home Bloc B2",
                    "timestamp": timezone.now().isoformat(),
                    "gps": {
                        "lat": 45.81027575048179,
                        "lng": 24.130539205078342,
                        "accuracy": 10,
                        "captured_at": timezone.now().isoformat(),
                    },
                    "data_processing_consent": True,
                    "attendance_photo": "data:image/webp;base64,MTIz",
                }

                checkin_response = self.client.post(
                    "/api/pontaj/clock/",
                    data=json.dumps(payload),
                    content_type="application/json",
                )
                self.assertEqual(checkin_response.status_code, 200)
                self.assertEqual(checkin_response.json()["state"], "ENTER")

                tool_views._last_seen.clear()
                checkout_response = self.client.post(
                    "/api/pontaj/clock/",
                    data=json.dumps(payload),
                    content_type="application/json",
                )
                self.assertEqual(checkout_response.status_code, 200)
                self.assertEqual(checkout_response.json()["state"], "EXIT")

                session = AttendanceSession.objects.get(user_fk=user)
                self.assertTrue(session.data_processing_consent)
                self.assertEqual(session.checkin_photo, payload["attendance_photo"])
                self.assertEqual(session.checkout_photo, payload["attendance_photo"])

    def test_android_v1_direct_nfc_payload_without_proof_can_check_in_and_out(self):
        user = Users(UserName="Android v1 NFC", UserSerie="ANDROID-V1-NFC")
        user.set_pin("9901")
        user.save()
        payload = {
            "uid": "MANUAL",
            "tag_type": "manual",
            "content": "9901",
            "timestamp": timezone.now().isoformat(),
            "device_key": "android-v1-direct",
            "mode": "manual",
            "worksite": "The Lake Home Blocurile E si F",
            "gps": {
                "lat": 45.81027575048179,
                "lng": 24.130539205078342,
                "accuracy": 10,
                "captured_at": timezone.now().isoformat(),
            },
        }

        checkin = self.client.post(
            "/api/nfc/scan/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(checkin.status_code, 200, checkin.content)
        self.assertEqual(checkin.json()["state"], "ENTER")

        tool_views._last_seen.clear()
        checkout = self.client.post(
            "/api/nfc/scan/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(checkout.status_code, 200, checkout.content)
        self.assertEqual(checkout.json()["state"], "EXIT")

        session = AttendanceSession.objects.get(user_fk=user)
        self.assertFalse(session.data_processing_consent)
        self.assertEqual(session.checkin_photo, "")
        self.assertEqual(session.checkout_photo, "")
        self.assertEqual(session.worksite, "The Lake Home Bloc E & F")

    def test_android_v1_to_v4_clock_payload_without_proof_remains_compatible(self):
        historical_payloads = (
            (
                "9902",
                "Android v1-v4 raza publicata",
                "The Lake Home Bloc B2",
                45.81087575048179,  # ~67 m: acceptat de raza de 100 m publicata in v4.
                24.130539205078342,
            ),
            (
                "9903",
                "Android v4 santier istoric",
                "Cisnadie",
                45.7164550916678,
                24.16268772028023,
            ),
        )

        for pin, name, worksite, lat, lng in historical_payloads:
            with self.subTest(worksite=worksite):
                user = Users(UserName=name, UserSerie=f"ANDROID-LEGACY-{pin}")
                user.set_pin(pin)
                user.save()
                response = self.post_clock({
                    "pin": pin,
                    "timestamp": timezone.now().isoformat(),
                    "device_key": f"android-v1-v4-{pin}",
                    "mode": "manual",
                    "worksite": worksite,
                    "gps": {
                        "lat": lat,
                        "lng": lng,
                        "accuracy": 10,
                        "captured_at": timezone.now().isoformat(),
                    },
                })

                self.assertEqual(response.status_code, 200, response.content)
                self.assertEqual(response.json()["state"], "ENTER")
                session = AttendanceSession.objects.get(user_fk=user)
                self.assertFalse(session.data_processing_consent)
                self.assertEqual(session.checkin_photo, "")

    def test_android_v1_driver_payload_without_worksite_or_proof_remains_compatible(self):
        user = Users(UserName="Android v1 driver", UserSerie="ANDROID-V1-DRIVER")
        user.set_pin("9904")
        user.save()
        response = self.client.post(
            "/api/nfc/scan/",
            data=json.dumps({
                "uid": "MANUAL",
                "tag_type": "manual",
                "content": "9904",
                "timestamp": timezone.now().isoformat(),
                "device_key": "android-v1-driver",
                "mode": "driver",
                "gps": {
                    "lat": 46.0,
                    "lng": 25.0,
                    "accuracy": 10,
                    "captured_at": timezone.now().isoformat(),
                },
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["state"], "ENTER")
        session = AttendanceSession.objects.get(user_fk=user)
        self.assertFalse(session.data_processing_consent)
        self.assertEqual(session.checkin_photo, "")

    def test_chef_never_uses_legacy_android_proof_exception(self):
        self.create_chef_user()

        response = self.post_clock({
            "pin": "1165",
            "mode": "chef",
            "device_key": "chef-without-proof",
            "timestamp": timezone.now().isoformat(),
            "gps": {
                **self.chef_center,
                "captured_at": timezone.now().isoformat(),
            },
        })

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error_code"], "DATA_PROCESSING_CONSENT_REQUIRED")

    def test_manual_attendance_rejects_missing_consent_expired_and_outside_location(self):
        user = Users(UserName="Validare mobilă", UserSerie="ANDROID-VALIDATION")
        user.set_pin("9920")
        user.save()
        base = {
            "pin": "9920",
            "device_key": "android-validation",
            "mode": "manual",
            "data_processing_consent": True,
            "attendance_photo": "data:image/webp;base64,MTIz",
            **self.worker_location(),
        }

        no_consent = self.post_clock({**base, "data_processing_consent": False})
        self.assertEqual(no_consent.status_code, 400)
        self.assertEqual(no_consent.json()["error_code"], "DATA_PROCESSING_CONSENT_REQUIRED")

        expired = self.post_clock({
            **base,
            "gps": {
                **base["gps"],
                "captured_at": (timezone.now() - timedelta(minutes=11)).isoformat(),
            },
        })
        self.assertEqual(expired.status_code, 409)
        self.assertEqual(expired.json()["error_code"], "GPS_LOCATION_EXPIRED")

        outside = self.post_clock({
            **base,
            "gps": {**base["gps"], "lat": 45.0, "lng": 24.0},
        })
        self.assertEqual(outside.status_code, 403)
        self.assertEqual(outside.json()["error_code"], "OUTSIDE_WORKSITE_AREA")
        self.assertFalse(AttendanceSession.objects.filter(user_fk=user).exists())

    def test_successful_pin_lookup_uses_plain_userpin(self):
        user = Users(UserName="Muncitor 3", UserSerie="SER-203")
        user.set_pin("5555")
        user.save()

        response = self.client.post(
            "/api/pontaj/login/",
            data=json.dumps({"pin": "5555", "device_key": "device-c", "uid": "MANUAL"}),
            content_type="application/json",
            REMOTE_ADDR="5.6.7.8",
        )

        user.refresh_from_db()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(user.UserPin, "5555")
        self.assertEqual(user.pin_hash, "")
        self.assertEqual(user.pin_lookup, "")


class AttendanceReportsTests(TestCase):
    def setUp(self):
        super().setUp()
        self.auth_header = {"HTTP_AUTHORIZATION": f"Bearer {make_admin_token()}"}

    def test_worksite_report_groups_known_aliases(self):
        user_one = Users.objects.create(UserName="Ion Pop", UserSerie="SER-301", Company="DMX")
        user_two = Users.objects.create(UserName="Vasile Ionescu", UserSerie="SER-302", Company="DMX")
        today = localdate()
        now = timezone.now()

        AttendanceSession.objects.create(
            user_fk=user_one,
            work_date=today,
            in_time=now - timedelta(hours=5),
            out_time=now - timedelta(hours=1),
            duration_seconds=4 * 3600,
            source="manual",
            worksite="Tractorului Bloc A",
        )
        AttendanceSession.objects.create(
            user_fk=user_two,
            work_date=today,
            in_time=now - timedelta(hours=4),
            out_time=now - timedelta(hours=2),
            duration_seconds=2 * 3600,
            source="manual",
            worksite="The Lake Home Bloc A",
        )

        response = self.client.get(
            f"/api/pontaj/reports/worksites/?start={today.isoformat()}&end={today.isoformat()}",
            **self.auth_header,
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["summary"]["worksites_count"], 1)
        self.assertEqual(payload["rows"][0]["worksite"], "The Lake Home Bloc A")
        self.assertEqual(payload["rows"][0]["people_count"], 2)
        self.assertEqual(payload["rows"][0]["total_seconds"], 6 * 3600)

    def test_day_cost_report_uses_hourly_rate_times_worked_hours(self):
        user = Users.objects.create(
            UserName="Mihai Popescu",
            UserSerie="SER-401",
            Company="DMX",
            hourly_rate=Decimal("25.50"),
        )
        today = localdate()
        now = timezone.now()

        AttendanceSession.objects.create(
            user_fk=user,
            work_date=today,
            in_time=now - timedelta(hours=3, minutes=30),
            out_time=now,
            duration_seconds=(3 * 3600) + (30 * 60),
            source="manual",
            worksite="Tractorului Bloc B2",
        )

        response = self.client.get(
            f"/api/pontaj/reports/day-cost/?date={today.isoformat()}",
            **self.auth_header,
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["summary"]["people_count"], 1)
        self.assertEqual(payload["summary"]["total_hms"], "03:30:00")
        self.assertEqual(payload["summary"]["total_cost"], "89.25")
        self.assertEqual(payload["people"][0]["display_name"], "Mihai Popescu (SER-401)")
        self.assertEqual(len(payload["worksites"]), 1)
        worksite = payload["worksites"][0]
        self.assertEqual(worksite["worksite"], "The Lake Home Bloc B2")
        self.assertEqual(worksite["people_count"], 1)
        self.assertEqual(worksite["average_start_time"], localtime(now - timedelta(hours=3, minutes=30)).strftime("%H:%M"))
        self.assertEqual(worksite["total_seconds"], (3 * 3600) + (30 * 60))
        self.assertEqual(worksite["total_hms"], "03:30:00")
        self.assertEqual(worksite["total_cost"], "89.25")

    def test_day_cost_worksite_counts_unique_people_and_averages_their_first_check_in(self):
        first = Users.objects.create(UserName="Primul", UserSerie="AVG-1", hourly_rate=Decimal("20.00"))
        second = Users.objects.create(UserName="Al doilea", UserSerie="AVG-2", hourly_rate=Decimal("20.00"))
        day = localdate()
        local_now = localtime(timezone.now())

        def at(hour):
            return local_now.replace(hour=hour, minute=0, second=0, microsecond=0)

        for user, start_hour, end_hour in (
            (first, 8, 9),
            (first, 14, 15),
            (second, 10, 11),
        ):
            AttendanceSession.objects.create(
                user_fk=user,
                work_date=day,
                in_time=at(start_hour),
                out_time=at(end_hour),
                duration_seconds=3600,
                worksite="The Lake Home Bloc A",
            )

        response = self.client.get(
            f"/api/pontaj/reports/day-cost/?date={day.isoformat()}",
            **self.auth_header,
        )

        self.assertEqual(response.status_code, 200, response.content)
        worksite = response.json()["worksites"][0]
        self.assertEqual(worksite["worksite"], "The Lake Home Bloc A")
        self.assertEqual(worksite["people_count"], 2)
        self.assertEqual(worksite["average_start_time"], "09:00")
