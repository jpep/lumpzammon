"""HTTP dev server with strict no-cache headers, for Lumpzammon skin preview."""
import http.server
import socketserver
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3132
    directory = sys.argv[2] if len(sys.argv) > 2 else "devanture"
    handler = lambda *args, **kw: NoCacheHandler(*args, directory=directory, **kw)
    with socketserver.TCPServer(("", port), handler) as httpd:
        print(f"Serving {directory!r} at http://localhost:{port} (no-cache)")
        httpd.serve_forever()
