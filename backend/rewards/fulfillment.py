"""
Fulfillment engine for the unified rewards module.

Provides a clean GiftCardProvider Protocol so the `POST /api/rewards/redeem`
handler stays provider-agnostic. Choose the active provider via the
AGGREGATOR_PROVIDER env-var (mock | tangocard | xoxoday).
"""

from __future__ import annotations

import uuid
from typing import Any, Dict, Protocol, runtime_checkable

from config import settings


@runtime_checkable
class GiftCardProvider(Protocol):
    """Minimal interface every gift-card provider must implement."""

    def issue(
        self,
        provider_code: str,
        amount_points: int,
        recipient_email: str | None,
        metadata: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Issue a gift card.

        Returns a dict with at minimum:
            status: "success" | "failed"
            voucher_code: str | None
            redeem_url: str | None
            vendor_reference: str | None
            error: str | None   (present when status=="failed")
        """
        ...


# ──────────────────────────────────────────────────────────────────────
# Mock provider (default – no external calls)
# ──────────────────────────────────────────────────────────────────────

class MockGiftCardProvider:
    """Returns a deterministic fake code immediately. Use for dev/staging."""

    def issue(
        self,
        provider_code: str,
        amount_points: int,
        recipient_email: str | None,
        metadata: Dict[str, Any],
    ) -> Dict[str, Any]:
        import time
        code = f"MOCK-{provider_code.upper()[:6]}-{str(uuid.uuid4())[:8].upper()}"
        return {
            "status": "success",
            "voucher_code": code,
            "redeem_url": f"https://mock.perksu.dev/redeem?code={code}",
            "vendor_reference": str(uuid.uuid4()),
        }


# ──────────────────────────────────────────────────────────────────────
# Xoxoday provider
# ──────────────────────────────────────────────────────────────────────

class XoxodayGiftCardProvider:
    """Calls the Xoxoday catalog issue API.

    Required settings (env-vars):
        XOXODAY_API_KEY
        XOXODAY_API_BASE  (default: https://api.xoxoday.com)
    """

    def issue(
        self,
        provider_code: str,
        amount_points: int,
        recipient_email: str | None,
        metadata: Dict[str, Any],
    ) -> Dict[str, Any]:
        import requests

        api_key = getattr(settings, "xoxoday_api_key", "")
        api_base = getattr(settings, "xoxoday_api_base", "https://api.xoxoday.com").rstrip("/")

        if not api_key:
            return {"status": "failed", "error": "Xoxoday API key not configured", "voucher_code": None, "redeem_url": None, "vendor_reference": None}

        try:
            resp = requests.post(
                f"{api_base}/catalogs/{provider_code}/issue",
                json={
                    "amount": amount_points,
                    "recipient": {"email": recipient_email},
                    "client_reference_id": metadata.get("redemption_id"),
                },
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            return {
                "status": "success",
                "voucher_code": data.get("code") or data.get("voucher_code"),
                "redeem_url": data.get("redeem_url"),
                "vendor_reference": data.get("reference") or data.get("id"),
            }
        except Exception as exc:
            return {"status": "failed", "error": str(exc), "voucher_code": None, "redeem_url": None, "vendor_reference": None}


# ──────────────────────────────────────────────────────────────────────
# TangoCard / Rybbon provider
# ──────────────────────────────────────────────────────────────────────

class TangoCardGiftCardProvider:
    """Calls the TangoCard Order API (v2).

    Required settings:
        TANGO_API_KEY
        TANGO_ACCOUNT_IDENTIFIER
        TANGO_API_BASE  (default: https://api.tangocard.com/raas/v2)
    """

    def issue(
        self,
        provider_code: str,
        amount_points: int,
        recipient_email: str | None,
        metadata: Dict[str, Any],
    ) -> Dict[str, Any]:
        import base64
        import requests

        api_key = getattr(settings, "tango_api_key", "")
        account_id = getattr(settings, "tango_account_identifier", "")
        api_base = getattr(settings, "tango_api_base", "https://api.tangocard.com/raas/v2").rstrip("/")

        if not api_key:
            return {"status": "failed", "error": "TangoCard API key not configured", "voucher_code": None, "redeem_url": None, "vendor_reference": None}

        token = base64.b64encode(f"{api_key}:".encode()).decode()
        headers = {"Authorization": f"Basic {token}", "Content-Type": "application/json"}

        try:
            resp = requests.post(
                f"{api_base}/orders",
                json={
                    "accountIdentifier": account_id,
                    "recipient": {"email": recipient_email},
                    "reward": {"sku": provider_code, "amount": float(amount_points)},
                    "externalTransactionId": metadata.get("redemption_id"),
                },
                headers=headers,
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            reward = data.get("reward", {})
            return {
                "status": "success",
                "voucher_code": reward.get("code") or reward.get("pin"),
                "redeem_url": reward.get("redeem_url"),
                "vendor_reference": data.get("id") or data.get("externalTransactionId"),
            }
        except Exception as exc:
            return {"status": "failed", "error": str(exc), "voucher_code": None, "redeem_url": None, "vendor_reference": None}


# ──────────────────────────────────────────────────────────────────────
# Factory
# ──────────────────────────────────────────────────────────────────────

def get_gift_card_provider() -> GiftCardProvider:
    """Return the configured provider instance."""
    provider = getattr(settings, "aggregator_provider", "mock")
    if provider == "xoxoday":
        return XoxodayGiftCardProvider()
    if provider == "tangocard":
        return TangoCardGiftCardProvider()
    return MockGiftCardProvider()
