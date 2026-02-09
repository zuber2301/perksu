import smtplib
from email.message import EmailMessage

from config import settings


def send_reward_email(to_email: str, voucher_code: str, redeem_url: str | None = None):
    """Send voucher email with code and redeem link."""
    if not settings.smtp_email or not settings.smtp_password:
        print(f"WARNING: SMTP credentials not set. Voucher for {to_email}: {voucher_code} {redeem_url}")
        return

    msg = EmailMessage()
    msg["Subject"] = "Your Perksu Reward is Ready"
    msg["From"] = f"Perksu <{settings.smtp_email}>"
    msg["To"] = to_email

    body = f"Your voucher code: {voucher_code}\n"
    if redeem_url:
        body += f"Redeem here: {redeem_url}\n"
    body += "\nIf you did not request this, contact your admin."

    msg.set_content(body)

    try:
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port) as smtp:
            smtp.login(settings.smtp_email, settings.smtp_password)
            smtp.send_message(msg)
        print(f"[REWARD] Voucher email sent to {to_email}")
    except Exception as e:
        print(f"[ERROR] Failed to send reward email to {to_email}: {e}")
