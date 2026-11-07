"""No network access: prove storm-level splitting and NOAA eligibility rules."""
import csv
import hashlib
import json
from pathlib import Path
import pytest
from train_classifier import DatasetSample, partition_dataset_strictly_disjoint


def test_changing_intensity_stays_in_one_split():
    samples = {label: [DatasetSample(f'{event}-{label}', label, f'storm-{event}',
                      hashlib.sha256(f'{event}-{label}'.encode()).hexdigest())
                      for event in range(12)] for label in range(5)}
    splits = partition_dataset_strictly_disjoint(samples)
    owners = {}
    for split_id, split in enumerate(splits):
        assert {s.class_id for s in split} == set(range(5))
        for sample in split:
            assert owners.setdefault(sample.event_id, split_id) == split_id
    reversed_samples = {k: list(reversed(v)) for k, v in reversed(list(samples.items()))}
    assert [[s.path for s in x] for x in splits] == [
        [s.path for s in x] for x in partition_dataset_strictly_disjoint(reversed_samples)]


def test_manifest_preserves_authentic_values_and_excludes_unavailable_images(tmp_path):
    from app.services.scientific_manifest import build_manifest
    source = tmp_path / 'source.csv'
    fields = ['SID', 'SEASON', 'NAME', 'ISO_TIME', 'BASIN', 'TRACK_TYPE', 'NATURE',
              'LAT', 'LON', 'NEWDELHI_WIND', 'IFLAG']
    with source.open('w', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerow(dict.fromkeys(fields, ' '))  # NOAA units row
        for hour, wind, flag in [(0, '', '_____O'), (3, '25', '_____O'),
                                 (6, '70', '_____O'), (9, '130', '_____O'),
                                 (12, '90', '_____I')]:
            writer.writerow(dict(SID='2013001N10080', SEASON='2013', NAME='TEST',
                ISO_TIME=f'2013-01-01 {hour:02}:00:00', BASIN='NI', TRACK_TYPE='main',
                NATURE='TS', LAT='10', LON='80', NEWDELHI_WIND=wind, IFLAG=flag))
    output = tmp_path / 'manifest.csv'
    report = build_manifest(source, output, source_url='https://www.ncei.noaa.gov/test.csv')
    rows = list(csv.DictReader(output.open()))
    assert len(rows) == 5
    assert len({r['split'] for r in rows}) == 1
    assert [r['class_id'] for r in rows] == ['', '', '3', '', '4']
    assert all(r['training_eligible'] == 'false' for r in rows)
    assert rows[0]['wind_knots'] == ''
    assert rows[1]['label_status'] == 'BELOW_SUPPORTED_INTENSITY'
    assert rows[3]['label_status'] == 'SUPER_CYCLONIC_OUTSIDE_CLASS_MAP'
    assert rows[4]['label_status'] == 'INTERPOLATED_AGENCY_INTENSITY'
    assert report['source_sha256'] == hashlib.sha256(source.read_bytes()).hexdigest()
    assert report['training_ready'] is False


def test_incomplete_csv_manifest_halts_before_model_construction(tmp_path):
    from app.services.scientific_manifest import load_training_csv
    with pytest.raises(ValueError, match='provenance'):
        load_training_csv(tmp_path / 'missing.csv')


def test_committed_noaa_inventory_is_disjoint_and_cannot_train():
    from app.services.scientific_manifest import load_training_csv, sha256_file, storm_split
    from train_classifier import InsufficientDatasetError
    path = Path(__file__).resolve().parents[1] / 'data/manifests/cyclonet_ni_scientific_v1.csv'
    provenance = json.loads(path.with_suffix('.provenance.json').read_text())
    assert sha256_file(path) == provenance['manifest_sha256']
    catalog = path.parent / 'hursat_v06_archive_catalog.json'
    catalog_provenance = json.loads(catalog.with_suffix('.provenance.json').read_text())
    assert sha256_file(catalog) == catalog_provenance['catalog_sha256']
    with path.open() as stream:
        rows = list(csv.DictReader(stream))
    assert len(rows) == provenance['observations'] == 12275
    assert len({row['event_id'] for row in rows}) == 363
    assert all(row['split'] == storm_split(row['event_id']) for row in rows)
    assert not any(row['training_eligible'] == 'true' for row in rows)
    with pytest.raises(InsufficientDatasetError, match='BLOCKED_EXTERNAL_DATASET'):
        load_training_csv(path)


def write_reviewed_csv_fixture(tmp_path, *, ready=True, **changes):
    from app.services.scientific_manifest import FIELDS, VERSION, storm_split, sha256_file
    row = dict.fromkeys(FIELDS, '')
    row.update(event_id='2013001N10080', timestamp='2013-01-01T06:00:00Z',
        wind_knots='70', wind_agency='NEWDELHI', wind_averaging_minutes='3',
        agency_interpolation_flag='O', class_id='3', label_status='SUPPORTED_INTENSITY',
        split=storm_split('2013001N10080'), image_status='VERIFIED', path='reviewed.png',
        sha256='a' * 64, training_eligible='true')
    row.update(changes)
    path = tmp_path / 'reviewed.csv'
    with path.open('w', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerow(row)
    path.with_suffix('.provenance.json').write_text(json.dumps(dict(
        dataset_version=VERSION, manifest_sha256=sha256_file(path), training_ready=ready)))
    return path


def test_string_false_cannot_enable_scientific_training(tmp_path):
    from app.services.scientific_manifest import load_training_csv
    from train_classifier import InsufficientDatasetError
    path = write_reviewed_csv_fixture(tmp_path, ready='false')
    with pytest.raises((ValueError, InsufficientDatasetError)):
        load_training_csv(path)


def test_noaa_storm_record_cannot_be_relabeled_as_a_negative(tmp_path):
    from app.services.scientific_manifest import load_training_csv
    path = write_reviewed_csv_fixture(tmp_path, class_id='0', wind_knots='25',
        label_status='BELOW_SUPPORTED_INTENSITY')
    with pytest.raises(ValueError, match='negative|class'):
        load_training_csv(path)


@pytest.mark.parametrize('changes', [dict(wind_agency='USA'),
    dict(wind_averaging_minutes='1'), dict(class_id='-1')])
def test_csv_cannot_silently_change_wind_convention_or_class(tmp_path, changes):
    from app.services.scientific_manifest import load_training_csv
    with pytest.raises(ValueError):
        load_training_csv(write_reviewed_csv_fixture(tmp_path, **changes))


def test_csv_retains_verified_three_minute_label_and_frozen_split(tmp_path):
    from app.services.scientific_manifest import load_training_csv, storm_split
    row = load_training_csv(write_reviewed_csv_fixture(tmp_path))['samples'][0]
    assert row['class_id'] == 3
    assert row['split'] == storm_split(row['event_id'])
