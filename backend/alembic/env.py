import os
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

from pathlib import Path

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import project settings to get the DB URL
try:
    import sys
    import os
    # Add project root to path so we can import modules
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
    from config import settings
    from models import Base
    sqlalchemy_url = settings.database_url
    target_metadata = Base.metadata
except Exception as e:
    print(f"Error importing settings: {e}")
    sqlalchemy_url = os.getenv('DATABASE_URL')
    target_metadata = None

if sqlalchemy_url:
    config.set_main_option('sqlalchemy.url', sqlalchemy_url)


def run_migrations_offline():
    """Run migrations in 'offline' mode."""
    url = config.get_main_option('sqlalchemy.url')
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix='sqlalchemy.',
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
