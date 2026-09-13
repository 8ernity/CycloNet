import requests

test_files = [
    ('Demo_1_CS.jpg', 'D:/Projects/CycloneTracker/frontend/public/demo_frames/demo_1.jpg'),
    ('Demo_2_SCS.jpg', 'D:/Projects/CycloneTracker/frontend/public/demo_frames/demo_2.jpg'),
    ('Demo_3_VSCS.jpg', 'D:/Projects/CycloneTracker/frontend/public/demo_frames/demo_3.jpg'),
    ('Demo_4_ESCS.jpg', 'D:/Projects/CycloneTracker/frontend/public/demo_frames/demo_4.jpg')
]

print('=' * 80)
print('LIVE API INFERENCE RESULTS FROM TRAINED PYTORCH MODEL')
print('=' * 80)

for name, path in test_files:
    with open(path, 'rb') as f:
        res = requests.post('http://localhost:8000/api/classify', files={'file': (name, f, 'image/jpeg')})
        if res.status_code == 200:
            pred = res.json()['prediction']
            probs = pred.get('probabilities', {})
            cat = pred['category_short']
            conf = pred['confidence']
            print(f'{name:20s} -> Class: {cat:15s} | Conf: {conf:5.2f}% | Softmax: {probs}')
        else:
            print(f'{name:20s} -> ERROR: {res.status_code} {res.text}')
