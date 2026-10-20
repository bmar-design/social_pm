import unittest
from unittest.mock import patch
from backend.pascal import normalize_market, price
import server

class MarketTests(unittest.TestCase):
    def test_no_purchase_uses_bid_not_mark_or_ask(self):
        m = normalize_market({'symbol': 'GAME.WIN', 'best_bid': '0.54', 'best_ask': '0.58', 'mark_price': '0.56'})
        self.assertEqual(m['yesAsk'], '0.58')
        self.assertEqual(m['noAsk'], '0.46')

    def test_missing_and_invalid_prices_never_become_zero(self):
        for v in (None, '', 'NaN', 'Infinity', '-0.01', '1.01', 'invalid'):
            self.assertIsNone(price(v))
        self.assertEqual(price('0'), '0')
        m = normalize_market({'symbol': 'GAME.WIN'})
        self.assertIsNone(m['yesAsk'])
        self.assertIsNone(m['noAsk'])

    def test_catalog_fetch_is_cached_and_failure_not_reported_as_fresh(self):
        server.CACHE = None
        with patch('server.fetch_markets', return_value=[{'id': 'A'}]) as fetch:
            first = server.market_snapshot()
            self.assertIs(server.market_snapshot(), first)
            self.assertEqual(fetch.call_count, 1)
        old = dict(first, fetchedAt=0)
        server.CACHE = old
        with patch('server.fetch_markets', side_effect=TimeoutError):
            with self.assertRaises(TimeoutError):
                server.market_snapshot()
        self.assertIs(server.CACHE, old)
        server.CACHE = None

if __name__ == '__main__':
    unittest.main()
