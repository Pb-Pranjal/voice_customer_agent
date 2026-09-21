import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import order_store
from server import start_refund


class RefundTrackingTests(unittest.TestCase):
    def test_working_days_skip_weekends_and_issue_date_is_day_zero(self):
        self.assertEqual(
            order_store.calculate_expected_refund_date("2026-09-21", 7),
            "2026-09-30",
        )
        self.assertEqual(
            order_store.calculate_expected_refund_date("2026-09-19", 7),
            "2026-09-29",
        )
        self.assertEqual(
            order_store.calculate_remaining_working_days(
                "2026-09-30",
                "2026-09-25",
            ),
            3,
        )

    def test_completed_refund_is_not_overdue(self):
        self.assertFalse(
            order_store.is_refund_overdue(
                "completed",
                "2026-09-20",
                "2026-09-21",
            )
        )

    def test_overdue_refund_creates_one_reusable_complaint(self):
        orders = {
            "A2001": {
                "item": "Test item",
                "status": "delivered",
                "total": 100,
                "refund_status": "pending",
                "refund_reason": "damaged",
                "refund_amount_inr": 100,
                "refund_ticket_id": "RF-A2001-1",
                "refund_issued_date": "2020-09-01T00:00:00Z",
                "expected_refund_date": "2020-09-10",
            },
            "A2002": {
                "item": "Completed item",
                "status": "delivered",
                "total": 200,
                "refund_status": "completed",
                "refund_issued_date": "2020-09-01T00:00:00Z",
                "expected_refund_date": "2020-09-10",
            },
        }
        with tempfile.TemporaryDirectory() as directory:
            orders_path = Path(directory) / "orders.json"
            orders_path.write_text(json.dumps(orders), encoding="utf-8")
            with patch.object(order_store, "ORDERS_PATH", orders_path):
                first = order_store.ensure_overdue_refund_tracking()
                second = order_store.ensure_overdue_refund_tracking()

            complaint = first["A2001"]
            self.assertEqual(complaint["refund_status"], "overdue")
            self.assertEqual(complaint["complaint_ticket_id"], "COMP-A2001")
            self.assertEqual(complaint["complaint_refund_ticket_id"], "RF-A2001-1")
            self.assertEqual(complaint["complaint_amount_inr"], 100)
            self.assertEqual(complaint["complaint_reason"], "damaged")
            self.assertEqual(complaint["complaint_status"], "Open")
            self.assertEqual(
                second["A2001"]["complaint_ticket_id"],
                "COMP-A2001",
            )
            self.assertNotIn("complaint_ticket_id", first["A2002"])

    def test_refund_creation_persists_expected_date_and_rejects_duplicate(self):
        orders = {
            "A2003": {
                "item": "Refund item",
                "status": "delivered",
                "total": 300,
                "eta_days": 0,
                "carrier": "Test",
            }
        }
        with tempfile.TemporaryDirectory() as directory:
            orders_path = Path(directory) / "orders.json"
            orders_path.write_text(json.dumps(orders), encoding="utf-8")
            with patch.object(order_store, "ORDERS_PATH", orders_path):
                result = start_refund("A2003", "damaged")
                duplicate = start_refund("A2003", "damaged")

            self.assertTrue(result["success"])
            self.assertEqual(result["refund_status"], "pending")
            self.assertRegex(result["expected_refund_date"], r"^\d{4}-\d{2}-\d{2}$")
            self.assertTrue(duplicate["duplicate"])
            self.assertEqual(duplicate["ticket_id"], result["ticket_id"])


if __name__ == "__main__":
    unittest.main()
