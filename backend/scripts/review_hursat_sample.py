"""Review the authentic downloaded sample without changing training admission.

Install requirements-data-review.txt in a separate review environment first.
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.services.hursat_review import review_archive


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'data/manifests/hursat_sample_review.json')
    args = parser.parse_args()
    integrity = json.loads((ROOT / 'data/manifests/hursat_sample_integrity.json').read_text(encoding='utf-8'))
    archive = ROOT / 'data/raw' / integrity['source_url'].rsplit('/', 1)[1]
    report = review_archive(archive, ROOT / 'data/manifests/cyclonet_ni_scientific_v1.csv', integrity)
    args.output.write_text(json.dumps(report, indent=2, allow_nan=False) + '\n', encoding='utf-8')
    print(json.dumps({key:value for key,value in report.items() if key != 'frames'}))


if __name__ == '__main__':
    main()
