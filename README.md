🌉 AccessiBridge
AI-powered accessibility for everyone - scan, fix, and bridge the digital divide in one click.
AccessiBridge is a Chrome extension that leverages AI to make any website accessible in real-time. With just a few clicks, transform inaccessible websites into inclusive experiences for everyone.
✨ Features
🔍 Smart Accessibility Scanning
* Real-time detection of accessibility issues

* Visual highlighting of problematic elements

* Live accessibility score with beautiful donut chart visualization

🤖 AI-Powered Alt Text Generation
   * Automatic image description using OpenRouter's vision AI

   * Contextual, meaningful alt text for screen readers

   * One-click fixes for missing image descriptions

🎨 Intelligent Contrast Fixing
      * WCAG 2.2 AA compliant contrast adjustments

      * Preserves design aesthetics while ensuring readability

      * Smart color calculations for optimal accessibility

📄 Comprehensive AI Reports
         * Detailed accessibility audits with actionable insights

         * Human-friendly explanations of why fixes matter

         * Exportable reports for developers and stakeholders

🚀 Quick Start
Prerequisites
            * Chrome browser

            * Python 3.9+

            * OpenRouter API key (Get one here)

Installation
1. Clone the Repository
bash
git clone https://github.com/yourusername/accessibridge.git
cd accessibridge


2. Backend Setup
bash
# Install Python dependencies
pip install -r requirements.txt


# Create environment file
touch .env


Add to your .env file:
text
OPENROUTER_API_KEY=your_openrouter_api_key_here
MODEL_NAME=google/gemini-flash-1.5
API_BASE=https://openrouter.ai/api/v1/chat/completions


Start the Flask server:
bash
python app.py


You should see:
text
✅ AI features enabled with OpenRouter!
🚀 Starting server on http://localhost:5000


3. Chrome Extension Setup
               1. Open Chrome and go to chrome://extensions

               2. Enable Developer Mode (toggle in top-right)

               3. Click Load unpacked

               4. Select the extension folder (containing manifest.json)

               5. The AccessiBridge icon will appear in your toolbar

🎯 Usage
                  1. Navigate to any website (try Wikipedia, GitHub, or news sites)

                  2. Click the AccessiBridge icon in your toolbar

                  3. Click "Scan Page" to analyze accessibility issues

                  4. Use the action buttons:

                     * 🤖 Generate AI Alt Text - Adds descriptions to images

                     * 🎨 Fix Contrast Issues - Improves text readability

                     * 📄 Generate AI Report - Creates comprehensive audit

Watch your accessibility score improve from 0% to 100%! 📈
🛠️ Built With
Frontend
                        * Chrome Extension API (Manifest V3)

                        * HTML5, CSS3, JavaScript (ES6+)

                        * Chrome Messaging API for component communication

                        * CSS Grid & Flexbox for responsive design

Backend
                           * Python Flask - REST API server

                           * OpenRouter API - AI model integration

                           * Google Gemini Flash 1.5 - Computer vision for image analysis

                           * WCAG 2.2 AA - Accessibility compliance algorithms

Key Technologies
                              * Real-time DOM analysis with MutationObserver

                              * Asynchronous message passing between extension components

                              * Color contrast calculations using relative luminance

                              * Environment-based configuration with python-dotenv

📊 Project Structure
text
accessibridge/
├── manifest.json          # Extension configuration
├── popup.html             # Extension popup UI
├── popup.css              # Dark theme styling
├── popup.js               # Frontend logic
├── content.js             # Page analysis & manipulation
├── app.py                 # Flask backend with AI integration
├── requirements.txt       # Python dependencies
├── .env                   # Environment variables (not committed)
├── .gitignore            # Git ignore rules
├── icons/                # Extension icons
│   └── logo.png       # Logo assets
└── README.md             # This file


🔧 Development
Running Tests
bash
# Test your OpenRouter API key
curl -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model":"google/gemini-flash-1.5","messages":[{"role":"user","content":"Hello"}]}' \
     https://openrouter.ai/api/v1/chat/completions


Debug Mode
                                 * Backend logs: Watch Flask terminal for detailed API call logs

                                 * Extension logs: Right-click popup → Inspect → Console

                                 * Content script logs: F12 → Console on any webpage

Testing Websites
✅ Great for testing: Wikipedia, GitHub, news sites, e-commerce
❌ Won't work on: chrome:// pages, Chrome Web Store
🌍 Impact
AccessiBridge addresses a critical need:
                                    * 1.3 billion people worldwide live with disabilities

                                    * 98% of websites fail basic accessibility standards

                                    * Our tool bridges the gap between developers and inclusive design

Real Results
                                       * Transform websites from 0% to 100% accessibility in minutes

                                       * Generate meaningful alt text for images using cutting-edge AI

                                       * Provide actionable guidance that developers actually want to follow

🤝 Contributing
We welcome contributions! Here's how you can help:
                                          1. Fork the repository

                                          2. Create a feature branch (git checkout -b feature/amazing-feature)

                                          3. Commit your changes (git commit -m 'Add amazing feature')

                                          4. Push to the branch (git push origin feature/amazing-feature)

                                          5. Open a Pull Request

Areas We'd Love Help With
                                             * Additional accessibility checks (keyboard navigation, ARIA labels)

                                             * Multi-language support for AI-generated content

                                             * Additional AI model integrations

                                             * Mobile browser extension support

                                             * UI/UX improvements and animations



🏆 Hackathon
AccessiBridge was created for OneHacks V  with the theme of "Building Bridges." We're proud to build bridges between:
                                                * Developers and users with disabilities

                                                * Technical requirements and human needs

                                                * Today's inaccessible web and tomorrow's inclusive internet

🙏 Acknowledgments
                                                   * OpenRouter for providing AI model access

                                                   * WCAG Working Group for accessibility standards

                                                   * Chrome Extensions Team for excellent documentation

                                                   * The accessibility community for inspiration and guidance

________________


Made with ❤️ for making the web accessible to everyone
AccessiBridge - Building bridges to digital inclusion, one website at a time.
