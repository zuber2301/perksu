"""
Dashboard API endpoints for Tenant Managers and Platform Admins
Provides consolidated view of points allocation and company metrics
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from starlette.responses import RedirectResponse
from sqlalchemy import and_, func, case, distinct
from sqlalchemy.orm import Session
from decimal import Decimal
import uuid

from database import get_db
from models import (
    Tenant, User, AllocationLog, Wallet, Recognition,
    LeadAllocation, Redemption, Department, Budget,
)
from auth.utils import get_current_user

router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])


def _get_spending_categories(db: Session, tenant_id: str) -> List[Dict[str, Any]]:
    """
    Get top spending categories by analyzing completed redemptions
    Groups by item_name (gift card name) to show spending patterns
    """
    try:
        # Query redemptions grouped by category
        redemption_query = db.query(
            Redemption.item_name.label('category'),
            func.sum(Redemption.point_cost).label('total_points'),
            func.count(Redemption.id).label('redemption_count'),
        ).filter(
            and_(
                Redemption.tenant_id == tenant_id,
                Redemption.status.in_(['COMPLETED', 'SHIPPED']),
            )
        ).group_by(
            Redemption.item_name
        ).order_by(
            func.sum(Redemption.point_cost).desc()
        ).limit(5).all()
        
        # If no redemptions, return empty list
        if not redemption_query:
            return []
        
        spending_data = []
        for row in redemption_query:
            spending_data.append({
                'category': row.category or 'Other',
                'amount': int(row.total_points or 0),
                'redemptions': int(row.redemption_count or 0),
            })
        
        return spending_data
    except Exception as e:
        # Return empty list if query fails
        print(f"Error fetching spending categories: {str(e)}")
        return []


@router.get("/summary")
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get comprehensive dashboard summary for Tenant Manager
    Returns: consolidated JSON with stats, leads, recognitions, and spending data
    
    Authorization: Only Tenant Managers can access their own tenant's data
    """
    
    # If the caller is a platform admin by role, redirect them to the tenants UI
    if getattr(current_user, 'role', None) == 'platform_admin':
        return RedirectResponse(url="http://localhost:7173/tenants", status_code=302)

    # Authorization: Ensure user is a Tenant Manager (or platform_admin org_role)
    if current_user.org_role not in ['tenant_manager', 'platform_admin']:
        raise HTTPException(
            status_code=403, 
            detail="Access denied. Only Tenant Managers can access dashboard."
        )

    # If the caller is a platform admin, redirect them to the tenants UI
    if current_user.org_role == 'platform_admin':
        return RedirectResponse(url="http://localhost:7173/tenants", status_code=302)
    
    # Get user's tenant
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Get all users in tenant
    tenant_users = db.query(User).filter(User.tenant_id == tenant.id).all()
    user_ids = [u.id for u in tenant_users]

    # Calculate statistics
    master_pool = float(tenant.budget_allocation_balance or 0)
    
    # Get all leads (managers with role LEAD or DEPARTMENT_LEAD)
    leads_query = db.query(
        User.id,
        User.first_name,
        User.last_name,
        Department.name.label('department_name'),
    ).outerjoin(
        Department, Department.id == User.department_id
    ).filter(
        and_(
            User.tenant_id == tenant.id,
            User.org_role.in_(['tenant_lead', 'manager'])
        )
    ).all()

    leads = []
    total_delegated = 0
    
    for lead in leads_query:
        try:
            # Get budget from LeadAllocation for this lead
            lead_allocation = db.query(
                func.sum(LeadAllocation.allocated_budget).label('allocated'),
                func.sum(LeadAllocation.spent_points).label('spent'),
            ).filter(
                and_(
                    LeadAllocation.lead_id == lead.id,
                    LeadAllocation.tenant_id == tenant.id
                )
            ).first()
            
            allocated = float(lead_allocation.allocated or 0) if lead_allocation else 0
            spent = float(lead_allocation.spent or 0) if lead_allocation else 0
            total_delegated += allocated
            
            leads.append({
                'id': str(lead.id),
                'name': f"{lead.first_name} {lead.last_name}",
                'department': lead.department_name or 'Unassigned',
                'budget': allocated,
                'used': spent,
            })
        except Exception as e:
            print(f"Error processing lead {lead.id}: {str(e)}")
            continue

    # Get total in wallets (current balance of all employee wallets)
    total_in_wallets = db.query(func.sum(Wallet.balance)).filter(
        Wallet.user_id.in_(user_ids)
    ).scalar() or 0
    total_in_wallets = float(total_in_wallets)

    # Active users count (excluding leads)
    active_users = db.query(func.count(User.id)).filter(
        and_(
            User.tenant_id == tenant.id,
            User.status == 'active',
            User.org_role == 'employee'
        )
    ).scalar() or 0

    # Get recent recognitions (last 10) with proper validation
    try:
        recent_recognitions = db.query(Recognition).filter(
            and_(
                Recognition.tenant_id == tenant.id,
                Recognition.status == 'active'
            )
        ).order_by(Recognition.created_at.desc()).limit(10).all()

        recognitions_data = []
        for rec in recent_recognitions:
            # Get user info safely
            given_by = db.query(User).filter(User.id == rec.from_user_id).first()
            received_by = db.query(User).filter(User.id == rec.to_user_id).first()
            
            given_by_name = f"{given_by.first_name} {given_by.last_name}" if given_by else 'Unknown'
            received_by_name = f"{received_by.first_name} {received_by.last_name}" if received_by else 'Unknown'
            
            recognitions_data.append({
                'id': str(rec.id),
                'given_by_name': given_by_name,
                'received_by_name': received_by_name,
                'message': rec.message or '',
                'points': int(rec.points or 0),
                'created_at': rec.created_at.isoformat() if rec.created_at else '',
                'tags': []  # Recognition model doesn't have tags field in current schema
            })
    except Exception as e:
        print(f"Error fetching recognitions: {str(e)}")
        recognitions_data = []

    # Get spending analytics (top 5 categories with real data)
    spending_data = _get_spending_categories(db, str(tenant.id))

    return {
        'success': True,
        'data': {
            'tenant_id': str(tenant.id),
            'tenant_name': tenant.name,
            'currency': tenant.currency or 'INR',
            'stats': {
                'master_pool': master_pool,
                'total_delegated': total_delegated,
                'total_in_wallets': total_in_wallets,
                'active_users_count': int(active_users),
            },
            'leads': leads,
            'recent_recognitions': recognitions_data,
            'spending_analytics': spending_data,
        }
    }


@router.post("/topup-request")
def submit_topup_request(
    request_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Submit a top-up request for additional points
    
    Body:
    {
        "amount": int,
        "urgency": "low|normal|high|urgent",
        "justification": string
    }
    
    Response: Creates notification for Platform Admin to review
    """
    # Authorization: Only Tenant Managers can request top-ups
    if current_user.org_role not in ['tenant_manager', 'platform_admin']:
        raise HTTPException(
            status_code=403, 
            detail="Access denied. Only Tenant Managers can submit top-up requests."
        )
    
    try:
        # Validate request data
        amount = request_data.get('amount')
        urgency = request_data.get('urgency', 'normal')
        justification = request_data.get('justification', '')
        
        if not amount or amount <= 0:
            raise HTTPException(status_code=400, detail="Invalid amount specified")
        
        if urgency not in ['low', 'normal', 'high', 'urgent']:
            raise HTTPException(status_code=400, detail="Invalid urgency level")
        
        # Get tenant
        tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
        
        # Create request ID
        request_id = str(uuid.uuid4())
        
        # TODO: Create notification for Platform Admin
        # This would integrate with your notification system
        # Example:
        # notification = Notification(
        #     user_id=platform_admin_id,
        #     type='topup_request',
        #     title=f"{tenant.name} requested {amount} points",
        #     data={'amount': amount, 'urgency': urgency, 'justification': justification},
        #     reference_id=request_id,
        # )
        # db.add(notification)
        # db.commit()
        
        return {
            'success': True,
            'message': f'Top-up request for {amount} points submitted successfully',
            'request_id': request_id,
            'urgency': urgency,
            'status': 'pending_review'
        }
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Error submitting request: {str(err)}")


@router.get("/variant")
def get_dashboard_variant(
    current_user: User = Depends(get_current_user),
):
    """
    Determine which dashboard variant the frontend should render for the
    authenticated user. Returns a small JSON payload describing the variant
    and an optional recommended client-side redirect path.

    Mapping rules:
    - `platform_admin` -> variant `tenants` (redirect `/tenants`)
    - `tenant_manager` -> variant `manager` (redirect `/dashboard`)
    - `manager` / `tenant_lead` -> variant `lead` (redirect `/dashboard`)
    - others -> variant `default` (redirect `/tenants`)
    """
    role = getattr(current_user, "role", None)
    org_role = getattr(current_user, "org_role", None)

    if role == "platform_admin" or org_role == "platform_admin":
        return {"variant": "tenants", "redirect": "/tenants"}

    if role == "tenant_manager" or org_role == "tenant_manager":
        return {"variant": "manager", "redirect": "/dashboard"}

    if role == "manager" or org_role in ("tenant_lead", "manager"):
        return {"variant": "lead", "redirect": "/dashboard"}

    return {"variant": "default", "redirect": "/tenants"}


@router.get("/export-report/{tenant_id}")
def export_monthly_report(
    tenant_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Export monthly transaction report as CSV
    Only accessible by Tenant Manager of the specified tenant
    
    Response: CSV content with allocation and recognition transactions
    """
    # Authorization: Tenant Manager can only export their own tenant's data
    if str(current_user.tenant_id) != tenant_id:
        if current_user.org_role != 'platform_admin':  # Platform admin can see all
            raise HTTPException(status_code=403, detail="Access denied")

    # Verify tenant exists
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    try:
        # Get current month range
        now = datetime.utcnow()
        month_start = datetime(now.year, now.month, 1)
        
        # Query allocation logs for this month
        allocation_logs = db.query(AllocationLog).filter(
            and_(
                AllocationLog.tenant_id == tenant_id,
                AllocationLog.created_at >= month_start
            )
        ).order_by(AllocationLog.created_at.desc()).all()

        # Query recognitions for this month
        recognitions = db.query(Recognition).filter(
            and_(
                Recognition.tenant_id == tenant_id,
                Recognition.created_at >= month_start,
                Recognition.status == 'active'
            )
        ).order_by(Recognition.created_at.desc()).all()

        # Generate CSV header
        csv_content = "Date,Type,Reference,Amount,Points,Status\n"
        
        # Add allocation logs
        for log in allocation_logs:
            csv_content += f"{log.created_at.date()},Allocation,\"{log.reference_note or 'Platform allocation'}\",{log.amount},N/A,{log.status}\n"
        
        # Add recognition records
        for rec in recognitions:
            given_by = db.query(User).filter(User.id == rec.from_user_id).first()
            received_by = db.query(User).filter(User.id == rec.to_user_id).first()
            given_by_name = f"{given_by.first_name} {given_by.last_name}" if given_by else 'Unknown'
            received_by_name = f"{received_by.first_name} {received_by.last_name}" if received_by else 'Unknown'
            
            csv_content += f"{rec.created_at.date()},Recognition,\"{given_by_name} → {received_by_name}\",N/A,{rec.points},{rec.status}\n"

        return {
            'success': True,
            'csv': csv_content,
            'filename': f"report-{tenant.name}-{now.strftime('%Y-%m-%d')}.csv"
        }
    except Exception as err:
        raise HTTPException(
            status_code=500, 
            detail=f"Error generating report: {str(err)}"
        )
