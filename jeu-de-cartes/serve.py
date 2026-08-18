import functools
import http.server
import socketserver

PORT = 8767
DIRECTORY = "/Users/bastienselliez/Documents/Skull king/jeu-de-cartes"

Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=DIRECTORY)
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    httpd.serve_forever()
