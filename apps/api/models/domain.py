from sqlalchemy import Column, String, Float, Integer, ForeignKey, JSON, DateTime, Enum, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime, timezone
import enum
from core.database import Base

class JobStatus(enum.Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"

class RiskLevel(enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class EventType(enum.Enum):
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"

# ---------------------------------------------------------
# CORE ENTITIES
# ---------------------------------------------------------

class Country(Base):
    __tablename__ = "countries"
    id = Column(String, primary_key=True, index=True) # e.g. "IND"
    name = Column(String, unique=True, index=True)
    region = Column(String)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class Commodity(Base):
    __tablename__ = "commodities"
    id = Column(String, primary_key=True, index=True) # e.g. "CRUDE_OIL"
    name = Column(String)

class Supplier(Base):
    __tablename__ = "suppliers"
    id = Column(String, primary_key=True, index=True)
    name = Column(String)
    country_id = Column(String, ForeignKey("countries.id"))
    reliability_score = Column(Float, default=1.0) # 0.0 to 1.0

class Route(Base):
    __tablename__ = "routes"
    id = Column(String, primary_key=True, index=True)
    name = Column(String)
    capacity = Column(Float) # e.g., million barrels per day
    transit_time_days = Column(Integer)

class Chokepoint(Base):
    __tablename__ = "chokepoints"
    id = Column(String, primary_key=True, index=True)
    name = Column(String)
    risk_factor = Column(Float, default=0.0)
    latitude = Column(Float)
    longitude = Column(Float)

class EnergyAsset(Base):
    __tablename__ = "energy_assets"
    id = Column(String, primary_key=True, index=True)
    name = Column(String)
    type = Column(String) # PORT, REFINERY, STORAGE
    country_id = Column(String, ForeignKey("countries.id"))
    capacity = Column(Float)
    latitude = Column(Float)
    longitude = Column(Float)

class TradeFlow(Base):
    __tablename__ = "trade_flows"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    supplier_id = Column(String, ForeignKey("suppliers.id"))
    destination_country_id = Column(String, ForeignKey("countries.id"))
    commodity_id = Column(String, ForeignKey("commodities.id"))
    route_id = Column(String, ForeignKey("routes.id"))
    volume = Column(Float)

# ---------------------------------------------------------
# INTELLIGENCE & SCENARIOS
# ---------------------------------------------------------

class GeopoliticalEvent(Base):
    __tablename__ = "geopolitical_events"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type = Column(String)
    location = Column(String)
    severity = Column(Float)
    affected_entity_id = Column(String)
    confidence = Column(Float)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    source_id = Column(String)

class RiskScore(Base):
    __tablename__ = "risk_scores"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_id = Column(String, index=True)
    score = Column(Float)
    level = Column(Enum(RiskLevel))
    factors = Column(JSON)
    confidence = Column(Float)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    model_version = Column(String)

class Job(Base):
    __tablename__ = "jobs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type = Column(String)
    status = Column(Enum(JobStatus), default=JobStatus.QUEUED)
    progress = Column(Float, default=0.0)
    result = Column(JSON, nullable=True)
    error = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class Scenario(Base):
    __tablename__ = "scenarios"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String)
    parameters = Column(JSON)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

# ---------------------------------------------------------
# INFRASTRUCTURE & OUTBOX
# ---------------------------------------------------------

class OutboxEvent(Base):
    __tablename__ = "outbox_events"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    aggregate_type = Column(String)
    aggregate_id = Column(String)
    event_type = Column(Enum(EventType))
    payload = Column(JSON)
    status = Column(Enum(JobStatus), default=JobStatus.QUEUED)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    processed_at = Column(DateTime, nullable=True)
    retry_count = Column(Integer, default=0)
