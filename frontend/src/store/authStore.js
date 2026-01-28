import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      setAuth: (user, token) => {
        set({
          user,
          token,
          isAuthenticated: true,
        })
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        })
      },

      updateUser: (userData) => {
        set({
          user: { ...get().user, ...userData },
        })
      },

      isHRAdmin: () => {
        const { user } = get()
        return user?.role === 'hr_admin' || user?.role === 'platform_admin'
      },

      isManager: () => {
        const { user } = get()
        return ['manager', 'hr_admin', 'platform_admin'].includes(user?.role)
      },
    }),
    {
      name: 'perksu-auth',
    }
  )
)
