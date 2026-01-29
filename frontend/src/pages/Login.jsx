import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { authAPI } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { HiOutlineMail, HiOutlineKey, HiOutlineArrowLeft, HiOutlineShieldCheck, HiOutlineLockClosed, HiOutlineEye, HiOutlineEyeOff, HiOutlineLibrary } from 'react-icons/hi'
import { FcGoogle } from 'react-icons/fc'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState('login') // 'login' or 'otp'
  const [showPassword, setShowPassword] = useState(false)
  const [timer, setTimer] = useState(0)
  
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()

  useEffect(() => {
    let interval
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [timer])

  const requestOtpMutation = useMutation({
    mutationFn: () => authAPI.requestOTP(email),
    onSuccess: () => {
      setStep('otp')
      setTimer(60)
      toast.success('OTP sent to your email!')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to send OTP')
    },
  })

  const loginMutation = useMutation({
    mutationFn: () => authAPI.login(email, password),
    onSuccess: (response) => {
      const { access_token, user } = response.data
      setAuth(user, access_token)
      toast.success(`Welcome back, ${user.first_name}!`)
      navigate('/dashboard')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Login failed')
    },
  })

  const verifyOtpMutation = useMutation({
    mutationFn: () => authAPI.verifyOTP(email, otp),
    onSuccess: (response) => {
      const { access_token, user } = response.data
      setAuth(user, access_token)
      toast.success(`Welcome back, ${user.first_name}!`)
      navigate('/dashboard')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Invalid identification code')
    },
  })

  const handleRequestOTP = () => {
    if (!email) {
      toast.error('Please enter your email first')
      return
    }
    requestOtpMutation.mutate()
  }

  const handleVerifyOTP = (e) => {
    e.preventDefault()
    verifyOtpMutation.mutate()
  }

  const handlePasswordLogin = (e) => {
    e.preventDefault()
    loginMutation.mutate()
  }

  const handleGoogleLogin = () => {
    toast.error('Google SSO is not configured for this environment yet.')
  }

  const handleSSOLogin = () => {
    toast.error('Enterprise SSO is not configured for this environment yet.')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-perksu-purple/10 via-white to-perksu-blue/10">
      <div className="w-full max-w-md p-8">
        <div className="bg-white rounded-2xl shadow-xl p-8 transition-all">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-perksu-purple to-perksu-blue rounded-2xl mb-4 shadow-lg shadow-perksu-purple/20">
              <span className="text-3xl font-bold text-white">P</span>
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-perksu-purple to-perksu-blue bg-clip-text text-transparent">
              Perksu
            </h1>
            <p className="text-gray-500 mt-2">Enterprise Rewards & Recognition</p>
          </div>

          {step === 'login' ? (
            /* Primary Password Login */
            <div className="space-y-6">
              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <div>
                  <label className="label">Work Email</label>
                  <div className="relative">
                    <HiOutlineMail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input pl-10 h-12"
                      placeholder="you@company.com"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Password</label>
                  <div className="relative">
                    <HiOutlineLockClosed className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input pl-10 pr-10 h-12"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? (
                        <HiOutlineEyeOff className="w-5 h-5" />
                      ) : (
                        <HiOutlineEye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loginMutation.isPending}
                  className="w-full btn-primary h-12 font-bold"
                >
                  {loginMutation.isPending ? 'Signing in...' : 'Sign In'}
                </button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-100"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-400">Other Login Methods</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleRequestOTP}
                  disabled={requestOtpMutation.isPending}
                  className="flex-1 flex flex-col items-center justify-center py-4 px-2 bg-purple-50 border border-purple-100 rounded-2xl hover:bg-purple-100 transition-all group"
                >
                  <HiOutlineShieldCheck className="w-6 h-6 text-perksu-purple mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-bold text-perksu-purple uppercase tracking-wider">Email OTP</span>
                </button>

                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="flex-1 flex flex-col items-center justify-center py-4 px-2 bg-slate-50 border border-slate-200 rounded-2xl hover:bg-slate-100 transition-all group"
                >
                  <FcGoogle className="w-6 h-6 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Google</span>
                </button>

                <button
                  type="button"
                  onClick={handleSSOLogin}
                  className="flex-1 flex flex-col items-center justify-center py-4 px-2 bg-blue-50 border border-blue-100 rounded-2xl hover:bg-blue-100 transition-all group"
                >
                  <HiOutlineLibrary className="w-6 h-6 text-perksu-blue mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-bold text-perksu-blue uppercase tracking-wider">Enterprise SSO</span>
                </button>
              </div>
            </div>
          ) : (
            /* OTP Verification Step */
            <form onSubmit={handleVerifyOTP} className="space-y-6">
              <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-green-50 rounded-full mb-3">
                  <HiOutlineShieldCheck className="w-6 h-6 text-green-600" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Check your email</h2>
                <p className="text-sm text-gray-500">
                  We sent a 6-digit code to <span className="font-medium text-gray-900">{email}</span>
                </p>
              </div>

              <div>
                <label className="label font-semibold text-gray-700">Verification Code</label>
                <div className="relative">
                  <HiOutlineKey className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    maxLength="6"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                    className="input pl-10 h-12 text-center tracking-[0.5em] text-xl font-bold"
                    placeholder="000000"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={verifyOtpMutation.isPending}
                className="w-full btn-primary h-12"
              >
                {verifyOtpMutation.isPending ? 'Verifying...' : 'Log In'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setStep('login')}
                  className="text-sm text-gray-500 hover:text-perksu-purple flex items-center justify-center gap-1 mx-auto"
                >
                  <HiOutlineArrowLeft className="w-4 h-4" />
                  Go back to Password Login
                </button>
                <div className="mt-4">
                  {timer > 0 ? (
                    <p className="text-xs text-gray-400">Resend code in {timer}s</p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => requestOtpMutation.mutate()}
                      className="text-xs font-semibold text-perksu-purple hover:underline"
                    >
                      Resend Verification Code
                    </button>
                  )}
                </div>
              </div>
            </form>
          )}

          {/* Demo help */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3 text-center">Demo Accounts</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Admin', email: 'admin@demo.com' },
                { label: 'Employee', email: 'employee@triton.com' }
              ].map(demo => (
                <button
                  key={demo.email}
                  onClick={() => setEmail(demo.email)}
                  className="text-[10px] bg-gray-50 hover:bg-gray-100 text-gray-600 px-2 py-1.5 rounded border border-gray-200 text-left transition-colors"
                >
                  <span className="block font-bold text-gray-700">{demo.label}</span>
                  {demo.email}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-2 text-center">Default password: <span className="font-mono">jspark123</span></p>
          </div>
        </div>
      </div>
    </div>
  )
}
