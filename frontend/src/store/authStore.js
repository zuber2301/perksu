import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Role hierarchy (highest to lowest)
const ROLE_HIERARCHY = {
  platform_admin: 4,
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
        // Extract all available roles from the user object
        const availableRoles = []
        if (user?.org_role) availableRoles.push(user.org_role)
        if (user?.role && user.role !== user.org_role) availableRoles.push(user.role)
        
        // Determine default role (highest in hierarchy)
        const defaultRole = availableRoles.sort((a, b) => 
          (ROLE_HIERARCHY[b] || 0) - (ROLE_HIERARCHY[a] || 0)
        )[0] || user?.org_role || user?.role
        
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
        return ['hr_admin', 'platform_admin'].includes(activeRole)
      },

      isManager: () => {
        const { activeRole } = get()
        return ['dept_lead', 'hr_admin', 'platform_admin'].includes(activeRole)
      },
    }),
    {
      name: 'perksu-auth',
    }
  )
)
