"""Reproducible diagnostics, not a calibration fit or scientific approval."""
import numpy as np


class ClassificationMetrics:
    """Accumulate bounded-memory metrics; rows=true class, columns=prediction."""
    def __init__(self, classes, bins=10):
        if len(classes) < 2 or len(set(classes)) != len(classes) or bins < 1:
            raise ValueError('Unique classes and positive calibration bins required')
        self.classes = list(classes)
        self.bins = bins
        self.confusion = np.zeros((len(classes), len(classes)), dtype=np.int64)
        self.bin_count = np.zeros(bins, dtype=np.int64)
        self.bin_confidence = np.zeros(bins)
        self.bin_correct = np.zeros(bins)
        self.count = self.accepted = self.accepted_correct = 0
        self.brier = self.nll = 0.0

    def update(self, probabilities, labels):
        p = np.asarray(probabilities, dtype=np.float64)
        y = np.asarray(labels)
        k = len(self.classes)
        if (p.ndim != 2 or p.shape[1] != k or y.shape != (len(p),)
                or not np.issubdtype(y.dtype, np.integer)
                or not np.isfinite(p).all() or (p < 0).any() or (p > 1).any()
                or not np.allclose(p.sum(1), 1, atol=1e-6, rtol=0)
                or (y < 0).any() or (y >= k).any()):
            raise ValueError('Invalid class probabilities or labels')
        if not len(p):
            return
        predicted = p.argmax(1)
        confidence = p.max(1)
        correct = predicted == y
        order = np.sort(p, axis=1)
        entropy = -(p * np.log(np.clip(p, 1e-12, 1))).sum(1) / np.log(k)
        # Fixed serving heuristic: never choose thresholds on the held-out test set.
        accepted = (confidence >= .60) & (entropy <= .65) & ((order[:, -1] - order[:, -2]) >= .15)
        indices = np.minimum((confidence * self.bins).astype(int), self.bins - 1)
        np.add.at(self.confusion, (y, predicted), 1)
        np.add.at(self.bin_count, indices, 1)
        np.add.at(self.bin_confidence, indices, confidence)
        np.add.at(self.bin_correct, indices, correct.astype(int))
        self.count += len(p)
        self.accepted += int(accepted.sum())
        self.accepted_correct += int((accepted & correct).sum())
        self.brier += float(((p - np.eye(k)[y]) ** 2).sum())
        self.nll += float(-np.log(np.clip(p[np.arange(len(y)), y], 1e-12, 1)).sum())

    def result(self):
        if not self.count:
            raise ValueError('Evaluation requires labeled samples')
        rows = []
        for i, name in enumerate(self.classes):
            tp = int(self.confusion[i, i])
            support = int(self.confusion[i].sum())
            predicted = int(self.confusion[:, i].sum())
            precision = tp / predicted if predicted else 0.0
            recall = tp / support if support else 0.0
            rows.append(dict(class_id=i, class_name=name, support=support,
                predicted_count=predicted, precision=precision, recall=recall,
                f1=2*tp/(support+predicted) if support+predicted else 0.0))
        bins = []
        ece = 0.0
        for i, count in enumerate(self.bin_count):
            confidence = float(self.bin_confidence[i]/count) if count else None
            accuracy = float(self.bin_correct[i]/count) if count else None
            if count:
                ece += int(count)/self.count * abs(confidence-accuracy)
            bins.append(dict(lower=i/self.bins, upper=(i+1)/self.bins,
                count=int(count), mean_confidence=confidence, accuracy=accuracy))
        selective_accuracy = self.accepted_correct/self.accepted if self.accepted else None
        return dict(count=self.count, accuracy=float(np.trace(self.confusion)/self.count),
            confusion_matrix=self.confusion.tolist(), per_class=rows,
            macro_f1=sum(row['f1'] for row in rows)/len(rows),
            zero_division_policy='0; inspect support and predicted_count',
            calibration=dict(status='DIAGNOSTIC_ONLY_NOT_CALIBRATED',
                expected_calibration_error=ece, bins=bins,
                bin_policy='equal width, lower inclusive; final bin includes 1',
                multiclass_brier_score=self.brier/self.count,
                negative_log_likelihood=self.nll/self.count),
            abstention=dict(status='FIXED_UNCALIBRATED_SERVING_HEURISTIC',
                minimum_probability=.60, maximum_normalized_entropy=.65, minimum_margin=.15,
                accepted=self.accepted, abstained=self.count-self.accepted,
                coverage=self.accepted/self.count, selective_accuracy=selective_accuracy,
                selective_risk=1-selective_accuracy if selective_accuracy is not None else None))
