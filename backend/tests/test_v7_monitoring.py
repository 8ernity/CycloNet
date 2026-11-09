import io
import json
import logging
import runpy
from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app
from app.core.observability import logger

probe = runpy.run_path(str(Path(__file__).resolve().parents[2]/'scripts/check_readiness.py'))


def test_monitor_rejects_liveness_false_success_and_missing_dependencies():
    valid={'status':'ready','database':'connected','redis':'connected','schema_current':True,'authentication_configured':True}
    assert probe['validate_readiness'](valid)
    for key in valid:
        assert not probe['validate_readiness']({**valid,key:None})
    for payload in [None, [], {'status':'healthy'}, {'status':'alive'}]:
        assert not probe['validate_readiness'](payload)


def test_request_log_omits_credentials_identifiers_query_and_payload():
    output=io.StringIO()
    handler=logging.StreamHandler(output)
    logger.addHandler(handler)
    try:
        response=TestClient(app).get('/unknown-private-person?token=private-query',headers={'Authorization':'Bearer private-token','X-Request-ID':'untrusted-id'})
    finally:
        logger.removeHandler(handler)
    record=json.loads(output.getvalue())
    assert record['route']=='unmatched'
    assert record['status']==404
    assert record['request_id']==response.headers['x-request-id']
    assert record['request_id']!='untrusted-id'
    assert 'private' not in output.getvalue()
