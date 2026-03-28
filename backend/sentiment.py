from transformers import BertTokenizer, BertForSequenceClassification
import torch

print("Loading FinBERT model...")
tokenizer = BertTokenizer.from_pretrained('ProsusAI/finbert')
model = BertForSequenceClassification.from_pretrained('ProsusAI/finbert')
model.eval()
print("Model loaded.")

def score_headline(text):
    inputs = tokenizer(text, return_tensors='pt', truncation=True, max_length=512)
    with torch.no_grad():
        outputs = model(**inputs)
    probs = torch.softmax(outputs.logits, dim=1).squeeze()
    labels = ['positive', 'negative', 'neutral']
    scores = {labels[i]: round(float(probs[i]), 4) for i in range(3)}
    top = max(scores, key=scores.get)
    return {
        'label': top,
        'scores': scores,
        'confidence': scores[top]
    }

# Test it
headlines = [
    "Saudi Arabia shoots down drones targeting major oilfield",
    "Iran names new supreme leader as oil prices surge past $100",
    "Qatar LNG exports remain stable despite regional tensions",
]

for h in headlines:
    result = score_headline(h)
    print(f"\n{h}")
    print(f"→ {result['label'].upper()} ({result['confidence']*100:.1f}%)")