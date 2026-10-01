"""Billing API — invoices + recorded payments (no gateway simulation).

GET  /api/invoices                     auth   — role-scoped list (patient -> own)
POST /api/invoices                     staff  — create an invoice with line items
GET  /api/invoices/<id>                auth   — single invoice + payments
POST /api/invoices/<id>/payments       staff  — record a payment (cash/mobile/…)
GET  /api/payments                     auth   — payment ledger (filters)
"""
from __future__ import annotations

from flask import Blueprint
from flask_jwt_extended import current_user, jwt_required

from app.api._helpers import json_body, str_arg
from app.services import billing_service
from app.utils import ok

bp = Blueprint("billing", __name__, url_prefix="/api")  # top-level /api/invoices + /api/payments


@bp.route("/invoices", methods=["GET"])
@jwt_required()
def list_invoices():
    result = billing_service.list_invoices(
        current_user, patient_id=str_arg("patient_id"), status=str_arg("status")
    )
    return ok(result["items"], 200, total=result["total"])


@bp.route("/invoices", methods=["POST"])
@jwt_required()
def create_invoice():
    return ok(billing_service.create_invoice(current_user, json_body()), 201)


@bp.route("/invoices/<invoice_id>", methods=["GET"])
@jwt_required()
def get_invoice(invoice_id: str):
    return ok(billing_service.get_invoice(invoice_id, current_user))


@bp.route("/invoices/<invoice_id>/payments", methods=["POST"])
@jwt_required()
def record_payment(invoice_id: str):
    return ok(billing_service.record_payment(invoice_id, json_body(), current_user), 201)


@bp.route("/payments", methods=["GET"])
@jwt_required()
def list_payments():
    result = billing_service.list_payments(
        current_user, patient_id=str_arg("patient_id"), invoice_id=str_arg("invoice_id")
    )
    return ok(result["items"], 200, total=result["total"])

