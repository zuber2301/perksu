import requests
from config import settings


def send_otp_sms(mobile_phone: str, otp: str) -> bool:
    """Send OTP via Twilio (if configured) or print fallback."""
    # Twilio REST API
    if getattr(settings, "twilio_account_sid", "") and getattr(settings, "twilio_auth_token", "") and getattr(settings, "twilio_from_number", ""):
        try:
            sid = settings.twilio_account_sid
            token = settings.twilio_auth_token
            from_number = settings.twilio_from_number
            url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
            payload = {
                "To": mobile_phone,
                "From": from_number,
                "Body": f"Your Perksu verification code is: {otp}"
            }
            resp = requests.post(url, data=payload, auth=(sid, token), timeout=10)
            resp.raise_for_status()
            return True
        except Exception as e:
            print(f"[SMS] Failed to send SMS via Twilio to {mobile_phone}: {e}")
            return False

    # Fallback: check generic SMS provider URL & API key
    if getattr(settings, "sms_api_url", "") and getattr(settings, "sms_api_key", ""):
        try:
            payload = {"to": mobile_phone, "message": f"Your Perksu verification code is: {otp}", "api_key": settings.sms_api_key}
            resp = requests.post(settings.sms_api_url, json=payload, timeout=10)
            resp.raise_for_status()
            return True
        except Exception as e:
            print(f"[SMS] Failed to send SMS via generic provider to {mobile_phone}: {e}")
            return False

    # Development fallback
    print(f"SMS OTP [{otp}] sent to {mobile_phone} (dev-fallback)")
    return True
