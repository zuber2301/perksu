from celery_app import celery_app
from redemption.aggregator import get_aggregator_client
from database import SessionLocal
from models import Redemption, RedemptionLedger
from datetime import datetime


@celery_app.task(bind=True, name='redemption.issue_voucher')
def issue_voucher_task(self, redemption_id: str):
    """Background task to call aggregator and update redemption status."""
    db = SessionLocal()
    try:
        redemption = db.query(Redemption).filter(Redemption.id == redemption_id).first()
        if not redemption:
            return {'error': 'redemption_not_found'}

        client = get_aggregator_client()
        metadata = {
            'redemption_id': str(redemption.id),
            'user_id': str(redemption.user_id),
            'email': (redemption.delivery_details or {}).get('email')
        }

        resp = client.issue_voucher(
            tenant_id=redemption.tenant_id,
            vendor_code=redemption.item_name,
            amount=float(redemption.point_cost),
            metadata=metadata
        )

        if resp.get('status') == 'success':
            redemption.voucher_code = resp.get('voucher_code')
            redemption.delivery_details = (redemption.delivery_details or {})
            redemption.delivery_details.update({
                'redeem_url': resp.get('redeem_url'),
                'vendor_reference': resp.get('vendor_reference')
            })
            old_status = redemption.status
            redemption.status = 'COMPLETED'
            redemption.processed_at = datetime.utcnow()

            ledger = RedemptionLedger(
                redemption_id=redemption.id,
                tenant_id=redemption.tenant_id,
                user_id=redemption.user_id,
                action='COMPLETED',
                status_before=old_status,
                status_after='COMPLETED'
            )
            db.add(ledger)
            db.commit()
            return {'status': 'completed', 'voucher_code': redemption.voucher_code}
        else:
            redemption.status = 'FAILED'
            redemption.failed_reason = str(resp)
            db.add(redemption)
            ledger = RedemptionLedger(
                redemption_id=redemption.id,
                tenant_id=redemption.tenant_id,
                user_id=redemption.user_id,
                action='FAILED',
                status_before=redemption.status,
                status_after='FAILED'
            )
            db.add(ledger)
            db.commit()
            return {'status': 'failed', 'error': resp}
    except Exception as e:
        # Celery will record the failure; also mark redemption as failed
        try:
            redemption = db.query(Redemption).filter(Redemption.id == redemption_id).first()
            if redemption:
                redemption.status = 'FAILED'
                redemption.failed_reason = str(e)
                db.add(redemption)
                ledger = RedemptionLedger(
                    redemption_id=redemption.id,
                    tenant_id=redemption.tenant_id,
                    user_id=redemption.user_id,
                    action='FAILED',
                    status_before=redemption.status,
                    status_after='FAILED'
                )
                db.add(ledger)
                db.commit()
        except Exception:
            pass
        raise
    finally:
        db.close()
