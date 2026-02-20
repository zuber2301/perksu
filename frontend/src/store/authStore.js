import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Role hierarchy (highest to lowest)
const ROLE_HIERARCHY = {
  platform_admin: 5,
  tenant_manager: 4,
  hr_admin: 3,
  dept_lead: 2,
  user: 1,
}

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      activeRole: null, // Track the currently active role

      setAuth: (user, token) => {
        // Extract the maximum role level the user has
        const userRoles = [user?.role, user?.org_role].filter(Boolean)
        const maxLevel = Math.max(...userRoles.map(r => ROLE_HIERARCHY[r] || 0))
        
        // Available roles are all roles in the hierarchy up to the user's maxLevel
        const availableRoles = Object.keys(ROLE_HIERARCHY)
          .filter(role => ROLE_HIERARCHY[role] <= maxLevel)
          .sort((a, b) => ROLE_HIERARCHY[b] - ROLE_HIERARCHY[a])

        // Default role is the highest one
        const defaultRole = availableRoles[0] || 'user'
        
        set({
          user: { ...user, availableRoles },
          token,
          isAuthenticated: true,
          activeRole: defaultRole,
        })
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          activeRole: null,
        })
      },

      updateUser: (userData) => {
        set({
          user: { ...get().user, ...userData },
        })
      },

      switchRole: (role) => {
        const { user } = get()
        if (user?.availableRoles?.includes(role)) {
          set({ activeRole: role })
        }
      },

      isHRAdmin: () => {
        const { activeRole } = get()
        return ['hr_admin', 'tenant_manager', 'platform_admin'].includes(activeRole)
      },

      isManager: () => {
        const { activeRole } = get()
        return ['dept_lead', 'hr_admin', 'tenant_manager', 'platform_admin'].includes(activeRole)
      },
    }),
    {
      name: 'perksu-auth',
    }
  )
)
