import asyncio
import json
from unittest.mock import AsyncMock
import pytest
from app.api.websocket import SecureWebSocketManager
from app.services.report_service import report_service

@pytest.mark.asyncio
async def test_operator_draft_never_reaches_public_socket():
    manager = SecureWebSocketManager()
    public = AsyncMock()
    manager.active_connections.add(public)
    await manager.broadcast_alert({'private_draft': 'operator only'})
    public.send_json.assert_not_called()

def test_exercise_has_no_hardware_delivery_or_authority_claims():
    result = report_service.dispatch_multi_channel_advisory('Example', 'HIGH', 2, 80, ['SMS','SIREN','VHF'])
    assert result['siren_payload']['target_towers'] is None
    assert result['channels_delivered'] == {}
    assert 'NDMA DRILL' not in json.dumps(result)
    assert 'RETURN TO SAFE HARBOUR' not in json.dumps(result)

def test_legacy_exercise_does_not_invent_latency():
    result = report_service.simulate_emergency_broadcast({'name':'Example'}, 'exercise', ['sms'])
    assert result['channel_metrics']['sms']['avg_latency'] is None

@pytest.mark.parametrize('role,accepted',[('member',False),('operator',True),('admin',True)])
def test_operator_channel_enforces_verified_roles(role,accepted):
    from fastapi.testclient import TestClient
    from starlette.websockets import WebSocketDisconnect
    from app.main import app
    from app.core.auth import make_test_token
    with TestClient(app).websocket_connect('/ws/operator-events') as connection:
        connection.send_json({'token':make_test_token(role=role)})
        if accepted:
            assert connection.receive_json()['type']=='handshake'
        else:
            with pytest.raises(WebSocketDisconnect): connection.receive_json()

def test_operator_channel_rejects_expired_credentials():
    from fastapi.testclient import TestClient
    from starlette.websockets import WebSocketDisconnect
    from app.main import app
    from app.core.auth import make_test_token
    with TestClient(app).websocket_connect('/ws/operator-events') as connection:
        connection.send_json({'token':make_test_token(role='operator',exp_minutes=-1)})
        with pytest.raises(WebSocketDisconnect): connection.receive_json()

def test_operator_channel_rejects_anonymous_and_untrusted_origin():
    from fastapi.testclient import TestClient
    from starlette.websockets import WebSocketDisconnect
    from app.main import app
    with TestClient(app).websocket_connect('/ws/operator-events') as connection:
        connection.send_json({})
        with pytest.raises(WebSocketDisconnect): connection.receive_json()
    with pytest.raises(WebSocketDisconnect):
        with TestClient(app).websocket_connect('/ws/operator-events',headers={'origin':'https://untrusted.invalid'}):
            raise AssertionError('Untrusted origin accepted')

@pytest.mark.asyncio
async def test_connected_operator_loses_access_at_expiry():
    import time
    manager=SecureWebSocketManager(operator_only=True)
    connection=AsyncMock()
    manager.active_connections.add(connection)
    manager.expires[connection]=time.time()-1
    await manager._broadcast({'private':'draft'})
    connection.send_json.assert_not_called()
    assert connection not in manager.active_connections

def test_public_message_rate_is_bounded():
    from fastapi.testclient import TestClient
    from starlette.websockets import WebSocketDisconnect
    from app.main import app
    with TestClient(app).websocket_connect('/ws/cyclone-stream') as connection:
        assert connection.receive_json()['type']=='handshake'
        for _ in range(60):
            connection.send_json({'action':'ping'})
            assert connection.receive_json()['type']=='pong'
        connection.send_json({'action':'ping'})
        with pytest.raises(WebSocketDisconnect): connection.receive_json()
