"""
Create the PostgreSQL schema from the SQLAlchemy models.

Idempotent: create_all skips tables that already exist, and the ALTER statements below
add columns introduced after the initial migration without touching existing data.

    python scripts/bootstrap_db.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text

from core.database import Base, engine
import models.domain # noqa: F401 - registers every table on Base.metadata

# Columns added after alembic revision e113037ac844. IF NOT EXISTS keeps re-runs safe.
POST_MIGRATION_COLUMNS = [
    "ALTER TABLE countries ADD COLUMN IF NOT EXISTS reserve_target_days DOUBLE PRECISION",
    "ALTER TABLE routes ADD COLUMN IF NOT EXISTS chokepoint_id VARCHAR",
    "ALTER TABLE routes ADD COLUMN IF NOT EXISTS path JSON",
    "ALTER TABLE routes ADD COLUMN IF NOT EXISTS chokepoint_ids JSON",
    "ALTER TABLE chokepoints ADD COLUMN IF NOT EXISTS region VARCHAR",
    "ALTER TABLE chokepoints ADD COLUMN IF NOT EXISTS daily_transit_volume DOUBLE PRECISION",
]


def main():
    print("Creating tables from models...")
    Base.metadata.create_all(bind=engine)

    with engine.connect() as conn:
        for statement in POST_MIGRATION_COLUMNS:
            conn.execute(text(statement))
        conn.commit()

    print("Schema is up to date.")


if __name__ == "__main__":
    main()
