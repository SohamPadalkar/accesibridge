console.log('Accessi-Bridge content script loaded');

let processedImages = new Set();
let fixedMap = new WeakMap(); // el -> { oldColor }

function rgbParse(str) {
  const m = str && str.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
  if (!m) return null;
  return { r: +m[21], g: +m, b: +m, a: m !== undefined ? +m : 1 };
}
function toLin(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
function luminance({ r, g, b }) { return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b); }
function contrastRatio(fg, bg) { const L1 = Math.max(luminance(fg), luminance(bg)); const L2 = Math.min(luminance(fg), luminance(bg)); return (L1 + 0.05) / (L2 + 0.05); }
function isLargeText(cs) { const size = parseFloat(cs.fontSize); const weight = parseInt(cs.fontWeight || '400', 10); return size >= 18 || (size >= 14 && weight >= 700); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function rgbToStr({ r, g, b }) { return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`; }

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

// Find nearest accessible text color w.r.t. given bg using linear interpolation to black or white
function nearestAccessibleTextColor(fg, bg, minRatio) {
  const tryToward = (target) => { // target: {r,g,b}
    let lo = 0, hi = 1, best = null;
    for (let i = 0; i < 18; i++) {
      const t = (lo + hi) / 2;
      const cand = { r: fg.r + (target.r - fg.r) * t, g: fg.g + (target.g - fg.g) * t, b: fg.b + (target.b - fg.b) * t };
      if (contrastRatio(cand, bg) >= minRatio) { best = cand; hi = t; } else { lo = t; }
    }
    return best;
  };
  // Try both black and white and pick whichever requires less delta
  const black = { r: 0, g: 0, b: 0 }, white = { r: 255, g: 255, b: 255 };
  const towardBlack = tryToward(black);
  const towardWhite = tryToward(white);
  const dist = (a, b) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
  if (towardBlack && towardWhite) {
    return dist(towardBlack, fg) <= dist(towardWhite, fg) ? towardBlack : towardWhite;
  } else if (towardBlack) return towardBlack;
  else if (towardWhite) return towardWhite;
  return null;
}

// SCAN: returns counts and marks elements
async function scanOnce() {
  // Clear transient marks (keep fixedMap)
  document.querySelectorAll('[data-missing-alt]').forEach(el => { if (!processedImages.has(el.src)) { el.style.outline = ''; el.removeAttribute('data-missing-alt'); } });
  document.querySelectorAll('[data-contrast-issue]').forEach(el => { if (!fixedMap.has(el)) { el.style.outline = ''; el.removeAttribute('data-contrast-issue'); } });

  // Images: only meaningful
  const missImgs = Array.from(document.querySelectorAll('img')).filter(img => {
    if (!img.src || img.src.startsWith('data:')) return false;
    if (processedImages.has(img.src)) return false;
    if (img.width < 80 || img.height < 80) return false;
    return !img.alt || img.alt.trim() === '';
  });
  missImgs.forEach(img => { img.setAttribute('data-missing-alt', 'true'); img.style.outline = '2px solid #dc3545'; });

  // Contrast: candidates
  let contrastIssues = 0;
  const candidates = document.querySelectorAll('p, span, a, li, button, label, h1, h2, h3, h4, h5, h6');
  candidates.forEach(el => {
    if (!el.offsetParent || el.offsetWidth < 60 || el.offsetHeight < 14) return;
    if (!el.textContent || el.textContent.trim().length < 8) return;

    const cs = getComputedStyle(el);
    const fg = rgbParse(cs.color); if (!fg) return;
    const bg = getEffectiveBackground(el);
    const minRatio = isLargeText(cs) ? 3.0 : 4.5;
    const ratio = contrastRatio(fg, bg); // WCAG [2][14]
    if (ratio < minRatio) {
      el.setAttribute('data-contrast-issue', 'true');
      el.style.outline = '1px dashed #ffc107';
      contrastIssues++;
    }
  });

  // Score from server (simple counts to avoid sending heavy arrays)
  try {
    const res = await fetch('http://localhost:5000/accessibility-score', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ missing_alt_count: missImgs.length, contrast_issue_count: contrastIssues })
    });
    const data = await res.json();
    return { altTextIssues: missImgs.length, contrastIssues, score: data.score || 0, success: true };
  } catch (e) {
    return { altTextIssues: missImgs.length, contrastIssues, score: Math.max(0, 100 - missImgs.length * 8 - contrastIssues * 5), success: true };
  }
}

async function fixContrast() {
  const targets = document.querySelectorAll('[data-contrast-issue="true"]');
  let fixed = 0;
  targets.forEach(el => {
    try {
      const cs = getComputedStyle(el);
      const fg = rgbParse(cs.color); if (!fg) return;
      const bg = getEffectiveBackground(el);
      const minRatio = isLargeText(cs) ? 3.0 : 4.5;
      const newColor = nearestAccessibleTextColor(fg, bg, minRatio); // pick nearby color to meet WCAG [1][17]
      if (newColor) {
        if (!fixedMap.has(el)) fixedMap.set(el, { oldColor: cs.color });
        el.style.setProperty('color', rgbToStr(newColor), 'important');
        el.style.outline = '1px solid #28a745';
        el.removeAttribute('data-contrast-issue');
        fixed++;
      }
    } catch { }
  });
  return { count: fixed, success: true };
}

// Alt text generation
async function generateAlt() {
  const images = Array.from(document.querySelectorAll('img[data-missing-alt="true"]'));
  const urls = images.map(i => i.src).filter(u => u && !u.startsWith('data:') && u.length < 500).slice(0, 5);
  if (urls.length === 0) return { count: 0, success: true };
  try {
    const res = await fetch('http://localhost:5000/generate-alt', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_urls: urls })
    });
    const data = await res.json();
    if (data.error) {
      return { count: 0, success: false, error: data.error }; // AI unavailable
    }
    let added = 0;
    (data.alts || []).forEach(({ url, alt }) => {
      const img = images.find(i => i.src === url);
      if (img && alt) {
        img.setAttribute('alt', alt);
        img.style.outline = '2px solid #28a745';
        img.removeAttribute('data-missing-alt');
        processedImages.add(url);
        added++;
      }
    });
    return { count: added, success: true };
  } catch (e) {
    return { count: 0, success: false, error: e.message };
  }
}

// Public handlers
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.type === 'GET_SCAN_DATA') { scanOnce().then(sendResponse); return true; }
  if (req.type === 'GENERATE_ALT_TEXT') { generateAlt().then(r => { setTimeout(() => scanOnce(), 700); sendResponse(r); }); return true; }
  if (req.type === 'FIX_CONTRAST') { fixContrast().then(r => { setTimeout(() => scanOnce(), 700); sendResponse(r); }); return true; }
});

// MutationObserver: only rescan when meaningful nodes added (imgs/text)
const mo = new MutationObserver((mutList) => {
  let trigger = false;
  for (const m of mutList) {
    if (m.addedNodes && m.addedNodes.length) {
      for (const n of m.addedNodes) {
        if (n.nodeType === 1 && (n.tagName === 'IMG' || n.querySelector?.('img,p,span,h1,h2,h3,h4,h5,h6'))) {
          trigger = true; break;
        }
      }
    }
    if (trigger) break;
  }
  if (trigger) { setTimeout(() => scanOnce(), 500); }
});
mo.observe(document.documentElement, { childList: true, subtree: true });

// Initial pass
window.addEventListener('load', () => setTimeout(() => scanOnce(), 600));
