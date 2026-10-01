"""Billing: invoices and invoice line items."""
from __future__ import annotations

from app.extensions import db
from app.utils import gen_uuid
from . import InvoiceStatus


class Invoice(db.Model):
    __tablename__ = "invoices"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    uuid = db.Column(db.String(36), unique=True, nullable=False, default=gen_uuid)

    patient_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False, index=True)
    appointment_id = db.Column(db.String(36), db.ForeignKey("appointments.id"), nullable=True)

    number = db.Column(db.String(32), nullable=False, unique=True)
    currency = db.Column(db.String(8), nullable=False, default="TZS")
    total_amount = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    status = db.Column(
        db.Enum(InvoiceStatus, native_enum=False, length=16),
        nullable=False,
        default=InvoiceStatus.draft,
        index=True,
    )
    issued_at = db.Column(db.DateTime, default=db.func.now(), nullable=False)
    due_date = db.Column(db.DateTime, nullable=True)
    paid_at = db.Column(db.DateTime, nullable=True)

    lines = db.relationship("InvoiceLine", back_populates="invoice", cascade="all, delete-orphan")
    payments = db.relationship("Payment", back_populates="invoice", cascade="all, delete-orphan")

    patient = db.relationship("User", foreign_keys=[patient_id])


class InvoiceLine(db.Model):
    __tablename__ = "invoice_lines"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    invoice_id = db.Column(db.String(36), db.ForeignKey("invoices.id"), nullable=False, index=True)
    description = db.Column(db.String(255), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    quantity = db.Column(db.Integer, nullable=False, default=1)

    invoice = db.relationship("Invoice", back_populates="lines")


class Payment(db.Model):
    """A recorded payment against an invoice.

    This records money that was actually received (cash, mobile money, bank
    transfer reference, insurance). There is intentionally NO gateway
    integration and NO simulated card processing — an operator records the
    payment with its reference, and the invoice is marked paid once the
    recorded payments cover the total.
    """

    __tablename__ = "payments"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    uuid = db.Column(db.String(36), unique=True, nullable=False, default=gen_uuid)
    invoice_id = db.Column(db.String(36), db.ForeignKey("invoices.id"), nullable=False, index=True)
    patient_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False, index=True)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    currency = db.Column(db.String(8), nullable=False, default="TZS")
    method = db.Column(db.String(32), nullable=False)  # cash | mobile_money | bank_transfer | insurance
    reference = db.Column(db.String(128), nullable=True)  # external receipt/transaction reference
    notes = db.Column(db.Text, nullable=True)
    recorded_by = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)
    paid_at = db.Column(db.DateTime, default=db.func.now(), nullable=False)

    invoice = db.relationship("Invoice", back_populates="payments")
