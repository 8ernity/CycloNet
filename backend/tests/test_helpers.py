import jwt
import datetime
import os
from app.core import auth

def make_valid_test_token(sub: str = "user_test_123", role: str = "member", exp_minutes: int = 60) -> str:
    """Helper to generate signed, cryptographically valid tokens for test suites."""
    secret = auth.JWT_SECRET_KEY or "test-jwt-secret-key-32byteslong!!"
    payload = {
        "sub": sub,
        "role": role,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=exp_minutes),
        "nbf": datetime.datetime.utcnow() - datetime.timedelta(seconds=5),
        "iat": datetime.datetime.utcnow()
    }
    return jwt.encode(payload, secret, algorithm="HS256")
