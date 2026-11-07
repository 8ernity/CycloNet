from datetime import datetime, timezone, timedelta
from unittest.mock import patch
import pytest
from app.models.checkpoint import CheckpointMetadata
from app.services.ml_service import CycloneIntensityService
from app.services.feed_policy import assess_feed, reconcile
from app.models.feed_result import FeedStatus

def metadata(**changes):
    return dict(model_id='test',model_version='1',architecture='resnet50+cyclone-head-v1',
        class_mapping=['NOT_A_CYCLONE','CS','SCS','VSCS','ESCS'],training_dataset_version='train1',
        evaluation_dataset_version='test1',training_complete=True,scientifically_validated=False,
        checkpoint_checksum='a'*64,demo_model=True,model_status='UNCALIBRATED_DEMO',**changes)

@pytest.mark.parametrize('changes', [dict(demo_model=False),dict(model_status='VALIDATED'),dict(training_complete=False),dict(class_mapping=['CS','CS'])])
def test_contradictory_artifact_metadata_rejected(changes):
    with pytest.raises(ValueError): CheckpointMetadata.model_validate(metadata() | changes)

@pytest.mark.parametrize('artifact', [{}, {'metadata':metadata() | {'class_mapping':['wrong','classes']},'num_classes':2},
    {'metadata':metadata(),'num_classes':5,'state_dict':{},'backbone_state_dict':{}}])
def test_missing_mismatched_or_tampered_artifacts_fail_closed(artifact):
    with patch('torch.load',return_value=artifact):
        service=CycloneIntensityService(); service.load_model()
    assert not service.checkpoint_loaded and not service.scientifically_validated

def test_old_and_undated_observations_are_not_fresh():
    for timestamp in [None,(datetime.now(timezone.utc)-timedelta(days=3)).isoformat()]:
        result=assess_feed(source='JTWC_NOAA',status=FeedStatus.HEALTHY,systems=[dict(id='01B',observation_time_utc=timestamp)])
        assert result.status==FeedStatus.STALE
        assert result.systems[0]['observation_time_utc']==timestamp

def test_only_dated_source_specific_complete_calm_retires_storm():
    old=dict(id='01B',source_id='JTWC_NOAA',basin='Bay of Bengal')
    result=assess_feed(source='JTWC_NOAA',status=FeedStatus.NO_ACTIVE_STORMS,
        observed_at=datetime.now(timezone.utc),calm_evidence=True,
        coverage=['Bay of Bengal'],complete_coverage=True)
    active,retired=reconcile([old],[result]); assert active==[]
    assert retired[0]['reconciliation_status']=='DISSIPATED_VERIFIED'
    result.coverage=['Arabian Sea']
    active,retired=reconcile([old],[result]); assert not retired
    assert active[0]['reconciliation_status']=='ACTIVE_STALE'

def test_wind_alone_never_issues_evacuation_or_landfall_warning():
    from app.services.report_service import report_service
    output=report_service.get_alert_level(150)
    assert output['stage']=='Experimental wind band'
    assert 'Total evacuation' not in str(output)
