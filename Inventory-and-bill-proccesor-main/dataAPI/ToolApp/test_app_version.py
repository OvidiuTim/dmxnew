from unittest.mock import patch

from django.test import TestCase

from ToolApp.security import make_admin_token
from ToolApp.views import ANDROID_PLAY_STORE_URL


class AppVersionApiTests(TestCase):
    def setUp(self):
        self.auth = {"HTTP_AUTHORIZATION": f"Bearer {make_admin_token()}"}

    @patch(
        "ToolApp.views.os.environ",
        {
            "DMX_ANDROID_UPDATE_AVAILABLE": "false",
            "DMX_ANDROID_UPDATE_URL": "https://example.com/old-app",
            "DMX_ANDROID_NEWVERSION_LINK": "https://example.com/old-app",
        },
    )
    def test_version_announces_android_update_with_play_store_link(self):
        response = self.client.get("/api/app/version/", **self.auth)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["is_update_available"])
        self.assertEqual(response.json()["update_url"], ANDROID_PLAY_STORE_URL)
        self.assertEqual(response.json()["link"], ANDROID_PLAY_STORE_URL)

    @patch(
        "ToolApp.views.os.environ",
        {
            "DMX_ANDROID_UPDATE_AVAILABLE": "true",
            "DMX_ANDROID_FORCE_UPDATE": "true",
        },
    )
    def test_version2_reports_no_update_even_when_main_version_is_enabled(self):
        response = self.client.get("/api/app/version2/", **self.auth)

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["is_update_available"])
        self.assertFalse(response.json()["is_force_update"])

    def test_version2_only_accepts_get(self):
        response = self.client.post("/api/app/version2/", **self.auth)

        self.assertEqual(response.status_code, 405)
