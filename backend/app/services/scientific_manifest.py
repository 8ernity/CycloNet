"""Auditable NOAA record inventory. An inventory is not a validated training set."""
import csv
import hashlib
import json
import math
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

IBTRACS_URL = ('https://www.ncei.noaa.gov/data/'
    'international-best-track-archive-for-climate-stewardship-ibtracs/'
    'v04r01/access/csv/ibtracs.NI.list.v04r01.csv')
HURSAT_URL = 'https://www.ncei.noaa.gov/data/hurricane-satellite-hursat-b1/archive/v06/'
VERSION = 'cyclonet_ni_scientific_v1'
SPLIT_SALT = VERSION + ':storm-split-v1:'
FIELDS = ['event_id', 'timestamp', 'season', 'name', 'basin', 'latitude', 'longitude',
          'wind_knots', 'wind_agency', 'wind_averaging_minutes', 'agency_interpolation_flag',
          'class_id', 'label_status', 'split', 'hursat_archive_url', 'image_status',
          'path', 'sha256', 'training_eligible', 'source_row']


def sha256_file(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def storm_split(event_id):
    # Stable assignment independent of labels, row order, and later data additions.
    value = int(hashlib.sha256((SPLIT_SALT + event_id).encode()).hexdigest()[:16], 16) / 2**64
    return 'train' if value < .7 else 'validation' if value < .85 else 'test'


def intensity_label(wind):
    if not wind:
        return '', 'MISSING_AGENCY_INTENSITY'
    value = float(wind)
    if not math.isfinite(value) or value < 0:
        return '', 'INVALID_AGENCY_INTENSITY'
    if value < 34:
        return '', 'BELOW_SUPPORTED_INTENSITY'
    if value >= 120:
        return '', 'SUPER_CYCLONIC_OUTSIDE_CLASS_MAP'
    return (1 if value < 48 else 2 if value < 64 else 3 if value < 90 else 4), 'SUPPORTED_INTENSITY'


def build_manifest(source, output, *, source_url=IBTRACS_URL, archive_catalog=None):
    source, output = Path(source), Path(output)
    archives = archive_catalog or {}
    rows, seen, exclusions = [], set(), Counter()
    with source.open(encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream)
        required = {'SID', 'SEASON', 'ISO_TIME', 'BASIN', 'TRACK_TYPE', 'NATURE',
                    'LAT', 'LON', 'NEWDELHI_WIND', 'IFLAG', 'NAME'}
        if not required.issubset(reader.fieldnames or []):
            raise ValueError('IBTrACS v04r01 columns missing')
        for line, raw in enumerate(reader, 2):
            raw = {key: (value or '').strip() for key, value in raw.items()}
            if line == 2 and not raw['SID']:
                continue  # NOAA units row, never interpreted as an observation
            if not re.fullmatch(r'\d{7}[NS]\d{5}', raw['SID']):
                raise ValueError(f'Invalid NOAA SID on source row {line}')
            year = int(raw['SEASON'])
            if raw['BASIN'] != 'NI' or not 1978 <= year <= 2015 or raw['TRACK_TYPE'].upper() != 'MAIN':
                exclusions['outside_NI_1978_2015_MAIN'] += 1
                continue
            timestamp = datetime.strptime(raw['ISO_TIME'], '%Y-%m-%d %H:%M:%S').isoformat() + 'Z'
            key = raw['SID'], timestamp
            if key in seen:
                raise ValueError(f'Duplicate storm/time record on source row {line}')
            seen.add(key)
            lat, lon = float(raw['LAT']), float(raw['LON'])
            if not math.isfinite(lat) or not math.isfinite(lon) or not (-90 <= lat <= 90 and -180 <= lon <= 180):
                raise ValueError(f'Invalid coordinates on source row {line}')
            label, status = intensity_label(raw['NEWDELHI_WIND'])
            flag = raw['IFLAG'][5:6]
            if status == 'SUPPORTED_INTENSITY' and flag not in ('O', 'V'):
                status = 'INTERPOLATED_AGENCY_INTENSITY' if flag in ('I', 'P') else 'UNKNOWN_AGENCY_PROVENANCE'
            if raw['NATURE'] != 'TS':
                status = 'NON_TROPICAL_OR_UNKNOWN_NATURE'
            rows.append(dict(event_id=raw['SID'], timestamp=timestamp, season=year,
                name=raw['NAME'], basin=raw['BASIN'], latitude=raw['LAT'], longitude=raw['LON'],
                wind_knots=raw['NEWDELHI_WIND'], wind_agency='NEWDELHI', wind_averaging_minutes=3,
                agency_interpolation_flag=flag, class_id=label, label_status=status,
                split=storm_split(raw['SID']), hursat_archive_url=archives.get(raw['SID'], ''),
                image_status='NOT_RETRIEVED', path='', sha256='', training_eligible='false', source_row=line))
    rows.sort(key=lambda row: (row['event_id'], row['timestamp']))
    if not rows:
        raise ValueError('No eligible North Indian Ocean records found in the source inventory')
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('w', newline='', encoding='utf-8') as stream:
        writer = csv.DictWriter(stream, fieldnames=FIELDS, lineterminator='\n')
        writer.writeheader()
        writer.writerows(rows)
    events = {row['event_id'] for row in rows}
    report = dict(dataset_version=VERSION, generated_at=datetime.now(timezone.utc).isoformat(),
        source_url=source_url, source_sha256=sha256_file(source), source_bytes=source.stat().st_size,
        manifest_sha256=sha256_file(output), hursat_version='v06', hursat_archive_root=HURSAT_URL,
        label_policy='NEWDELHI 3-minute knots; CS [34,48), SCS [48,64), VSCS [64,90), ESCS [90,120)',
        interpolation_policy='Only O/V NewDelhi flags eligible; no interpolated labels used for training',
        split_policy='SHA256(cyclonet_ni_scientific_v1:storm-split-v1: + SID), 70/15/15 thresholds',
        observations=len(rows), storms=len(events),
        split_storms=dict(Counter(storm_split(event) for event in sorted(events))),
        split_observations=dict(Counter(row['split'] for row in rows)),
        label_statuses=dict(Counter(row['label_status'] for row in rows)),
        verified_archive_link_observations=sum(bool(row['hursat_archive_url']) for row in rows),
        source_exclusions=dict(exclusions), training_eligible_observations=0, training_ready=False,
        blockers=['HURSAT frame retrieval, v03r09 to v04r01 storm identity reconciliation, timestamp join and pixel preprocessing/QC required',
                  'Independent non-cyclone imagery is absent; storm records below 34 kt are not negative examples',
                  'Independent scientific evaluation, calibration and operational validation remain required'])
    output.with_suffix('.provenance.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8', newline='\n')
    return report


def load_training_csv(path):
    """Fail closed on incomplete inventory; preserve reviewed split assignments."""
    path = Path(path)
    sidecar = path.with_suffix('.provenance.json')
    if not path.is_file() or not sidecar.is_file():
        raise ValueError('Scientific manifest and provenance sidecar required')
    metadata = json.loads(sidecar.read_text(encoding='utf-8'))
    if metadata.get('manifest_sha256') != sha256_file(path):
        raise ValueError('Scientific manifest provenance checksum mismatch')
    if metadata.get('training_ready') is not True:
        from app.services.dataset_errors import InsufficientDatasetError
        raise InsufficientDatasetError('BLOCKED_EXTERNAL_DATASET: inventory has no reviewed, complete scientific image dataset')
    samples = []
    with path.open(encoding='utf-8', newline='') as stream:
        for row in csv.DictReader(stream):
            if row['training_eligible'] != 'true':
                continue
            if row['image_status'] != 'VERIFIED' or not row['path'] or not row['sha256']:
                raise ValueError('Eligible image lacks verified image provenance')
            if row['split'] != storm_split(row['event_id']):
                raise ValueError('Storm split changed from the frozen manifest policy')
            label = int(row['class_id'])
            # This format inventories NOAA storm records; it cannot establish
            # independent negative examples, even for a weak/developing storm.
            # A combined image dataset needs separately reviewed negative data.
            if label not in (1, 2, 3, 4):
                raise ValueError('Invalid NOAA class; this storm inventory cannot supply negative examples')
            if row['wind_agency'] != 'NEWDELHI' or row['wind_averaging_minutes'] != '3':
                raise ValueError('Scientific labels require NEWDELHI three-minute wind measurements')
            expected, status = intensity_label(row['wind_knots'])
            if (label != expected or status != 'SUPPORTED_INTENSITY'
                    or row['label_status'] != status or row['agency_interpolation_flag'] not in ('O', 'V')):
                raise ValueError('Invalid or interpolated scientific label')
            samples.append(dict(path=row['path'], class_id=label, event_id=row['event_id'],
                                sha256=row['sha256'], split=row['split'], timestamp=row['timestamp']))
    return dict(dataset_version=metadata['dataset_version'], synthetic=False, samples=samples)


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=Path('data/manifests/cyclonet_ni_scientific_v1.csv'))
    parser.add_argument('--archive-catalog', type=Path)
    args = parser.parse_args()
    catalog = json.loads(args.archive_catalog.read_text()) if args.archive_catalog else None
    print(json.dumps(build_manifest(args.source, args.output, archive_catalog=catalog), indent=2))
