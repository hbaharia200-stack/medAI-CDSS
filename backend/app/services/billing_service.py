"""Billing: invoices + recorded payments.

Payments here are *recorded* (cash / mobile money / bank reference /
insurance) — there is no gateway integration and no simulated card processing.
"""
from __future__ import annotations

from datetime import datetime

from app.extensions import db
from app.models import InvoiceStatus, Payment, UserRole
from app.repositories import log_audit
from app.repositories import workflow_repo as repo
from app.schemas.workflow import serialize_invoice
from app.services import patient_service
from app.utils import AuthError, NotFoundError, ValidationError

PAYMENT_METHODS = {"cash", "mobile_money", "bank_transfer", "insurance", "waiver"}


def _role(actor) -> str:
    return actor.role.value if hasattr(actor.role, "value") else str(actor.role)


def require_billing_staff(actor) -> None:
    if _role(actor) not in (UserRole.admin.value, UserRole.doctor.value, UserRole.nurse.value):
        raise AuthError("forbidden_role", "Only staff may manage billing.", 403)


def _serialize(invoice) -> dict:
    payload = serialize_invoice(invoice)
    payments = list(invoice.payments or [])
    payload["paidAmount"] = round(sum(float(p.amount) for p in payments), 2)
    payload["balance"] = round(payload["totalAmount"] - payload["paidAmount"], 2)
    payload["payments"] = [
        {
            "id": p.id,
            "amount": float(p.amount),
            "currency": p.currency,
            "method": p.method,
            "reference": p.reference,
            "recordedBy": p.recorded_by,
            "paidAt": p.paid_at.isoformat() if p.paid_at else None,
        }
        for p in payments
    ]
    return payload


def list_invoices(actor, *, patient_id: str | None = None, status: str | None = None) -> dict:
    role = _role(actor)
    if role == UserRole.patient.value:
        patient_id = actor.id
    if status and status not in {s.value for s in InvoiceStatus}:
        raise ValidationError(
            f"'status' must be one of: {', '.join(s.value for s in InvoiceStatus)}.", "invalid_status"
        )

    invoices = repo.list_invoices(for_patient=patient_id)
    if status:
        invoices = [
            i for i in invoices
            if (i.status.value if hasattr(i.status, "value") else i.status) == status
        ]
    return {"items": [_serialize(i) for i in invoices], "total": len(invoices)}


def get_invoice(invoice_id: str, actor) -> dict:
    invoice = repo.get_invoice(invoice_id)
    if invoice is None:
        raise NotFoundError("Invoice not found.")
    if _role(actor) == UserRole.patient.value and invoice.patient_id != actor.id:
        raise AuthError("forbidden_invoice", "You do not have access to this invoice.", 403)
    return _serialize(invoice)


def create_invoice(actor, data: dict) -> dict:
    require_billing_staff(actor)
    patient_id = (data.get("patientId") or "").strip()
    # Support walk-in patient creation with patientName + phone (no patientId).
    patient_name = (data.get("patientName") or data.get("fullName") or "").strip()
    phone = (data.get("phone") or "").strip()
    if not patient_id and not (patient_name and phone):
        raise ValidationError("'patientId' or 'patientName'+'phone' is required.", "required_field_missing")
    if patient_id:
        patient_service.get_patient(patient_id)  # 404s when unknown / not a patient
    elif patient_name and phone:
        # Create a walk-in patient record (no password — clinical record only).
        patient_data = dict(data)
        patient_data["fullName"] = patient_name
        patient_id = patient_service.create_patient(patient_data).id

    # Accept both 'lines' (canonical) and 'items' (test/legacy alias).
    # Normalize 'items' format {description, quantity, unitPrice} into 'lines' format {description, amount}.
    raw_lines = data.get("lines") or data.get("items") or []
    lines: list[dict] = []
    for item in raw_lines:
        if isinstance(item, dict):
            if "amount" in item:
                # Already in 'lines' format.
                lines.append(item)
            elif "unitPrice" in item:
                # 'items' format: unitPrice is the per-unit price; create_invoice
                # multiplies amount * quantity, so store unitPrice as amount.
                lines.append({
                    "description": item.get("description", ""),
                    "amount": float(item["unitPrice"]),
                    "quantity": int(item.get("quantity", 1)),
                })
            else:
                raise ValidationError("Each line needs 'description' and 'amount' or 'unitPrice'.", "invalid_line_item")
        else:
            raise ValidationError("Each line must be a dict.", "invalid_line_item")
    if not isinstance(lines, list) or not lines:
        raise ValidationError("'lines' must contain at least one line item.", "required_field_missing")
    for line in lines:
        if not isinstance(line, dict) or not line.get("description") or line.get("amount") in (None, ""):
            raise ValidationError("Each line needs 'description' and 'amount'.", "invalid_line_item")
        try:
            float(line["amount"])
        except (TypeError, ValueError) as exc:
            raise ValidationError("Line 'amount' must be numeric.", "invalid_line_item") from exc

    invoice = repo.create_invoice(
        patient_id=patient_id,
        lines=lines,
        appointment_id=data.get("appointmentId") or None,
        currency=data.get("currency") or "TZS",
        due_date=None,
    )
    invoice.status = InvoiceStatus(data.get("status") or InvoiceStatus.draft.value)
    db.session.commit()

    log_audit(
        action="invoice.created",
        user_id=actor.id,
        role=_role(actor),
        detail={
            "invoiceId": invoice.id,
            "patientId": patient_id,
            "total": float(invoice.total_amount or 0),
        },
    )
    return _serialize(invoice)


def record_payment(invoice_id: str, data: dict, actor) -> dict:
    """Record a payment against an invoice (no gateway; operator-entered)."""
    require_billing_staff(actor)
    invoice = repo.get_invoice(invoice_id)
    if invoice is None:
        raise NotFoundError("Invoice not found.")
    if (invoice.status.value if hasattr(invoice.status, "value") else invoice.status) == "paid":
        raise ValidationError("This invoice is already fully paid.", "invoice_already_paid")

    method = (data.get("method") or "").strip()
    if method not in PAYMENT_METHODS:
        raise ValidationError(
            f"'method' must be one of: {', '.join(sorted(PAYMENT_METHODS))}.", "invalid_payment_method"
        )
    if data.get("amount") in (None, ""):
        raise ValidationError("'amount' is required.", "required_field_missing")
    try:
        amount = float(data["amount"])
    except (TypeError, ValueError) as exc:
        raise ValidationError("'amount' must be numeric.", "invalid_amount") from exc
    if amount <= 0:
        raise ValidationError("'amount' must be greater than zero.", "invalid_amount")

    payment = Payment(
        invoice_id=invoice.id,
        patient_id=invoice.patient_id,
        amount=amount,
        currency=invoice.currency or "TZS",
        method=method,
        reference=data.get("reference"),
        notes=data.get("notes"),
        recorded_by=actor.id,
    )
    db.session.add(payment)
    db.session.flush()

    paid = sum(float(p.amount) for p in invoice.payments or [])
    total = float(invoice.total_amount or 0)
    if paid >= total:
        invoice.status = InvoiceStatus.paid
        invoice.paid_at = datetime.utcnow()
    db.session.commit()

    log_audit(
        action="payment.recorded",
        user_id=actor.id,
        role=_role(actor),
        detail={
            "invoiceId": invoice.id,
            "paymentId": payment.id,
            "amount": amount,
            "method": method,
            "invoiceStatus": invoice.status.value,
        },
    )
    # Return flat structure: {payment, invoice} so ok() wraps as {success, data: {payment, invoice}}
    # Tests expect data.amount at top level of data. Provide both shapes for compatibility.
    return {
        "id": payment.id,
        "amount": amount,
        "method": method,
        "invoiceId": invoice.id,
        "invoice": _serialize(invoice),
    }


def list_payments(actor, *, patient_id: str | None = None, invoice_id: str | None = None) -> dict:
    role = _role(actor)
    if role == UserRole.patient.value:
        patient_id = actor.id
    query = db.session.query(Payment)
    if patient_id:
        query = query.filter(Payment.patient_id == patient_id)
    if invoice_id:
        query = query.filter(Payment.invoice_id == invoice_id)
    rows = query.order_by(Payment.paid_at.desc()).all()
    return {
        "items": [
            {
                "id": p.id,
                "invoiceId": p.invoice_id,
                "patientId": p.patient_id,
                "amount": float(p.amount),
                "currency": p.currency,
                "method": p.method,
                "reference": p.reference,
                "recordedBy": p.recorded_by,
                "paidAt": p.paid_at.isoformat() if p.paid_at else None,
            }
            for p in rows
        ],
        "total": len(rows),
    }