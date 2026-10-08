import copy
import json
from django.test import TestCase
from django.contrib.auth.models import User
from .models import Residential, Payment, Obligation
from .sync import apply_admin_snapshot, SyncConflict
from .validation import STORES


def snapshot():
    stores = {name: [] for name in STORES}
    def add(store, item):
        stores[store].append({'key': item['id'], 'value': item})
    add('residential', {'id': 'demo', 'name': 'Condomínio de teste'})
    add('units', {'id': '101', 'label': '101', 'contacts': []})
    add('obligations', {'id': 'o1', 'unitId': '101', 'kind': 'monthly_contribution',
        'status': 'partial', 'amountCents': 10000, 'paidCents': 5000, 'dueDate': '2026-10-10'})
    add('payments', {'id': 'p1', 'obligationId': 'o1', 'unitId': '101',
        'amountCents': 5000, 'paidAt': '2026-10-08T12:00:00-03:00'})
    return {'format': 'conta-certa-snapshot', 'schemaVersion': 1, 'stores': stores}


class FinancialIntegrityTests(TestCase):
    def setUp(self):
        self.snapshot = snapshot()
        self.residential = apply_admin_snapshot(self.snapshot, base_version=0)

    def test_conflict_does_not_change_server_records(self):
        with self.assertRaises(SyncConflict):
            apply_admin_snapshot(self.snapshot, base_version=0)
        self.residential.refresh_from_db()
        self.assertEqual(self.residential.sync_version, 1)
        self.assertEqual(Payment.objects.count(), 1)

    def test_second_writer_is_checked_under_transaction(self):
        apply_admin_snapshot(self.snapshot, base_version=1)
        with self.assertRaises(SyncConflict):
            apply_admin_snapshot(self.snapshot, base_version=1)
        self.residential.refresh_from_db()
        self.assertEqual(self.residential.sync_version, 2)

    def test_partial_snapshot_cannot_delete_payments(self):
        del self.snapshot['stores']['payments']
        with self.assertRaisesRegex(ValueError, 'INCOMPLETOS'):
            apply_admin_snapshot(self.snapshot, base_version=1)
        self.assertEqual(Payment.objects.count(), 1)

    def test_complete_but_older_snapshot_cannot_delete_ledger(self):
        self.snapshot['stores']['payments'] = []
        self.snapshot['stores']['obligations'] = []
        with self.assertRaisesRegex(ValueError, 'REMOVERIA'):
            apply_admin_snapshot(self.snapshot, base_version=1)
        self.assertEqual(Payment.objects.count(), 1)
        self.assertEqual(Obligation.objects.count(), 1)

    def test_invalid_amounts_never_become_zero(self):
        for value in (True, '5000', 50.5, -1, None, 9007199254740992):
            with self.subTest(value=value):
                invalid = copy.deepcopy(self.snapshot)
                invalid['stores']['payments'][0]['value']['amountCents'] = value
                with self.assertRaises(ValueError):
                    apply_admin_snapshot(invalid, base_version=1)
        self.assertEqual(Payment.objects.get().amount_cents, 5000)

    def test_duplicate_ids_and_inconsistent_paid_total_rejected(self):
        invalid = copy.deepcopy(self.snapshot)
        invalid['stores']['payments'].append(invalid['stores']['payments'][0])
        with self.assertRaisesRegex(ValueError, 'DUPLICADA'):
            apply_admin_snapshot(invalid, base_version=1)
        invalid = copy.deepcopy(self.snapshot)
        invalid['stores']['payments'][0]['value']['amountCents'] = 6000
        with self.assertRaisesRegex(ValueError, 'TOTAL_PAGAMENTOS'):
            apply_admin_snapshot(invalid, base_version=1)

    def test_existing_payment_cannot_be_rewritten(self):
        self.snapshot['stores']['payments'][0]['value']['paidAt'] = '2026-10-09T12:00:00-03:00'
        with self.assertRaisesRegex(ValueError, 'NAO_PODE_SER_ALTERADO'):
            apply_admin_snapshot(self.snapshot, base_version=1)

    def test_bad_closing_is_rejected(self):
        self.snapshot['stores']['monthClosings'] = [{'key': '2026-10', 'value': {
            'id': '2026-10', 'competence': '2026-10', 'status': 'closed', 'revision': 1,
            'openingBalanceCents': 0, 'revenueCents': 10000, 'expenseCents': 0,
            'resultCents': 10000, 'closingBalanceCents': 10000,
        }}]
        with self.assertRaisesRegex(ValueError, 'LANCAMENTOS_DIVERGENTES'):
            apply_admin_snapshot(self.snapshot, base_version=1)

    def test_api_returns_400_for_malformed_payload_and_409_for_stale_version(self):
        User.objects.create_user(username='admin', password='test-password', is_staff=True)
        login = self.client.post('/api/auth/admin/login/', data=json.dumps({'username': 'admin', 'password': 'test-password'}), content_type='application/json')
        headers = {'HTTP_AUTHORIZATION': 'Bearer ' + login.json()['token']}
        for bad in ({'stores': []}, {'stores': {'residential': [False]}}, self.snapshot):
            response = self.client.post('/api/admin/sync/push/', data=json.dumps({'baseVersion': 0, 'snapshot': bad}), content_type='application/json', **headers)
            self.assertEqual(response.status_code, 409 if bad == self.snapshot else 400)
