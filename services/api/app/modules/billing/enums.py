"""Billing enums for Invoice and Subscription state machines."""

import enum


class InvoiceStatus(enum.StrEnum):
    DRAFT = "draft"
    ISSUED = "issued"
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    CANCELED = "canceled"
    EXPIRED = "expired"
    PAST_DUE = "past_due"
    REFUNDED = "refunded"
    VOID = "void"


class SubscriptionStatus(enum.StrEnum):
    INACTIVE = "inactive"
    ACTIVE = "active"
    OVERDUE = "overdue"
    SUSPENDED = "suspended"
    CANCELED = "canceled"


class PaymentProvider(enum.StrEnum):
    STRIPE = "stripe"
    MERCADOPAGO = "mercadopago"


class PaymentMethod(enum.StrEnum):
    PIX = "pix"
    BOLETO = "boleto"
    CARD = "card"
    CHECKOUT_LINK = "checkout_link"
    SUBSCRIPTION = "subscription"


class AttemptStatus(enum.StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    FAILED = "failed"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class ContractStatus(enum.StrEnum):
    PENDING = "pending"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    GRACE_PERIOD = "grace_period"
    SUSPENDED = "suspended"
    CANCELLED = "cancelled"
