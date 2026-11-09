"""Real Uvicorn processes and sockets, isolated DB schema, no agency ingestion.

Complements in-process tests; does not certify hosted capacity or Clerk access.
"""
import asyncio
import json
import os
from pathlib import Path
import socket
import statistics
import subprocess
import sys
import time
from urllib.parse import urlsplit, urlunsplit

import httpx
import jwt
import pytest
import redis
from alembic import command
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from test_v5_infrastructure import infrastructure


def free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


def test_two_real_servers_websockets_and_local_soak(infrastructure, tmp_path):
    from websockets.asyncio.client import connect
    from websockets.exceptions import ConnectionClosed, InvalidStatus

    config, engine, _, _ = infrastructure
    command.upgrade(config, 'head')
    # A separate logical Redis DB keeps real HTTP quotas away from unit fixtures.
    parts = urlsplit(os.environ['TEST_REDIS_URL'])
    redis_url = urlunsplit((parts.scheme, parts.netloc, '/15', '', ''))
    cache = redis.from_url(redis_url, socket_timeout=3)
    assert cache.dbsize() == 0, 'Runtime test Redis DB 15 must be empty; do not overwrite existing state'
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public = key.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    issuer, origin = 'https://fixture.clerk.invalid', 'https://fixture.cyclonet.invalid'
    env = {**os.environ, 'ENVIRONMENT': 'production', 'DATABASE_URL': engine.url.render_as_string(hide_password=False),
           'REDIS_URL': redis_url, 'REDIS_FAIL_CLOSED': 'true', 'ENABLE_INGESTION_WORKER': 'false',
           'CLERK_ISSUER': issuer, 'CLERK_PEM_PUBLIC_KEY': public, 'CLERK_JWKS_URL': '', 'CLERK_AUDIENCE': '',
           'CLERK_AUTHORIZED_PARTIES': origin, 'CORS_ORIGINS': origin, 'REQUIRE_VALIDATED_ML': 'false',
           'GEMINI_API_KEY': '', 'GEE_PROJECT_ID': '', 'JWT_SECRET_KEY': '', 'ADMIN_API_KEY': ''}
    ports, processes, logs = [], [], []
    durations = []
    request_count = 0
    started = time.monotonic()
    try:
        for number in range(2):
            port = free_port()
            log = (tmp_path / f'worker-{number}.log').open('wb')
            logs.append(log)
            process = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1',
                                        '--port', str(port), '--no-access-log', '--ws-max-size', '4096'],
                                       cwd=Path(__file__).resolve().parents[1], env=env, stdout=log, stderr=log)
            processes.append(process)
            ports.append(port)
            deadline = time.monotonic() + 90
            # Use the same functional request budget as the exercise below.
            # A short retry timeout can pile up schema probes on a busy host.
            with httpx.Client(trust_env=False, timeout=10) as client:
                while True:
                    assert process.poll() is None, 'Real backend exited before readiness; inspect private test log'
                    try:
                        response = client.get(f'http://127.0.0.1:{port}/health/ready')
                        if response.status_code == 200:
                            assert response.json()['redis'] == 'connected'
                            break
                    except httpx.HTTPError:
                        pass
                    if time.monotonic() > deadline:
                        raise AssertionError('Real backend failed to become ready')
                    time.sleep(.2)

        def token(role, seconds=60):
            return jwt.encode({'sub': 'runtime-fixture-user', 'iss': issuer, 'azp': origin,
                               'exp': int(time.time()) + seconds, 'public_metadata': {'role': role}}, key, algorithm='RS256')

        async def socket_checks():
            for port in ports:
                base = f'ws://127.0.0.1:{port}/api/ws'
                async with connect(base + '/cyclone-stream', origin=origin, proxy=None, open_timeout=5) as ws:
                    assert json.loads(await asyncio.wait_for(ws.recv(), 5))['type'] == 'handshake'
                    await ws.send(json.dumps({'action': 'ping'}))
                    for _ in range(5):
                        message = json.loads(await asyncio.wait_for(ws.recv(), 5))
                        if message['type'] == 'pong':
                            break
                        assert 'token' not in message and 'operator_events' not in message
                    else:
                        raise AssertionError('Public WebSocket did not answer ping')
                with pytest.raises(InvalidStatus):
                    async with connect(base + '/cyclone-stream', origin='https://untrusted.invalid', proxy=None, open_timeout=5):
                        pass
                for credential in ['forged', token('member'), token('operator', -1)]:
                    async with connect(base + '/operator-events', origin=origin, proxy=None, open_timeout=5) as ws:
                        await ws.send(json.dumps({'token': credential}))
                        with pytest.raises(ConnectionClosed):
                            await asyncio.wait_for(ws.recv(), 5)
                async with connect(base + '/operator-events', origin=origin, proxy=None, open_timeout=5) as ws:
                    await ws.send(json.dumps({'token': token('operator')}))
                    assert json.loads(await asyncio.wait_for(ws.recv(), 5))['type'] == 'handshake'

        asyncio.run(socket_checks())

        async def soak():
            nonlocal request_count
            # One minute is a bounded local exercise, not a production soak SLA.
            deadline = time.monotonic() + 60
            async with httpx.AsyncClient(trust_env=False, timeout=10, limits=httpx.Limits(max_connections=6)) as client:
                async def worker(number):
                    nonlocal request_count
                    urls = ['/health/ready', '/api/cyclones?limit=10', '/api/ingest/status']
                    while time.monotonic() < deadline:
                        before = time.monotonic()
                        response = await client.get(f'http://127.0.0.1:{ports[number % 2]}' + urls[request_count % 3])
                        durations.append((time.monotonic() - before) * 1000)
                        assert response.status_code == 200
                        response.json()
                        request_count += 1
                        await asyncio.sleep(.15)
                await asyncio.gather(*(worker(number) for number in range(6)))
        asyncio.run(soak())
        assert request_count >= 60
        # Expensive-route rate limits must be shared between actual processes.
        with httpx.Client(trust_env=False, timeout=10) as client:
            statuses = [client.get(f'http://127.0.0.1:{ports[n % 2]}/api/surge/calculate').status_code for n in range(31)]
            assert statuses.count(200) == 30 and statuses[-1] == 429
            assert client.post(f'http://127.0.0.1:{ports[0]}/api/ingest/sync').status_code in (401, 403)
        report = {'scope': 'Two local production-mode Uvicorn processes, fixture RSA identity, isolated PostgreSQL/Redis; no live Clerk or agency acceptance',
                  'workers': 2, 'soak_seconds': 60, 'http_requests': request_count, 'unexpected_http_failures': 0,
                  'median_ms': round(statistics.median(durations), 2),
                  'p95_ms': round(sorted(durations)[int(len(durations) * .95)], 2),
                  'public_socket_and_origin_checks': 'passed', 'operator_socket_role_expiry_forgery_checks': 'passed',
                  'cross_worker_quota': '30 allowed; request 31 rejected', 'elapsed_seconds': round(time.monotonic() - started, 2)}
        output = os.environ.get('V7_NETWORK_REPORT')
        if output:
            Path(output).write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    finally:
        for process in processes:
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=15)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=10)
        for log in logs:
            log.close()
        # Only the empty-at-start test DB and this application's quota keys.
        keys = list(cache.scan_iter(match='ratelimit:*')) + list(cache.scan_iter(match='cyclonet:*'))
        if keys:
            cache.delete(*keys)
        cache.close()
