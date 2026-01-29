import smtplib
from email.message import EmailMessage
from config import settings

def send_otp_email(to_email: str, otp: str):
    """
    Send OTP email using Gmail SMTP.
    """
    if not settings.smtp_email or not settings.smtp_password:
        print(f"WARNING: SMTP credentials not set. OTP for {to_email} is {otp}")
        return

    msg = EmailMessage()
    msg["Subject"] = "Your Perksu Login Code"
    msg["From"] = f"Perksu <{settings.smtp_email}>"
    msg["To"] = to_email
    
    msg.set_content(
        f"""
Your Perksu login code is:

{otp}

This code is valid for 5 minutes.
If you did not request this, ignore this email.
        """
    )

    try:
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port) as smtp:
            smtp.login(settings.smtp_email, settings.smtp_password)
            smtp.send_message(msg)
        print(f"[AUTH] OTP sent successfully to {to_email}")
    except Exception as e:
        print(f"[ERROR] Failed to send email to {to_email}: {e}")
