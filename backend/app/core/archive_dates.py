"""Normalize legacy display dates for stable, indexed archive pagination."""
from datetime import date
import re

def archive_start_date(year, display):
    if not year or not 1 <= int(year) <= 9999:
        return date.min  # Sort-only sentinel for unavailable dates; never displayed as an observation.
    display = display or ''
    iso = re.match(r'(\d{4}-\d{2}-\d{2})', display)
    if iso:
        try: return date.fromisoformat(iso[1])
        except ValueError: pass
    months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
    first = re.split(r'[-–]', display)[0].lower()
    month = next((i+1 for i,m in enumerate(months) if m in first), 1)
    days = re.findall(r'\b(\d{1,2})\b', first)
    try: return date(int(year), month, int(days[0]) if days else 1)
    except ValueError: return date(int(year),month,1)
