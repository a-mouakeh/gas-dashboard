from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
import yfinance as yf
import pandas as pd
import os
import requests
from dotenv import load_dotenv
from transformers import BertTokenizer, BertForSequenceClassification
import torch

load_dotenv()

print("Loading FinBERT...")
tokenizer = BertTokenizer.from_pretrained('ProsusAI/finbert')
finbert = BertForSequenceClassification.from_pretrained('ProsusAI/finbert')
finbert.eval()
print("FinBERT ready.")

def score_headline(text):
    inputs = tokenizer(text, return_tensors='pt', truncation=True, max_length=512)
    with torch.no_grad():
        outputs = finbert(**inputs)
    probs = torch.softmax(outputs.logits, dim=1).squeeze()
    labels = ['positive', 'negative', 'neutral']
    scores = {labels[i]: round(float(probs[i]), 4) for i in range(3)}
    top = max(scores, key=scores.get)
    return {
        'label': top,
        'scores': scores,
        'confidence': round(scores[top], 4)
    }

app = Flask(__name__, static_folder='..', static_url_path='')
CORS(app, resources={r"/api/*": {"origins": "*"}})

NEWS_API_KEY = os.getenv('NEWS_API_KEY')

TICKERS = {
    'ttf':   'TTF=F',
    'brent': 'BZ=F',
    'henry': 'NG=F',
    'lng':   'LNG',
}

LIVE_TICKERS = {
    'ttf':      'TTF=F',
    'henry':    'NG=F',
    'brent':    'BZ=F',
    'nakilat':  'QGTS.QA',
    'aramco':   '2222.SR',
    'shell':    'SHEL',
    'total':    'TTE',
    'cheniere': 'LNG',
}

@app.route('/')
def index():
    return send_from_directory('..', 'index.html')

@app.route('/api/prices/<commodity>')
def get_prices(commodity):
    ticker = TICKERS.get(commodity.lower())
    if not ticker:
        return jsonify({'error': f'Unknown commodity: {commodity}'}), 404
    try:
        period = request.args.get('period', '2y')
        interval = '1d' if period == '1mo' else '1wk' if period in ['3mo', '6mo'] else '1mo'
        raw = yf.download(ticker, period=period, interval=interval, auto_adjust=True)
        raw.columns = [col[0] if isinstance(col, tuple) else col for col in raw.columns]
        close = raw['Close'].dropna()
        prices = []
        for date, value in close.items():
            date_str = date.strftime('%Y-%m-%d') if interval in ['1d', '1wk'] else date.strftime('%Y-%m')
            prices.append({
                'date': date_str,
                'value': round(float(value), 2)
            })
        return jsonify({
            'commodity': commodity,
            'ticker': ticker,
            'data': prices
        })
    except Exception as e:
        print(f"ERROR for {commodity}: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/live')
def get_live_prices():
    results = []
    for name, ticker in LIVE_TICKERS.items():
        try:
            data = yf.Ticker(ticker)
            hist = data.history(period='2d')
            if len(hist) < 2:
                raise ValueError('Not enough data')
            prev_close = round(float(hist['Close'].iloc[-2]), 2)
            last_price = round(float(hist['Close'].iloc[-1]), 2)
            change_pct = round(((last_price - prev_close) / prev_close) * 100, 2)
            results.append({
                'name': name,
                'ticker': ticker,
                'price': last_price,
                'change_pct': change_pct,
            })
        except Exception as e:
            results.append({
                'name': name,
                'ticker': ticker,
                'price': None,
                'change_pct': None,
            })
    return jsonify(results)

@app.route('/api/news/general')
def get_general_news():
    try:
        query = 'LNG OR "natural gas" OR "gas pipeline" OR "Gulf energy" OR "energy market"'
        url = (
            f'https://newsapi.org/v2/everything?'
            f'q={requests.utils.quote(query)}'
            f'&language=en'
            f'&sortBy=publishedAt'
            f'&pageSize=15'
            f'&apiKey={NEWS_API_KEY}'
        )
        response = requests.get(url)
        data = response.json()
        articles = []
        for a in data.get('articles', []):
            articles.append({
                'title':       a.get('title'),
                'source':      a.get('source', {}).get('name'),
                'url':         a.get('url'),
                'publishedAt': a.get('publishedAt'),
                'description': a.get('description'),
            })
        return jsonify(articles)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/news/hormuz')
def get_hormuz_news():
    try:
        query = '"Strait of Hormuz" OR "tanker attack" OR "oil facility attack" OR "gas facility" OR "shipping attack" OR "energy infrastructure" OR "Houthi"'
        url = (
            f'https://newsapi.org/v2/everything?'
            f'q={requests.utils.quote(query)}'
            f'&language=en'
            f'&sortBy=publishedAt'
            f'&pageSize=15'
            f'&apiKey={NEWS_API_KEY}'
        )
        response = requests.get(url)
        data = response.json()
        articles = []
        for a in data.get('articles', []):
            articles.append({
                'title':       a.get('title'),
                'source':      a.get('source', {}).get('name'),
                'url':         a.get('url'),
                'publishedAt': a.get('publishedAt'),
                'description': a.get('description'),
            })
        return jsonify(articles)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
SENTIMENT_KEYWORDS = [
    'hormuz', 'iran', 'tanker', 'lng', 'gas facility',
    'oil facility', 'shipping', 'houthi', 'gulf energy',
    'strait', 'pipeline attack', 'refinery', 'crude supply'
]

def is_relevant(title):
    title_lower = title.lower()
    return any(kw in title_lower for kw in SENTIMENT_KEYWORDS)

ESCALATION_KEYWORDS = [
    'strike', 'attack', 'bomb', 'missile', 'drone attack',
    'invasion', 'war', 'ultimatum', 'threatens', 'seize',
    'incursion', 'conflict escalat', 'emergency', 'shutdown',
    'closure', 'blockade'
]

def override_sentiment(title, sentiment):
    title_lower = title.lower()
    if any(kw in title_lower for kw in ESCALATION_KEYWORDS):
        return {
            'label': 'negative',
            'confidence': max(sentiment['confidence'], 0.75),
            'scores': sentiment['scores']
        }
    return sentiment

@app.route('/api/sentiment')
def get_sentiment():
    try:
        query = '"Strait of Hormuz" OR "tanker attack" OR "oil facility" OR "gas facility" OR "Houthi" OR "Iran energy"'
        url = (
            f'https://newsapi.org/v2/everything?'
            f'q={requests.utils.quote(query)}'
            f'&language=en'
            f'&sortBy=publishedAt'
            f'&pageSize=30'
            f'&apiKey={NEWS_API_KEY}'
        )
        response = requests.get(url)
        data = response.json()
        articles = data.get('articles', [])

        results = []
        scores = {'positive': 0, 'negative': 0, 'neutral': 0}
        count = 0

        for a in articles:
            title = a.get('title', '')
            if not title:
                continue

            # Filter 1 — must contain relevant keyword
            if not is_relevant(title):
                continue

            sentiment = score_headline(title)
            sentiment = override_sentiment(title, sentiment)

            # Filter 2 — skip low confidence scores
            if sentiment['confidence'] < 0.6:
                continue

            results.append({
                'title': title,
                'source': a.get('source', {}).get('name'),
                'publishedAt': a.get('publishedAt'),
                'label': sentiment['label'],
                'confidence': sentiment['confidence'],
                'scores': sentiment['scores']
            })
            scores[sentiment['label']] += 1
            count += 1

        fear_index = round((scores['negative'] / count) * 100) if count > 0 else 0

        return jsonify({
            'fear_index': fear_index,
            'counts': scores,
            'total': count,
            'articles': results
        })

    except Exception as e:
        print(f"Sentiment error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/health')
def health():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    app.run(debug=True, port=8080)