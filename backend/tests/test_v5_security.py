import os
import time
from unittest.mock import patch
import jwt
import pytest
from fastapi import HTTPException, Response
from starlette.requests import Request
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from app.core import auth, rate_limit
from app.main import health_ready

@pytest.mark.parametrize('claim,value', [('iss','https://unrelated.example'), ('aud','wrong'), ('azp','https://untrusted.example')])
def test_clerk_cross_application_tokens_rejected(claim,value):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public = key.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    payload = dict(sub='user', exp=int(time.time())+600, iss='https://clerk.example', aud='cyclonet', azp='https://cyclonet.example')
    payload[claim] = value
    token = jwt.encode(payload, key, algorithm='RS256')
    with patch.multiple(auth, ENVIRONMENT='production', CLERK_ISSUER='https://clerk.example', CLERK_AUDIENCE='cyclonet',
                        CLERK_AUTHORIZED_PARTIES={'https://cyclonet.example'}, CLERK_PEM_PUBLIC_KEY=public):
        assert auth.decode_token_payload(token) is None

def test_production_redis_failure_cannot_opt_out():
    request = Request({'type':'http','client':('127.0.0.1',100)})
    with patch.multiple(rate_limit, ENVIRONMENT='production', REDIS_FAIL_CLOSED=False, _redis_client=None):
        with pytest.raises(HTTPException) as exc:
            rate_limit.enforce_rate_limit(request, 'admin')
    assert exc.value.status_code == 503

def test_missing_redis_is_unready(monkeypatch):
    monkeypatch.setenv('ENVIRONMENT','production')
    monkeypatch.delenv('REDIS_URL', raising=False)
    response = Response()
    assert health_ready(response)['status'] == 'unready'
    assert response.status_code == 503
