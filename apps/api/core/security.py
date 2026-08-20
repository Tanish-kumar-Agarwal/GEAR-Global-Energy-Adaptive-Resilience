import os
from datetime import datetime, timedelta, timezone
from typing import Optional, List
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import jwt
from jwt.exceptions import InvalidTokenError as JWTError
from passlib.context import CryptContext
from sqlalchemy.orm import Session
import logging

from core.database import get_db
from models.domain import User, Role, SecurityAudit
from core.logging import get_logger, log_event, user_id_ctx, request_id_ctx, correlation_id_ctx

logger = get_logger(__name__)

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "super_secret_fallback_key_do_not_use_in_prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")

# ---------------------------------------------------------
# CENTRALIZED RBAC MATRIX
# ---------------------------------------------------------
ROLE_PERMISSIONS = {
    Role.ADMIN: ["*"], # Full access
    Role.ANALYST: [
        "scenario:read", "scenario:create", "scenario:execute",
        "optimization:read", "recommendation:read", "intelligence:read",
        "world:read", "risk:read", "graph:read"
    ],
    Role.OPERATOR: [
        "scenario:read", "scenario:create", "scenario:execute",
        "optimization:read", "optimization:execute", "recommendation:read",
        "intelligence:read", "world:read", "risk:read", "graph:read"
    ],
    Role.DECISION_MAKER: [
        "scenario:read", "optimization:read", "recommendation:read",
        "decision:read", "decision:approve", "decision:reject", "decision:review",
        "intelligence:read", "world:read", "risk:read", "graph:read"
    ],
    Role.VIEWER: [
        "scenario:read", "optimization:read", "recommendation:read",
        "decision:read", "intelligence:read", "world:read", "risk:read", "graph:read"
    ]
}

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def log_security_event(db: Session, event_type: str, actor_id: str = None, 
                       resource_type: str = None, resource_id: str = None,
                       action: str = None, outcome: str = None, reason: str = None, metadata: dict = None):
    audit = SecurityAudit(
        event_type=event_type,
        actor_id=actor_id,
        resource_type=resource_type,
        resource_id=resource_id,
        action=action,
        outcome=outcome,
        reason=reason,
        request_id=request_id_ctx.get(),
        correlation_id=correlation_id_ctx.get(),
        metadata_payload=metadata or {}
    )
    db.add(audit)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to write security audit: {e}")
        
    log_event(logger, logging.INFO if outcome == "SUCCESS" else logging.WARNING, 
              event_type, actor_id=actor_id, outcome=outcome, resource_id=resource_id)

def get_current_user(db: Session = Depends(get_db)):
    # BYPASS AUTHENTICATION
    user = db.query(User).filter(User.username == "admin").first()
    if user:
        user_id_ctx.set(user.id)
        return user
    return User(username="admin", role=Role.ADMIN, id="mock-id", is_active=True)

class RequirePermissions:
    def __init__(self, required_permission: str):
        self.required_permission = required_permission

    def __call__(self, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
        perms = ROLE_PERMISSIONS.get(user.role, [])
        if "*" not in perms and self.required_permission not in perms:
            log_security_event(
                db=db,
                event_type="ACCESS_DENIED",
                actor_id=user.id,
                action=self.required_permission,
                outcome="FAILURE",
                reason="Lacks permission"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )
        return user
