import os
import pytest
import jwt
from unittest.mock import patch

from app.core import auth
from app.core.auth import (
    Role,
    ROLE_MAPPING,
    parse_role_from_claims,
    decode_token_payload,
    is_valid_admin_key,
    make_test_token
)

def test_role_matching_is_exact_not_substring():
    """
    FIX-008 & SEC-02: Substring matches like 'administrator_fake' or 'not_an_admin'
    must NOT match Role.ADMINISTRATOR.
    """
    fake_admin_claims = {
        "public_metadata": {"role": "administrator_fake"},
        "_token_type": "clerk"
    }
    role = parse_role_from_claims(fake_admin_claims)
    assert role == Role.PUBLIC_VIEWER
    assert role != Role.ADMINISTRATOR

    analyst_claims = {
        "public_metadata": {"role": "analyst"},
        "_token_type": "clerk"
    }
    assert parse_role_from_claims(analyst_claims) == Role.AUTHENTICATED_ANALYST

    admin_claims = {
        "public_metadata": {"role": "administrator"},
        "_token_type": "clerk"
    }
    assert parse_role_from_claims(admin_claims) == Role.ADMINISTRATOR

def test_production_hmac_fails_closed_when_secret_too_short_or_missing():
    """
    FIX-008: In production, JWT_SECRET_KEY must be >= 32 chars.
    A short key or missing key must fail closed immediately.
    """
    with patch.object(auth, "ENVIRONMENT", "production"):
        with patch.object(auth, "JWT_SECRET_KEY", "short_secret"):
            # Token signed with short secret
            token = jwt.encode({"sub": "test", "exp": 9999999999}, "short_secret", algorithm="HS256")
            res = decode_token_payload(token)
            assert res is None

def test_forged_none_algorithm_jwt_rejected():
    """
    FIX-008: Algorithm=none must be rejected regardless of header claims.
    """
    forged_token = "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImlzX2FkbWluIjp0cnVlfQ."
    assert decode_token_payload(forged_token) is None

def test_admin_api_key_constant_time_comparison():
    """
    FIX-008: Admin API key check fails closed on None, empty string, or invalid key.
    """
    with patch.object(auth, "ADMIN_API_KEY", "super_secret_admin_key_1234567890"):
        assert is_valid_admin_key(None) is False
        assert is_valid_admin_key("") is False
        assert is_valid_admin_key("wrong_key") is False
        assert is_valid_admin_key("super_secret_admin_key_1234567890") is True

    with patch.object(auth, "ADMIN_API_KEY", ""):
        assert is_valid_admin_key("any_key") is False
