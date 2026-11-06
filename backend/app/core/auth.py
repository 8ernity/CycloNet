import os
import time
import datetime
import secrets
import logging
from enum import Enum
from typing import Optional, Dict, Any, List
from fastapi import Header, HTTPException, Depends, Request, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from jwt import PyJWKClient

logger = logging.getLogger(__name__)

# Security configuration - SEC-01, SEC-02, SEC-03
ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "")
CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY", "")
CLERK_PEM_PUBLIC_KEY = os.getenv("CLERK_PEM_PUBLIC_KEY", "")
CLERK_JWKS_URL = os.getenv("CLERK_JWKS_URL", "")
CLERK_ISSUER = os.getenv("CLERK_ISSUER", "")
CLERK_AUDIENCE = os.getenv("CLERK_AUDIENCE", "")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "")
ENVIRONMENT = os.getenv("ENVIRONMENT", "production").lower()

security_bearer = HTTPBearer(auto_error=False)

# Cached JWKS client for Clerk public key rotation - SEC-01
_jwks_client: Optional[PyJWKClient] = None

# SEC-02: Role Enumeration and Hierarchy
class Role(str, Enum):
    PUBLIC_VIEWER = "public_viewer"
    AUTHENTICATED_ANALYST = "authenticated_analyst"
    AUTHORIZED_OPERATOR = "authorized_operator"
    ADMINISTRATOR = "administrator"

ROLE_MAPPING: Dict[str, Role] = {
    "admin": Role.ADMINISTRATOR,
    "administrator": Role.ADMINISTRATOR,
    "operator": Role.AUTHORIZED_OPERATOR,
    "authorized_operator": Role.AUTHORIZED_OPERATOR,
    "analyst": Role.AUTHENTICATED_ANALYST,
    "authenticated_analyst": Role.AUTHENTICATED_ANALYST,
    "member": Role.AUTHENTICATED_ANALYST,
    "viewer": Role.PUBLIC_VIEWER,
    "public_viewer": Role.PUBLIC_VIEWER,
}

ROLE_HIERARCHY: Dict[Role, int] = {
    Role.PUBLIC_VIEWER: 1,
    Role.AUTHENTICATED_ANALYST: 2,
    Role.AUTHORIZED_OPERATOR: 3,
    Role.ADMINISTRATOR: 4,
}

def get_jwks_client() -> Optional[PyJWKClient]:
    """Returns a cached PyJWKClient for Clerk's JWKS endpoint with rotation support (SEC-01)."""
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

def parse_role_from_claims(claims: Dict[str, Any], token_type: Optional[str] = None) -> Role:
    """
    SEC-02 & FIX-03: Strict exact matching against defined role enumeration.
    Privileged roles (ADMINISTRATOR, AUTHORIZED_OPERATOR) are only granted from:
    1. For Clerk tokens: 'public_metadata.role', 'public_metadata.cyclonet_role', or verified 'org_role'.
       Unverified top-level claims from user profiles CANNOT grant operator or admin status.
    2. For verified internal tokens (token_type='internal'): trusted 'cyclonet_role' or 'role'.
    """
    if token_type is None:
        token_type = claims.get("_token_type", "clerk")

    if token_type == "clerk":
        # Check backend-controlled public_metadata
        public_meta = claims.get("public_metadata")
        if isinstance(public_meta, dict):
            meta_role = public_meta.get("cyclonet_role") or public_meta.get("role")
            if meta_role and isinstance(meta_role, str):
                matched = ROLE_MAPPING.get(meta_role.strip().lower(), Role.PUBLIC_VIEWER)
                if matched != Role.PUBLIC_VIEWER:
                    return matched

        # Check verified organization membership role
        org_role = claims.get("org_role")
        if org_role and isinstance(org_role, str):
            matched = ROLE_MAPPING.get(org_role.strip().lower(), Role.PUBLIC_VIEWER)
            if matched != Role.PUBLIC_VIEWER:
                return matched

        # Top-level claims on Clerk tokens: Can only grant up to AUTHENTICATED_ANALYST.
        # User-supplied claims cannot grant AUTHORIZED_OPERATOR or ADMINISTRATOR!
        raw_role = claims.get("cyclonet_role") or claims.get("role") or ""
        if isinstance(raw_role, str):
            matched = ROLE_MAPPING.get(raw_role.strip().lower(), Role.PUBLIC_VIEWER)
            if ROLE_HIERARCHY[matched] >= ROLE_HIERARCHY[Role.AUTHORIZED_OPERATOR]:
                logger.warning(
                    "[Auth] Untrusted top-level role claim '%s' attempted privilege escalation. Demoting to AUTHENTICATED_ANALYST.",
                    raw_role
                )
                return Role.AUTHENTICATED_ANALYST
            return matched
        return Role.PUBLIC_VIEWER
    else:
        # Verified internal HMAC tokens
        raw_role = (
            claims.get("cyclonet_role")
            or claims.get("org_role")
            or claims.get("role")
            or ""
        )
        if isinstance(raw_role, str):
            normalized = raw_role.strip().lower()
            return ROLE_MAPPING.get(normalized, Role.PUBLIC_VIEWER)
        elif isinstance(raw_role, (list, tuple)):
            highest = Role.PUBLIC_VIEWER
            for item in raw_role:
                if isinstance(item, str):
                    matched = ROLE_MAPPING.get(item.strip().lower(), Role.PUBLIC_VIEWER)
                    if ROLE_HIERARCHY[matched] > ROLE_HIERARCHY[highest]:
                        highest = matched
            return highest
        return Role.PUBLIC_VIEWER

def decode_token_payload(token: str) -> Optional[Dict[str, Any]]:
    """
    SEC-01, SEC-03, FIX-03: Cryptographically verifies JWT signatures.
    Separates Clerk (RS256) from internal application (HS256) tokens.
    Strictly verifies signatures, expiration (exp), not-before (nbf), and algorithm allowlist.
    NEVER decodes unverified payloads or accepts forged algorithm=none tokens.
    """
    if not token or not token.strip():
        return None

    # Inspect algorithm without verifying signature first to select correct verification path
    try:
        header = jwt.get_unverified_header(token)
    except Exception:
        return None

    alg = header.get("alg")
    if alg not in ("RS256", "HS256"):
        logger.warning("[Auth] Rejected token with disallowed algorithm '%s'", alg)
        return None

    options = {
        "verify_signature": True,
        "require": ["exp"],
        "verify_exp": True,
        "verify_nbf": True,
        "verify_iat": True,
    }
    if CLERK_ISSUER:
        options["verify_iss"] = True
    if CLERK_AUDIENCE:
        options["verify_aud"] = True

    # 1. Clerk RS256 Verification Path
    if alg == "RS256":
        # 1a. Verify with Clerk PEM Public Key
        if CLERK_PEM_PUBLIC_KEY and CLERK_PEM_PUBLIC_KEY.strip():
            try:
                pem = CLERK_PEM_PUBLIC_KEY.strip()
                if not pem.startswith("-----BEGIN"):
                    pem = f"-----BEGIN PUBLIC KEY-----\n{pem}\n-----END PUBLIC KEY-----"
                decoded = jwt.decode(
                    token,
                    pem,
                    algorithms=["RS256"],
                    issuer=CLERK_ISSUER or None,
                    audience=CLERK_AUDIENCE or None,
                    options=options
                )
                decoded["_token_type"] = "clerk"
                return decoded
            except jwt.ExpiredSignatureError:
                logger.info("[Auth] Token signature has expired.")
                return None
            except jwt.InvalidTokenError as e:
                logger.debug("[Auth] RS256 PEM token verification failed: %s", e)
                return None

        # 1b. Verify via Clerk JWKS Client (RS256 with key rotation and kid match)
        jwks = get_jwks_client()
        if jwks:
            try:
                signing_key = jwks.get_signing_key_from_jwt(token)
                decoded = jwt.decode(
                    token,
                    signing_key.key,
                    algorithms=["RS256"],
                    issuer=CLERK_ISSUER or None,
                    audience=CLERK_AUDIENCE or None,
                    options=options
                )
                decoded["_token_type"] = "clerk"
                return decoded
            except jwt.ExpiredSignatureError:
                logger.info("[Auth] JWKS token signature has expired.")
                return None
            except Exception as e:
                logger.debug("[Auth] JWKS token verification failed: %s", e)
                return None

        # If RS256 token but no Clerk public keys configured, reject
        logger.warning("[Auth] RS256 token received but no Clerk public key/JWKS configured; rejecting.")
        return None

    # 2. Internal HS256 Verification Path
    if alg == "HS256":
        hmac_secret = (JWT_SECRET_KEY or os.getenv("JWT_SECRET_KEY", "")).strip()

        # Fail closed if no secret configured
        if not hmac_secret:
            logger.debug("[Auth] No cryptographic verification secret configured; failing closed.")
            return None

        if len(hmac_secret) < 32 and ENVIRONMENT == "production":
            logger.error("[Auth] In production, JWT_SECRET_KEY must be at least 32 characters; failing closed.")
            return None

        try:
            decoded = jwt.decode(
                token,
                hmac_secret,
                algorithms=["HS256"],
                options={"verify_signature": True, "require": ["exp"], "verify_exp": True}
            )
            decoded["_token_type"] = "internal"
            return decoded
        except jwt.ExpiredSignatureError:
            logger.info("[Auth] HS256 token signature has expired.")
            return None
        except jwt.InvalidTokenError as e:
            logger.debug("[Auth] HS256 token verification failed: %s", e)
            return None

    return None

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_bearer),
    x_admin_key: Optional[str] = Header(None, alias="X-Admin-Key")
) -> Optional[Dict[str, Any]]:
    """
    SEC-01 & SEC-03: Resolves authenticated user identity ONLY from cryptographically
    verified credentials (verified JWT or verified admin API key).
    """
    # 1. Check X-Admin-Key header with constant-time comparison
    if is_valid_admin_key(x_admin_key):
        return {
            "id": "admin-system",
            "role": Role.ADMINISTRATOR.value,
            "role_enum": Role.ADMINISTRATOR,
            "email": "admin@cyclonet.internal",
            "auth_type": "api_key",
            "is_admin": True,
            "is_operator": True
        }

    # 2. Check Bearer token
    if not credentials or not credentials.credentials:
        return None

    token = credentials.credentials.strip()

    # Check if Bearer token matches administrative API key
    if is_valid_admin_key(token):
        return {
            "id": "admin-system",
            "role": Role.ADMINISTRATOR.value,
            "role_enum": Role.ADMINISTRATOR,
            "email": "admin@cyclonet.internal",
            "auth_type": "api_key",
            "is_admin": True,
            "is_operator": True
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

    # SEC-02: Exact role matching from verified claims
    role = parse_role_from_claims(claims)
    is_admin = (role == Role.ADMINISTRATOR)
    is_operator = (role in (Role.ADMINISTRATOR, Role.AUTHORIZED_OPERATOR))

    return {
        "id": str(user_id),
        "role": "admin" if is_admin else ("operator" if is_operator else "analyst"),
        "role_enum": role,
        "email": claims.get("email"),
        "claims": claims,
        "auth_type": "jwt",
        "is_admin": is_admin,
        "is_operator": is_operator
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

def require_role(minimum_role: Role):
    """
    SEC-02: Enforces hierarchical role-based authorization.
    Rejects users with insufficient privileges with HTTP 403.
    """
    async def role_dependency(
        current_user: Dict[str, Any] = Depends(require_authenticated_user)
    ) -> Dict[str, Any]:
        user_role = current_user.get("role_enum", Role.PUBLIC_VIEWER)
        if ROLE_HIERARCHY.get(user_role, 0) < ROLE_HIERARCHY.get(minimum_role, 0):
            raise HTTPException(
                status_code=403,
                detail=f"Forbidden: {minimum_role.value.replace('_', ' ').title()} privileges required."
            )
        return current_user
    return role_dependency

async def require_operator_user(
    current_user: Dict[str, Any] = Depends(require_role(Role.AUTHORIZED_OPERATOR))
) -> Dict[str, Any]:
    """SEC-04: Enforces Authorized Operator or higher privileges."""
    return current_user

async def require_admin_user(
    current_user: Dict[str, Any] = Depends(require_role(Role.ADMINISTRATOR))
) -> Dict[str, Any]:
    """SEC-04: Enforces Administrator privileges."""
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
    3. Cryptographically verified JWT with exact admin role claim
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

        # Check cryptographically verified JWT claims for exact admin role
        claims = decode_token_payload(token)
        if claims:
            role = parse_role_from_claims(claims)
            if role == Role.ADMINISTRATOR:
                return True

    # Reject unauthorized access
    raise HTTPException(
        status_code=401,
        detail="Unauthorized: Access to this administrative endpoint requires a valid Admin Key or verified Admin JWT credentials.",
        headers={"WWW-Authenticate": "Bearer"}
    )

def make_test_token(sub: str = "user_test_123", role: str = "member", exp_minutes: int = 60) -> str:
    """Helper to generate signed, cryptographically valid tokens for test suites."""
    secret = (JWT_SECRET_KEY or os.getenv("JWT_SECRET_KEY", "")).strip()
    if not secret:
        raise ValueError("Cannot make test token: JWT_SECRET_KEY is not configured in environment.")
    payload = {
        "sub": sub,
        "role": role,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=exp_minutes),
        "nbf": datetime.datetime.utcnow() - datetime.timedelta(seconds=5),
        "iat": datetime.datetime.utcnow()
    }
    return jwt.encode(payload, secret, algorithm="HS256")
