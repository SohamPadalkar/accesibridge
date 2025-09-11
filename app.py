from dotenv import load_dotenv
import os
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from urllib.parse import urlparse

load_dotenv()

app = Flask(__name__)

# CORS: open during dev, optionally restrict in prod
ALLOWED_ORIGIN = os.getenv("ALLOWED_ORIGIN")
if ALLOWED_ORIGIN:
    CORS(app, resources={r"/*": {"origins": [ALLOWED_ORIGIN]}})
else:
    CORS(app)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_BASE = os.getenv("API_BASE", "https://openrouter.ai/api/v1/chat/completions")
DEFAULT_MODEL = os.getenv("MODEL_NAME", "google/gemini-flash-1.5")

HEADERS = {
    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
    "Content-Type": "application/json",
    "HTTP-Referer": "http://localhost:5000",
    "X-Title": "Accessi-Bridge"
}

def is_valid_image_url(url: str) -> bool:
    try:
        if not url or url.startswith("data:"):
            return False
        p = urlparse(url)
        if p.scheme not in ("http", "https"):
            return False
        return any(p.path.lower().endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"))
    except:
        return False

def alt_with_ai(url: str) -> str:
    if not OPENROUTER_API_KEY:
        return f"Image from {urlparse(url).netloc}"
    payload = {
        "model": DEFAULT_MODEL,
        "messages": [{
            "role": "user",
            "content": [
                {"type":"text","text":"Generate a concise alt text (<100 chars), describe the main subject clearly."},
                {"type":"image_url","image_url":{"url": url}}
            ]
        }],
        "max_tokens": 60,
        "temperature": 0.6
    }
    try:
        r = requests.post(OPENROUTER_BASE, headers=HEADERS, json=payload, timeout=20)
        if r.status_code == 200:
            data = r.json()
            if data.get("choices"):
                return data["choices"]["message"]["content"].strip()[:100]
        # Bubble up error
        raise RuntimeError(f"OpenRouter {r.status_code}: {r.text[:200]}")
    except Exception as e:
        raise RuntimeError(str(e))

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "ai_enabled": bool(OPENROUTER_API_KEY),
        "model": DEFAULT_MODEL
    }), 200

@app.route("/generate-alt", methods=["POST"])
def generate_alt():
    data = request.get_json(silent=True) or {}
    urls = [u for u in data.get("image_urls", []) if is_valid_image_url(u)][:5]
    if not urls:
        return jsonify({"alts": [], "error": None}), 200

    alts, errors = [], []
    for u in urls:
        try:
            text = alt_with_ai(u)
            alts.append({"url": u, "alt": text})
        except Exception as e:
            errors.append({"url": u, "message": str(e)})
    # If all failed, surface a top-level error for the popup
    top_error = None
    if alts == [] and errors:
        top_error = "AI service unavailable or API error. Check API key, model, or network."

    return jsonify({"alts": alts, "errors": errors, "error": top_error}), 200

@app.route("/accessibility-score", methods=["POST"])
def accessibility_score():
    data = request.get_json(silent=True) or {}
    missing = int(data.get("missing_alt_count", 0))
    contrast = int(data.get("contrast_issue_count", 0))

    score = 100 - missing * 8 - contrast * 5
    score = max(0, min(100, score))
    return jsonify({
        "score": score,
        "issues": {"missing_alt": missing, "contrast_issues": contrast}
    }), 200

@app.route("/", methods=["GET"])
def home():
    return f"Accessi-Bridge API. Model={DEFAULT_MODEL}. AI={'ON' if OPENROUTER_API_KEY else 'OFF'}"

if __name__ == "__main__":
    if not OPENROUTER_API_KEY:
        print("⚠️  OPENROUTER_API_KEY not set. AI will fallback.")
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)), debug=True)
