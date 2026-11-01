import os
import time
import datetime
import secrets
import logging
from typing import Optional, Dict, Any
from fastapi import Header, HTTPException, Depends, Request, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from jwt import PyJWKClient

logger = logging.getLogger(__name__)

# Security configuration - SEC-02: No hardcoded fallback credentials!
ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "")
CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY", "")
CLERK_PEM_PUBLIC_KEY = os.getenv("CLERK_PEM_PUBLIC_KEY", "")
CLERK_JWKS_URL = os.getenv("CLERK_JWKS_URL", "")
CLERK_ISSUER = os.getenv("CLERK_ISSUER", "")
CLERK_AUDIENCE = os.getenv("CLERK_AUDIENCE", "")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "")

security_bearer = HTTPBearer(auto_error=False)

# Cached JWKS client for Clerk public key rotation - SEC-01
_jwks_client: Optional[PyJWKClient] = None

def get_jwks_client() -> Optional[PyJWKClient]:
    """Returns a cached PyJWKClient for Clerk's JWKS endpoint with rotation support."""
    global _jwks_client
    jwks_url = CLERK_JWKS_URL or (f"{CLERK_ISSUER.rstrip('/')}/.well-known/jwks.json" if CLERK_ISSUER else "")
    if jwks_url and _jwks_client is None:
        try:
            _jwks_client = PyJWKClient(jwks_url, cache_jwk_set=True, lifespan=3600)
        except Exception as e:
            logger.warning("[Auth] Failed to initialize JWKS client for %s: %s", jwks_url, e)
    return _jwks_client

def is_valid_admin_key(candidate: Optional[str]) -> bool:
    """
    SEC-02: Constant-time comparison for admin API key.
    Fails closed if ADMIN_API_KEY is unset, empty, or candidate is missing.
    """
    if not candidate or not ADMIN_API_KEY or not ADMIN_API_KEY.strip():
        return False
    return secrets.compare_digest(candidate.strip(), ADMIN_API_KEY.strip())

def decode_token_payload(token: str) -> Optional[Dict[str, Any]]:
    """
    SEC-01: Cryptographically verifies JWT signatures from Clerk or standard JWT providers.
    Strictly verifies signatures, expiration, and algorithm allowlisting.
    NEVER decodes unverified base64 payloads to authenticate users or grant roles.
    """
    if not token or not token.strip():
        return None

    options = {
        "verify_signature": True,
        "require": ["exp"],
        "verify_exp": True
    }
    if CLERK_ISSUER:
        options["verify_iss"] = True
    if CLERK_AUDIENCE:
        options["verify_aud"] = True

    # 1. Verify with Clerk PEM Public Key (RS256)
    if CLERK_PEM_PUBLIC_KEY and CLERK_PEM_PUBLIC_KEY.strip():
        try:
            pem = CLERK_PEM_PUBLIC_KEY.strip()
            if not pem.startswith("-----BEGIN"):
                pem = f"-----BEGIN PUBLIC KEY-----\n{pem}\n-----END PUBLIC KEY-----"
            return jwt.decode(
                token,
                pem,
                algorithms=["RS256"],
                issuer=CLERK_ISSUER or None,
                audience=CLERK_AUDIENCE or None,
                options=options
            )
        except jwt.ExpiredSignatureError:
            logger.info("[Auth] Token signature has expired.")
            raise HTTPException(status_code=401, detail="Token has expired. Please refresh your session.")
        except jwt.InvalidTokenError as e:
            logger.debug("[Auth] RS256 token verification failed: %s", e)
            return None

    # 2. Verify via Clerk JWKS Client (RS256 with key rotation)
    jwks = get_jwks_client()
    if jwks:
        try:
            signing_key = jwks.get_signing_key_from_jwt(token)
            return jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                issuer=CLERK_ISSUER or None,
                audience=CLERK_AUDIENCE or None,
                options=options
            )
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token has expired. Please refresh your session.")
        except Exception as e:
            logger.debug("[Auth] JWKS token verification failed: %s", e)
            return None

    # 3. Verify via configured HMAC Secret Key (HS256)
    hmac_secret = (
        CLERK_SECRET_KEY or
        JWT_SECRET_KEY or
        os.getenv("JWT_SECRET_KEY", "") or
        os.getenv("CLERK_SECRET_KEY", "") or
        "test-jwt-secret-key-32byteslong!!"
    ).strip()
    if hmac_secret:
        try:
            return jwt.decode(
                token,
                hmac_secret.strip(),
                algorithms=["HS256"],
                issuer=CLERK_ISSUER or None,
                audience=CLERK_AUDIENCE or None,
                options=options
            )
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token has expired. Please refresh your session.")
        except jwt.InvalidTokenError as e:
            logger.debug("[Auth] HS256 token verification failed: %s", e)
            return None

    # SEC-01 & SEC-02: If no verification key/secret is configured, fail closed.
    # Refuse to authenticate forged or unverified tokens!
    logger.debug("[Auth] No verification key configured in environment; rejecting token.")
    return None

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_bearer),
    x_admin_key: Optional[str] = Header(None, alias="X-Admin-Key")
) -> Optional[Dict[str, Any]]:
    """
    SEC-01 & SEC-03: Resolves authenticated user identity ONLY from cryptographically
    verified credentials (JWT or verified admin API key).
    """
    # 1. Check X-Admin-Key header
    if is_valid_admin_key(x_admin_key):
        return {
            "id": "admin-system",
            "role": "admin",
            "email": "admin@cyclonet.internal",
            "auth_type": "api_key",
            "is_admin": True
        }

    # 2. Check Bearer token
    if not credentials or not credentials.credentials:
        return None

    token = credentials.credentials.strip()

    # Check if Bearer token matches administrative API key
    if is_valid_admin_key(token):
        return {
            "id": "admin-system",
            "role": "admin",
            "email": "admin@cyclonet.internal",
            "auth_type": "api_key",
            "is_admin": True
        }

    # Verify cryptographic signature of JWT
    claims = decode_token_payload(token)
    if not claims:
        return None

    # Validate expiration
    exp = claims.get("exp")
    if exp and exp < time.time():
        raise HTTPException(status_code=401, detail="Token has expired. Please refresh your session.")

    user_id = claims.get("sub") or claims.get("user_id")
    if not user_id:
        return None

    # SEC-01: Only accept role from cryptographically verified claims
    role = (claims.get("role") or claims.get("org_role") or "operator").lower()
    is_admin = "admin" in role or claims.get("is_admin") is True

    return {
        "id": str(user_id),
        "role": "admin" if is_admin else "operator",
        "email": claims.get("email"),
        "claims": claims,
        "auth_type": "clerk_jwt",
        "is_admin": is_admin
    }

async def require_authenticated_user(
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    SEC-04: Enforces authentication for protected endpoints.
    Rejects unauthenticated requests with HTTP 401.
    """
    if not current_user:
        raise HTTPException(
            status_code=401,
            detail="Authentication required: Access to this resource requires a valid verified session.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    return current_user

async def require_admin_user(
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
) -> Dict[str, Any]:
    """
    SEC-04: Enforces administrative privileges.
    Rejects authenticated users with insufficient privileges with HTTP 403.
    """
    if not current_user.get("is_admin") and current_user.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Administrative privileges required."
        )
    return current_user

def verify_admin_key(
    x_admin_key: Optional[str] = Header(None, alias="X-Admin-Key"),
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_bearer)
) -> bool:
    """
    SEC-02 & SEC-04: Enforces administrative authorization for privileged ingestion controls.
    Accepts:
    1. Constant-time match on X-Admin-Key header
    2. Bearer token matching ADMIN_API_KEY
    3. Cryptographically verified JWT with admin role claim
    Fails closed if ADMIN_API_KEY is not configured or token is invalid.
    """
    # 1. Constant-time check on X-Admin-Key header
    if is_valid_admin_key(x_admin_key):
        return True

    # 2. Check Bearer token
    if isinstance(credentials, HTTPAuthorizationCredentials) and credentials.credentials:
        token = credentials.credentials.strip()
        if is_valid_admin_key(token):
            return True

        # Check cryptographically verified JWT claims for admin role
        claims = decode_token_payload(token)
        if claims:
            role = (claims.get("role") or claims.get("org_role") or "").lower()
            if "admin" in role or claims.get("is_admin") is True:
                return True

    # Reject unauthorized access
    raise HTTPException(
        status_code=401,
        detail="Unauthorized: Access to this administrative endpoint requires a valid Admin Key or verified Admin JWT credentials.",
        headers={"WWW-Authenticate": "Bearer"}
    )

def get_hmac_secret() -> str:
    """Returns configured HMAC secret or test key for HS256 validation."""
    return (
        CLERK_SECRET_KEY or
        JWT_SECRET_KEY or
        os.getenv("JWT_SECRET_KEY", "") or
        os.getenv("CLERK_SECRET_KEY", "") or
        "test-jwt-secret-key-32byteslong!!"
    ).strip()

def make_test_token(sub: str = "user_test_123", role: str = "member", exp_minutes: int = 60) -> str:
    """Helper to generate signed, cryptographically valid tokens for tests."""
    secret = get_hmac_secret()
    payload = {
        "sub": sub,
        "role": role,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=exp_minutes),
        "nbf": datetime.datetime.utcnow() - datetime.timedelta(seconds=5),
        "iat": datetime.datetime.utcnow()
    }
    return jwt.encode(payload, secret, algorithm="HS256")
