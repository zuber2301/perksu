from typing import Optional
from uuid import UUID
from contextvars import ContextVar

# Context variables for multi-tenancy
tenant_id_var: ContextVar[Optional[UUID]] = ContextVar("tenant_id", default=None)
global_access_var: ContextVar[bool] = ContextVar("global_access", default=False)

class TenantContext:
    @staticmethod
    def set(tenant_id: Optional[UUID] = None, global_access: bool = False):
        tenant_id_var.set(tenant_id)
        global_access_var.set(global_access)

    @staticmethod
    def get_tenant_id() -> Optional[UUID]:
        return tenant_id_var.get()

    @staticmethod
    def is_global() -> bool:
        return global_access_var.get()
