"""
Simple Aggregator client interface and a Mock implementation.

This provides a pluggable place to integrate real providers (Xoxoday, TangoCard, Giftbit).
For local development the `MockAggregatorClient` returns deterministic voucher codes.
"""

import base64
import time
import uuid
from typing import Any, Dict

import requests
from config import settings


class AggregatorClient:
    """Base interface for aggregator clients."""

    def issue_voucher(
        self,
        tenant_id: uuid.UUID,
        vendor_code: str,
        amount: float,
        metadata: Dict[str, Any],
    ) -> Dict[str, Any]:
        raise NotImplementedError()

    def check_balance(self, vendor_code: str) -> Dict[str, Any]:
        raise NotImplementedError()

    def get_catalog(self) -> Dict[str, Any]:
        raise NotImplementedError()


class MockAggregatorClient(AggregatorClient):
    def issue_voucher(
        self,
        tenant_id: uuid.UUID,
        vendor_code: str,
        amount: float,
        metadata: Dict[str, Any],
    ) -> Dict[str, Any]:
        # Simulate network latency
        time.sleep(0.1)
        code = f"MOCK-{int(time.time())}-{str(uuid.uuid4())[:8].upper()}"
        return {
            "status": "success",
            "voucher_code": code,
            "pin": None,
            "redeem_url": f"https://mock-aggregator.example/redeem/{code}",
            "vendor_reference": str(uuid.uuid4()),
        }


class TangoCardClient(AggregatorClient):
    """Minimal TangoCard implementation (requires settings.tango_api_key and account id).
    This is a simple wrapper; for full integration, extend per TangoCard docs."""

    def issue_voucher(self, tenant_id: uuid.UUID, vendor_code: str, amount: float, metadata: Dict[str, Any]) -> Dict[str, Any]:
        if not (getattr(settings, "tango_api_key", "") and getattr(settings, "tango_account_identifier", "")):
            raise RuntimeError("TangoCard configuration missing")
        try:
            url = f"{settings.tango_api_base}/v2/clients/{settings.tango_account_identifier}/orders"
            payload = {
                "send": False,
                "amount": amount,
                "denominations": [{"denomination": amount}],
                "vendor": vendor_code,
                "metadata": metadata,
            }
            headers = {"Authorization": f"Bearer {settings.tango_api_key}", "Content-Type": "application/json"}
            resp = requests.post(url, json=payload, headers=headers, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            # Map response fields conservatively
            return {
                "status": "success",
                "voucher_code": data.get("voucher_code") or data.get("order_id") or str(uuid.uuid4()),
                "redeem_url": data.get("redeem_url"),
                "vendor_reference": data.get("order_id") or data.get("vendor_reference") or str(uuid.uuid4()),
            }
        except Exception as e:
            return {"status": "failed", "error": str(e)}


class XoxodayClient(AggregatorClient):
    """Minimal Xoxoday implementation (requires API key configured as XOXODAY_API_KEY).
    Adjust according to the provider's API."""

    def issue_voucher(self, tenant_id: uuid.UUID, vendor_code: str, amount: float, metadata: Dict[str, Any]) -> Dict[str, Any]:
        api_key = getattr(settings, "xoxoday_api_key", "")
        api_base = getattr(settings, "xoxoday_api_base", "https://api.xoxoday.com")
        if not api_key:
            raise RuntimeError("Xoxoday API key not configured")
        try:
            url = f"{api_base}/catalogs/{vendor_code}/issue"
            payload = {"amount": amount, "metadata": metadata}
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            resp = requests.post(url, json=payload, headers=headers, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            return {
                "status": data.get("status", "success"),
                "voucher_code": data.get("voucher_code") or data.get("code") or str(uuid.uuid4()),
                "redeem_url": data.get("redeem_url") or data.get("url"),
                "vendor_reference": data.get("reference") or data.get("vendor_reference") or str(uuid.uuid4()),
            }
        except Exception as e:
            return {"status": "failed", "error": str(e)}


# Factory
def get_aggregator_client() -> AggregatorClient:
    provider = getattr(settings, "aggregator_provider", "mock")
    if provider == "mock":
        return MockAggregatorClient()
    if provider == "tangocard":
        return TangoCardClient()
    if provider == "xoxoday":
        return XoxodayClient()
    # Add other providers here (e.g., XoxodayClient)
    return MockAggregatorClient()
    def check_balance(self, vendor_code: str) -> Dict[str, Any]:
        return {"vendor_code": vendor_code, "current_balance": 100000.0}

    def get_catalog(self) -> Dict[str, Any]:
        """Returns a mock catalog including various international brands."""
        return {
            "brands": [
                {
                    "brandKey": "amazon-in",
                    "brandName": "Amazon.in",
                    "imageUrls": {"80w-mono": "https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg"},
                    "items": [
                        {"utid": "amz-in-500", "rewardName": "Amazon ₹500", "value": 500, "currencyCode": "INR"},
                        {"utid": "amz-in-1000", "rewardName": "Amazon ₹1000", "value": 1000, "currencyCode": "INR"}
                    ]
                },
                {
                    "brandKey": "swiggy-in",
                    "brandName": "Swiggy",
                    "imageUrls": {"80w-mono": "https://upload.wikimedia.org/wikipedia/en/thumb/1/12/Swiggy_logo.svg/1200px-Swiggy_logo.svg.png"},
                    "items": [
                        {"utid": "swig-in-250", "rewardName": "Swiggy ₹250", "value": 250, "currencyCode": "INR"},
                        {"utid": "swig-in-500", "rewardName": "Swiggy ₹500", "value": 500, "currencyCode": "INR"}
                    ]
                },
                {
                    "brandKey": "starbucks-us",
                    "brandName": "Starbucks US",
                    "imageUrls": {"80w-mono": "https://upload.wikimedia.org/wikipedia/en/thumb/d/d3/Starbucks_Corporation_Logo_2011.svg/1200px-Starbucks_Corporation_Logo_2011.svg.png"},
                    "items": [
                        {"utid": "sbux-us-10", "rewardName": "Starbucks $10", "value": 10, "currencyCode": "USD"}
                    ]
                }
            ]
        }


# Factory
def get_aggregator_client() -> AggregatorClient:
    provider = getattr(settings, "aggregator_provider", "mock")
    if provider == "mock":
        return MockAggregatorClient()
    if provider == "tangocard":
        return TangoCardClient()
    # Add other providers here (e.g., XoxodayClient)
    return MockAggregatorClient()


class TangoCardClient(AggregatorClient):
    """Minimal Tango Card client implementation.

    This is a lightweight wrapper that calls Tango Card's order API. In production
    you should implement retries, idempotency, and error handling per provider docs.
    """

    def __init__(self):
        self.base = settings.tango_api_base.rstrip("/")
        self.api_key = settings.tango_api_key
        self.account_id = settings.tango_account_identifier
        if not self.api_key:
            raise RuntimeError("TANGO_API_KEY is not configured")

    def _auth_header(self):
        # Tango Card uses HTTP Basic auth where the username is the API key and password is empty
        token = base64.b64encode(f"{self.api_key}:".encode()).decode()
        return {"Authorization": f"Basic {token}", "Content-Type": "application/json"}

    def issue_voucher(
        self,
        tenant_id: uuid.UUID,
        vendor_code: str,
        amount: float,
        metadata: Dict[str, Any],
    ) -> Dict[str, Any]:
        # Construct a simple order payload — adapt fields to your Tango Card integration
        url = f"{self.base}/orders"
        payload = {
            "accountIdentifier": self.account_id,
            "recipient": {
                "email": metadata.get("email") or metadata.get("user_email"),
                "firstName": metadata.get("first_name"),
                "lastName": metadata.get("last_name"),
            },
            "reward": {"sku": vendor_code, "amount": float(amount)},
            "externalTransactionId": metadata.get("redemption_id"),
        }

        resp = requests.post(url, json=payload, headers=self._auth_header(), timeout=15)
        resp.raise_for_status()
        data = resp.json()

        # Normalize response to our expected shape
        return {
            "status": "success",
            "voucher_code": data.get("reward", {}).get("code")
            or data.get("reward", {}).get("pin"),
            "redeem_url": data.get("reward", {}).get("redeem_url"),
            "vendor_reference": data.get("id") or data.get("externalTransactionId"),
        }

    def check_balance(self, vendor_code: str) -> Dict[str, Any]:
        url = f"{self.base}/accounts/{self.account_id}/balance"
        resp = requests.get(url, headers=self._auth_header(), timeout=10)
        resp.raise_for_status()
        data = resp.json()
        return {"vendor_code": vendor_code, "current_balance": data.get("balance")}

    def get_catalog(self) -> Dict[str, Any]:
        url = f"{self.base}/catalogs"
        resp = requests.get(url, headers=self._auth_header(), timeout=15)
        resp.raise_for_status()
        return resp.json()
