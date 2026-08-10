import json

from django.test import Client, TestCase

from ToolApp.models import AppModuleAccess, AppPagePermission, AppUser, Users
from ToolApp.module_access import default_module_route, effective_module_codes
from ToolApp.security import app_user_can_access_api_path, make_admin_token, make_app_user_token
from ToolApp.views import _make_admin_app_token


class ModuleAccessApiTests(TestCase):
    def setUp(self):
        self.employee = Users.objects.create(
            UserName="Utilizator Module",
            UserSerie="MOD-001",
            photo="https://example.test/photo.jpg",
        )
        self.app_user = AppUser.objects.create(
            employee=self.employee,
            username="module.user",
            pin_hash="unused",
        )
        self.app_client = Client()
        self.app_client.cookies["appj"] = make_app_user_token(self.app_user)
        self.admin_client = Client()
        self.admin_client.cookies["ptj"] = make_admin_token()

    def grant_page(self, route):
        AppPagePermission.objects.update_or_create(
            app_user=self.app_user,
            route=route,
            defaults={"can_access": True},
        )

    def test_current_modules_are_ordered_and_have_default_route(self):
        AppModuleAccess.objects.create(app_user=self.app_user, module_code="tools")
        AppModuleAccess.objects.create(app_user=self.app_user, module_code="teams_schedule")

        response = self.app_client.get("/api/app-auth/modules/")

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["granted_modules"], ["teams_schedule", "tools"])
        self.assertEqual(response.json()["default_module_route"], "/pontaj/echipe")
        self.assertEqual(default_module_route(self.app_user), "/pontaj/echipe")

    def test_account_without_modules_has_explicit_empty_state(self):
        response = self.app_client.get("/api/app-auth/modules/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["granted_modules"], [])
        self.assertIsNone(response.json()["default_module_route"])

    def test_admin_can_grant_multiple_users_and_revoke_access(self):
        second_employee = Users.objects.create(UserName="Al Doilea", UserSerie="MOD-002")
        second_user = AppUser.objects.create(employee=second_employee, username="second.user", pin_hash="unused")

        granted = self.admin_client.post(
            "/api/app-admin/modules/warehouse/access/",
            data=json.dumps({"app_user_ids": [self.app_user.pk, second_user.pk]}),
            content_type="application/json",
        )
        self.assertEqual(granted.status_code, 200, granted.content)
        self.assertEqual(
            AppModuleAccess.objects.filter(module_code="warehouse", can_access=True).count(),
            2,
        )
        self.assertTrue(AppPagePermission.objects.filter(
            app_user=self.app_user, route="/magazie", can_access=True
        ).exists())

        revoked = self.admin_client.post(
            "/api/app-admin/modules/warehouse/access/",
            data=json.dumps({"app_user_ids": [second_user.pk]}),
            content_type="application/json",
        )
        self.assertEqual(revoked.status_code, 200, revoked.content)
        self.app_user.refresh_from_db()
        self.assertNotIn("warehouse", effective_module_codes(self.app_user))
        self.assertTrue(AppModuleAccess.objects.get(
            app_user=self.app_user, module_code="warehouse"
        ).can_access is False)

    def test_ordinary_app_user_cannot_mutate_module_access(self):
        response = self.app_client.post(
            "/api/app-admin/modules/tools/access/",
            data=json.dumps({"app_user_ids": [self.app_user.pk]}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 401)
        self.assertFalse(AppModuleAccess.objects.exists())

    def test_module_gate_and_page_permission_are_both_required_for_api(self):
        self.grant_page("/pontaj")
        self.assertFalse(app_user_can_access_api_path(self.app_user, "/api/pontaj/today/"))

        AppModuleAccess.objects.create(app_user=self.app_user, module_code="attendance")
        self.assertTrue(app_user_can_access_api_path(self.app_user, "/api/pontaj/today/"))

        AppPagePermission.objects.filter(app_user=self.app_user, route="/pontaj").update(can_access=False)
        self.assertFalse(app_user_can_access_api_path(self.app_user, "/api/pontaj/today/"))

    def test_tools_only_account_can_use_tool_employee_api_but_not_attendance(self):
        AppModuleAccess.objects.create(app_user=self.app_user, module_code="tools")
        self.grant_page("/unelte")
        self.grant_page("/unelte/adauga-unealta")
        self.grant_page("/predare-unealta")

        self.assertTrue(app_user_can_access_api_path(self.app_user, "/api/tool/"))
        self.assertTrue(app_user_can_access_api_path(self.app_user, "/api/tool/", "POST"))
        self.assertTrue(app_user_can_access_api_path(self.app_user, "/api/tools/assign-quantity/", "POST"))
        self.assertTrue(app_user_can_access_api_path(self.app_user, "/api/tools/return-quantity/", "POST"))
        self.assertTrue(app_user_can_access_api_path(self.app_user, "/api/user/"))
        self.assertFalse(app_user_can_access_api_path(self.app_user, "/api/pontaj/today/"))

        AppPagePermission.objects.filter(app_user=self.app_user, route="/predare-unealta").update(can_access=False)
        self.assertFalse(app_user_can_access_api_path(self.app_user, "/api/tools/assign-quantity/", "POST"))
        self.assertEqual(self.app_client.get("/tools/issue/").status_code, 403)

        AppPagePermission.objects.filter(app_user=self.app_user, route="/predare-unealta").update(can_access=True)
        self.assertEqual(self.app_client.get("/tools/issue/").status_code, 405)

    def test_module_landing_permission_cannot_be_disabled_while_module_is_active(self):
        AppModuleAccess.objects.create(app_user=self.app_user, module_code="warehouse")
        self.grant_page("/magazie")
        client = Client()
        client.cookies["app_admin"] = _make_admin_app_token()

        response = client.post(
            "/api/app-admin/users/",
            data=json.dumps({
                "app_user_id": self.app_user.pk,
                "route": "/magazie",
                "can_access": False,
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertTrue(AppPagePermission.objects.get(app_user=self.app_user, route="/magazie").can_access)

    def test_admin_has_full_module_listing(self):
        response = self.admin_client.get("/api/app-admin/modules/")

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(
            [module["code"] for module in response.json()["modules"]],
            ["attendance", "teams_schedule", "warehouse", "human_resources", "tools"],
        )
        current = self.admin_client.get("/api/app-auth/modules/")
        self.assertEqual(current.status_code, 200)
        self.assertEqual(
            current.json()["granted_modules"],
            ["attendance", "teams_schedule", "warehouse", "human_resources", "tools"],
        )
