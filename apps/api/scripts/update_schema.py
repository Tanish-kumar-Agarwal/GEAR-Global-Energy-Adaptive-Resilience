from sqlalchemy import create_engine, text
import os

POSTGRES_USER = os.getenv("POSTGRES_USER", "gear_user")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "gear_pass")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_DB = os.getenv("POSTGRES_DB", "gear")

SQLALCHEMY_DATABASE_URL = f"postgresql+psycopg://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"

engine = create_engine(SQLALCHEMY_DATABASE_URL)

with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE geopolitical_events ADD COLUMN title VARCHAR;"))
        conn.execute(text("ALTER TABLE geopolitical_events ADD COLUMN description VARCHAR;"))
        conn.execute(text("ALTER TABLE geopolitical_events ADD COLUMN latitude FLOAT;"))
        conn.execute(text("ALTER TABLE geopolitical_events ADD COLUMN longitude FLOAT;"))
        conn.execute(text("ALTER TABLE geopolitical_events ADD COLUMN source_event_id VARCHAR;"))
        conn.execute(text("ALTER TABLE geopolitical_events ADD COLUMN raw_payload JSON;"))
        conn.execute(text("ALTER TABLE geopolitical_events ADD COLUMN ingestion_time TIMESTAMP WITH TIME ZONE;"))
        
        # Make source_event_id unique
        conn.execute(text("ALTER TABLE geopolitical_events ADD CONSTRAINT uq_source_event_id UNIQUE(source_event_id);"))
        conn.execute(text("CREATE INDEX ix_geopolitical_events_source_event_id ON geopolitical_events (source_event_id);"))
        
        # Alter affected_entity_id to be nullable (it might already be, but just in case)
        conn.execute(text("ALTER TABLE geopolitical_events ALTER COLUMN affected_entity_id DROP NOT NULL;"))
        
        conn.commit()
        print("Schema updated successfully.")
    except Exception as e:
        print(f"Error updating schema: {e}")
