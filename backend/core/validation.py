"""Fail closed before replacing the authoritative financial snapshot."""
import re
from datetime import date
from django.utils.dateparse import parse_datetime

STORES = ('settings', 'projections', 'residential', 'units', 'periods', 'importMeta',
          'obligations', 'payments', 'certificates', 'certificateEvents',
          'transactions', 'monthClosings', 'closingEvents')
MAX_SAFE_INTEGER = 9007199254740991


def integer(value, *, minimum=None):
    if type(value) is not int or abs(value) > MAX_SAFE_INTEGER or (minimum is not None and value < minimum):
        raise ValueError('VALOR_FINANCEIRO_INVALIDO')
    return value


def valid_date(value):
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
        raise ValueError('DATA_INVALIDA')
    try:
        date.fromisoformat(value)
    except ValueError:
        raise ValueError('DATA_INVALIDA')
    return value


def validate_admin_snapshot(snapshot):
    if not isinstance(snapshot, dict) or snapshot.get('format') != 'conta-certa-snapshot' or snapshot.get('schemaVersion') != 1:
        raise ValueError('SNAPSHOT_INVALIDO')
    stores = snapshot.get('stores')
    if not isinstance(stores, dict) or set(stores) != set(STORES):
        raise ValueError('SNAPSHOT_STORES_INCOMPLETOS_OU_INVALIDOS')
    rows = {}
    for name in STORES:
        if not isinstance(stores[name], list):
            raise ValueError('SNAPSHOT_STORE_INVALIDO')
        rows[name] = []
        keys = set()
        for entry in stores[name]:
            if not isinstance(entry, dict) or 'key' not in entry or 'value' not in entry:
                raise ValueError('SNAPSHOT_REGISTRO_INVALIDO')
            key = entry['key']
            if not isinstance(key, (str, int)) or str(key) in keys:
                raise ValueError('SNAPSHOT_CHAVE_DUPLICADA_OU_INVALIDA')
            keys.add(str(key))
            item = entry['value']
            if name not in ('settings', 'importMeta'):
                field = 'certificateId' if name == 'certificates' else 'id'
                if not isinstance(item, dict) or str(item.get(field, '')) != str(key) or not str(key):
                    raise ValueError('SNAPSHOT_ID_INVALIDO')
            rows[name].append(item)
    if len(rows['residential']) != 1:
        raise ValueError('SNAPSHOT_RESIDENCIAL_INVALIDO')
    units = {str(u['id']) for u in rows['units']}
    obligations = {str(o['id']): o for o in rows['obligations']}
    paid = {key: 0 for key in obligations}
    for o in obligations.values():
        if str(o.get('unitId')) not in units:
            raise ValueError('OBRIGACAO_SEM_UNIDADE')
        amount = integer(o.get('amountCents'), minimum=1)
        received = integer(o.get('paidCents'), minimum=0)
        if received > amount:
            raise ValueError('PAGAMENTO_SUPERIOR_AO_SALDO')
        if o.get('status') not in ('open', 'partial', 'paid', 'cancelled'):
            raise ValueError('STATUS_OBRIGACAO_INVALIDO')
        expected = 'open' if received == 0 else 'partial' if received < amount else 'paid'
        if (o['status'] == 'cancelled' and received) or (o['status'] != 'cancelled' and o['status'] != expected):
            raise ValueError('STATUS_OBRIGACAO_INCONSISTENTE')
        valid_date(o.get('dueDate'))
    for payment in rows['payments']:
        oid = str(payment.get('obligationId'))
        obligation = obligations.get(oid)
        if not obligation or str(payment.get('unitId')) != str(obligation.get('unitId')):
            raise ValueError('PAGAMENTO_SEM_OBRIGACAO_CORRESPONDENTE')
        integer(payment.get('amountCents'), minimum=1)
        valid_date(str(payment.get('paidAt', ''))[:10])
        if parse_datetime(str(payment.get('paidAt', ''))) is None:
            raise ValueError('DATA_PAGAMENTO_INVALIDA')
        paid[oid] += payment['amountCents']
    for oid, obligation in obligations.items():
        if paid[oid] != obligation['paidCents']:
            raise ValueError('TOTAL_PAGAMENTOS_DIVERGENTE')
    for movement in rows['transactions']:
        integer(movement.get('amountCents'), minimum=1)
        valid_date(movement.get('date'))
        if movement.get('kind') not in ('income', 'expense') or movement.get('competence') != movement['date'][:7]:
            raise ValueError('MOVIMENTO_INVALIDO')
    for closing in rows['monthClosings']:
        competence = closing.get('competence')
        if not isinstance(competence, str) or not re.fullmatch(r'\d{4}-(0[1-9]|1[0-2])', competence) or closing['id'] != competence:
            raise ValueError('COMPETENCIA_INVALIDA')
        if closing.get('status') not in ('closed', 'reopened'):
            raise ValueError('FECHAMENTO_INVALIDO')
        integer(closing.get('revision'), minimum=1)
        for field in ('openingBalanceCents', 'revenueCents', 'expenseCents', 'resultCents', 'closingBalanceCents'):
            integer(closing.get(field))
        adjustment = integer(closing.get('historicalAdjustmentCents', 0)) if closing.get('source') == 'historical_import' else 0
        if closing['revenueCents'] - closing['expenseCents'] + adjustment != closing['resultCents'] or closing['openingBalanceCents'] + closing['resultCents'] != closing['closingBalanceCents']:
            raise ValueError('FECHAMENTO_TOTAIS_DIVERGENTES')
        if closing['status'] == 'closed' and closing.get('source') != 'historical_import':
            revenue = sum(p['amountCents'] for p in rows['payments'] if p['paidAt'][:7] == competence)
            revenue += sum(m['amountCents'] for m in rows['transactions'] if m['competence'] == competence and m['kind'] == 'income')
            expenses = sum(m['amountCents'] for m in rows['transactions'] if m['competence'] == competence and m['kind'] == 'expense')
            if revenue != closing['revenueCents'] or expenses != closing['expenseCents']:
                raise ValueError('FECHAMENTO_LANCAMENTOS_DIVERGENTES')
    return rows
