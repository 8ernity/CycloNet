import os
import jwt
import datetime

# Ensure test environment variables are loaded prior to app imports
os.environ["ADMIN_API_KEY"] = "test-remediation-admin-key-2026"
os.environ["JWT_SECRET_KEY"] = "test-remediation-secret-key-32byteslong!!"
os.environ["CLERK_SECRET_KEY"] = "test-clerk-secret-key"

import pytest
from app.core import auth

# Re-read environment variables in auth module for test runner
auth.ADMIN_API_KEY = os.environ["ADMIN_API_KEY"]
auth.JWT_SECRET_KEY = os.environ["JWT_SECRET_KEY"]

def make_valid_test_token(sub: str = "user_test_123", role: str = "member", exp_minutes: int = 60) -> str:
    """Helper to generate signed, cryptographically valid tokens for test suites."""
    payload = {
        "sub": sub,
        "role": role,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=exp_minutes),
        "nbf": datetime.datetime.utcnow() - datetime.timedelta(seconds=5),
        "iat": datetime.datetime.utcnow()
    }
    return jwt.encode(payload, auth.JWT_SECRET_KEY, algorithm="HS256")
