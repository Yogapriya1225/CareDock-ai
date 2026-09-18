"""
Authentication endpoints:
- Register
- Login
- OAuth2 token endpoint for Swagger
- Current user
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
)
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.auth import UserCreate, UserOut, LoginRequest, Token


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"]
)


# ---------------------------------------------------------
# REGISTER
# ---------------------------------------------------------

@router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED
)
def register(
    payload: UserCreate,
    db: Session = Depends(get_db)
):
    existing = db.query(User).filter(
        User.email == payload.email
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    user = User(
        full_name=payload.full_name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        phone=payload.phone,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


# ---------------------------------------------------------
# NORMAL LOGIN
# ---------------------------------------------------------

@router.post(
    "/login",
    response_model=Token
)
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.email == payload.email
    ).first()

    if not user or not verify_password(
        payload.password,
        user.hashed_password
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="Account is deactivated"
        )

    token = create_access_token(
        {
            "sub": str(user.id),
            "role": user.role.value
        }
    )

    return Token(
        access_token=token,
        user=user
    )


# ---------------------------------------------------------
# OAUTH2 TOKEN FOR SWAGGER
# ---------------------------------------------------------

@router.post("/token")
def token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    OAuth2-compatible login endpoint used by Swagger UI.

    Swagger sends:
        username = user's email
        password = user's password
    """

    user = db.query(User).filter(
        User.email == form_data.username
    ).first()

    if not user or not verify_password(
        form_data.password,
        user.hashed_password
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="Account is deactivated"
        )

    access_token = create_access_token(
        {
            "sub": str(user.id),
            "role": user.role.value
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


# ---------------------------------------------------------
# CURRENT USER
# ---------------------------------------------------------

@router.get(
    "/me",
    response_model=UserOut
)
def get_me(
    current_user: User = Depends(get_current_user)
):
    return current_user