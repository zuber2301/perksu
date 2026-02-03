"""
Tenant Resolution & Context Utilities
Handles the critical "hard link" between Users and Tenants
"""

from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from config import settings
from fastapi import HTTPException, status
from jose import jwt
from models import Tenant
from sqlalchemy.orm import Session


class TenantResolver:
    """Resolves tenant_id for users during onboarding"""

    @staticmethod
    def resolve_from_email_domain(email: str, db: Session) -> Optional[UUID]:
        """
        Domain-Match Auto-Onboarding (A)
        Looks for tenant with matching domain_whitelist entry.

        Example: john@triton.com -> finds tenant with @triton.com in domain_whitelist
        """
        if not email or "@" not in email:
            return None

        # Extract domain from email
        domain = f"@{email.split('@')[1]}"

        # Query tenants with this domain in their whitelist
        tenant = (
            db.query(Tenant)
            .filter(
                Tenant.status == "ACTIVE",
                # PostgreSQL specific: check if domain is in the array
                Tenant.domain_whitelist.contains([domain]),
            )
            .first()
        )

        return tenant.id if tenant else None

    @staticmethod
    def resolve_from_invite_token(token: str, db: Session) -> Optional[UUID]:
        """
        Invite-Link Method (B)
        Decodes secure token to extract tenant_id.

        Example: /signup?invite_token=eyJ0eXAiOiJKV1QiLCJhbGc...
        Token payload: {"tenant_id": "uuid", "exp": timestamp}
        """
        try:
            payload = jwt.decode(
                token, settings.secret_key, algorithms=[settings.algorithm]
            )
            tenant_id = payload.get("tenant_id")

            if not tenant_id:
                return None

            tenant_uuid = UUID(tenant_id)

            # Verify tenant exists and is active
            tenant = (
                db.query(Tenant)
                .filter(Tenant.id == tenant_uuid, Tenant.status == "ACTIVE")
                .first()
            )

            return tenant.id if tenant else None

        except Exception:
            return None

    @staticmethod
    def create_invite_token(tenant_id: UUID, expires_in_hours: int = 7 * 24) -> str:
        """
        Generate a secure invite token with embedded tenant_id.
        Default expiry: 7 days (168 hours)
        """
        expiry = datetime.utcnow() + timedelta(hours=expires_in_hours)
        payload = {"tenant_id": str(tenant_id), "exp": expiry, "type": "invite"}
        token = jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)
        return token

    @staticmethod
    def resolve_tenant(
        email: Optional[str] = None,
        invite_token: Optional[str] = None,
        explicit_tenant_id: Optional[UUID] = None,
        db: Optional[Session] = None,
    ) -> Optional[UUID]:
        """
        Main resolver that tries multiple methods in order:
        1. Explicit tenant_id (if provided by admin)
        2. Invite token (if provided during signup)
        3. Domain-match auto-onboarding (if email provided)

        Returns: tenant_id (UUID) or None if no matching tenant found
        """
        # Method 1: Explicit assignment (for admin provisioning)
        if explicit_tenant_id and db:
            tenant = (
                db.query(Tenant)
                .filter(Tenant.id == explicit_tenant_id, Tenant.status == "ACTIVE")
                .first()
            )
            if tenant:
                return tenant.id

        # Method 2: Invite token
        if invite_token and db:
            tenant_id = TenantResolver.resolve_from_invite_token(invite_token, db)
            if tenant_id:
                return tenant_id

        # Method 3: Email domain matching
        if email and db:
            tenant_id = TenantResolver.resolve_from_email_domain(email, db)
            if tenant_id:
                return tenant_id

        return None


class TenantContext:
    """
    Thread-local storage for tenant context during request processing.
    Allows middleware and services to know the current tenant without passing it everywhere.
    """

    import threading

    _context = threading.local()

    @classmethod
    def set(cls, tenant_id: UUID, global_access: bool = False):
        """Set the current tenant context"""
        cls._context.tenant_id = tenant_id
        cls._context.global_access = global_access

    @classmethod
    def get_tenant_id(cls) -> Optional[UUID]:
        """Get the current tenant_id from context"""
        return getattr(cls._context, "tenant_id", None)

    @classmethod
    def has_global_access(cls) -> bool:
        """Check if current user has global (platform admin) access"""
        return getattr(cls._context, "global_access", False)

    @classmethod
    def clear(cls):
        """Clear the tenant context"""
        if hasattr(cls._context, "tenant_id"):
            delattr(cls._context, "tenant_id")
        if hasattr(cls._context, "global_access"):
            delattr(cls._context, "global_access")


class TenantFilter:
    """
    Global filter helper for queries.
    Ensures all queries are tenant-scoped unless user has global access.
    """

    @staticmethod
    def apply_tenant_filter(
        query, model_class, user_tenant_id: UUID, has_global_access: bool = False
    ):
        """
        Apply tenant filter to a query.

        Usage:
            query = db.query(User)
            query = TenantFilter.apply_tenant_filter(query, User, current_user.tenant_id)
            users = query.all()
        """
        if not has_global_access and hasattr(model_class, "tenant_id"):
            query = query.filter(model_class.tenant_id == user_tenant_id)

        return query

    @staticmethod
    def ensure_tenant_isolation(user_tenant_id: UUID, query_tenant_id: UUID):
        """
        Verify that a user trying to access a resource belongs to the same tenant.
        Raises HTTPException if tenant isolation is violated.
        """
        if user_tenant_id != query_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Tenant isolation violation",
            )
