from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
import yfinance as yf
import pandas as pd
import os

app = Flask(__name__, static_folder='..', static_url_path='')
CORS(app, resources={r"/api/*": {"origins": "*"}})

TICKERS = {
    'ttf':   'TTF=F',
    'brent': 'BZ=F',
    'henry': 'NG=F',
    'lng':   'LNG',
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
        interval = '1d' if period == '1mo' else '1wk' if period =='3mo' else '1mo'
        raw = yf.download(ticker, period=period, interval=interval, auto_adjust=True)
        raw.columns = [col[0] if isinstance(col, tuple) else col for col in raw.columns]
        close = raw['Close'].dropna()

        prices = []
        prices = []
        for date, value in close.items():
            date_str = date.strftime('%Y-%m-%d') if interval == '1d' else date.strftime('%Y-%m-%d') if interval == '1wk' else date.strftime('%Y-%m')
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

@app.route('/api/health')
def health():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    app.run(debug=True, port=8080)