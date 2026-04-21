from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
import yfinance as yf
import pandas as pd
import os
import requests
from dotenv import load_dotenv
from transformers import BertTokenizer, BertForSequenceClassification
import torch
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
import numpy as np
from scipy import stats

load_dotenv()

_forecast_cache = {'data': None, 'timestamp': 0}
FORECAST_CACHE_TTL = 300  # 5 minutes

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
GIE_API_KEY  = os.getenv('GIE_API_KEY')

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

def get_eu_storage():
    try:
        url = f'https://agsi.gie.eu/api?type=EU&size=1&apikey={GIE_API_KEY}'
        headers = {'x-key': GIE_API_KEY}
        response = requests.get(url, headers=headers)
        data = response.json()
        print(f"GIE response: {data}")
        storage_pct = float(data['data'][0]['full'])
        return round(storage_pct, 2)
    except Exception as e:
        print(f"GIE storage error: {e}")
        return 50.0

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
    

@app.route('/api/supply-risk')
def get_supply_risk():
    try:
        # Component 1 — Sentiment score (already computed)
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

        # Filter relevant articles
        relevant = [a for a in articles if a.get('title') and is_relevant(a['title'])]

        # Score headlines
        sentiment_scores = []
        for a in relevant[:15]:
            s = score_headline(a['title'])
            s = override_sentiment(a['title'], s)
            sentiment_scores.append(s)

        negative_count = sum(1 for s in sentiment_scores if s['label'] == 'negative')
        total = len(sentiment_scores) if sentiment_scores else 1
        sentiment_component = round((negative_count / total) * 100)

        # Component 2 — News volume (more articles = higher risk)
        volume_component = min(len(relevant) * 5, 100)

        # Component 3 — TTF price volatility
        raw = yf.download('TTF=F', period='1mo', interval='1d', auto_adjust=True)
        raw.columns = [col[0] if isinstance(col, tuple) else col for col in raw.columns]
        closes = raw['Close'].dropna()
        if len(closes) > 1:
            returns = closes.pct_change().dropna()
            volatility = float(returns.std() * 100)
            volatility_component = min(round(volatility * 10), 100)
        else:
            volatility_component = 50

        # Composite score — weighted average
        # Sentiment: 50%, Volume: 20%, Volatility: 30%
        composite = round(
            sentiment_component * 0.50 +
            volume_component    * 0.20 +
            volatility_component * 0.30
        )

        # Risk level
        if composite >= 70:
            risk_level = 'CRITICAL'
        elif composite >= 40:
            risk_level = 'ELEVATED'
        else:
            risk_level = 'LOW'

        return jsonify({
            'composite': composite,
            'risk_level': risk_level,
            'components': {
                'sentiment': sentiment_component,
                'volume':    volume_component,
                'volatility': volatility_component
            },
            'articles_analysed': total
        })

    except Exception as e:
        print(f"Supply risk error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
    

@app.route('/api/forecast')
def get_forecast():
    import time
    now = time.time()
    if _forecast_cache['data'] and (now - _forecast_cache['timestamp']) < FORECAST_CACHE_TTL:
        return jsonify(_forecast_cache['data'])
    try:
        ttf_raw = yf.download('TTF=F', period='5y', interval='1mo', auto_adjust=True)
        ttf_raw = ttf_raw.squeeze(axis=1) if ttf_raw.shape[1] == 1 else ttf_raw
        ttf_raw.columns = [col[0] if isinstance(col, tuple) else col for col in ttf_raw.columns]
        ttf_prices = ttf_raw['Close'].dropna()

        brent_raw = yf.download('BZ=F', period='5y', interval='1mo', auto_adjust=True)
        brent_raw = brent_raw.squeeze(axis=1) if brent_raw.shape[1] == 1 else brent_raw
        brent_raw.columns = [col[0] if isinstance(col, tuple) else col for col in brent_raw.columns]
        brent_prices = brent_raw['Close'].dropna()

        combined = pd.DataFrame({
            'ttf':   ttf_prices,
            'brent': brent_prices
        }).dropna()

        prices = combined['ttf'].values
        brent  = combined['brent'].values
        dates  = combined.index

        if len(prices) < 6:
            return jsonify({'error': 'Not enough data'}), 500

        eu_storage = get_eu_storage()

        fear_index = 50
        try:
            news_query = '"Strait of Hormuz" OR "tanker attack" OR "Iran energy" OR "Houthi"'
            news_url = (
                f'https://newsapi.org/v2/everything?'
                f'q={requests.utils.quote(news_query)}'
                f'&language=en&sortBy=publishedAt&pageSize=20'
                f'&apiKey={NEWS_API_KEY}'
            )
            news_resp = requests.get(news_url).json()
            articles  = news_resp.get('articles', [])
            relevant  = [a for a in articles if a.get('title') and is_relevant(a['title'])]
            scored    = [override_sentiment(a['title'], score_headline(a['title'])) for a in relevant[:10]]
            neg_count = sum(1 for s in scored if s['label'] == 'negative')
            fear_index = round((neg_count / len(scored)) * 100) if scored else 50
        except:
            pass

        HISTORICAL_FEAR = {
            # Russia invasion and European energy crisis
            '2022-01': 80, '2022-02': 80, '2022-03': 80, '2022-04': 80,
            '2022-05': 80, '2022-06': 80, '2022-07': 80, '2022-08': 80,
            '2022-09': 80, '2022-10': 80, '2022-11': 80, '2022-12': 80,
            # Middle East escalation (Oct 7 aftermath)
            '2024-10': 65, '2024-11': 65, '2024-12': 65,
            # US-Iran war buildup
            '2026-01': 75, '2026-02': 75, '2026-03': 80,
        }

        # Cutoff date — anything from here onwards uses live FinBERT
        LIVE_FEAR_CUTOFF = '2026-03'

        def build_features(idx, fear, storage):
            vol = float(np.std(prices[max(0, idx-3):idx])) if idx >= 3 else 0
            month = dates[idx].month
            seasonal = float(np.sin(2 * np.pi * month / 12))
            volatility_regime = 1.0 if vol > float(np.std(prices)) * 1.5 else 0.0

            date_key = dates[idx].strftime('%Y-%m')

            if fear is not None:
                # Current prediction — use real FinBERT score
                effective_fear = fear
            elif date_key >= LIVE_FEAR_CUTOFF:
                # Recent months — use live FinBERT score
                effective_fear = fear_index
            else:
                # Historical months — use hard labels
                effective_fear = HISTORICAL_FEAR.get(date_key, 50)

            crisis_regime = 1.0 if effective_fear >= 60 else 0.0
            storage_signal = (50.0 - storage) / 50.0

            return [
                float(prices[idx-1]),
                float(prices[idx-2]) if idx >= 2 else float(prices[0]),
                float(prices[idx-3]) if idx >= 3 else float(prices[0]),
                float(brent[idx]),
                vol,
                effective_fear / 100.0,
                seasonal,
                volatility_regime,
                crisis_regime,
                storage_signal,
            ]

        X, y = [], []
        crisis_X, crisis_y = [], []

        for i in range(3, len(prices) - 1):
            features = build_features(i, None, eu_storage)
            target   = float(prices[i + 1])
            date_key = dates[i].strftime('%Y-%m')

            if date_key >= LIVE_FEAR_CUTOFF:
                effective_fear = fear_index
            else:
                effective_fear = HISTORICAL_FEAR.get(date_key, 50)

            is_crisis = effective_fear >= 60

            X.append(features)
            y.append(target)

            if is_crisis:
                crisis_X.append(features)
                crisis_y.append(target)

        # Time weights — recent months weighted more heavily
        n = len(X)
        weights = np.array([np.exp(0.15 * i) for i in range(n)])
        weights = weights / weights.sum()

        n_crisis = len(crisis_X)
        crisis_weights = np.array([np.exp(0.15 * i) for i in range(n_crisis)]) if n_crisis > 0 else np.array([])
        if n_crisis > 0:
            crisis_weights = crisis_weights / crisis_weights.sum()

        scaler_normal = StandardScaler()
        X_scaled = scaler_normal.fit_transform(X)
        model_normal = Ridge(alpha=1.0)
        model_normal.fit(X_scaled, y, sample_weight=weights)

        has_crisis_model = False
        scaler_crisis = None
        model_crisis = None

        if len(crisis_X) >= 4:
            scaler_crisis = StandardScaler()
            crisis_X_scaled = scaler_crisis.fit_transform(crisis_X)
            model_crisis = Ridge(alpha=1.0)
            model_crisis.fit(crisis_X_scaled, crisis_y, sample_weight=crisis_weights)
            has_crisis_model = True

        current_features = build_features(len(prices) - 1, fear_index, eu_storage)
        current_is_crisis = fear_index >= 60

        cf_normal = scaler_normal.transform([current_features])
        normal_forecast = float(model_normal.predict(cf_normal)[0])

        if has_crisis_model and current_is_crisis and scaler_crisis and model_crisis:
            cf_crisis = scaler_crisis.transform([current_features])
            crisis_forecast = float(model_crisis.predict(cf_crisis)[0])
        else:
            storage_adjustment = max(0, (50 - eu_storage) / 50) * 0.20
            fear_adjustment = max(0, (fear_index - 50) / 50) * 0.25
            current_month = dates[-1].month
            seasonal_adjustment = 0.10 if current_month in [10, 11, 12, 1, 2, 3] else 0.0
            crisis_forecast = normal_forecast * (1 + storage_adjustment + fear_adjustment + seasonal_adjustment)

        y_pred_normal = model_normal.predict(X_scaled)
        residuals = np.array(y) - y_pred_normal

        # Split residuals by regime for separate band calculation
        normal_indices = [i for i, x in enumerate(X) if x[8] == 0.0]  # crisis_regime == 0
        crisis_indices = [i for i, x in enumerate(X) if x[8] == 1.0]  # crisis_regime == 1

        normal_residuals = residuals[normal_indices] if normal_indices else residuals
        crisis_residuals = residuals[crisis_indices] if crisis_indices else residuals

        # Use IQR on each regime separately
        def robust_std(res):
            q75, q25 = np.percentile(res, [75, 25])
            return float((q75 - q25) / 1.35)

        std_normal = robust_std(normal_residuals) if len(normal_residuals) > 2 else 5.0
        std_crisis = robust_std(crisis_residuals) if len(crisis_residuals) > 2 else std_normal * 1.6
        std_crisis = min(std_crisis, std_normal * 2.0)

        current_price = float(prices[-1])
        z_score = (current_price - normal_forecast) / std_normal if std_normal > 0 else 0
        divergence = abs(z_score) > 2.0
        divergence_direction = 'above' if z_score > 0 else 'below'
        risk_premium = round(crisis_forecast - normal_forecast, 2)

        historical = []
        for date, price in zip(dates, prices):
            historical.append({
                'date':   date.strftime('%Y-%m'),
                'actual': round(float(price), 2)
            })

        forecast_points = []
        last_date = dates[-1]
        last_price = float(prices[-1])

        for m in range(1, 4):
            forecast_date = last_date + pd.DateOffset(months=m)
            # Blend forecast toward last price with decay
            decay = 0.3 * m
            normal_m  = round(normal_forecast * (1 - decay) + last_price * decay, 2)
            crisis_m  = round(crisis_forecast * (1 - decay) + last_price * decay, 2)
            forecast_points.append({
                'date':         forecast_date.strftime('%Y-%m'),
                'normal':       normal_m,
                'crisis':       crisis_m,
                'normal_upper': round(normal_m + std_normal * (1 + m * 0.1), 2),
                'normal_lower': max(0, round(normal_m - std_normal * (1 + m * 0.1), 2)),
                'crisis_upper': round(crisis_m + std_crisis * (1 + m * 0.1), 2),
                'crisis_lower': max(0, round(crisis_m - std_crisis * (1 + m * 0.1), 2)),
            })

        result = {
            'current_price':        round(current_price, 2),
            'normal_forecast':      round(normal_forecast, 2),
            'crisis_forecast':      round(crisis_forecast, 2),
            'risk_premium':         risk_premium,
            'std_normal':           round(std_normal, 2),
            'std_crisis':           round(std_crisis, 2),
            'fear_index':           fear_index,
            'eu_storage':           eu_storage,
            'current_regime':       'CRISIS' if current_is_crisis else 'NORMAL',
            'divergence':           divergence,
            'divergence_zscore':    round(z_score, 2),
            'divergence_direction': divergence_direction,
            'has_crisis_model':     has_crisis_model,
            'historical':           historical,
            'forecast':             forecast_points,
        }
        _forecast_cache['data'] = result
        _forecast_cache['timestamp'] = time.time()
        return jsonify(result)

    except Exception as e:
        print(f"Forecast error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/health')
def health():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    app.run(debug=True, port=8080)