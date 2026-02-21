import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import axios from 'axios'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { 
  HiOutlineMail, 
  HiOutlineKey, 
  HiOutlineUser, 
  HiOutlineEye, 
  HiOutlineEyeOff, 
  HiOutlineArrowRight,
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
  HiOutlineArrowLeft
} from 'react-icons/hi'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: `${API_URL}/api`,
})

export default function SignUp() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    personal_email: '',
    mobile_phone: '',
  })

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [inviteToken, setInviteToken] = useState('')
  const [tenantInfo, setTenantInfo] = useState(null)
  const [step, setStep] = useState('form') // 'form', 'loading', 'success', 'error'
  const [errors, setErrors] = useState({})

  // Extract invite token from URL
  useEffect(() => {
    const token = searchParams.get('invite_token')
    if (token) {
      setInviteToken(token)
      // Optionally: Decode token to show tenant info
      decodeInviteToken(token)
    }
  }, [searchParams])

  // Decode JWT to show tenant info
  const decodeInviteToken = (token) => {
    try {
      const parts = token.split('.')
      if (parts.length !== 3) return
      
      const decoded = JSON.parse(atob(parts[1]))
      // Token contains tenant_id and exp
      if (decoded.tenant_id) {
        setTenantInfo({
          tenant_id: decoded.tenant_id,
          expires: new Date(decoded.exp * 1000),
          isExpired: new Date(decoded.exp * 1000) < new Date()
        })
      }
    } catch (err) {
      console.log('Could not decode token:', err)
    }
  }

  // Validation
  const validateForm = () => {
    const newErrors = {}

    if (!formData.email) newErrors.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email'
    }

    if (!formData.first_name) newErrors.first_name = 'First name is required'
    if (!formData.last_name) newErrors.last_name = 'Last name is required'

    if (!formData.password) newErrors.password = 'Password is required'
    else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
    }

    if (!formData.confirmPassword) newErrors.confirmPassword = 'Please confirm password'
    else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    if (formData.mobile_phone && !/^[\d\s\-\+\(\)]{7,}$/.test(formData.mobile_phone)) {
      newErrors.mobile_phone = 'Please enter a valid phone number'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Sign-up mutation
  const signUpMutation = useMutation({
    mutationFn: (data) => api.post('/auth/signup', data),
    onSuccess: (response) => {
      const { access_token, user } = response
      setAuth(user, access_token)
      setStep('success')
      
      // Redirect after 2 seconds
      setTimeout(() => {
        if (user?.role === 'platform_admin') {
          navigate('/tenants')
        } else {
          navigate('/dashboard')
        }
      }, 2000)
    },
    onError: (error) => {
      const message = error.response?.data?.detail || 'Sign-up failed'
      setErrors({ submit: message })
      setStep('error')
      toast.error(message)
    },
  })

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setStep('loading')
    
    const submitData = {
      email: formData.email,
      password: formData.password,
      first_name: formData.first_name,
      last_name: formData.last_name,
      personal_email: formData.personal_email || undefined,
      mobile_phone: formData.mobile_phone || undefined,
    }

    if (inviteToken) {
      submitData.invite_token = inviteToken
    }

    signUpMutation.mutate(submitData)
  }

  const handleBackToLogin = () => {
    navigate('/login')
  }

  // Render: Loading state
  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <div className="animate-spin mb-4">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100">
              <div className="h-8 w-8 border-4 border-indigo-300 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Creating your account...</h2>
          <p className="text-gray-600">Please wait while we set everything up</p>
        </div>
      </div>
    )
  }

  // Render: Success state
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <div className="mb-4 flex justify-center">
            <HiOutlineCheckCircle className="h-16 w-16 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome!</h2>
          <p className="text-gray-600 mb-4">Your account has been created successfully.</p>
          <p className="text-sm text-gray-500">Redirecting to dashboard...</p>
        </div>
      </div>
    )
  }

  // Render: Error state
  if (step === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="mb-4 flex justify-center">
            <HiOutlineExclamationCircle className="h-12 w-12 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2 text-center">Sign-up Failed</h2>
          <p className="text-red-600 text-center mb-6">{errors.submit}</p>
          <button
            onClick={() => setStep('form')}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            Try Again
          </button>
          <button
            onClick={handleBackToLogin}
            className="w-full mt-2 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Back to Login
          </button>
        </div>
      </div>
    )
  }

  // Render: Form state
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Join Perksu</h1>
          <p className="text-gray-600">Create your account to get started</p>
        </div>

        {/* Invite Token Info */}
        {inviteToken && tenantInfo && !tenantInfo.isExpired && (
          <div className="mb-6 bg-green-50 border-l-4 border-green-500 p-4 rounded">
            <p className="text-green-800 text-sm">
              <span className="font-semibold">✓ Invite link detected</span>
              <br />
              You'll be automatically joined to your organization
            </p>
          </div>
        )}

        {/* Expired Token Warning */}
        {tenantInfo && tenantInfo.isExpired && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded">
            <p className="text-red-800 text-sm">
              <span className="font-semibold">⚠ Invite link expired</span>
              <br />
              Please ask your administrator for a new invite link
            </p>
          </div>
        )}

        {/* Sign-up Form */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <div className="relative">
                <HiOutlineMail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="you@company.com"
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.email ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
              </div>
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">{errors.email}</p>
              )}
            </div>

            {/* First Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name
              </label>
              <div className="relative">
                <HiOutlineUser className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  placeholder="John"
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.first_name ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
              </div>
              {errors.first_name && (
                <p className="text-red-500 text-xs mt-1">{errors.first_name}</p>
              )}
            </div>

            {/* Last Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name
              </label>
              <div className="relative">
                <HiOutlineUser className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  placeholder="Doe"
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.last_name ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
              </div>
              {errors.last_name && (
                <p className="text-red-500 text-xs mt-1">{errors.last_name}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <HiOutlineKey className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="••••••••"
                  className={`w-full pl-10 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.password ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <HiOutlineEyeOff className="h-5 w-5" />
                  ) : (
                    <HiOutlineEye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <HiOutlineKey className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="••••••••"
                  className={`w-full pl-10 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? (
                    <HiOutlineEyeOff className="h-5 w-5" />
                  ) : (
                    <HiOutlineEye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Optional Fields Section */}
            <div className="pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-600 font-medium mb-3">Optional Information</p>

              {/* Personal Email */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Personal Email
                </label>
                <input
                  type="email"
                  name="personal_email"
                  value={formData.personal_email}
                  onChange={handleInputChange}
                  placeholder="your.personal@email.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              {/* Mobile Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mobile Phone
                </label>
                <input
                  type="tel"
                  name="mobile_phone"
                  value={formData.mobile_phone}
                  onChange={handleInputChange}
                  placeholder="+1 (555) 000-0000"
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm ${
                    errors.mobile_phone ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.mobile_phone && (
                  <p className="text-red-500 text-xs mt-1">{errors.mobile_phone}</p>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={signUpMutation.isPending}
              className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition-colors font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              Create Account
              <HiOutlineArrowRight className="h-5 w-5" />
            </button>

            {/* Login Link */}
            <p className="text-center text-sm text-gray-600">
              Already have an account?{' '}
              <button
                type="button"
                onClick={handleBackToLogin}
                className="text-indigo-600 hover:text-indigo-700 font-semibold"
              >
                Log in
              </button>
            </p>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-600 mt-4">
          By signing up, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  )
}
