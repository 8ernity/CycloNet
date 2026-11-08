from datetime import datetime, timezone
from unittest.mock import patch, AsyncMock
import httpx
import pytest
from app.services.live_ingestion import LiveIngestionService

@pytest.mark.asyncio
@pytest.mark.parametrize('unit,expected',[('KT',22.224),('KNOTS',22.224),('KM/H',12),('KMPH',12),('',None)])
async def test_imd_movement_normalization(unit,expected):
    text = f'TROPICAL CYCLONE ADVISORY NO. 1 {datetime.now(timezone.utc).replace(microsecond=0).isoformat()} Cyclonic Storm ALPHA over Bay of Bengal position near 15.0N 85.0E MOVING AT 12 {unit} SUSTAINED WIND 50 KT'
    with patch('httpx.AsyncClient.get',AsyncMock(return_value=httpx.Response(200,text=text))):
        result=await LiveIngestionService()._fetch_imd_bulletins()
    assert len(result.systems)==1
    assert result.systems[0]['movement_speed_kmph']==pytest.approx(expected) if expected else result.systems[0]['movement_speed_kmph'] is None

@pytest.mark.asyncio
async def test_imd_multi_storm_page_cannot_mix_observations():
    text = f'TROPICAL CYCLONE ADVISORY NO. 1 {datetime.now(timezone.utc).replace(microsecond=0).isoformat()} Cyclonic Storm ALPHA position near 15.0N 85.0E MOVING AT 12 KT Cyclonic Storm BETA position near 18.0N 90.0E SUSTAINED WIND 80 KT'
    with patch('httpx.AsyncClient.get',AsyncMock(return_value=httpx.Response(200,text=text))):
        result=await LiveIngestionService()._fetch_imd_bulletins()
    assert not result.systems

@pytest.mark.asyncio
async def test_wind_speed_is_not_movement_speed():
    text=f'TROPICAL CYCLONE ADVISORY NO. 1 {datetime.now(timezone.utc).replace(microsecond=0).isoformat()} Cyclonic Storm ALPHA position near 15.0N 85.0E WIND SPEED 50 KT'
    with patch('httpx.AsyncClient.get',AsyncMock(return_value=httpx.Response(200,text=text))):
        result=await LiveIngestionService()._fetch_imd_bulletins()
    assert result.systems[0]['movement_speed_kmph'] is None
    assert result.systems[0]['intensity_knots']==50

@pytest.mark.asyncio
async def test_imd_bulletin_header_is_not_a_storm_name():
    text=f'CYCLONIC STORM BULLETIN NO. 1 {datetime.now(timezone.utc).replace(microsecond=0).isoformat()} Cyclonic Storm ALPHA over Bay of Bengal position near 15.0N 85.0E'
    with patch('httpx.AsyncClient.get',AsyncMock(return_value=httpx.Response(200,text=text))):
        result=await LiveIngestionService()._fetch_imd_bulletins()
    assert len(result.systems)==1
    assert result.systems[0]['id']=='LIVE-IMD-ALPHA'

@pytest.mark.asyncio
@pytest.mark.parametrize('movement,expected', [('MOVING AT 12 KT',None), ('MOVING NORTHWEST','NW'), ('DIRECTION NNE','NNE'), ('MOVING RANDOM',None)])
async def test_imd_direction_requires_a_complete_compass_value(movement,expected):
    text=f'TROPICAL CYCLONE ADVISORY NO. 1 {datetime.now(timezone.utc).replace(microsecond=0).isoformat()} Cyclonic Storm ALPHA position near 15.0N 85.0E {movement}'
    with patch('httpx.AsyncClient.get',AsyncMock(return_value=httpx.Response(200,text=text))):
        result=await LiveIngestionService()._fetch_imd_bulletins()
    assert result.systems[0]['movement_direction']==expected
