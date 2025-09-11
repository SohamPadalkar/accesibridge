import os
import math
import requests
from flask import Flask, request, jsonify
from typing import List, Tuple
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Config
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_BASE = os.environ.get("OPENROUTER_BASE", "https://openrouter.ai/api/v1/chat/completions")
DEFAULT_MODEL = os.environ.get("OPENROUTER_MODEL", "openrouter/auto")

HEADERS = {
    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
    "Content-Type": "application/json"
}

#############
# Utilities #
#############
def hex_to_rgb(hex_color: str) -> Tuple[float, float, float]:
    hex_color = hex_color.strip().lstrip('#')
    if len(hex_color) == 3:
        hex_color = ''.join(2 * c for c in hex_color)
    r = int(hex_color[0:2], 16) / 255.0
    g = int(hex_color[2:4], 16) / 255.0
    b = int(hex_color[4:6], 16) / 255.0
    return (r, g, b)

def relative_luminance(rgb: Tuple[float, float, float]) -> float:
    def to_linear(c): return c/12.92 if c <= 0.03928 else ((c+0.055)/1.055) ** 2.4
    r_lin, g_lin, b_lin = map(to_linear, rgb)
    return 0.2126*r_lin + 0.7152*g_lin + 0.0722*b_lin

def contrast_ratio(hex_a: str, hex_b: str) -> float:
    lum1 = relative_luminance(hex_to_rgb(hex_a))
    lum2 = relative_luminance(hex_to_rgb(hex_b))
    L1, L2 = max(lum1, lum2), min(lum1, lum2)
    return (L1 + 0.05) / (L2 + 0.05)

###############
# Endpoints   #
###############
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200

@app.route("/generate-alt", methods=["POST"])
def generate_alt():
    data = request.get_json() or {}
    image_urls = data.get("image_urls", [])
    if not image_urls:
        return jsonify({"error": "image_urls required"}), 400

    # Fake output for demo (replace with OpenRouter call later)
    alts = [{"url": url, "alt": f"Descriptive alt text for {url}"} for url in image_urls]
    return jsonify({"alts": alts}), 200

@app.route("/accessibility-score", methods=["POST"])
def accessibility_score():
    data = request.get_json() or {}
    images = data.get("images", [])
    contrast = data.get("contrast", [])

    # Simple scoring
    score = 100 - (len(images) * 5 + len(contrast) * 3)
    score = max(0, score)

    return jsonify({
        "score": score,
        "issues": {
            "missing_alt": len(images),
            "contrast_issues": len(contrast)
        }
    })

@app.route("/", methods=["GET"])
def home():
    return "Accessi-Bridge Flask API is running!"

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)
