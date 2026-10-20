"""Read-only Pascal adapter. Decimal strings remain strings at the API boundary."""
import json
from decimal import Decimal, InvalidOperation
from urllib.request import Request, urlopen

URL = 'https://data.pascal.trade/api/v1/markets'

def price(value):
    try:
        number = Decimal(str(value))
        return str(number) if number.is_finite() and 0 <= number <= 1 else None
    except InvalidOperation:
        return None

def normalize_market(raw):
    attrs = raw.get('display_attributes') or {}
    symbol = raw.get('symbol')
    if not isinstance(symbol, str) or not symbol:
        raise ValueError('Missing market symbol')
    bid, ask = price(raw.get('best_bid')), price(raw.get('best_ask'))
    return {
        'id': symbol, 'provider': 'pascal',
        'event': attrs.get('event_description') or symbol,
        'title': attrs.get('market_description') or 'Yes',
        'opposite': attrs.get('reverse_description') or 'No',
        'tags': [t for t in attrs.get('tags', []) if isinstance(t, str)],
        'markPrice': price(raw.get('mark_price')),
        'yesAsk': ask,
        'noAsk': str(Decimal(1) - Decimal(bid)) if bid is not None else None,
        'resolved': raw.get('resolution') is not None,
        'rulesUrl': raw.get('rules_url'),
    }

def fetch_markets():
    request = Request(URL, headers={'Accept': 'application/json', 'User-Agent': 'SocialGroups-MVP/1.0'})
    with urlopen(request, timeout=12) as response:
        payload = json.load(response)
    if payload.get('status') != 'success' or not isinstance(payload.get('data'), list):
        raise ValueError('Invalid Pascal response')
    return [normalize_market(m) for m in payload['data'] if m.get('resolution') is None]
