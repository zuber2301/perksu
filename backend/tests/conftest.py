"""Test utilities and shims for backend tests."""
import io as _io
import csv as _csv
import types as _types
import sys as _sys

# Lightweight pandas shim when pandas is not installed
try:
    import pandas  # type: ignore
except Exception:
    pandas = _types.SimpleNamespace()

    class _DataFrame:
        def __init__(self, rows):
            # rows is a list of dicts
            self._rows = rows
            self.columns = list(rows[0].keys()) if rows else []

        def iterrows(self):
            for i, r in enumerate(self._rows):
                yield i, r

        def __setattr__(self, name, value):
            if name == 'columns':
                old_cols = getattr(self, 'columns', [])
                new_cols = value
                if old_cols and new_cols and len(old_cols) == len(new_cols):
                    remapped = []
                    for r in self._rows:
                        new_row = {}
                        for old, new in zip(old_cols, new_cols):
                            new_row[new] = r.get(old, '')
                        remapped.append(new_row)
                    self._rows = remapped
                object.__setattr__(self, name, value)
            else:
                object.__setattr__(self, name, value)

    def _read_csv(bytestream):
        text = bytestream.read().decode('utf-8') if hasattr(bytestream, 'read') else str(bytestream)
        reader = _csv.DictReader(_io.StringIO(text))
        rows = [dict(r) for r in reader]
        return _DataFrame(rows)

    def _read_excel(bytestream):
        raise RuntimeError('read_excel not available in test shim')

    pandas.read_csv = _read_csv
    pandas.read_excel = _read_excel
    _sys.modules['pandas'] = pandas

__all__ = ["pandas"]

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import os
import sys

# Create an in-memory test database and override the app dependency so all tests use the same DB
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

import database
# Patch the real database module so everyone uses our in-memory DB
database.SessionLocal = TestingSessionLocal
database.engine = engine
Base = database.Base

from database import get_db
def _override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

# Avoid multiple imports by checking if models already in sys.modules
if 'models' not in sys.modules:
    import models  # registers all model classes on Base

# Ensure the test DB schema exists before the app or any routes are imported
Base.metadata.create_all(bind=engine)

# Seed platform admin
from startup_utils import init_platform_admin
init_platform_admin()

try:
    # If the app is importable, import it after creating tables and override its DB dependency
    if 'main' not in sys.modules:
        import main
        from main import app
    else:
        app = sys.modules['main'].app
    app.dependency_overrides[get_db] = _override_get_db
except Exception:
    pass

import pytest

# Ensure every test has the DB override, even if legacy tests try to clobber it
@pytest.fixture(autouse=True)
def force_db_override():
    from database import get_db
    if 'main' in sys.modules:
        sys.modules['main'].app.dependency_overrides[get_db] = _override_get_db

# Keep a session-scoped fixture to drop the schema at the end of the test session
@pytest.fixture(scope="session", autouse=True)
def teardown_database():
    yield
    Base.metadata.drop_all(bind=engine)
