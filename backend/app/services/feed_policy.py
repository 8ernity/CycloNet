"""Conservative source freshness and source-scoped reconciliation policy."""
import re
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from typing import Optional

from app.models.feed_result import FeedResult, FeedStatus

_SYNOPTIC_DATE_RE = re.compile(r"^(\d{1,2})[-/]?([A-Za-z]{3})[-/]?(\d{2,4})\s+(\d{2})(\d{2})Z?$", re.IGNORECASE)
_SYNOPTIC_DAY_TIME_RE = re.compile(r"^(\d{1,2})/(\d{2})(\d{2})Z?$", re.IGNORECASE)
_SYNOPTIC_COMPACT_RE = re.compile(r"^(\d{2})(\d{2})(\d{2})Z$", re.IGNORECASE)


def _resolve_day_time(day: int, hour: int, minute: int) -> Optional[datetime]:
    now = datetime.now(timezone.utc)
    year = now.year
    month = now.month
    if day > now.day and (day - now.day) > 15:
        month = month - 1 or 12
        if month == 12:
            year -= 1
    try:
        return datetime(year, month, day, hour, minute, tzinfo=timezone.utc)
    except ValueError:
        return None


def parse_time(value: object) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        dt: Optional[datetime] = value
    elif isinstance(value, str):
        val = value.strip()
        try:
            dt = datetime.fromisoformat(val.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            try:
                dt = parsedate_to_datetime(val)
            except (ValueError, TypeError):
                dt = _parse_synoptic_time(val)
    else:
        return None
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def _parse_synoptic_time(val: str) -> Optional[datetime]:
    if m1 := _SYNOPTIC_DATE_RE.match(val):
        d, m_str, y, hh, mm = m1.groups()
        year = int(y) + 2000 if len(y) == 2 else int(y)
        try:
            month = datetime.strptime(m_str.capitalize(), "%b").month
            return datetime(year, month, int(d), int(hh), int(mm), tzinfo=timezone.utc)
        except ValueError:
            return None
    if m2 := (_SYNOPTIC_COMPACT_RE.match(val) or _SYNOPTIC_DAY_TIME_RE.match(val)):
        day, hour, minute = map(int, m2.groups())
        return _resolve_day_time(day, hour, minute)
    return None

def fresh(value, now=None):
    dt = parse_time(value)
    now = now or datetime.now(timezone.utc)
    return dt is not None and -timedelta(minutes=15) <= now - dt <= timedelta(hours=36)

def assess_feed(**kwargs):
    result = FeedResult(**kwargs)
    if result.status in (FeedStatus.FAILED, FeedStatus.UNAVAILABLE):
        return result
    for system in result.systems:
        observed = parse_time(system.get('observation_time_utc'))
        system['observation_time_utc'] = observed.isoformat() if observed else None
        system['source_id'] = result.source
        system['source_url'] = result.source_url
        system['retrieved_at'] = result.retrieved_at.isoformat()
        current = fresh(observed)
        system['is_stale'] = not current
        system['data_state'] = 'ACTIVE' if current else 'STALE'
        system['reconciliation_status'] = 'ACTIVE_VERIFIED' if current else ('ACTIVE_STALE' if observed else 'STATUS_UNCERTAIN')
        system['telemetry_badge'] = 'SOURCE OBSERVATION' if current else 'STALE / TIME UNVERIFIED'
    if result.systems:
        result.status = FeedStatus.HEALTHY if all(not s['is_stale'] for s in result.systems) else FeedStatus.STALE
    elif not (result.calm_evidence and result.complete_coverage and fresh(result.observed_at)):
        result.status = FeedStatus.DEGRADED
        result.error = 'No dated authoritative evidence of basin-wide calm'
    return result

def source_id(system):
    if system.get('source_id'):
        return system['source_id']
    for prefix, name in [('LIVE-JTWC-', 'JTWC_NOAA'), ('LIVE-IMD-', 'IMD_RSMC'), ('LIVE-GDACS-', 'GDACS_UN')]:
        if system.get('id', '').startswith(prefix):
            return name
    return None

def reconcile(previous, results):
    """Only the original source's fresh complete coverage may retire its storm.

    Missing storms in partial/failed/undated feeds remain stale. Source IDs are
    intentionally not merged on name alone because agencies may disagree.
    """
    by_source = {r.source: r for r in results}
    merged, retired = {}, []
    for result in results:
        for system in result.systems:
            key = (result.source, system['id'])
            merged[key] = {**system, 'source_id': result.source}
    for old in previous:
        key = (source_id(old), old['id'])
        if key in merged:
            new_time, old_time = parse_time(merged[key].get('observation_time_utc')), parse_time(old.get('observation_time_utc'))
            if old_time and (not new_time or new_time < old_time):
                merged[key] = {**old, 'is_stale': True, 'reconciliation_status': 'ACTIVE_STALE', 'data_state': 'STALE'}
            continue
        result = by_source.get(key[0])
        if (result and result.status == FeedStatus.NO_ACTIVE_STORMS and result.calm_evidence
                and result.complete_coverage and old.get('basin') in result.coverage and fresh(result.observed_at)):
            retired.append({**old, 'reconciliation_status': 'DISSIPATED_VERIFIED'})
        else:
            merged[key] = {**old, 'is_stale': True, 'data_state': 'STALE',
                           'reconciliation_status': 'ACTIVE_STALE', 'telemetry_badge': 'STALE TELEMETRY (OUTAGE)'}
    return list(merged.values()), retired
