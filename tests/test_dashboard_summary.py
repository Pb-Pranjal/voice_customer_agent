import unittest

from fastapi.testclient import TestClient

from server import app


class DashboardSummaryTests(unittest.TestCase):
    def test_dashboard_summary_route_returns_totals_and_recent_refunds(self):
        client = TestClient(app)
        response = client.get('/api/dashboard/summary')

        self.assertEqual(response.status_code, 200)
        payload = response.json()

        self.assertIn('total_orders', payload)
        self.assertIn('total_refund_requests', payload)
        self.assertIn('pending_refund_requests', payload)
        self.assertIn('total_refund_amount', payload)
        self.assertIn('recent_refunds', payload)
        self.assertGreaterEqual(payload['total_orders'], 1)
        self.assertGreaterEqual(payload['total_refund_requests'], 1)
        self.assertGreaterEqual(payload['total_refund_amount'], 0)
        self.assertIsInstance(payload['recent_refunds'], list)


if __name__ == '__main__':
    unittest.main()
