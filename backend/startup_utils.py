import uuid

from auth.utils import get_password_hash
from models import RewardCatalogMaster, SystemAdmin, Tenant

from database import SessionLocal


def init_platform_admin():
    """Ensure a platform admin and master tenant exist on startup."""
    print("Verifying platform admin status...")
    db = SessionLocal()
    try:
        # 1. Ensure jSpark (Platform) Tenant exists
        jspark = db.query(Tenant).filter(Tenant.slug == "jspark").first()
        if not jspark:
            print("→ Creating Platform Tenant (jSpark)...")
            jspark = Tenant(
                id=uuid.UUID("00000000-0000-0000-0000-000000000000"),
                name="jSpark Platform",
                slug="jspark",
                subscription_tier="enterprise",
                status="ACTIVE",
            )
            db.add(jspark)
            db.flush()

        # 2. Ensure default System Admin exists
        admin_email = "admin@perksu.com"
        admin = db.query(SystemAdmin).filter(SystemAdmin.email == admin_email).first()
        if not admin:
            print(f"→ Creating default System Admin ({admin_email})...")
            admin = SystemAdmin(
                email=admin_email,
                password_hash=get_password_hash("admin123"),
                first_name="Perksu",
                last_name="Admin",
                is_super_admin=True,
                mfa_enabled=False,  # Disable for simple demo login
            )
            db.add(admin)
            db.flush()

        db.commit()
    except Exception as e:
        print(f"ERROR initializing platform admin: {e}")
        db.rollback()
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Default reward catalog seed
# ---------------------------------------------------------------------------

_DEFAULT_CATALOG = [
    {
        "name": "Amazon Pay Gift Card",
        "brand": "Amazon",
        "category": "Gift Cards",
        "description": "Redeem for Amazon.in credits (₹1 per 10 points)",
        "image_url": "https://img.etimg.com/thumb/msid-59738992,width-1200,height-900,resizemode-4,imgsize-25499/amazon-pay.jpg",
        "fulfillment_type": "GIFT_CARD_API",
        "provider_code": "AMZ-IN",
        "min_points": 1000,
        "max_points": 10000,
        "step_points": 500,
    },
    {
        "name": "Swiggy Money Voucher",
        "brand": "Swiggy",
        "category": "Food & Dining",
        "description": "Order food, groceries and more on Swiggy",
        "image_url": "https://upload.wikimedia.org/wikipedia/en/thumb/1/12/Swiggy_logo.svg/1200px-Swiggy_logo.svg.png",
        "fulfillment_type": "GIFT_CARD_API",
        "provider_code": "SWG-IN",
        "min_points": 500,
        "max_points": 5000,
        "step_points": 250,
    },
    {
        "name": "Zomato Gift Card",
        "brand": "Zomato",
        "category": "Food & Dining",
        "description": "Redeem on Zomato for food delivery and dining out",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/b/bd/Zomato_Logo.png",
        "fulfillment_type": "GIFT_CARD_API",
        "provider_code": "ZOM-IN",
        "min_points": 500,
        "max_points": 5000,
        "step_points": 250,
    },
    {
        "name": "Flipkart E-Gift Voucher",
        "brand": "Flipkart",
        "category": "Shopping",
        "description": "India's largest online shopping destination",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/7/7a/Flipkart_logo.png",
        "fulfillment_type": "GIFT_CARD_API",
        "provider_code": "FLK-IN",
        "min_points": 1000,
        "max_points": 10000,
        "step_points": 500,
    },
    {
        "name": "Myntra Gift Card",
        "brand": "Myntra",
        "category": "Shopping",
        "description": "Latest fashion and lifestyle brands",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/b/bc/Myntra_logo.png",
        "fulfillment_type": "GIFT_CARD_API",
        "provider_code": "MYN-IN",
        "min_points": 500,
        "max_points": 5000,
        "step_points": 500,
    },
    {
        "name": "MakeMyTrip Holiday Voucher",
        "brand": "MakeMyTrip",
        "category": "Experiences",
        "description": "Redeem for flights, hotels and holiday packages",
        "image_url": "https://logos-world.net/wp-content/uploads/2021/01/MakeMyTrip-Logo.png",
        "fulfillment_type": "GIFT_CARD_API",
        "provider_code": "MMT-IN",
        "min_points": 2000,
        "max_points": 25000,
        "step_points": 1000,
    },
    {
        "name": "Uber India E-Gift Card",
        "brand": "Uber",
        "category": "Experiences",
        "description": "Redeem for Uber rides across India",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Uber_logo_2018.svg/1200px-Uber_logo_2018.svg.png",
        "fulfillment_type": "GIFT_CARD_API",
        "provider_code": "UBR-IN",
        "min_points": 250,
        "max_points": 2000,
        "step_points": 250,
    },
    {
        "name": "BookMyShow Voucher",
        "brand": "BookMyShow",
        "category": "Experiences",
        "description": "Movies, events, plays and sports",
        "image_url": "https://in.bmscdn.com/webdie/desktop/nav/logo.png",
        "fulfillment_type": "GIFT_CARD_API",
        "provider_code": "BMS-IN",
        "min_points": 500,
        "max_points": 2000,
        "step_points": 500,
    },
    {
        "name": "Starbucks Card",
        "brand": "Starbucks",
        "category": "Food & Dining",
        "description": "Enjoy your favorite coffee at Starbucks",
        "image_url": "https://upload.wikimedia.org/wikipedia/en/thumb/d/d3/Starbucks_Corporation_Logo_2011.svg/1200px-Starbucks_Corporation_Logo_2011.svg.png",
        "fulfillment_type": "GIFT_CARD_API",
        "provider_code": "SBUX-IN",
        "min_points": 500,
        "max_points": 5000,
        "step_points": 500,
    },
    {
        "name": "Pantaloons E-Gift Card",
        "brand": "Pantaloons",
        "category": "Shopping",
        "description": "Redeem at any Pantaloons outlet across India",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/f/fe/Pantaloons_Logo.png",
        "fulfillment_type": "GIFT_CARD_API",
        "provider_code": "PAN-IN",
        "min_points": 1000,
        "max_points": 10000,
        "step_points": 1000,
    },
    {
        "name": "Netmeds Voucher",
        "brand": "Netmeds",
        "category": "Shopping",
        "description": "Order medicines and wellness products online",
        "image_url": "https://www.netmeds.com/assets/gloryweb/images/netmeds-logo.svg",
        "fulfillment_type": "GIFT_CARD_API",
        "provider_code": "NET-IN",
        "min_points": 500,
        "max_points": 2000,
        "step_points": 500,
    },
    {
        "name": "Laptop Sleeve",
        "brand": "Perksu Merch",
        "category": "Merchandise",
        "description": "Protective sleeve for 13/14 inch laptops",
        "image_url": "",
        "fulfillment_type": "INVENTORY_ITEM",
        "provider_code": None,
        "min_points": 200,
        "max_points": 200,
        "step_points": 200,
    },
    {
        "name": "Company T-Shirt",
        "brand": "Perksu Swag",
        "category": "Merchandise",
        "description": "Premium cotton tee with logo",
        "image_url": "",
        "fulfillment_type": "INVENTORY_ITEM",
        "provider_code": None,
        "min_points": 500,
        "max_points": 500,
        "step_points": 500,
    },
    {
        "name": "Company Hoodie",
        "brand": "Perksu Swag",
        "category": "Merchandise",
        "description": "Warm fleece hoodie with embroidered logo",
        "image_url": "",
        "fulfillment_type": "INVENTORY_ITEM",
        "provider_code": None,
        "min_points": 1000,
        "max_points": 1000,
        "step_points": 1000,
    },
    {
        "name": "Insulated Water Bottle",
        "brand": "Perksu Swag",
        "category": "Merchandise",
        "description": "1-litre stainless steel bottle",
        "image_url": "",
        "fulfillment_type": "INVENTORY_ITEM",
        "provider_code": None,
        "min_points": 400,
        "max_points": 400,
        "step_points": 400,
    },
    {
        "name": "Donate to CRY India",
        "brand": "CRY India",
        "category": "Social Good",
        "description": "Support child rights across India (₹1 per point)",
        "image_url": "",
        "fulfillment_type": "MANUAL",
        "provider_code": None,
        "min_points": 100,
        "max_points": 5000,
        "step_points": 100,
    },
    {
        "name": "Donate to Teach For India",
        "brand": "Teach For India",
        "category": "Social Good",
        "description": "Fund education for underserved children",
        "image_url": "",
        "fulfillment_type": "MANUAL",
        "provider_code": None,
        "min_points": 100,
        "max_points": 5000,
        "step_points": 100,
    },
]


def seed_reward_catalog():
    """Insert platform-wide Master Catalog items."""
    print("Seeding Master Reward Catalog...")
    db = SessionLocal()
    try:
        existing = db.query(RewardCatalogMaster).count()
        if existing > 0:
            print(f"→ Master Catalog already seeded ({existing} items). Skipping.")
            return

        print(f"→ Inserting {len(_DEFAULT_CATALOG)} master catalog items...")
        for entry in _DEFAULT_CATALOG:
            item = RewardCatalogMaster(
                **{k: v for k, v in entry.items()},
            )
            db.add(item)

        db.commit()
        print("✓ Master Reward catalog seeded successfully.")
    except Exception as e:
        print(f"ERROR seeding master reward catalog: {e}")
        db.rollback()
    finally:
        db.close()

