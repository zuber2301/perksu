from models import User

from database import SessionLocal

db = SessionLocal()
try:
    users = db.query(User).all()
    for i, u in enumerate(users):
        u.mobile_phone = f"+919876500{i:03d}"
        print(f"Updated {u.email} -> {u.mobile_phone}")
    db.commit()
finally:
    db.close()
