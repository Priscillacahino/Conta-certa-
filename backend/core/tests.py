import json
from datetime import timedelta
from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import User
from django.test import Client, TestCase
from django.utils import timezone
from .models import ApiSession, Residential, Unit, ResidentCredential

class ApiSmokeTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.admin = User.objects.create_user(username="admin", password="senha-forte", is_staff=True)

    def admin_login(self, password="senha-forte"):
        return self.client.post(
            "/api/auth/admin/login/",
            data=json.dumps({"username": "admin", "password": password}),
            content_type="application/json",
        )

    def test_health(self):
        response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["ok"])
        self.assertEqual(response.json()["version"], "0.12.0")

    def test_admin_login_requires_staff(self):
        response = self.admin_login()
        self.assertEqual(response.status_code, 200)
        self.assertIn("token", response.json())

    def test_admin_login_is_rate_limited(self):
        for _ in range(4):
            response = self.admin_login("errada")
            self.assertEqual(response.status_code, 401)
        response = self.admin_login("errada")
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.json()["error"], "MUITAS_TENTATIVAS")
        blocked = self.admin_login()
        self.assertEqual(blocked.status_code, 429)

    def test_resident_login_rejects_without_activation(self):
        residential = Residential.objects.create(external_id="demo", name="Demo")
        unit = Unit.objects.create(residential=residential, external_id="101", label="AP 101")
        ResidentCredential.objects.create(unit=unit, phone_digits="83999999999")
        response = self.client.post(
            "/api/auth/resident/login/",
            data=json.dumps({"phone": "83999999999", "pin": "123456"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 401)

    def test_admin_sync_pull_requires_auth(self):
        response = self.client.get("/api/admin/sync/pull/")
        self.assertEqual(response.status_code, 401)

    def test_deactivated_resident_invalidates_existing_session(self):
        residential = Residential.objects.create(external_id="demo", name="Demo")
        unit = Unit.objects.create(residential=residential, external_id="101", label="AP 101")
        credential = ResidentCredential.objects.create(
            unit=unit,
            phone_digits="83999999999",
            pin_hash=make_password("123456"),
        )
        token = ApiSession.issue(
            role=ApiSession.ROLE_RESIDENT,
            credential=credential,
            expires_at=timezone.now() + timedelta(days=1),
        )
        credential.active = False
        credential.save(update_fields=["active"])
        response = self.client.get(
            "/api/resident/snapshot/",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(response.status_code, 401)

    def test_new_activation_code_invalidates_previous_code(self):
        residential = Residential.objects.create(external_id="demo", name="Demo")
        unit = Unit.objects.create(residential=residential, external_id="101", label="AP 101")
        ResidentCredential.objects.create(unit=unit, phone_digits="83999999999")

        login = self.admin_login()
        token = login.json()["token"]
        headers = {"HTTP_AUTHORIZATION": f"Bearer {token}"}
        body = {"residentialId": "demo", "unitId": "101", "phone": "83999999999"}

        first = self.client.post(
            "/api/admin/residents/activation/",
            data=json.dumps(body),
            content_type="application/json",
            **headers,
        )
        second = self.client.post(
            "/api/admin/residents/activation/",
            data=json.dumps(body),
            content_type="application/json",
            **headers,
        )
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)

        rejected = self.client.post(
            "/api/auth/resident/activate/",
            data=json.dumps({
                "phone": "83999999999",
                "activationCode": first.json()["activationCode"],
                "pin": "123456",
            }),
            content_type="application/json",
        )
        self.assertEqual(rejected.status_code, 401)

        accepted = self.client.post(
            "/api/auth/resident/activate/",
            data=json.dumps({
                "phone": "83999999999",
                "activationCode": second.json()["activationCode"],
                "pin": "123456",
            }),
            content_type="application/json",
        )
        self.assertEqual(accepted.status_code, 200)

    def test_admin_can_list_and_revoke_session(self):
        login = self.admin_login()
        token = login.json()["token"]
        headers = {"HTTP_AUTHORIZATION": f"Bearer {token}"}

        listing = self.client.get("/api/admin/sessions/", **headers)
        self.assertEqual(listing.status_code, 200)
        current = next(item for item in listing.json()["sessions"] if item["current"])

        revoked = self.client.post(
            "/api/admin/sessions/revoke/",
            data=json.dumps({"sessionId": current["id"]}),
            content_type="application/json",
            **headers,
        )
        self.assertEqual(revoked.status_code, 200)

        denied = self.client.get("/api/admin/sessions/", **headers)
        self.assertEqual(denied.status_code, 401)
