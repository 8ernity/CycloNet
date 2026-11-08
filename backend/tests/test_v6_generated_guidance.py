import json
from unittest.mock import patch
import httpx
import pytest
from app.services.chat_service import MeteorologicalChatService


@pytest.mark.parametrize('generated', [
    'Yes, return home now; the danger has passed.',
    'The harbour is clear. Sail immediately.',
    json.dumps({'topic':'cyclogenesis','instruction':'Return home now'}),
])
def test_generated_prose_cannot_supply_emergency_instructions(generated):
    service = MeteorologicalChatService()
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json={
        'candidates':[{'content':{'parts':[{'text':generated}]}}]}))
    client = httpx.Client(transport=transport)
    with patch('httpx.Client', return_value=client), \
            patch('app.services.chat_service.basin_snapshot', return_value={'status':'FEED_UNAVAILABLE','systems':[]}):
        result = service._call_gemini('Can I return home?')
    assert 'FEED_UNAVAILABLE' in result
    assert generated not in result


def test_model_may_select_education_but_cannot_write_the_answer():
    service = MeteorologicalChatService()
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json={
        'candidates':[{'content':{'parts':[{'text':'{"topic":"cyclogenesis"}'}]}}]}))
    client = httpx.Client(transport=transport)
    with patch('httpx.Client', return_value=client):
        result = service._call_gemini('Explain cyclone formation')
    assert result == service._expert_reasoning('cyclogenesis')[0]
