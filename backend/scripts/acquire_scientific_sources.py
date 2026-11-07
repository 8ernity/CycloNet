"""Fetch public NOAA source records and actual HURSAT archive listings, never guessed image URLs.

Run from backend: python scripts/acquire_scientific_sources.py
Raw records are kept outside git. This does not download the multi-GB image corpus.
"""
import csv
import json
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.services.scientific_manifest import IBTRACS_URL, HURSAT_URL, build_manifest, sha256_file


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hrefs = []

    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            self.hrefs.extend(value for key, value in attrs if key == 'href' and value)


def fetch(url, path, limit):
    # Only known NOAA URLs are accepted; bounded downloads, no credentials.
    if urlparse(url).netloc != 'www.ncei.noaa.gov' or urlparse(url).scheme != 'https':
        raise ValueError('Only HTTPS NOAA sources are supported')
    request = Request(url, headers={'User-Agent': 'CycloNet-scientific-manifest/1.0'})
    with urlopen(request, timeout=60) as response:
        data = response.read(limit + 1)
        if len(data) > limit:
            raise ValueError('Source exceeds bounded download size')
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return data


def main():
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh-records', action='store_true')
    args = parser.parse_args()
    raw = ROOT / 'data/raw'
    records = raw / 'ibtracs.NI.list.v04r01.csv'
    if args.refresh_records or not records.exists():
        fetch(IBTRACS_URL, records, 50 * 1024 * 1024)
    output = ROOT / 'data/manifests/cyclonet_ni_scientific_v1.csv'
    build_manifest(records, output)
    with output.open() as stream:
        storms = {row['event_id'] for row in csv.DictReader(stream)}

    def year_listing(year):
        url = HURSAT_URL + str(year) + '/'
        path = raw / 'hursat-listings' / f'{year}.html'
        try:
            data = fetch(url, path, 2 * 1024 * 1024)
            links = Links()
            links.feed(data.decode('utf-8'))
            found = {}
            for href in links.hrefs:
                match = re.fullmatch(r'HURSAT_b1_v06_(\d{7}[NS]\d{5})_.+\.tar\.gz', href)
                if match and match[1] in storms:
                    if match[1] in found:
                        raise ValueError('Ambiguous archive for storm ' + match[1])
                    found[match[1]] = urljoin(url, href)
            return found, dict(url=url, sha256=sha256_file(path), status='FETCHED')
        except Exception as exc:
            return {}, dict(url=url, status='UNAVAILABLE', error=type(exc).__name__)

    archives, evidence = {}, []
    with ThreadPoolExecutor(max_workers=4) as pool:
        for found, source in pool.map(year_listing, range(1978, 2016)):
            archives.update(found)
            evidence.append(source)
    catalog = output.parent / 'hursat_v06_archive_catalog.json'
    catalog.write_text(json.dumps(dict(sorted(archives.items())), indent=2) + '\n', encoding='utf-8', newline='\n')
    report = build_manifest(records, output, archive_catalog=archives)
    provenance = dict(retrieved_at=datetime.now(timezone.utc).isoformat(),
        catalog_sha256=sha256_file(catalog), matched_storm_ids=len(archives),
        unmatched_storm_ids=sorted(storms - archives.keys()), sources=evidence,
        note='Exact SID archive links only; HURSAT v03r09/v04r01 identity and frame joins still require review')
    catalog.with_suffix('.provenance.json').write_text(json.dumps(provenance, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps(report, indent=2))
    print('Unavailable archive listings:', sum(row['status'] != 'FETCHED' for row in evidence))


if __name__ == '__main__':
    main()
