from datetime import datetime
from decimal import Decimal

from celery_app import celery_app
from models import Redemption, RedemptionLedger, Wallet, WalletLedger
from redemption.aggregator import get_aggregator_client

from database import SessionLocal


@celery_app.task(bind=True, name="redemption.issue_voucher")
def issue_voucher_task(self, redemption_id: str):
    """Background task to call aggregator and update redemption status."""
    db = SessionLocal()
    try:
        redemption = db.query(Redemption).filter(Redemption.id == redemption_id).first()
        if not redemption:
            return {"error": "redemption_not_found"}

        client = get_aggregator_client()
        metadata = {
            "redemption_id": str(redemption.id),
            "user_id": str(redemption.user_id),
            "email": (redemption.delivery_details or {}).get("email"),
        }

        resp = client.issue_voucher(
            tenant_id=redemption.tenant_id,
            vendor_code=redemption.item_name,
            amount=float(redemption.point_cost),
            metadata=metadata,
        )

        if resp.get("status") == "success":
            redemption.voucher_code = resp.get("voucher_code")
            redemption.delivery_details = redemption.delivery_details or {}
            redemption.delivery_details.update(
                {
                    "redeem_url": resp.get("redeem_url"),
                    "vendor_reference": resp.get("vendor_reference"),
                }
            )
            old_status = redemption.status
            redemption.status = "COMPLETED"
            redemption.processed_at = datetime.utcnow()

            ledger = RedemptionLedger(
                redemption_id=redemption.id,
                tenant_id=redemption.tenant_id,
                user_id=redemption.user_id,
                action="COMPLETED",
                status_before=old_status,
                status_after="COMPLETED",
            )
            db.add(ledger)
            db.commit()

            # Send reward email to user if email exists
            try:
                from notifications.email_service import send_reward_email
                user = db.query(User).filter(User.id == redemption.user_id).first()
                if user and user.personal_email:
                    send_reward_email(user.personal_email, redemption.voucher_code, redemption.delivery_details.get("redeem_url"))
            except Exception as e:
                print(f"[WARNING] Failed to send reward email: {e}")

            return {"status": "completed", "voucher_code": redemption.voucher_code}
        else:
            # REFUND Logic for Atomic Transaction
            redemption.status = "FAILED"
            redemption.failed_reason = f"Aggregator error: {resp}"
            db.add(redemption)
            
            # Refund points to user wallet
            wallet = db.query(Wallet).filter(Wallet.user_id == redemption.user_id).first()
            if wallet:
                wallet.balance += redemption.point_cost
                wallet.lifetime_spent -= redemption.point_cost
                
                # Log reversal
                reversal = WalletLedger(
                    tenant_id=redemption.tenant_id,
                    wallet_id=wallet.id,
                    transaction_type="credit",
                    source="reversal",
                    points=Decimal(redemption.point_cost),
                    balance_after=wallet.balance,
                    reference_type="Redemption",
                    reference_id=redemption.id,
                    description=f"Refund for failed redemption: {redemption.item_name}",
                )
                db.add(reversal)

            ledger = RedemptionLedger(
                redemption_id=redemption.id,
                tenant_id=redemption.tenant_id,
                user_id=redemption.user_id,
                action="FAILED",
                status_before="PROCESSING",
                status_after="FAILED",
            )
            db.add(ledger)
            db.commit()
            return {"status": "failed", "error": resp}
    except Exception as e:
        # Celery will record the failure; also mark redemption as failed and refund
        try:
            redemption = (
                db.query(Redemption).filter(Redemption.id == redemption_id).first()
            )
            if redemption and redemption.status != "FAILED":
                redemption.status = "FAILED"
                redemption.failed_reason = str(e)
                db.add(redemption)
                
                # Refund points
                wallet = db.query(Wallet).filter(Wallet.user_id == redemption.user_id).first()
                if wallet:
                    wallet.balance += redemption.point_cost
                    wallet.lifetime_spent -= redemption.point_cost
                    reversal = WalletLedger(
                        tenant_id=redemption.tenant_id,
                        wallet_id=wallet.id,
                        transaction_type="credit",
                        source="reversal",
                        points=Decimal(redemption.point_cost),
                        balance_after=wallet.balance,
                        reference_type="Redemption",
                        reference_id=redemption.id,
                        description=f"Refund for failed redemption (error): {redemption.item_name}",
                    )
                    db.add(reversal)

                ledger = RedemptionLedger(
                    redemption_id=redemption.id,
                    tenant_id=redemption.tenant_id,
                    user_id=redemption.user_id,
                    action="FAILED",
                    status_before="PROCESSING",
                    status_after="FAILED",
                )
                db.add(ledger)
                db.commit()
        except Exception:
            pass
        raise
    finally:
        db.close()
