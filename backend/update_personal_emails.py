from database import SessionLocal
from models import User
db = SessionLocal()
try:
    users = db.query(User).all()
    for u in users:
        if not u.personal_email:
            u.personal_email = f"{u.email.split('@')[0]}_personal@gmail.com"
            print(f"Updated {u.email} -> {u.personal_email}")
    db.commit()
finally:
    db.close()
