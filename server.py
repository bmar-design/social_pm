"""Local MVP server: public market reads only; no account or money operations."""
import json
import time
import threading
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit
from backend.pascal import fetch_markets

ROOT = Path(__file__).resolve().parent
CACHE = None
LOCK = threading.Lock()

def market_snapshot():
    global CACHE
    with LOCK:
        if CACHE and time.time() - CACHE['fetchedAt'] < 15:
            return CACHE
        markets = fetch_markets()
        CACHE = {'markets': markets, 'fetchedAt': int(time.time()), 'provider': 'pascal', 'tradingEnabled': False}
        return CACHE

class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        path = urlsplit(self.path).path
        if path == '/api/markets':
            try:
                self.reply(200, market_snapshot())
            except Exception:
                self.reply(503, {'error': 'Market data is temporarily unavailable. Please try again.'})
            return
        if path.startswith('/api/'):
            self.reply(404, {'error': 'Not found'})
            return
        # Explicit allowlist: never serve source, credentials, or .git.
        files = {'/': 'index.html', '/index.html': 'index.html', '/app.js': 'app.js',
                 '/live.js': 'live.js', '/style.css': 'style.css'}
        if path not in files:
            self.send_error(404)
            return
        content = (ROOT / files[path]).read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', self.guess_type(files[path]) + '; charset=utf-8')
        self.send_header('Content-Length', str(len(content)))
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(content)

    def do_HEAD(self):
        self.send_error(405)

    def do_POST(self):
        self.reply(501, {'error': 'Accounts, funding and trading are not connected in this preview.'})

    def reply(self, status, data):
        content = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(content)))
        self.end_headers()
        self.wfile.write(content)

if __name__ == '__main__':
    print('Social Groups: http://localhost:5173', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 5173), Handler).serve_forever()
