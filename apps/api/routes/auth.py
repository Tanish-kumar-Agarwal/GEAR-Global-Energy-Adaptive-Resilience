from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from core.database import get_db
from models.domain import User
from core.security import verify_password, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES, log_security_event

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])

@router.post("/token")
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        # Log failure securely
        log_security_event(db, "LOGIN_FAILURE", actor_id=form_data.username, outcome="FAILURE", reason="Invalid credentials")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not user.is_active:
        log_security_event(db, "LOGIN_FAILURE", actor_id=user.id, outcome="FAILURE", reason="User disabled")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role.value}, expires_delta=access_token_expires
    )
    
    # Log success
    log_security_event(db, "LOGIN_SUCCESS", actor_id=user.id, outcome="SUCCESS")
    
    return {"access_token": access_token, "token_type": "bearer"}
