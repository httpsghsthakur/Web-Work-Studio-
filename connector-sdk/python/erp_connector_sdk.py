import time
import json
import hmac
import hashlib
import requests
from typing import Dict, Any, Optional, List

class ERPConnectorSDK:
    """
    Python Enterprise School ERP Connector SDK.
    Connects any standalone School ERP to Central ERP Command.
    """
    def __init__(self, central_url: str, school_id: str, api_key: str, hmac_secret: str, timeout: int = 10):
        self.central_url = central_url.rstrip('/')
        self.school_id = school_id
        self.api_key = api_key
        self.hmac_secret = hmac_secret
        self.timeout = timeout

    def _generate_signature(self, timestamp: str, body_str: str = "") -> str:
        signing_payload = f"{self.school_id}:{timestamp}:{body_str}".encode('utf-8')
        secret_bytes = self.hmac_secret.encode('utf-8')
        return hmac.new(secret_bytes, signing_payload, hashlib.sha256).hexdigest()

    def _request(self, endpoint: str, method: str = "GET", data: Optional[Dict[str, Any]] = None, idempotency_key: Optional[str] = None) -> Dict[str, Any]:
        timestamp = str(int(time.time()))
        body_str = json.dumps(data) if data is not None else ""
        signature = self._generate_signature(timestamp, body_str)

        headers = {
            "Content-Type": "application/json",
            "x-school-id": self.school_id,
            "x-api-key": self.api_key,
            "x-timestamp": timestamp,
            "x-signature": signature
        }
        if idempotency_key:
            headers["x-idempotency-key"] = idempotency_key

        url = f"{self.central_url}/api/v1/connector{endpoint}"
        response = requests.request(
            method=method,
            url=url,
            headers=headers,
            data=body_str if body_str else None,
            timeout=self.timeout
        )

        if not response.ok:
            try:
                err_data = response.json()
                msg = err_data.get('error', f"HTTP {response.status_code}")
            except Exception:
                msg = f"HTTP {response.status_code}: {response.text}"
            raise RuntimeError(f"Central ERP Gateway Error: {msg}")

        return response.json()

    def check_license_status(self) -> Dict[str, Any]:
        """Check operational authorization, suspension status, and enabled modules."""
        return self._request("/status", method="GET")

    def send_heartbeat(self, cpu_pct: float = 18.0, mem_pct: float = 45.0, disk_pct: float = 30.0, db_size_mb: float = 5000.0) -> Dict[str, Any]:
        """Dispatch vitality ping with local system performance metrics."""
        payload = {
            "cpu_usage_pct": cpu_pct,
            "memory_usage_pct": mem_pct,
            "disk_usage_pct": disk_pct,
            "database_size_mb": db_size_mb,
            "response_time_ms": 32,
            "active_sessions": 75
        }
        return self._request("/heartbeat", method="POST", data=payload)

    def sync_data(self, sync_payload: Dict[str, Any], idempotency_key: Optional[str] = None) -> Dict[str, Any]:
        """Push aggregated student/teacher census, attendance, and local security events."""
        return self._request("/sync", method="POST", data=sync_payload, idempotency_key=idempotency_key)

    def poll_pending_commands(self) -> List[Dict[str, Any]]:
        """Poll secure pull-based command queue for any remote administration orders."""
        res = self._request("/commands/pending", method="GET")
        return res.get("data", [])

    def acknowledge_command(self, command_id: str, status: str = "SUCCESS", result_log: str = "") -> Dict[str, Any]:
        """Report execution outcome of a recognized command."""
        payload = {
            "execution_status": status,
            "result_log": result_log
        }
        return self._request(f"/commands/{command_id}/ack", method="POST", data=payload)
