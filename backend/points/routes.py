"""
API routes for points allocation and distribution.
Handles Platform Admin allocations and Tenant Manager distributions.
"""

from decimal import Decimal
from uuid import UUID

from auth.utils import get_current_user, get_platform_admin
from fastapi import APIRouter, Depends, HTTPException
from models import Tenant, User
from points.schemas import (
    AllocationRequest,
    AllocationResponse,
    AwardRequest,
    AwardResponse,
    ClawbackRequest,
    ClawbackResponse,
    DelegationRequest,
    DelegationResponse,
    TenantAllocationStatsResponse,
)
from points.service import PointsService
from points import ledger
from sqlalchemy.orm import Session

from database import get_db

router = APIRouter(prefix="/api/v1/points", tags=["points"])

# Include ledger routes
router.include_router(ledger.router, prefix="/ledger")


@router.post(
    "/allocate-to-tenant",
    response_model=AllocationResponse,
    dependencies=[Depends(get_platform_admin)],
)
async def allocate_points_to_tenant(
    allocation_req: AllocationRequest,
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db),
):
    """
    Platform Admin: Allocate points to a tenant's allocation pool.
    This increases tenant.budget_allocation_balance.
    
    Only Platform Admins can perform this action.
    """
    try:
        result = PointsService.allocateToTenant(
            db=db,
            tenant_id=allocation_req.tenant_id,
            admin_id=current_user.id,
            amount=Decimal(str(allocation_req.amount)),
            currency=allocation_req.currency,
            reference_note=allocation_req.reference_note,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/tenant-allocation-stats",
    response_model=TenantAllocationStatsResponse,
)
async def get_tenant_allocation_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get allocation stats for the current tenant's manager dashboard.
    Shows "Company Distribution Pool" balance.
    """
    try:
        tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        allocation_balance = Decimal(str(tenant.budget_allocation_balance))

        # Generate status message
        if allocation_balance == 0:
            message = "No budget available. Contact Platform Admin to allocate budget."
        elif allocation_balance < Decimal(100):
            message = f"Low allocation balance. Reach out to increase your distribution budget."
        else:
            message = f"Ready to distribute. You have {allocation_balance} budget available."

        return TenantAllocationStatsResponse(
            tenant_id=str(tenant.id),
            tenant_name=tenant.name,
            budget_allocation_balance=str(allocation_balance),
            currency=tenant.currency,
            currency_label=tenant.currency_label,
            status=tenant.status,
            message=message,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/delegate-to-lead",
    response_model=DelegationResponse,
)
async def delegate_points_to_lead(
    delegation_req: DelegationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Tenant Manager: Delegate points from allocation pool to a lead/department head.
    This transfers from tenant.points_allocation_balance to lead's lead_distribution_balance.
    """
    # Verify current user is a tenant manager
    if current_user.org_role not in ["tenant_manager", "hr_admin"]:
        raise HTTPException(
            status_code=403,
            detail="Only Tenant Managers can delegate points to leads",
        )

    try:
        result = PointsService.delegateToLead(
            db=db,
            tenant_id=current_user.tenant_id,
            lead_id=delegation_req.lead_id,
            amount=Decimal(str(delegation_req.amount)),
            delegation_note=delegation_req.delegation_note,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/award-to-user",
    response_model=AwardResponse,
)
async def award_points_to_user(
    award_req: AwardRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Tenant Manager/Lead: Award points to a user from allocation pool.
    This is the recognition action that adds points to user's wallet.
    
    Checks:
    - Tenant has sufficient points_allocation_balance
    - Both users exist in tenant
    """
    # Verify current user has right to distribute
    if current_user.org_role not in ["tenant_manager", "hr_admin", "tenant_lead", "manager"]:
        raise HTTPException(
            status_code=403,
            detail="You don't have permission to award points",
        )

    try:
        result = PointsService.awardToUser(
            db=db,
            tenant_id=current_user.tenant_id,
            from_user_id=current_user.id,
            to_user_id=award_req.to_user_id,
            amount=Decimal(str(award_req.amount)),
            recognition_message=award_req.recognition_message,
            recognition_id=award_req.recognition_id,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/clawback/{tenant_id}",
    response_model=ClawbackResponse,
    dependencies=[Depends(get_platform_admin)],
)
async def clawback_tenant_allocation(
    tenant_id: UUID,
    clawback_req: ClawbackRequest,
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db),
):
    """
    Platform Admin: Clawback/revoke all points from a tenant.
    Use case: Tenant subscription cancelled or needs penalty.
    Sets tenant.points_allocation_balance to 0.
    
    Only Platform Admins can perform this action.
    """
    try:
        result = PointsService.clawbackAllocation(
            db=db,
            tenant_id=tenant_id,
            admin_id=current_user.id,
            reason=clawback_req.reason,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
