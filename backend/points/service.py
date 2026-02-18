"""
Points allocation and distribution service.
Handles the allocation of points from Platform Admin -> Tenant Manager -> User
"""

from decimal import Decimal
from typing import Optional
from uuid import UUID

from models import (
    AllocationLog,
    PlatformBillingLog,
    Recognition,
    Tenant,
    User,
    Wallet,
    WalletLedger,
)
from sqlalchemy.orm import Session


class PointsService:
    """Service for managing point allocation and distribution"""

    @staticmethod
    def allocateToTenant(
        db: Session,
        tenant_id: UUID,
        admin_id: UUID,
        amount: Decimal,
        currency: str = "INR",
        reference_note: Optional[str] = None,
    ) -> dict:
        """
        Allocate points from Platform Admin to Tenant's allocation pool.
        
        This increases the tenant's points_allocation_balance, creating a "Company Distribution Pool"
        that the Tenant Manager can draw from.

        Args:
            db: Database session
            tenant_id: The tenant receiving the allocation
            admin_id: The platform admin performing the allocation
            amount: Number of points to allocate
            currency: Currency code (default: INR)
            reference_note: Reference note for audit trail (e.g., "Monthly subscription - Invoice #8842")

        Returns:
            dict with transaction details

        Raises:
            ValueError: If tenant not found or amount is invalid
        """
        # Validate tenant exists
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            raise ValueError(f"Tenant {tenant_id} not found")

        if amount <= 0:
            raise ValueError("Allocation amount must be positive")

        try:
            # Step 1: Increase tenant's allocation pool
            # We sync both master_budget_balance and budget_allocation_balance
            # and track the lifetime total in allocated_budget
            tenant.budget_allocation_balance = (tenant.budget_allocation_balance or 0) + amount
            tenant.master_budget_balance = (tenant.master_budget_balance or 0) + amount
            tenant.allocated_budget = (tenant.allocated_budget or 0) + amount
            db.add(tenant)

            # Step 2: Create allocation log (for tenant-level audit)
            allocation_log = AllocationLog(
                tenant_id=tenant_id,
                allocated_by=admin_id,
                amount=amount,
                currency=currency,
                reference_note=reference_note,
                status="COMPLETED",
            )
            db.add(allocation_log)

            # Step 3: Create platform billing log (for platform-level audit)
            platform_log = PlatformBillingLog(
                admin_id=admin_id,
                tenant_id=tenant_id,
                amount=amount,
                currency=currency,
                reference_note=reference_note or f"Credit allocation to {tenant.name}",
                transaction_type="CREDIT_INJECTION",
            )
            db.add(platform_log)

            db.commit()

            return {
                "success": True,
                "tenant_id": str(tenant_id),
                "amount_allocated": str(amount),
                "new_allocation_balance": str(tenant.budget_allocation_balance),
                "currency": currency,
                "allocation_log_id": str(allocation_log.id),
                "platform_log_id": str(platform_log.id),
            }
        except Exception as e:
            db.rollback()
            raise Exception(f"Failed to allocate points to tenant: {str(e)}")

    @staticmethod
    def delegateToLead(
        db: Session,
        tenant_id: UUID,
        lead_id: UUID,
        amount: Decimal,
        delegation_note: Optional[str] = None,
    ) -> dict:
        """
        Delegate points from Tenant Manager to Lead/Department Head.
        This transfers from tenant.points_allocation_balance to a lead's lead_distribution_balance.

        Args:
            db: Database session
            tenant_id: The tenant performing delegation
            lead_id: The lead receiving delegation
            amount: Number of points to delegate
            delegation_note: Optional note for audit trail

        Returns:
            dict with delegation details

        Raises:
            ValueError: If validation fails
        """
        # Validate tenant exists
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            raise ValueError(f"Tenant {tenant_id} not found")

        # Validate lead exists and belongs to tenant
        lead = (
            db.query(User)
            .filter(User.id == lead_id, User.tenant_id == tenant_id)
            .first()
        )
        if not lead:
            raise ValueError(f"Lead {lead_id} not found in tenant {tenant_id}")

        if amount <= 0:
            raise ValueError("Delegation amount must be positive")

        if tenant.budget_allocation_balance < amount:
            raise ValueError(
                f"Insufficient allocation balance. Available: {tenant.budget_allocation_balance}, Required: {amount}"
            )

        try:
            # Deduct from tenant pool
            tenant.budget_allocation_balance -= amount
            tenant.master_budget_balance = (tenant.master_budget_balance or 0) - amount

            # Add to lead's lead_distribution_balance (new field to add to User model)
            if not hasattr(lead, "lead_distribution_balance"):
                lead.lead_distribution_balance = Decimal(0)
            lead.lead_distribution_balance = (
                (lead.lead_distribution_balance or Decimal(0)) + amount
            )

            db.add(tenant)
            db.add(lead)
            db.commit()

            return {
                "success": True,
                "tenant_id": str(tenant_id),
                "lead_id": str(lead_id),
                "amount_delegated": str(amount),
                "lead_new_balance": str(lead.lead_distribution_balance),
                "tenant_remaining_balance": str(tenant.budget_allocation_balance),
                "note": delegation_note,
            }
        except Exception as e:
            db.rollback()
            raise Exception(f"Failed to delegate points to lead: {str(e)}")

    @staticmethod
    def awardToUser(
        db: Session,
        tenant_id: UUID,
        from_user_id: UUID,
        to_user_id: UUID,
        amount: Decimal,
        recognition_message: str,
        recognition_id: Optional[UUID] = None,
    ) -> dict:
        """
        Award points to a user from the allocation pool.
        This transfers from tenant.points_allocation_balance to user.wallet.balance.

        Args:
            db: Database session
            tenant_id: The tenant performing the award
            from_user_id: User giving the recognition
            to_user_id: User receiving the points
            amount: Number of points to award
            recognition_message: Message for the recognition
            recognition_id: Optional ID of related recognition record

        Returns:
            dict with award details

        Raises:
            ValueError: If validation fails
        """
        # Validate tenant exists and has sufficient balance
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            raise ValueError(f"Tenant {tenant_id} not found")

        if tenant.budget_allocation_balance < amount:
            raise ValueError(
                f"Insufficient allocation pool. Available: {tenant.budget_allocation_balance}, Required: {amount}"
            )

        # Validate users exist and belong to tenant
        from_user = (
            db.query(User)
            .filter(User.id == from_user_id, User.tenant_id == tenant_id)
            .first()
        )
        if not from_user:
            raise ValueError(f"From user {from_user_id} not found in tenant {tenant_id}")

        to_user = (
            db.query(User)
            .filter(User.id == to_user_id, User.tenant_id == tenant_id)
            .first()
        )
        if not to_user:
            raise ValueError(f"To user {to_user_id} not found in tenant {tenant_id}")

        if amount <= 0:
            raise ValueError("Award amount must be positive")

        try:
            # Step 1: Deduct from tenant's allocation pool
            tenant.budget_allocation_balance -= amount
            tenant.master_budget_balance = (tenant.master_budget_balance or 0) - amount

            # Step 2: Get or create recipient's wallet
            wallet = (
                db.query(Wallet)
                .filter(Wallet.user_id == to_user_id)
                .first()
            )
            if not wallet:
                wallet = Wallet(
                    tenant_id=tenant_id,
                    user_id=to_user_id,
                    balance=Decimal(0),
                    lifetime_earned=Decimal(0),
                    lifetime_spent=Decimal(0),
                )
                db.add(wallet)

            # Step 3: Add points to wallet
            wallet.balance += amount
            wallet.lifetime_earned += amount

            # Step 4: Create wallet ledger entry
            ledger_entry = WalletLedger(
                tenant_id=tenant_id,
                wallet_id=wallet.id,
                transaction_type="credit",
                source="recognition",
                points=amount,
                balance_after=wallet.balance,
                reference_type="recognition",
                reference_id=recognition_id,
                description=f"Recognition from {from_user.full_name}: {recognition_message}",
                created_by=from_user_id,
            )
            db.add(ledger_entry)

            # Step 5: Update recognition record if provided
            if recognition_id:
                recognition = (
                    db.query(Recognition)
                    .filter(Recognition.id == recognition_id)
                    .first()
                )
                if recognition:
                    recognition.status = "active"

            db.add(tenant)
            db.commit()

            return {
                "success": True,
                "tenant_id": str(tenant_id),
                "to_user_id": str(to_user_id),
                "amount_awarded": str(amount),
                "recipient_new_wallet_balance": str(wallet.balance),
                "tenant_remaining_pool": str(tenant.budget_allocation_balance),
                "ledger_entry_id": str(ledger_entry.id),
            }
        except Exception as e:
            db.rollback()
            raise Exception(f"Failed to award points to user: {str(e)}")

    @staticmethod
    def clawbackAllocation(
        db: Session,
        tenant_id: UUID,
        admin_id: UUID,
        reason: Optional[str] = None,
    ) -> dict:
        """
        Clawback/revoke all points from a tenant (e.g., if subscription is cancelled).
        Sets tenant.points_allocation_balance to 0.

        Args:
            db: Database session
            tenant_id: The tenant to clawback points from
            admin_id: The platform admin performing the clawback
            reason: Reason for clawback (e.g., "Subscription cancelled")

        Returns:
            dict with clawback details

        Raises:
            ValueError: If tenant not found
        """
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            raise ValueError(f"Tenant {tenant_id} not found")

        previous_balance = tenant.budget_allocation_balance

        try:
            # Reset allocation balance to zero
            tenant.budget_allocation_balance = Decimal(0)
            tenant.master_budget_balance = Decimal(0)

            # Create platform billing log for clawback
            platform_log = PlatformBillingLog(
                admin_id=admin_id,
                tenant_id=tenant_id,
                amount=previous_balance,
                currency="INR",
                reference_note=reason or "Points clawback",
                transaction_type="CLAWBACK",
            )
            db.add(platform_log)
            db.add(tenant)
            db.commit()

            return {
                "success": True,
                "tenant_id": str(tenant_id),
                "amount_clawed_back": str(previous_balance),
                "new_balance": str(tenant.budget_allocation_balance),
                "platform_log_id": str(platform_log.id),
                "reason": reason,
            }
        except Exception as e:
            db.rollback()
            raise Exception(f"Failed to clawback allocation: {str(e)}")
