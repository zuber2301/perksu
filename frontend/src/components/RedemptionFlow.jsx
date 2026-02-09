/**
 * Redemption Flow Component
 * Handles the multi-step redemption process:
 * 1. Initiate redemption (generate OTP)
 * 2. Verify OTP
 * 3. Collect delivery details (for merchandise)
 * 4. Confirmation
 */

import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, Loader } from 'lucide-react';
import api from '../lib/api';

const STEPS = {
  CONFIRM: 'confirm',
  OTP: 'otp',
  DELIVERY: 'delivery',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  FAILED: 'failed'
};

export default function RedemptionFlow({ item, onClose, onComplete }) {
  const [step, setStep] = useState(STEPS.CONFIRM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [redemptionId, setRedemptionId] = useState(null);
  const [otp, setOtp] = useState('');
  const [otpExpiry, setOtpExpiry] = useState(null);
  const [otpAttempts, setOtpAttempts] = useState(0);

  const [deliveryDetails, setDeliveryDetails] = useState({
    full_name: '',
    phone_number: '',
    address_line_1: '',
    address_line_2: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India'
  });

  const handleInitiateRedemption = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/redemptions/initiate', {
        item_type: item.item_type || (item.voucher_denomination ? 'VOUCHER' : 'MERCH'),
        item_id: item.id,
        item_name: item.name || item.vendor_name,
        point_cost: item.point_cost,
        actual_cost: item.voucher_denomination || 0
      });

      setRedemptionId(response.data.redemption_id);
      setOtpExpiry(Date.now() + 10 * 60 * 1000);
      setStep(STEPS.OTP);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to initiate redemption');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      setError('Please enter a 6-digit OTP');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/redemptions/verify-otp', {
        redemption_id: redemptionId,
        otp_code: otp
      });

      // If voucher, go to success. If merchandise, go to delivery details
          if (item.item_type === 'VOUCHER' || item.voucher_denomination) {
        // For vouchers, the issuance happens asynchronously in a background task.
        // Show a processing state and poll the redemption status until completion or failure.
        setStep(STEPS.PROCESSING);
        // Poll for status
        const poll = setInterval(async () => {
          try {
            const resp = await api.get(`/redemptions/${response.data.redemption_id}`);
            const status = resp.data.status;
            if (status === 'COMPLETED') {
              clearInterval(poll);
              setStep(STEPS.SUCCESS);
            } else if (status === 'FAILED') {
              clearInterval(poll);
              setError(resp.data.failed_reason || 'Voucher issuance failed');
              setStep(STEPS.FAILED);
            }
          } catch (err) {
            // ignore transient errors
          }
        }, 2000);
      } else {
        setStep(STEPS.DELIVERY);
      }
    } catch (err) {
      setOtpAttempts(prev => prev + 1);
      setError(err.response?.data?.detail || 'Failed to verify OTP');
      if (otpAttempts >= 2) {
        setError('Maximum attempts exceeded. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitDelivery = async () => {
    // Validate required fields
    const requiredFields = ['full_name', 'phone_number', 'address_line_1', 'city', 'pincode'];
    if (!requiredFields.every(field => deliveryDetails[field])) {
      setError('Please fill in all required delivery details');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api.post(`/redemptions/delivery-details/${redemptionId}`, {
        ...deliveryDetails
      });

      setStep(STEPS.SUCCESS);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit delivery details');
    } finally {
      setLoading(false);
    }
  };

  const isOtpExpired = otpExpiry && Date.now() > otpExpiry;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900">Redeem Item</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="h-6 w-6 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step: Confirm */}
          {step === STEPS.CONFIRM && (
            <ConfirmStep
              item={item}
              loading={loading}
              onConfirm={handleInitiateRedemption}
              onCancel={onClose}
            />
          )}

          {/* Step: OTP Verification */}
          {step === STEPS.OTP && (
            <OTPStep
              otp={otp}
              setOtp={setOtp}
              loading={loading}
              error={error}
              isExpired={isOtpExpired}
              otpExpiry={otpExpiry}
              onVerify={handleVerifyOTP}
              onResend={handleInitiateRedemption}
              attempts={otpAttempts}
            />
          )}

          {/* Step: Delivery Details */}
          {step === STEPS.DELIVERY && (
            <DeliveryStep
              details={deliveryDetails}
              setDetails={setDeliveryDetails}
              loading={loading}
              error={error}
              onSubmit={handleSubmitDelivery}
            />
          )}

          {/* Step: Processing (background issuer) */}
          {step === STEPS.PROCESSING && (
            <div className="space-y-4 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
                <svg className="animate-spin w-6 h-6 text-blue-600" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium">Processing your voucher</h3>
              <p className="text-sm text-slate-600">We're issuing your voucher — this may take a few moments. We'll update this screen when it's ready.</p>
              <div className="flex gap-2 justify-center mt-4">
                <button onClick={() => { onClose(); onComplete(); }} className="px-4 py-2 text-sm border rounded">Close</button>
              </div>
            </div>
          )}

          {/* Step: Failed */}
          {step === STEPS.FAILED && (
            <div className="space-y-4 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" viewBox="0 0 24 24"><path d="M11.001 10h2v5h-2zM11 16h2v2h-2z" fill="currentColor"/></svg>
              </div>
              <h3 className="text-lg font-medium">Voucher issuance failed</h3>
              <p className="text-sm text-slate-600">{error || 'There was an error issuing your voucher. Please try again later.'}</p>
              <div className="flex gap-2 justify-center mt-4">
                <button onClick={() => { onClose(); onComplete(); }} className="px-4 py-2 text-sm border rounded">Close</button>
              </div>
            </div>
          )}

          {/* Step: Success */}
          {step === STEPS.SUCCESS && (
            <SuccessStep
              item={item}
              onClose={() => {
                onClose();
                onComplete();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ConfirmStep({ item, loading, onConfirm, onCancel }) {
  const itemType = item.voucher_denomination ? 'VOUCHER' : 'MERCH';
  const displayName = item.vendor_name || item.name;
  const displayCost = item.voucher_denomination || item.point_cost;

  return (
    <div className="space-y-6">
      {/* Item Preview */}
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
        <p className="text-sm text-slate-600 mb-2">You are about to redeem:</p>
        <h3 className="text-xl font-bold text-slate-900 mb-2">{displayName}</h3>
        {itemType === 'VOUCHER' ? (
          <p className="text-slate-600">₹{displayCost} Digital Voucher</p>
        ) : (
          <p className="text-slate-600">{item.category} - {item.name}</p>
        )}
      </div>

      {/* Points Cost */}
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <p className="text-sm text-slate-600 mb-1">This will cost you</p>
        <p className="text-3xl font-bold text-blue-600">{item.point_cost} Points</p>
      </div>

      {/* Security Note */}
      <div className="flex gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
        <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800">
          For security, we'll send a verification code to your registered email.
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <Loader className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {loading ? 'Processing...' : 'Proceed'}
        </button>
      </div>
    </div>
  );
}

function OTPStep({ otp, setOtp, loading, error, isExpired, otpExpiry, onVerify, onResend, attempts }) {
  const remainingTime = Math.ceil((otpExpiry - Date.now()) / 1000);
  const canResend = isExpired;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-slate-600 mb-4">
          We've sent a 6-digit code to your email. Please enter it below.
        </p>

        <label className="block text-sm font-medium text-slate-900 mb-2">
          Verification Code
        </label>
        <input
          type="text"
          maxLength="6"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          placeholder="000000"
          className="w-full px-4 py-3 text-2xl text-center tracking-widest border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
          disabled={isExpired}
        />

        {/* Expiry Timer */}
        {!isExpired && (
          <p className="text-sm text-slate-500 mt-2">
            Code expires in: <span className="font-medium text-blue-600">{remainingTime}s</span>
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Attempts */}
      {attempts > 0 && (
        <p className="text-sm text-slate-600">
          Attempts remaining: <span className="font-medium">{3 - attempts}</span>
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3 flex-col">
        <button
          onClick={onVerify}
          disabled={loading || otp.length !== 6 || isExpired}
          className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <Loader className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {loading ? 'Verifying...' : 'Verify Code'}
        </button>

        {canResend && (
          <button
            onClick={onResend}
            className="w-full px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
          >
            Resend Code
          </button>
        )}
      </div>
    </div>
  );
}

function DeliveryStep({ details, setDetails, loading, error, onSubmit }) {
  const handleChange = (field, value) => {
    setDetails(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="space-y-4">
      <p className="text-slate-600 mb-4">
        Please provide your delivery address for this order.
      </p>

      {error && (
        <div className="flex gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <input
          placeholder="Full Name *"
          value={details.full_name}
          onChange={(e) => handleChange('full_name', e.target.value)}
          className="col-span-2 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
        />
        <input
          placeholder="Phone Number *"
          value={details.phone_number}
          onChange={(e) => handleChange('phone_number', e.target.value)}
          className="col-span-2 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
        />
        <input
          placeholder="Address Line 1 *"
          value={details.address_line_1}
          onChange={(e) => handleChange('address_line_1', e.target.value)}
          className="col-span-2 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
        />
        <input
          placeholder="Address Line 2"
          value={details.address_line_2}
          onChange={(e) => handleChange('address_line_2', e.target.value)}
          className="col-span-2 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
        />
        <input
          placeholder="City *"
          value={details.city}
          onChange={(e) => handleChange('city', e.target.value)}
          className="col-span-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
        />
        <input
          placeholder="State"
          value={details.state}
          onChange={(e) => handleChange('state', e.target.value)}
          className="col-span-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
        />
        <input
          placeholder="Pincode *"
          value={details.pincode}
          onChange={(e) => handleChange('pincode', e.target.value)}
          className="col-span-2 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
        />
      </div>

      <button
        onClick={onSubmit}
        disabled={loading}
        className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
      >
        {loading ? <Loader className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {loading ? 'Submitting...' : 'Complete Order'}
      </button>
    </div>
  );
}

function SuccessStep({ item, onClose }) {
  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
          <Check className="h-8 w-8 text-green-600" />
        </div>
      </div>

      <div>
        <h3 className="text-2xl font-bold text-slate-900 mb-2">
          Redemption Successful! 🎉
        </h3>
        <p className="text-slate-600">
          {item.voucher_denomination
            ? 'Your voucher code will be sent to your email shortly.'
            : 'Your order has been placed. You will receive a tracking number soon.'}
        </p>
      </div>

      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <p className="text-sm text-slate-600 mb-1">Redeemed</p>
        <p className="text-lg font-bold text-slate-900">
          {item.vendor_name || item.name}
        </p>
      </div>

      <button
        onClick={onClose}
        className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
      >
        Done
      </button>
    </div>
  );
}
