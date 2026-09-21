import json
from django.contrib.auth.models import User
from django.test import Client, TestCase
from .models import Residential, Unit, ResidentCredential

class ApiSmokeTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.admin = User.objects.create_user(username="admin", password="senha-forte", is_staff=True)

    def test_health(self):
        response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["ok"])

    def test_admin_login_requires_staff(self):
        response = self.client.post(
            "/api/auth/admin/login/",
            data=json.dumps({"username": "admin", "password": "senha-forte"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("token", response.json())

    def test_resident_login_rejects_without_activation(self):
        residential = Residential.objects.create(external_id="demo", name="Demo")
        unit = Unit.objects.create(residential=residential, external_id="101", label="AP 101")
        ResidentCredential.objects.create(unit=unit, phone_digits="83999999999")
        response = self.client.post(
            "/api/auth/resident/login/",
            data=json.dumps({"phone": "83999999999", "pin": "1234"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 401)

    def test_admin_sync_pull_requires_auth(self):
        response = self.client.get("/api/admin/sync/pull/")
        self.assertEqual(response.status_code, 401)
