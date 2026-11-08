"""Reproducible raw-frame review, deliberately separate from training admission.

HURSAT htime is the nominal track time, while time_coverage_start is the
satellite acquisition start. Neither is silently substituted for the other.
"""
import csv
import hashlib
import io
import math
import tarfile
from datetime import datetime, timedelta, timezone


def timestamp(value):
    dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')


def label_index(path):
    rows = {}
    with path.open(encoding='utf-8', newline='') as stream:
        for row in csv.DictReader(stream):
            key = (row['event_id'], timestamp(row['timestamp']))
            if key in rows:
                raise ValueError('Duplicate event/time label; review cannot choose silently')
            rows[key] = row
    return rows


def nominal_time(days):
    seconds = float(days) * 86400
    if not math.isfinite(seconds):
        raise ValueError('Invalid nominal time')
    # CF day fractions can carry sub-millisecond floating-point noise. Record
    # the original value separately; never round a genuine acquisition offset.
    if abs(seconds - round(seconds)) < 0.001:
        seconds = round(seconds)
    return datetime(1970, 1, 1, tzinfo=timezone.utc) + timedelta(seconds=seconds)


def separation_km(lat1, lon1, lat2, lon2):
    values = (lat1, lon1, lat2, lon2)
    if not all(math.isfinite(v) for v in values) or not (-90 <= lat1 <= 90 and -90 <= lat2 <= 90):
        raise ValueError('Invalid center coordinates')
    a, b = math.radians(lat1), math.radians(lat2)
    h = math.sin((b-a)/2)**2 + math.cos(a)*math.cos(b)*math.sin(math.radians(lon2-lon1)/2)**2
    return 6371.0088 * 2 * math.asin(math.sqrt(min(1, max(0, h))))


def match_frame(frame, labels):
    row = labels.get((frame['event_id'], timestamp(frame['nominal_time'])))
    start = datetime.fromisoformat(timestamp(frame['acquisition_start']))
    nominal = datetime.fromisoformat(timestamp(frame['nominal_time']))
    result = {**frame, 'training_eligible': False, 'scientifically_validated': False,
              'join_status': 'NO_EXACT_EVENT_TIME_LABEL', 'label': None,
              'acquisition_to_nominal_seconds': (nominal-start).total_seconds(),
              'review_reasons': ['INDEPENDENT_REVIEW_REQUIRED', 'HURSAT_WIND_AVERAGING_UNKNOWN']}
    if frame['embedded_track_version'] != 'v04r01':
        result['review_reasons'].append('TRACK_VERSION_DIFFERS')
    if start != nominal:
        result['review_reasons'].append('ACQUISITION_DIFFERS_FROM_LABEL_TIME')
    if row is None:
        return result
    result['join_status'] = 'EXACT_NOMINAL_JOIN_REQUIRES_REVIEW'
    result['center_separation_km'] = round(separation_km(frame['center_latitude'], frame['center_longitude'],
                                                      float(row['latitude']), float(row['longitude'])), 6)
    fields = ('timestamp', 'latitude', 'longitude', 'wind_knots', 'wind_agency',
              'wind_averaging_minutes', 'agency_interpolation_flag', 'class_id', 'label_status', 'split', 'source_row')
    result['label'] = {key: row[key] for key in fields}
    if row['label_status'] != 'SUPPORTED_INTENSITY':
        result['review_reasons'].append(row['label_status'])
    if frame.get('ir_valid_pixels', 0) < frame.get('ir_total_pixels', 0):
        result['review_reasons'].append('INFRARED_PIXELS_MISSING')
    return result


def read_frame(data):
    # Optional offline review dependency; production servers do not import h5py.
    import h5py
    import numpy as np

    def scalar(value):
        return np.asarray(value).reshape(-1)[0]

    def text(value):
        value = scalar(value)
        return value.decode('utf-8') if isinstance(value, bytes) else str(value)

    with h5py.File(io.BytesIO(data), 'r') as file:
        if text(file['htime'].attrs['units']) != 'days since 1970-01-01 00:00':
            raise ValueError('Unsupported nominal time units')
        if text(file['htime'].attrs['calendar']) != 'standard':
            raise ValueError('Unsupported calendar')
        nominal_days = float(scalar(file['htime'][()]))
        nominal = nominal_time(nominal_days)
        for name, unit in [('CentLat','degrees_north'), ('CentLon','degrees_east'), ('WindSpd','knots')]:
            if text(file[name].attrs['units']) != unit:
                raise ValueError('Unsupported units: ' + name)
        ir = file['IRWIN']
        if ir.shape != (1, 301, 301) or text(ir.attrs['units']).lower() != 'kelvin':
            raise ValueError('Unsupported infrared grid or units')
        raw = ir[()]
        valid = np.isfinite(raw) & (raw != scalar(ir.attrs['_FillValue']))
        kelvin = raw[valid].astype(np.float64) * float(scalar(ir.attrs['scale_factor'])) + float(scalar(ir.attrs['add_offset']))
        if not np.all(np.isfinite(kelvin)):
            raise ValueError('Nonfinite decoded temperature')
        event_id = text(file.attrs['TC_serial_number'])
        if file['sid'][()].tobytes().decode('ascii').strip('\x00 ') != event_id:
            raise ValueError('Conflicting storm identifiers')
        return dict(event_id=event_id, nominal_time=timestamp(nominal.isoformat()), nominal_days_since_epoch=nominal_days,
            acquisition_start=timestamp(text(file.attrs['time_coverage_start'])),
            acquisition_end=timestamp(text(file.attrs['time_coverage_end'])),
            satellite=text(file.attrs['Satellite_Name']), embedded_track_version=text(file.attrs['IBTrACS_Version']),
            center_latitude=float(scalar(file['CentLat'][()])), center_longitude=float(scalar(file['CentLon'][()])),
            embedded_wind_knots=float(scalar(file['WindSpd'][()])), embedded_wind_averaging_minutes=None,
            ir_valid_pixels=int(valid.sum()), ir_total_pixels=int(raw.size),
            ir_min_kelvin=float(kelvin.min()) if kelvin.size else None,
            ir_max_kelvin=float(kelvin.max()) if kelvin.size else None)


def review_archive(archive, manifest, integrity):
    def sha(path):
        with path.open('rb') as stream:
            return hashlib.file_digest(stream, 'sha256').hexdigest()
    archive_sha = sha(archive)
    if archive_sha != integrity['archive_sha256']:
        raise ValueError('Archive checksum differs from recorded acquisition')
    labels = label_index(manifest)
    expected = {frame['member']: frame for frame in integrity['frames']}
    if len(expected) != len(integrity['frames']) or len(expected) > 1000:
        raise ValueError('Duplicate or excessive inventory')
    frames, seen = [], set()
    # Never extract archive paths to disk. Bound member size/count before reads.
    with tarfile.open(archive, 'r|gz') as stream:
        for member in stream:
            if not member.isfile() or member.name not in expected or member.name in seen or member.size > 16*1024*1024:
                raise ValueError('Unexpected, duplicate, or excessive archive member')
            seen.add(member.name)
            data = stream.extractfile(member).read(16*1024*1024+1)
            digest = hashlib.sha256(data).hexdigest()
            if len(data) != expected[member.name]['bytes'] or digest != expected[member.name]['sha256']:
                raise ValueError('Frame checksum differs from recorded acquisition')
            frame = read_frame(data)
            if frame['event_id'] != integrity['event_id']:
                raise ValueError('Unexpected storm identity')
            frames.append(match_frame(dict(member=member.name, sha256=digest, **frame), labels))
    if seen != expected.keys():
        raise ValueError('Missing archive members')
    return dict(schema_version=1, source_url=integrity['source_url'], archive_sha256=archive_sha,
        manifest_sha256=sha(manifest), frame_count=len(frames),
        exact_nominal_label_matches=sum(f['label'] is not None for f in frames),
        training_eligible_count=0, scientifically_validated=False,
        method='Exact SID and nominal UTC time after removing <1ms CF day-fraction noise; raw days, acquisition offsets and version/center differences retained for review. No interpolation, wind-convention conversion, or training approval.',
        frames=frames)
