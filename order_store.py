"""Small JSON-backed order store shared by REST and voice integrations."""

from __future__ import annotations

import json
import logging
import os
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import RLock
from typing import Any, Dict


logger = logging.getLogger("order_store")
ORDERS_PATH = Path(__file__).resolve().parent / "data" / "orders.json"
ORDER_STORE_LOCK = RLock()
DEFAULT_REFUND_WORKING_DAYS = 7


class OrderStoreError(RuntimeError):
    """Raised when order data cannot be read or safely persisted."""


def _normalise_order_id(order_id: str) -> str:
    return str(order_id).strip().upper()


def _coerce_datetime(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc) if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if not isinstance(value, str):
        return None
    value = value.strip()
    if not value:
        return None
    try:
        if value.endswith("Z"):
            value = value[:-1] + "+00:00"
        dt = datetime.fromisoformat(value)
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except ValueError:
        return None


def _format_datetime_utc(value: Any) -> str | None:
    dt = _coerce_datetime(value)
    if dt is None:
        return None
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def calculate_working_days(start_date: str | datetime | None, working_days: int = DEFAULT_REFUND_WORKING_DAYS) -> datetime:
    """Return the date after N working days, excluding weekends."""
    if working_days < 0:
        working_days = 0
    if not isinstance(working_days, int):
        working_days = int(working_days)

    base = _coerce_datetime(start_date) or datetime.now(timezone.utc)
    if base.tzinfo is None:
        base = base.replace(tzinfo=timezone.utc)

    current = base.date()
    completed = 0
    while completed < working_days:
        current = current + timedelta(days=1)
        if current.weekday() < 5:
            completed += 1
    return datetime.combine(current, datetime.min.time(), tzinfo=timezone.utc)


def calculate_expected_refund_date(issued_date: str | datetime | None, working_days: int = DEFAULT_REFUND_WORKING_DAYS) -> str:
    """Return the expected refund completion date using working days only."""
    issued = _coerce_datetime(issued_date) or datetime.now(timezone.utc)
    expected = calculate_working_days(issued, working_days)
    return expected.date().isoformat()


def _refund_status(order: Dict[str, Any]) -> str:
    return str(order.get("refund_status") or "").strip().lower()


def _ensure_refund_tracking(order_id: str, order: Dict[str, Any]) -> Dict[str, Any]:
    """Populate refund timeline fields and generate overdue complaint tickets when needed."""
    updated = dict(order)
    refund_status = _refund_status(updated)

    if not refund_status:
        return updated

    issued_value = updated.get("refund_issued_date") or updated.get("refund_requested_at")
    issued_dt = _coerce_datetime(issued_value) or datetime.now(timezone.utc)
    updated["refund_issued_date"] = _format_datetime_utc(issued_dt)

    if not updated.get("expected_refund_date"):
        updated["expected_refund_date"] = calculate_expected_refund_date(issued_dt)

    expected_date = updated.get("expected_refund_date")
    if not expected_date:
        expected_date = calculate_expected_refund_date(issued_dt)
        updated["expected_refund_date"] = expected_date

    issue_date = _coerce_datetime(updated.get("refund_issued_date")) or issued_dt
    expected_dt = datetime.fromisoformat(expected_date + "T00:00:00+00:00")
    has_expired = refund_status in {"requested", "pending", "processing"} and datetime.now(timezone.utc).date() > expected_dt.date()

    if has_expired and refund_status not in {"failed", "completed", "overdue"}:
        updated["refund_status"] = "overdue"
        refund_status = "overdue"

    complaint_id = updated.get("complaint_ticket_id")
    complaint_status = str(updated.get("complaint_status") or "").strip().lower()
    if refund_status == "overdue":
        if not complaint_id:
            complaint_id = f"COMP-{_normalise_order_id(order_id)}"
            updated["complaint_ticket_id"] = complaint_id
        updated["complaint_status"] = "Open"
        updated["complaint_created_date"] = updated.get("complaint_created_date") or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        updated["complaint_overdue_date"] = updated.get("complaint_overdue_date") or datetime.now(timezone.utc).strftime("%Y-%m-%d")
        updated["customer_issue"] = updated.get("customer_issue") or updated.get("refund_reason") or "Refund delayed beyond expected timeline"
        updated["complaint_amount_inr"] = updated.get("complaint_amount_inr") or updated.get("refund_amount_inr") or updated.get("total")
        updated["complaint_refund_ticket_id"] = updated.get("complaint_refund_ticket_id") or updated.get("refund_ticket_id")
        updated["complaint_reason"] = updated.get("complaint_reason") or updated.get("refund_reason")
    elif complaint_id and complaint_status == "open":
        updated["complaint_status"] = "Open"

    return updated


def ensure_overdue_refund_tracking() -> Dict[str, Dict[str, Any]]:
    """Scan stored orders and attach overdue/complaint metadata without mutating unrelated data."""
    with ORDER_STORE_LOCK:
        orders = read_orders()
        updated_orders = {}
        for order_id, order in orders.items():
            if not isinstance(order, dict):
                updated_orders[order_id] = order
                continue
            updated_orders[order_id] = _ensure_refund_tracking(order_id, order)
        if updated_orders != orders:
            _write_orders(updated_orders)
        return updated_orders


def read_orders() -> Dict[str, Dict[str, Any]]:
    """Read orders from disk, returning an empty store for missing/invalid data."""
    try:
        with ORDERS_PATH.open("r", encoding="utf-8") as file:
            data = json.load(file)
    except FileNotFoundError:
        logger.error("Order data file is missing: %s", ORDERS_PATH)
        return {}
    except (json.JSONDecodeError, OSError) as exc:
        logger.error("Could not read order data: %s", exc)
        return {}

    if not isinstance(data, dict) or any(
        not isinstance(order_id, str) or not isinstance(order, dict)
        for order_id, order in data.items()
    ):
        logger.error("Order data must be an object of order objects")
        return {}

    return data


def find_order(order_id: str) -> Dict[str, Any] | None:
    """Return a copy of an order so callers cannot mutate the store accidentally."""
    orders = ensure_overdue_refund_tracking()
    order = orders.get(_normalise_order_id(order_id))
    return dict(order) if order else None


def update_order(order_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    """Merge updates into an order and persist the complete document atomically."""
    with ORDER_STORE_LOCK:
        normalised_id = _normalise_order_id(order_id)
        orders = read_orders()
        if normalised_id not in orders:
            raise KeyError(normalised_id)

        updated_order = {**orders[normalised_id], **updates}
        if updated_order.get("refund_status"):
            updated_order = _ensure_refund_tracking(normalised_id, updated_order)
        orders[normalised_id] = updated_order
        _write_orders(orders)
        return dict(updated_order)


def _write_orders(orders: Dict[str, Dict[str, Any]]) -> None:
    ORDERS_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=ORDERS_PATH.parent,
            prefix="orders-",
            suffix=".tmp",
            delete=False,
        ) as file:
            temporary_path = file.name
            json.dump(orders, file, indent=2, ensure_ascii=True)
            file.write("\n")
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary_path, ORDERS_PATH)
    except (OSError, TypeError, ValueError) as exc:
        if temporary_path:
            try:
                os.unlink(temporary_path)
            except OSError:
                pass
        raise OrderStoreError("Could not persist order data safely") from exc


def list_refunds() -> list[Dict[str, Any]]:
    """Return stored refund records in a frontend-friendly shape."""
    orders = ensure_overdue_refund_tracking()
    refunds = []
    for order_id, order in orders.items():
        if order.get("refund_status"):
            refund_status = str(order.get("refund_status") or "").lower()
            remaining = 0
            expected_raw = order.get("expected_refund_date")
            if expected_raw:
                expected_dt = datetime.fromisoformat(str(expected_raw) + "T00:00:00+00:00")
                today = datetime.now(timezone.utc)
                if refund_status in {"requested", "pending", "processing", "overdue"}:
                    remaining = max(0, (expected_dt.date() - today.date()).days)
            refunds.append({
                "ticket_id": order.get("refund_ticket_id"),
                "order_id": order_id,
                "item": order.get("item"),
                "reason": order.get("refund_reason"),
                "refund_amount_inr": order.get("refund_amount_inr", order.get("total")),
                "status": order.get("refund_status"),
                "refund_status": order.get("refund_status"),
                "requested_at": order.get("refund_requested_at"),
                "refund_issued_date": order.get("refund_issued_date"),
                "expected_refund_date": order.get("expected_refund_date"),
                "remaining_working_days": remaining,
                "overdue": order.get("refund_status", "").lower() == "overdue",
                "complaint_ticket_id": order.get("complaint_ticket_id"),
                "complaint_status": order.get("complaint_status"),
                "processing_days": order.get("processing_days", DEFAULT_REFUND_WORKING_DAYS),
                "complaint_created_date": order.get("complaint_created_date"),
            })
    return sorted(refunds, key=lambda refund: refund.get("requested_at") or "", reverse=True)


def dashboard_summary() -> Dict[str, Any]:
    """Aggregate refund and order totals for the dashboard."""
    orders = ensure_overdue_refund_tracking()
    refund_count = 0
    pending_refund_count = 0
    total_refund_amount = 0
    recent_refunds = []
    recent_complaints = []

    for order_id, order in orders.items():
        if order.get("refund_status"):
            refund_count += 1
            status = str(order.get("refund_status", "")).lower()
            if status in {"requested", "pending", "processing", "overdue"}:
                pending_refund_count += 1
            amount = order.get("refund_amount_inr")
            if isinstance(amount, (int, float)):
                total_refund_amount += int(amount)

        if order.get("complaint_ticket_id"):
            recent_complaints.append({
                "complaint_ticket_id": order.get("complaint_ticket_id"),
                "refund_ticket_id": order.get("refund_ticket_id"),
                "order_id": order_id,
                "refund_amount_inr": order.get("refund_amount_inr", order.get("total")),
                "reason": order.get("refund_reason"),
                "complaint_status": order.get("complaint_status"),
                "created_date": order.get("complaint_created_date") or order.get("refund_issued_date"),
            })

    recent_refunds = list_refunds()[:5]
    recent_complaints = sorted(recent_complaints, key=lambda item: item.get("created_date") or "", reverse=True)[:5]

    return {
        "total_orders": len(orders),
        "total_refund_requests": refund_count,
        "pending_refund_requests": pending_refund_count,
        "total_refund_amount": total_refund_amount,
        "recent_refunds": recent_refunds,
        "recent_complaints": recent_complaints,
    }
