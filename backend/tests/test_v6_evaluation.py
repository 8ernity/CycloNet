import math
import json
import numpy as np
import pytest
from app.services.evaluation import ClassificationMetrics


def test_metric_values_match_hand_computed_confusion_and_probabilities():
    metrics = ClassificationMetrics(['negative', 'storm'])
    metrics.update([[1, 0], [.2, .8], [.7, .3], [.4, .6]], [0, 1, 1, 0])
    result = metrics.result()
    assert result['confusion_matrix'] == [[1, 1], [1, 1]]
    assert result['macro_f1'] == .5
    assert result['per_class'][1]['precision'] == .5
    assert result['per_class'][0]['recall'] == .5
    assert result['calibration']['multiclass_brier_score'] == pytest.approx(.445)
    assert result['calibration']['expected_calibration_error'] == pytest.approx(.375)
    assert result['calibration']['negative_log_likelihood'] == pytest.approx(-math.log(.8*.3*.4)/4)
    assert sum(row['count'] for row in result['calibration']['bins']) == 4
    json.dumps(result, allow_nan=False)


def test_perfect_predictions_and_exact_one_bin_boundary():
    metrics = ClassificationMetrics(['negative', 'storm'])
    metrics.update([[1, 0], [0, 1]], [0, 1])
    result = metrics.result()
    assert result['macro_f1'] == 1
    assert result['calibration']['expected_calibration_error'] == 0
    assert result['calibration']['bins'][-1]['count'] == 2
    assert result['abstention']['coverage'] == 1
    assert result['abstention']['selective_risk'] == 0


def test_no_accepted_predictions_is_unavailable_not_perfect_accuracy():
    metrics = ClassificationMetrics(['negative', 'storm', 'unseen'])
    metrics.update([[1/3]*3, [1/3]*3], [0, 1])
    result = metrics.result()
    assert result['abstention']['coverage'] == 0
    assert result['abstention']['selective_accuracy'] is None
    assert result['abstention']['selective_risk'] is None
    assert result['per_class'][2]['support'] == 0
    assert result['per_class'][2]['f1'] == 0


def test_batch_partition_does_not_change_results():
    probabilities = np.array([[.9,.1], [.45,.55], [.05,.95]])
    labels = np.array([0,0,1])
    full = ClassificationMetrics(['negative','storm'])
    batches = ClassificationMetrics(['negative','storm'])
    full.update(probabilities, labels)
    for p, y in zip(probabilities, labels):
        batches.update([p], [y])
    assert full.result() == batches.result()


@pytest.mark.parametrize('probabilities,labels', [
    ([[float('nan'),0]], [0]), ([[.3,.3]], [0]), ([[-.1,1.1]], [0]),
    ([[.1,.9]], [2]), ([[.1,.9]], [.5]), ([[.1,.9]], []),
])
def test_invalid_probabilities_and_labels_rejected(probabilities, labels):
    with pytest.raises(ValueError):
        ClassificationMetrics(['a','b']).update(probabilities, labels)


def test_empty_evaluation_cannot_report_results():
    with pytest.raises(ValueError):
        ClassificationMetrics(['a','b']).result()
