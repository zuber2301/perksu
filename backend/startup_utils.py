import uuid

from auth.utils import get_password_hash
from models import RewardCatalogItem, SystemAdmin, Tenant

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
    # ── Gift Cards ──────────────────────────────────────────────────────────
    {
        "name": "Amazon Pay Gift Card",
        "brand": "Amazon",
        "category": "Gift Cards",
        "description": "Shop millions of products on Amazon.in",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg",
        "fulfillment_type": "GIFT_CARD_API",
        "provider_code": "amazon-in",
        "min_denomination_points": 500,
        "max_denomination_points": 5000,
        "step_points": 500,
    },
    {
        "name": "Flipkart Gift Card",
        "brand": "Flipkart",
        "category": "Gift Cards",
        "description": "India's largest e-commerce platform",
        "image_url": "https://upload.wikimedia.org/wikipedia/en/thumb/2/2e/Flipkart_Logo.svg/1200px-Flipkart_Logo.svg.png",
        "fulfillment_type": "GIFT_CARD_API",
        "provider_code": "flipkart-in",
        "min_denomination_points": 500,
        "max_denomination_points": 5000,
        "step_points": 500,
    },
    {
        "name": "Myntra Gift Card",
        "brand": "Myntra",
        "category": "Shopping",
        "description": "India's top fashion & lifestyle platform",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Myntra_logo.png/640px-Myntra_logo.png",
        "fulfillment_type": "GIFT_CARD_API",
        "provider_code": "myntra-in",
        "min_denomination_points": 500,
        "max_denomination_points": 3000,
        "step_points": 500,
    },
    {
        "name": "Croma Gift Card",
        "brand": "Croma",
        "category": "Shopping",
        "description": "Electronics & appliances chain",
        "image_url": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a3/Logo_of_Croma.svg/1200px-Logo_of_Croma.svg.png",
        "fulfillment_type": "GIFT_CARD_API",
        "provider_code": "croma-in",
        "min_denomination_points": 1000,
        "max_denomination_points": 5000,
        "step_points": 1000,
    },
    # ── Food & Dining ────────────────────────────────────────────────────────
    {
        "name": "Swiggy Gift Card",
        "brand": "Swiggy",
        "category": "Food & Dining",
        "description": "Order food from your favourite restaurants",
        "image_url": "https://upload.wikimedia.org/wikipedia/en/thumb/1/12/Swiggy_logo.svg/1200px-Swiggy_logo.svg.png",
        "fulfillment_type": "GIFT_CARD_API",
        "provider_code": "swiggy-in",
        "min_denomination_points": 250,
        "max_denomination_points": 2000,
        "step_points": 250,
    },
    {
        "name": "Zomato Gift Card",
        "brand": "Zomato",
        "category": "Food & Dining",
        "description": "Discover restaurants, delivery & more",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/7/75/Zomato_logo.png",
        "fulfillment_type": "GIFT_CARD_API",
        "provider_code": "zomato-in",
        "min_denomination_points": 250,
        "max_denomination_points": 2000,
        "step_points": 250,
    },
    {
        "name": "Starbucks Gift Card",
        "brand": "Starbucks",
        "category": "Food & Dining",
        "description": "Your favourite coffee & snacks",
        "image_url": "https://upload.wikimedia.org/wikipedia/en/thumb/d/d3/Starbucks_Corporation_Logo_2011.svg/1200px-Starbucks_Corporation_Logo_2011.svg.png",
        "fulfillment_type": "GIFT_CARD_API",
        "provider_code": "starbucks-in",
        "min_denomination_points": 500,
        "max_denomination_points": 2000,
        "step_points": 500,
    },
    {
        "name": "BigBasket Gift Card",
        "brand": "BigBasket",
        "category": "Food & Dining",
        "description": "Groceries & essentials delivered",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/a/a4/BigBasket_logo.svg",
        "fulfillment_type": "GIFT_CARD_API",
        "provider_code": "bigbasket-in",
        "min_denomination_points": 250,
        "max_denomination_points": 2000,
        "step_points": 250,
    },
    # ── Experiences ──────────────────────────────────────────────────────────
    {
        "name": "BookMyShow Gift Card",
        "brand": "BookMyShow",
        "category": "Experiences",
        "description": "Movies, concerts, sports & events",
        "image_url": "https://upload.wikimedia.org/wikipedia/en/1/18/Book_my_show.png",
        "fulfillment_type": "GIFT_CARD_API",
        "provider_code": "bookmyshow-in",
        "min_denomination_points": 500,
        "max_denomination_points": 2000,
        "step_points": 500,
    },
    {
        "name": "Netflix Gift Card",
        "brand": "Netflix",
        "category": "Experiences",
        "description": "Premium streaming subscription",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg",
        "fulfillment_type": "GIFT_CARD_API",
        "provider_code": "netflix-in",
        "min_denomination_points": 500,
        "max_denomination_points": 2000,
        "step_points": 500,
    },
    {
        "name": "Spotify Premium",
        "brand": "Spotify",
        "category": "Experiences",
        "description": "Ad-free music streaming",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/8/84/Spotify_icon.svg",
        "fulfillment_type": "GIFT_CARD_API",
        "provider_code": "spotify-in",
        "min_denomination_points": 500,
        "max_denomination_points": 1500,
        "step_points": 500,
    },
    # ── Merchandise ──────────────────────────────────────────────────────────
    {
        "name": "Company Coffee Mug",
        "brand": "Perksu Swag",
        "category": "Merchandise",
        "description": "High-quality branded ceramic mug",
        "image_url": "",
        "fulfillment_type": "INVENTORY_ITEM",
        "provider_code": None,
        "min_denomination_points": 200,
        "max_denomination_points": 200,
        "step_points": 200,
        "inventory_count": 100,
    },
    {
        "name": "Company T-Shirt",
        "brand": "Perksu Swag",
        "category": "Merchandise",
        "description": "Premium cotton tee with logo",
        "image_url": "",
        "fulfillment_type": "INVENTORY_ITEM",
        "provider_code": None,
        "min_denomination_points": 500,
        "max_denomination_points": 500,
        "step_points": 500,
        "inventory_count": 50,
    },
    {
        "name": "Company Hoodie",
        "brand": "Perksu Swag",
        "category": "Merchandise",
        "description": "Warm fleece hoodie with embroidered logo",
        "image_url": "",
        "fulfillment_type": "INVENTORY_ITEM",
        "provider_code": None,
        "min_denomination_points": 1000,
        "max_denomination_points": 1000,
        "step_points": 1000,
        "inventory_count": 30,
    },
    {
        "name": "Insulated Water Bottle",
        "brand": "Perksu Swag",
        "category": "Merchandise",
        "description": "1-litre stainless steel bottle",
        "image_url": "",
        "fulfillment_type": "INVENTORY_ITEM",
        "provider_code": None,
        "min_denomination_points": 400,
        "max_denomination_points": 400,
        "step_points": 400,
        "inventory_count": 75,
    },
    # ── Social Good ──────────────────────────────────────────────────────────
    {
        "name": "Donate to CRY India",
        "brand": "CRY India",
        "category": "Social Good",
        "description": "Support child rights across India (₹1 per point)",
        "image_url": "",
        "fulfillment_type": "MANUAL",
        "provider_code": None,
        "min_denomination_points": 100,
        "max_denomination_points": 5000,
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
        "min_denomination_points": 100,
        "max_denomination_points": 5000,
        "step_points": 100,
    },
]


def seed_reward_catalog():
    """Insert default platform-wide catalog items if they don't exist yet."""
    print("Seeding reward catalog...")
    db = SessionLocal()
    try:
        existing = db.query(RewardCatalogItem).filter(RewardCatalogItem.tenant_id.is_(None)).count()
        if existing > 0:
            print(f"→ Catalog already seeded ({existing} global items). Skipping.")
            return

        print(f"→ Inserting {len(_DEFAULT_CATALOG)} global catalog items...")
        for entry in _DEFAULT_CATALOG:
            item = RewardCatalogItem(
                tenant_id=None,  # global
                **{k: v for k, v in entry.items()},
            )
            db.add(item)

        db.commit()
        print("✓ Reward catalog seeded successfully.")
    except Exception as e:
        print(f"ERROR seeding reward catalog: {e}")
        db.rollback()
    finally:
        db.close()

