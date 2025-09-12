from dotenv import load_dotenv
import os
import requests
import json
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from urllib.parse import urlparse

# Load environment variables
load_dotenv()

app = Flask(__name__)

# CORS Configuration
ALLOWED_ORIGIN = os.getenv("ALLOWED_ORIGIN")
if ALLOWED_ORIGIN:
    print(f"🔒 CORS locked to: {ALLOWED_ORIGIN}")
    CORS(app, resources={r"/*": {"origins": [ALLOWED_ORIGIN]}})
else:
    print("🌐 CORS open for development")
    CORS(app)

# Configuration
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_BASE = os.getenv("API_BASE", "https://openrouter.ai/api/v1/chat/completions")
DEFAULT_MODEL = os.getenv("MODEL_NAME", "google/gemini-flash-1.5")

HEADERS = {
    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
    "Content-Type": "application/json",
    "HTTP-Referer": "http://localhost:5000",
    "X-Title": "AccessiBridge"
}

def log_info(message):
    """Enhanced logging with timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] ℹ️  {message}")

def log_success(message):
    """Success logging"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] ✅ {message}")

def log_error(message):
    """Error logging"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] ❌ {message}")

def log_warning(message):
    """Warning logging"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] ⚠️  {message}")

def is_valid_image_url(url):
    """Check if URL is a valid image"""
    try:
        if not url or url.startswith('data:'):
            return False
        parsed = urlparse(url)
        if parsed.scheme not in ['http', 'https']:
            log_warning(f"Invalid scheme for URL: {url}")
            return False
        
        # Check file extension
        valid_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
        is_valid = any(parsed.path.lower().endswith(ext) for ext in valid_extensions)
        
        if not is_valid:
            log_warning(f"No valid image extension found: {url}")
        
        return is_valid
    except Exception as e:
        log_error(f"Error validating URL {url}: {e}")
        return False

def generate_alt_text_with_ai(image_url):
    """Generate alt text using OpenRouter API with detailed logging"""
    if not OPENROUTER_API_KEY:
        fallback = f"Image from {urlparse(image_url).netloc}"
        log_warning(f"No API key - using fallback: {fallback}")
        return fallback
    
    log_info(f"🤖 Generating alt text for: {image_url}")
    
    try:
        payload = {
            "model": DEFAULT_MODEL,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Generate a concise, descriptive alt text for this image in under 100 characters. Focus on the main subject and important details."
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": image_url}
                        }
                    ]
                }
            ],
            "max_tokens": 60,
            "temperature": 0.7
        }
        
        log_info(f"📡 Sending request to OpenRouter (model: {DEFAULT_MODEL})")
        response = requests.post(OPENROUTER_BASE, headers=HEADERS, json=payload, timeout=20)
        
        log_info(f"📨 OpenRouter response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            log_info(f"📄 Full AI response: {json.dumps(data, indent=2)}")
            
            if 'choices' in data and len(data['choices']) > 0:
                alt_text = data['choices'][0]['message']['content'].strip()
                log_success(f"🎯 Generated alt text: '{alt_text[:50]}{'...' if len(alt_text) > 50 else ''}'")
                return alt_text[:100]  # Ensure it's not too long
        else:
            log_error(f"OpenRouter API error: {response.status_code} - {response.text}")
            
    except Exception as e:
        log_error(f"Exception calling OpenRouter API: {e}")
    
    # Fallback to descriptive text
    fallback = f"Image from {urlparse(image_url).netloc}"
    log_warning(f"Using fallback alt text: {fallback}")
    return fallback

@app.route("/health", methods=["GET"])
def health():
    """Health check with detailed status"""
    log_info("🏥 Health check requested")
    
    status = {
        "status": "ok",
        "ai_enabled": bool(OPENROUTER_API_KEY),
        "model": DEFAULT_MODEL,
        "api_base": OPENROUTER_BASE,
        "timestamp": datetime.now().isoformat()
    }
    
    if OPENROUTER_API_KEY:
        log_success("✅ AI features are enabled")
    else:
        log_warning("⚠️  AI features disabled - no API key")
    
    return jsonify(status), 200

@app.route("/generate-alt", methods=["POST"])
def generate_alt():
    """Generate alt text for images with detailed logging"""
    data = request.get_json() or {}
    image_urls = data.get("image_urls", [])
    
    log_info(f"🖼️  Alt text generation requested for {len(image_urls)} images")
    
    if not image_urls:
        log_warning("No image URLs provided")
        return jsonify({"error": "image_urls required"}), 400

    alts = []
    processed_count = 0
    
    for url in image_urls[:5]:  # Limit to 5 images to avoid rate limits
        log_info(f"🔍 Processing image {processed_count + 1}/{min(len(image_urls), 5)}: {url[:60]}...")
        
        # Skip invalid URLs
        if not is_valid_image_url(url):
            log_warning(f"⏭️  Skipping invalid URL: {url}")
            continue
            
        try:
            alt_text = generate_alt_text_with_ai(url)
            alts.append({"url": url, "alt": alt_text})
            processed_count += 1
            log_success(f"✅ Successfully processed image {processed_count}")
        except Exception as e:
            log_error(f"❌ Error processing {url}: {e}")
            alts.append({"url": url, "alt": f"Image from {urlparse(url).netloc}"})

    log_success(f"🎉 Alt text generation complete! Processed {processed_count} images successfully")
    return jsonify({"alts": alts}), 200

@app.route("/accessibility-score", methods=["POST"])
def accessibility_score():
    """Calculate accessibility score with logging"""
    data = request.get_json() or {}
    
    missing_alt = data.get("missing_alt_count", 0)
    contrast_issues = data.get("contrast_issue_count", 0)
    
    log_info(f"📊 Score calculation: {missing_alt} missing alt, {contrast_issues} contrast issues")
    
    # Enhanced scoring algorithm
    score = 100
    score -= missing_alt * 8  # Alt text is critical
    score -= contrast_issues * 5  # Contrast is important
    
    # Ensure score is between 0 and 100
    score = max(0, min(100, score))
    
    log_success(f"🎯 Accessibility score calculated: {score}/100")
    
    return jsonify({
        "score": score,
        "issues": {
            "missing_alt": missing_alt,
            "contrast_issues": contrast_issues
        },
        "recommendations": {
            "alt_text": f"Add alt text to {missing_alt} images" if missing_alt > 0 else "Great job on alt text!",
            "contrast": f"Fix {contrast_issues} contrast issues" if contrast_issues > 0 else "Contrast looks good!"
        }
    })

@app.route("/ai-report", methods=["POST"])
def ai_report():
    """Generate comprehensive AI accessibility report"""
    data = request.get_json() or {}
    heuristics = data.get("heuristics", {})
    
    page_url = heuristics.get("meta", {}).get("url", "Unknown page")
    log_info(f"📄 AI report requested for: {page_url}")
    
    def fallback_report(h):
        """Generate fallback report when AI is unavailable"""
        log_info("📝 Generating fallback report (AI unavailable)")
        
        score_tips = []
        if h.get("images", {}).get("missingAlt", 0) > 0:
            score_tips.append("Add descriptive alt text to images")
        if h.get("forms", {}).get("inputsWithoutLabel", 0) > 0:
            score_tips.append("Associate labels with form controls")
        if h.get("links", {}).get("genericText", 0) > 0:
            score_tips.append("Use descriptive link text instead of 'click here'")
        if not h.get("landmarks", {}).get("hasMain"):
            score_tips.append("Add a main landmark (<main> or role='main')")
        
        md = f"# Accessibility Report\n\n"
        md += f"**Page:** {h.get('meta', {}).get('url', '')}\n"
        md += f"**Title:** {h.get('meta', {}).get('title', '')}\n\n"
        
        if score_tips:
            md += "## Key Recommendations\n\n"
            for tip in score_tips:
                md += f"- {tip}\n"
        else:
            md += "## Great Job! 🎉\n\n"
            md += "No major accessibility issues were detected. Your site is on the right track!\n\n"
            md += "### Proactive Suggestions:\n"
            md += "- Consider adding skip navigation links\n"
            md += "- Test with screen readers for user experience\n"
        
        return md

    if not OPENROUTER_API_KEY:
        log_warning("⚠️  AI unavailable - generating fallback report")
        return jsonify({
            "report_markdown": fallback_report(heuristics),
            "summary": "Fallback report (AI disabled)",
            "error": "AI features disabled - set OPENROUTER_API_KEY"
        }), 200

    # Craft AI prompt
    log_info("🤖 Crafting AI prompt for comprehensive report")
    
    payload = {
        "model": DEFAULT_MODEL,
        "messages": [
            {
                "role": "system",
                "content": "You are an expert web accessibility auditor following WCAG 2.2 AA standards. Generate a comprehensive, encouraging, and actionable accessibility report. Use a positive tone and focus on both strengths and improvements."
            },
            {
                "role": "user",
                "content": f"""Create a detailed accessibility report for this webpage. Include:

1. **Executive Summary** (2-3 sentences)
2. **Strengths** (what's working well)
3. **Priority Fixes** (top 5 issues with impact and solutions)
4. **Recommendations** (additional improvements)
5. **Encouragement** (positive closing)

Heuristics data:
{json.dumps(heuristics, indent=2)}

Make it professional but encouraging. Focus on user impact."""
            }
        ],
        "max_tokens": 800,
        "temperature": 0.6
    }
    
    try:
        log_info("📡 Sending AI report request to OpenRouter")
        response = requests.post(OPENROUTER_BASE, headers=HEADERS, json=payload, timeout=30)
        
        log_info(f"📨 AI report response status: {response.status_code}")
        
        if response.status_code == 200:
            ai_data = response.json()
            if 'choices' in ai_data and len(ai_data['choices']) > 0:
                report_content = ai_data['choices'][0]['message']['content'].strip()
                log_success(f"🎉 AI report generated successfully ({len(report_content)} characters)")
                
                return jsonify({
                    "report_markdown": report_content,
                    "summary": "AI-generated comprehensive accessibility report"
                }), 200
        else:
            log_error(f"OpenRouter API error for report: {response.status_code} - {response.text}")
            
    except Exception as e:
        log_error(f"Exception generating AI report: {e}")
    
    # Fall back to heuristic report
    log_warning("🔄 Falling back to heuristic-based report")
    return jsonify({
        "report_markdown": fallback_report(heuristics),
        "summary": "Fallback report (AI request failed)",
        "error": "AI service temporarily unavailable"
    }), 200

@app.route("/", methods=["GET"])
def home():
    """API status page"""
    api_status = "enabled" if OPENROUTER_API_KEY else "disabled"
    message = f"🌉 AccessiBridge API is running! AI: {api_status}, Model: {DEFAULT_MODEL}"
    log_info("🏠 Home page accessed")
    return message

if __name__ == "__main__":
    print("\n" + "="*60)
    print("🌉 AccessiBridge - Making the Web Accessible")
    print("="*60)
    
    if not OPENROUTER_API_KEY:
        log_warning("OPENROUTER_API_KEY not set. AI features will use fallback descriptions.")
        log_info("💡 To enable real AI: Add OPENROUTER_API_KEY=your_key_here to your .env file")
    else:
        log_success("AI features enabled with OpenRouter!")
        log_info(f"🤖 Using model: {DEFAULT_MODEL}")
    
    log_info(f"🚀 Starting server on http://localhost:5000")
    print("="*60 + "\n")
    
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)
