from datetime import datetime
from django.db import transaction
from django.utils.dateparse import parse_date, parse_datetime
from .models import (
    Residential, Unit, ResidentCredential, Obligation, Payment,
    Movement, Closing, Certificate, AuditEvent,
)

def store_values(snapshot, name):
    stores = (snapshot or {}).get("stores") or {}
    entries = stores.get(name) or []
    out = []
    for entry in entries:
        if isinstance(entry, dict) and "value" in entry:
            out.append(entry["value"])
    return out

def _int(value):
    return value if isinstance(value, int) else 0

def apply_admin_snapshot(snapshot, *, actor="admin"):
    residential_values = store_values(snapshot, "residential")
    if not residential_values:
        raise ValueError("SNAPSHOT_SEM_RESIDENCIAL")
    r = residential_values[0]
    external_id = str(r.get("id") or "").strip()
    if not external_id:
        raise ValueError("RESIDENCIAL_SEM_ID")

    with transaction.atomic():
        residential, _ = Residential.objects.select_for_update().get_or_create(
            external_id=external_id,
            defaults={"name": str(r.get("name") or external_id), "address": str(r.get("address") or "")},
        )
        residential.name = str(r.get("name") or residential.name)
        residential.address = str(r.get("address") or residential.address)
        residential.save()

        incoming_unit_ids = set()
        for item in store_values(snapshot, "units"):
            uid = str(item.get("id") or "").strip()
            if not uid:
                continue
            incoming_unit_ids.add(uid)
            unit, _ = Unit.objects.update_or_create(
                residential=residential,
                external_id=uid,
                defaults={
                    "label": str(item.get("label") or f"Unidade {uid}"),
                    "responsible_name": str(item.get("responsibleName") or ""),
                    "active": item.get("active") is not False,
                    "payload": item,
                },
            )
            incoming_phones = set()
            for contact in item.get("contacts") or []:
                if contact.get("type") != "phone" or contact.get("active") is False:
                    continue
                digits = "".join(ch for ch in str(contact.get("value") or "") if ch.isdigit())
                if 10 <= len(digits) <= 15:
                    incoming_phones.add(digits)
                    ResidentCredential.objects.update_or_create(
                        unit=unit, phone_digits=digits,
                        defaults={"active": True},
                    )
            ResidentCredential.objects.filter(unit=unit).exclude(phone_digits__in=incoming_phones).update(active=False)
        Unit.objects.filter(residential=residential).exclude(external_id__in=incoming_unit_ids).update(active=False)

        def sync_rows(model, store_name, id_field, defaults_builder):
            incoming = set()
            for item in store_values(snapshot, store_name):
                ext = str(item.get(id_field) or "").strip()
                if not ext:
                    continue
                incoming.add(ext)
                model.objects.update_or_create(
                    residential=residential,
                    **{id_field if id_field != "id" else "external_id": ext},
                    defaults=defaults_builder(item),
                )
            key = "external_id" if hasattr(model, "external_id") else id_field
            model.objects.filter(residential=residential).exclude(**{f"{key}__in": incoming}).delete()

        sync_rows(Obligation, "obligations", "id", lambda i: {
            "unit_external_id": str(i.get("unitId") or ""),
            "kind": str(i.get("kind") or ""),
            "status": str(i.get("status") or ""),
            "amount_cents": _int(i.get("amountCents")),
            "paid_cents": _int(i.get("paidCents")),
            "due_date": parse_date(str(i.get("dueDate") or "")) if i.get("dueDate") else None,
            "payload": i,
        })
        sync_rows(Payment, "payments", "id", lambda i: {
            "obligation_external_id": str(i.get("obligationId") or ""),
            "unit_external_id": str(i.get("unitId") or ""),
            "amount_cents": _int(i.get("amountCents")),
            "paid_at": parse_datetime(str(i.get("paidAt") or "")) if i.get("paidAt") else None,
            "payload": i,
        })
        sync_rows(Movement, "transactions", "id", lambda i: {
            "competence": str(i.get("competence") or ""),
            "kind": str(i.get("kind") or ""),
            "amount_cents": _int(i.get("amountCents")),
            "date": parse_date(str(i.get("date") or "")) if i.get("date") else None,
            "payload": i,
        })

        incoming_closings = set()
        for i in store_values(snapshot, "monthClosings"):
            comp = str(i.get("competence") or i.get("id") or "").strip()
            if not comp:
                continue
            incoming_closings.add(comp)
            Closing.objects.update_or_create(
                residential=residential, competence=comp,
                defaults={
                    "status": str(i.get("status") or "closed"),
                    "revision": max(1, int(i.get("revision") or 1)),
                    "opening_balance_cents": _int(i.get("openingBalanceCents")),
                    "revenue_cents": _int(i.get("revenueCents")),
                    "expense_cents": _int(i.get("expenseCents")),
                    "result_cents": _int(i.get("resultCents")),
                    "closing_balance_cents": _int(i.get("closingBalanceCents")),
                    "payload": i,
                },
            )
        Closing.objects.filter(residential=residential).exclude(competence__in=incoming_closings).delete()

        incoming_cert_ids = set()
        for i in store_values(snapshot, "certificates"):
            cid = str(i.get("certificateId") or "").strip()
            if not cid:
                continue
            incoming_cert_ids.add(cid)
            Certificate.objects.update_or_create(
                certificate_id=cid,
                defaults={
                    "residential": residential,
                    "unit_external_id": str(i.get("unitId") or ""),
                    "year": int(i.get("year") or 0),
                    "status": str(i.get("status") or ""),
                    "file_name": str(i.get("fileName") or ""),
                    "pdf_base64": str(i.get("pdfBase64") or ""),
                    "payload": i,
                },
            )
        Certificate.objects.filter(residential=residential).exclude(certificate_id__in=incoming_cert_ids).delete()

        residential.latest_snapshot = snapshot
        residential.sync_version += 1
        residential.save(update_fields=["latest_snapshot", "sync_version", "updated_at"])
        AuditEvent.objects.create(
            residential=residential,
            actor_role="admin",
            actor=actor,
            action="SYNC_PUSH",
            detail={"syncVersion": residential.sync_version},
        )
        return residential

def resident_snapshot(credential):
    unit = credential.unit
    residential = unit.residential
    obligations = list(Obligation.objects.filter(
        residential=residential, unit_external_id=unit.external_id
    ).order_by("due_date", "external_id").values_list("payload", flat=True))
    payments = list(Payment.objects.filter(
        residential=residential, unit_external_id=unit.external_id
    ).order_by("paid_at", "external_id").values_list("payload", flat=True))
    certificates = list(Certificate.objects.filter(
        residential=residential, unit_external_id=unit.external_id
    ).order_by("-year").values_list("payload", flat=True))

    movements = list(Movement.objects.filter(
        residential=residential, kind="expense"
    ).order_by("date", "external_id").values_list("payload", flat=True))

    closings = []
    for closing in Closing.objects.filter(residential=residential, status="closed").order_by("competence"):
        payload = dict(closing.payload or {})
        payload["expenses"] = [
            m for m in movements if str(m.get("competence") or "") == closing.competence
        ]
        closings.append(payload)

    return {
        "schemaVersion": 2,
        "profileType": "resident-readonly",
        "syncVersion": residential.sync_version,
        "generatedAt": residential.updated_at.isoformat(),
        "residential": {"id": residential.external_id, "name": residential.name},
        "unit": {
            "id": unit.external_id,
            "label": unit.label,
            "responsibleName": unit.responsible_name,
        },
        "allowedPhones": [credential.phone_digits],
        "obligations": obligations,
        "payments": payments,
        "closings": closings,
        "certificates": certificates,
    }
