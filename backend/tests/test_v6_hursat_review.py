import pytest
from app.services.hursat_review import label_index, match_frame, nominal_time, review_archive, separation_km, timestamp


def test_nominal_match_preserves_acquisition_offset_and_wind_convention():
    frame = dict(event_id='fixture', nominal_time='2015-06-06T06:00:00Z',
                 acquisition_start='2015-06-06T05:30:00Z', embedded_track_version='v03r09',
                 center_latitude=13.1, center_longitude=68.5, embedded_wind_knots=22,
                 embedded_wind_averaging_minutes=None)
    row = dict(timestamp=frame['nominal_time'], latitude='13.1', longitude='68.5', wind_knots='25',
               wind_agency='NEWDELHI', wind_averaging_minutes='3', agency_interpolation_flag='_',
               class_id='1', label_status='REVIEW_REQUIRED', split='test', source_row='1')
    result = match_frame(frame, {('fixture', frame['nominal_time']):row})
    assert result['center_separation_km'] == 0
    assert result['acquisition_to_nominal_seconds'] == 1800
    assert result['label']['split'] == 'test'
    assert result['label']['wind_averaging_minutes'] == '3'
    assert result['embedded_wind_averaging_minutes'] is None
    assert 'TRACK_VERSION_DIFFERS' in result['review_reasons']
    assert 'ACQUISITION_DIFFERS_FROM_LABEL_TIME' in result['review_reasons']
    assert result['training_eligible'] is False
    # A nearby time or another event must never supply this frame's label.
    for key in [('other',frame['nominal_time']), ('fixture','2015-06-06T09:00:00Z')]:
        absent = match_frame(frame, {key:row})
        assert absent['label'] is None
        assert absent['join_status'] == 'NO_EXACT_EVENT_TIME_LABEL'


def test_duplicate_manifest_labels_are_rejected(tmp_path):
    path = tmp_path / 'labels.csv'
    path.write_text('event_id,timestamp\na,2015-06-06T06:00:00Z\na,2015-06-06T06:00:00+00:00\n', encoding='utf-8')
    with pytest.raises(ValueError, match='Duplicate'):
        label_index(path)


def test_spatial_and_time_normalization():
    assert separation_km(0,0,0,1) == pytest.approx(111.19508)
    assert separation_km(0,179,0,-179) == pytest.approx(222.39016)
    with pytest.raises(ValueError):separation_km(float('nan'),0,0,0)
    assert timestamp('2015-06-06T11:30:00+05:30') == '2015-06-06T06:00:00Z'
    assert timestamp(nominal_time(16592.25 - .00004/86400).isoformat()) == '2015-06-06T06:00:00Z'
    assert timestamp(nominal_time(16592.25 + .5/86400).isoformat()) == '2015-06-06T06:00:00.500000Z'


def test_changed_archive_rejected_before_decoding(tmp_path):
    archive = tmp_path / 'archive.tar.gz'
    archive.write_bytes(b'changed')
    with pytest.raises(ValueError, match='Archive checksum'):
        review_archive(archive, tmp_path / 'unused.csv', {'archive_sha256':'0'*64})
