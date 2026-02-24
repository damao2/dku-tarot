"""
DKU Tarot — Local proxy: translates OpenAI-format requests to Anthropic's API.
Usage:
    python3 proxy.py
Then set API Endpoint in the app to:  http://localhost:8787/v1/chat/completions
"""

import json, sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"
PORT = 8787


class ProxyHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        """Handle CORS preflight."""
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        openai_req = json.loads(body)

        api_key = self.headers.get("Authorization", "").replace("Bearer ", "")

        # --- Translate OpenAI format → Anthropic format ---
        system_text = ""
        messages = []
        for msg in openai_req.get("messages", []):
            if msg["role"] == "system":
                system_text += msg["content"] + "\n"
            else:
                messages.append({"role": msg["role"], "content": msg["content"]})

        anthropic_body = {
            "model": openai_req.get("model", "claude-sonnet-4-5-20250929"),
            "max_tokens": 1024,
            "stream": True,
            "messages": messages,
        }
        if system_text.strip():
            anthropic_body["system"] = system_text.strip()

        req = Request(
            ANTHROPIC_URL,
            data=json.dumps(anthropic_body).encode(),
            headers={
                "Content-Type": "application/json",
                "x-api-key": api_key,
                "anthropic-version": ANTHROPIC_VERSION,
            },
            method="POST",
        )

        try:
            resp = urlopen(req)
        except HTTPError as e:
            err_body = e.read().decode()
            self.send_response(e.code)
            self._cors_headers()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(err_body.encode())
            return

        # --- Stream: translate Anthropic SSE → OpenAI SSE ---
        self.send_response(200)
        self._cors_headers()
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()

        for raw_line in resp:
            line = raw_line.decode("utf-8").strip()
            if not line.startswith("data: "):
                continue
            data = line[6:]
            if data == "[DONE]":
                self.wfile.write(b"data: [DONE]\n\n")
                self.wfile.flush()
                break

            try:
                event = json.loads(data)
            except json.JSONDecodeError:
                continue

            etype = event.get("type", "")

            if etype == "content_block_delta":
                text = event.get("delta", {}).get("text", "")
                if text:
                    openai_chunk = {
                        "choices": [{"delta": {"content": text}, "index": 0}]
                    }
                    self.wfile.write(f"data: {json.dumps(openai_chunk)}\n\n".encode())
                    self.wfile.flush()

            elif etype == "message_stop":
                self.wfile.write(b"data: [DONE]\n\n")
                self.wfile.flush()
                break

    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")

    def log_message(self, fmt, *args):
        print(f"[proxy] {args[0]}")


if __name__ == "__main__":
    print(f"DKU Tarot proxy running on http://localhost:{PORT}")
    print(f"Set API Endpoint to: http://localhost:{PORT}/v1/chat/completions")
    print("Press Ctrl+C to stop.\n")
    try:
        HTTPServer(("", PORT), ProxyHandler).serve_forever()
    except KeyboardInterrupt:
        print("\nProxy stopped.")
