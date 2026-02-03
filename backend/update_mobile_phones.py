from models import User

from database import SessionLocal

db = SessionLocal()
try:
    users = db.query(User).all()
    for i, u in enumerate(users):
        if not u.mobile_phone:
            u.mobile_phone = f"+1555000{i:03d}"
            print(f"Updated {u.email} -> {u.mobile_phone}")
    db.commit()
finally:
    db.close()
