"""Conservative content screen before training; flagged pairs require review.

Checks decoded RGB and 32x32 RGB thumbnails. It is not a guarantee against
arbitrary crops/rotations/scene overlap, which need independent dataset review.
"""
import hashlib
from collections import defaultdict
from itertools import product
import numpy as np
from PIL import Image

MAX_COMPARISONS = 1_000_000
THUMBNAIL_SIZE = (32, 32)
MAX_CHANNEL_MAE = 2.0  # 8-bit channel levels; fixed before split evaluation


def verify_image_content_splits(splits):
    from train_classifier import DataLeakageError
    from app.services.dataset_errors import InsufficientDatasetError
    exact = {}
    buckets = defaultdict(list)
    comparisons = checked = 0
    for split_name, samples in zip(('train', 'validation', 'test'), splits):
        for sample in samples:
            with Image.open(sample.path) as image:
                rgb = image.convert('RGB')
                digest = hashlib.sha256(str(rgb.size).encode() + rgb.tobytes()).hexdigest()
                thumbnail = np.asarray(rgb.resize(THUMBNAIL_SIZE, Image.Resampling.BILINEAR), dtype=np.int16)
            previous = exact.get(digest)
            if previous and previous[0] != split_name:
                raise DataLeakageError(f'Decoded image content shared across {previous[0]} and {split_name}: {previous[1]} / {sample.path}')
            means = thumbnail.mean(axis=(0, 1))
            bucket = tuple(np.floor(means/MAX_CHANNEL_MAE).astype(int))
            # Mean differences cannot exceed channel MAE. Adjacent buckets cover
            # all pairs within this screen's threshold, without an NxN matrix.
            for offset in product((-1, 0, 1), repeat=3):
                key = tuple(v+o for v, o in zip(bucket, offset))
                for other_split, other_path, other in buckets.get(key, ()):
                    if other_split == split_name:
                        continue
                    comparisons += 1
                    if comparisons > MAX_COMPARISONS:
                        raise InsufficientDatasetError('Image content review budget exceeded; partition/review the dataset before training')
                    if (np.abs(thumbnail-other).mean(axis=(0, 1)) <= MAX_CHANNEL_MAE).all():
                        raise DataLeakageError(f'Near-duplicate image content across {other_split} and {split_name} requires review: {other_path} / {sample.path}')
            exact.setdefault(digest, (split_name, sample.path))
            buckets[bucket].append((split_name, sample.path, thumbnail))
            checked += 1
    return dict(status='PASSED_AUTOMATED_SCREEN', images_checked=checked,
        candidate_comparisons=comparisons, thumbnail_size=list(THUMBNAIL_SIZE),
        maximum_channel_mae=MAX_CHANNEL_MAE,
        limitation='Crops, rotations, shared scenes and semantic overlap still require independent review')
