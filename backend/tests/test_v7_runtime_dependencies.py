from pathlib import Path
import re
import os
import subprocess
import sys
from uvicorn.config import Config


def test_public_application_does_not_load_optional_inference_runtime():
    result = subprocess.run([sys.executable, '-c',
        "import sys; from app.main import health_ml; from fastapi import Response; "
        "assert health_ml(Response())['ready'] is False; "
        "assert 'torch' not in sys.modules; "
        "from app.services.image_validation import validate_image_payload; "
        "assert 'torch' not in sys.modules"],
        env={**os.environ, 'ENVIRONMENT': 'test', 'DATABASE_URL': 'sqlite:///:memory:'},
        capture_output=True, text=True, timeout=60)
    assert result.returncode == 0, result.stderr


def test_uvicorn_has_a_real_websocket_transport():
    async def app(scope, receive, send):
        pass
    config = Config(app, log_config=None)
    config.load()
    assert config.ws_protocol_class is not None, 'WebSocket transport must be installed by deployment locks'


def test_both_deployment_locks_pin_and_hash_every_distribution():
    backend = Path(__file__).resolve().parents[1]
    for name in ['requirements.lock', 'requirements-linux.lock']:
        contents = (backend / name).read_text(encoding='utf-8')
        assert re.search(r'^websockets==', contents, re.M), name
        blocks = re.split(r'(?=^[a-zA-Z0-9][a-zA-Z0-9_.-]*==)', contents, flags=re.M)[1:]
        assert blocks, name
        for block in blocks:
            assert '--hash=sha256:' in block, (name, block.splitlines()[0])
