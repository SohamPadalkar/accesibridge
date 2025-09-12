console.log('AccessiBridge content script loaded');

let processedImages = new Set();
let fixedElements = new WeakSet();

// Utilities for color and contrast calculations
function rgbParse(str) {
  const m = str && str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m) return null;
  return { r: +m[1], g: +m[2], b: +m[3], a: m[4] !== undefined ? +m[4] : 1 };
}

function toLin(v) {
  v /= 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function luminance({ r, g, b }) {
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

function contrastRatio(fg, bg) {
  const L1 = Math.max(luminance(fg), luminance(bg));
  const L2 = Math.min(luminance(fg), luminance(bg));
  return (L1 + 0.05) / (L2 + 0.05);
}

function isLargeText(cs) {
  const size = parseFloat(cs.fontSize);
  const weight = parseInt(cs.fontWeight || '400', 10);
  return size >= 18 || (size >= 14 && weight >= 700);
}

function getEffectiveBackground(el) {
  let n = el;
  while (n && n !== document.documentElement) {
    const cs = getComputedStyle(n);
    const bg = rgbParse(cs.backgroundColor);
    if (bg && (bg.a ?? 1) > 0.01) return bg;
    n = n.parentElement;
  }
  return { r: 255, g: 255, b: 255, a: 1 };
}

// Find nearest accessible text color using WCAG standards
function nearestAccessibleTextColor(fg, bg, minRatio) {
  const tryToward = (target) => {
    let lo = 0, hi = 1, best = null;
    for (let i = 0; i < 18; i++) {
      const t = (lo + hi) / 2;
      const cand = {
        r: fg.r + (target.r - fg.r) * t,
        g: fg.g + (target.g - fg.g) * t,
        b: fg.b + (target.b - fg.b) * t
      };
      if (contrastRatio(cand, bg) >= minRatio) {
        best = cand;
        hi = t;
      } else {
        lo = t;
      }
    }
    return best;
  };

  const black = { r: 0, g: 0, b: 0 };
  const white = { r: 255, g: 255, b: 255 };
  const towardBlack = tryToward(black);
  const towardWhite = tryToward(white);

  const dist = (a, b) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);

  if (towardBlack && towardWhite) {
    return dist(towardBlack, fg) <= dist(towardWhite, fg) ? towardBlack : towardWhite;
  } else if (towardBlack) {
    return towardBlack;
  } else if (towardWhite) {
    return towardWhite;
  }
  return null;
}

function rgbToStr({ r, g, b }) {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

// Main scan function
async function scanOnce() {
  console.log('🔍 Starting accessibility scan...');

  // Clear transient marks (keep fixedElements)
  document.querySelectorAll('[data-missing-alt]').forEach(el => {
    if (!processedImages.has(el.src)) {
      el.style.outline = '';
      el.removeAttribute('data-missing-alt');
    }
  });

  document.querySelectorAll('[data-contrast-issue]').forEach(el => {
    if (!fixedElements.has(el)) {
      el.style.outline = '';
      el.removeAttribute('data-contrast-issue');
    }
  });

  // Images: only meaningful ones
  const missImgs = Array.from(document.querySelectorAll('img')).filter(img => {
    if (!img.src || img.src.startsWith('data:')) return false;
    if (processedImages.has(img.src)) return false;
    if (img.width < 80 || img.height < 80) return false;
    return !img.alt || img.alt.trim() === '';
  });

  missImgs.forEach(img => {
    img.setAttribute('data-missing-alt', 'true');
    img.style.outline = '2px solid #dc3545';
  });

  // Contrast: candidates
  let contrastIssues = 0;
  const candidates = document.querySelectorAll('p, span, a, li, button, label, h1, h2, h3, h4, h5, h6');

  candidates.forEach(el => {
    if (!el.offsetParent || el.offsetWidth < 60 || el.offsetHeight < 14) return;
    if (!el.textContent || el.textContent.trim().length < 8) return;
    if (fixedElements.has(el)) return;

    const cs = getComputedStyle(el);
    const fg = rgbParse(cs.color);
    if (!fg) return;

    const bg = getEffectiveBackground(el);
    const minRatio = isLargeText(cs) ? 3.0 : 4.5;
    const ratio = contrastRatio(fg, bg);

    if (ratio < minRatio) {
      el.setAttribute('data-contrast-issue', 'true');
      el.style.outline = '1px dashed #ffc107';
      contrastIssues++;
    }
  });

  console.log(`📊 Scan results: ${missImgs.length} missing alt, ${contrastIssues} contrast issues`);

  // Score from server
  try {
    const res = await fetch('http://localhost:5000/accessibility-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        missing_alt_count: missImgs.length,
        contrast_issue_count: contrastIssues
      })
    });

    const data = await res.json();
    return {
      altTextIssues: missImgs.length,
      contrastIssues,
      score: data.score || 0,
      success: true
    };
  } catch (e) {
    console.error('Score calculation error:', e);
    return {
      altTextIssues: missImgs.length,
      contrastIssues,
      score: Math.max(0, 100 - missImgs.length * 8 - contrastIssues * 5),
      success: true
    };
  }
}

// Fix contrast issues using WCAG-compliant colors
async function fixContrast() {
  const targets = document.querySelectorAll('[data-contrast-issue="true"]');
  let fixed = 0;

  console.log(`🎨 Fixing contrast for ${targets.length} elements`);

  targets.forEach(el => {
    try {
      const cs = getComputedStyle(el);
      const fg = rgbParse(cs.color);
      if (!fg) return;

      const bg = getEffectiveBackground(el);
      const minRatio = isLargeText(cs) ? 3.0 : 4.5;
      const newColor = nearestAccessibleTextColor(fg, bg, minRatio);

      if (newColor) {
        el.style.setProperty('color', rgbToStr(newColor), 'important');
        el.style.outline = '1px solid #28a745';
        el.removeAttribute('data-contrast-issue');
        fixedElements.add(el);
        fixed++;
      }
    } catch (e) {
      console.error('Error fixing element:', e);
    }
  });

  console.log(`✅ Fixed ${fixed} contrast issues`);
  return { count: fixed, success: true };
}

// Generate alt text using AI
async function generateAlt() {
  const images = Array.from(document.querySelectorAll('img[data-missing-alt="true"]'));
  const urls = images
    .map(i => i.src)
    .filter(u => u && !u.startsWith('data:') && u.length < 500)
    .slice(0, 5);

  console.log(`🤖 Generating alt text for ${urls.length} images`);

  if (urls.length === 0) return { count: 0, success: true };

  try {
    const res = await fetch('http://localhost:5000/generate-alt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_urls: urls })
    });

    const data = await res.json();
    let added = 0;

    if (data.alts && Array.isArray(data.alts)) {
      data.alts.forEach(({ url, alt }) => {
        const img = images.find(i => i.src === url);
        if (img && alt) {
          img.setAttribute('alt', alt);
          img.style.outline = '2px solid #28a745';
          img.removeAttribute('data-missing-alt');
          processedImages.add(url);
          added++;
          console.log(`✅ Added alt text: "${alt}"`);
        }
      });
    }

    return { count: added, success: true };
  } catch (e) {
    console.error('Alt text generation error:', e);
    return { count: 0, success: false, error: e.message };
  }
}

// Collect comprehensive accessibility heuristics
async function collectAccessibilityHeuristics() {
  console.log('📊 Collecting accessibility heuristics...');

  const out = {
    meta: {
      url: location.href,
      title: document.title || '',
      lang: document.documentElement.getAttribute('lang') || '',
    },
    images: {
      total: 0,
      missingAlt: 0,
      emptyAlt: 0,
      decorativeCandidates: 0,
    },
    landmarks: {
      hasMain: !!document.querySelector('main,[role="main"]'),
      hasHeader: !!document.querySelector('header,[role="banner"]'),
      hasFooter: !!document.querySelector('footer,[role="contentinfo"]'),
      hasNav: !!document.querySelector('nav,[role="navigation"]'),
      regionCount: document.querySelectorAll('[role="region"]').length
    },
    headings: {
      h1: document.querySelectorAll('h1').length,
      h2: document.querySelectorAll('h2').length,
      h3: document.querySelectorAll('h3').length,
      outlineSuspicious: false
    },
    links: {
      total: document.querySelectorAll('a[href]').length,
      emptyText: 0,
      genericText: 0,
    },
    forms: {
      inputs: document.querySelectorAll('input,textarea,select').length,
      inputsWithoutLabel: 0
    },
    aria: {
      elementsWithRole: document.querySelectorAll('[role]').length,
      invalidAria: 0
    },
    media: {
      videos: document.querySelectorAll('video').length,
      videosWithoutCaptions: 0,
      gifs: Array.from(document.querySelectorAll('img')).filter(i => /\.gif($|\?)/i.test(i.src)).length
    },
    interaction: {
      focusableWithoutOutline: 0,
      tabIndexMinusOne: document.querySelectorAll('[tabindex="-1"]').length
    },
    motion: {
      autoPlayingVideo: 0,
      animatedGifs: 0
    }
  };

  // Images analysis
  const imgs = Array.from(document.querySelectorAll('img'));
  out.images.total = imgs.length;

  imgs.forEach(img => {
    const alt = img.getAttribute('alt');
    if (alt === null) {
      out.images.missingAlt++;
    } else if ((alt || '').trim() === '') {
      out.images.emptyAlt++;
    }

    if ((img.width < 80 || img.height < 80) || /icon|logo|decor/i.test(img.className + img.id)) {
      out.images.decorativeCandidates++;
    }
  });

  // Headings outline analysis
  const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(h => +h.tagName.slice(1));
  let jumps = 0;
  for (let i = 1; i < headings.length; i++) {
    if (headings[i] - headings[i - 1] > 1) jumps++;
  }
  out.headings.outlineSuspicious = (out.headings.h1 > 1) || (out.headings.h1 === 0 && out.headings.h2 >= 2) || jumps >= 2;

  // Links analysis
  const genericPhrases = /(click here|learn more|read more|more|details|link)/i;
  Array.from(document.querySelectorAll('a[href]')).forEach(a => {
    const text = (a.textContent || '').trim();
    if (!text) {
      out.links.emptyText++;
    } else if (genericPhrases.test(text) && text.split(/\s+/).length <= 3) {
      out.links.genericText++;
    }
  });

  // Forms analysis
  const inputEls = Array.from(document.querySelectorAll('input,textarea,select'));
  inputEls.forEach(el => {
    const id = el.getAttribute('id');
    const hasLabelFor = id && document.querySelector(`label[for="${CSS.escape(id)}"]`);
    const hasWrappedLabel = el.closest('label');
    const hasAriaLabel = el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby');

    if (!hasLabelFor && !hasWrappedLabel && !hasAriaLabel) {
      out.forms.inputsWithoutLabel++;
    }
  });

  // Media analysis
  const videos = Array.from(document.querySelectorAll('video'));
  out.media.videosWithoutCaptions = videos.filter(v => {
    const tracks = v.querySelectorAll('track[kind="captions"],track[kind="subtitles"]');
    return tracks.length === 0;
  }).length;

  // Interaction analysis
  const focusables = Array.from(document.querySelectorAll('a[href],button,input,textarea,select,[tabindex]:not([tabindex="-1"])'));
  out.interaction.focusableWithoutOutline = focusables.filter(el => {
    const cs = getComputedStyle(el);
    return (cs.outlineStyle === 'none' || cs.outlineWidth === '0px') && cs.boxShadow === 'none';
  }).length;

  // Motion analysis
  out.motion.autoPlayingVideo = videos.filter(v => v.autoplay && !v.muted).length;
  out.motion.animatedGifs = out.media.gifs;

  console.log('📊 Heuristics collected:', out);
  return out;
}

// Generate comprehensive AI report
async function buildAIReport() {
  const data = await collectAccessibilityHeuristics();

  console.log('📄 Generating AI accessibility report...');

  try {
    const res = await fetch('http://localhost:5000/ai-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ heuristics: data })
    });

    const json = await res.json();

    return {
      success: true,
      reportMarkdown: json.report_markdown || '',
      summary: json.summary || '',
      raw: data,
      warning: json.error || null
    };
  } catch (e) {
    console.error('AI report generation error:', e);
    return { success: false, error: e.message, raw: data };
  }
}

// Message handlers
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  console.log('📨 Content script received message:', req.type);

  switch (req.type) {
    case 'GET_SCAN_DATA':
      scanOnce().then(sendResponse);
      return true;

    case 'GENERATE_ALT_TEXT':
      generateAlt().then(r => {
        setTimeout(() => scanOnce(), 700);
        sendResponse(r);
      });
      return true;

    case 'FIX_CONTRAST':
      fixContrast().then(r => {
        setTimeout(() => scanOnce(), 700);
        sendResponse(r);
      });
      return true;

    case 'GENERATE_AI_REPORT':
      buildAIReport().then(sendResponse);
      return true;
  }
});

// MutationObserver: only rescan when meaningful nodes added
const mo = new MutationObserver((mutList) => {
  let trigger = false;
  for (const m of mutList) {
    if (m.addedNodes && m.addedNodes.length) {
      for (const n of m.addedNodes) {
        if (n.nodeType === 1 && (n.tagName === 'IMG' || n.querySelector?.('img,p,span,h1,h2,h3,h4,h5,h6'))) {
          trigger = true;
          break;
        }
      }
    }
    if (trigger) break;
  }
  if (trigger) {
    console.log('🔄 DOM changes detected, scheduling rescan...');
    setTimeout(() => scanOnce(), 500);
  }
});

mo.observe(document.documentElement, { childList: true, subtree: true });

// Initial scan
window.addEventListener('load', () => {
  console.log('🚀 Page loaded, starting initial accessibility scan...');
  setTimeout(() => scanOnce(), 600);
});
