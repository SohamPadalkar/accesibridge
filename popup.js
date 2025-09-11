console.log('Popup script loaded');

let scoreChart;

// Update the donut chart
function updateDonutChart(score = 0) {
  const scoreText = document.getElementById('scoreText');
  const donutSegment = document.getElementById('donut-segment');

  scoreText.textContent = `${Math.round(score)}%`;

  const circumference = 100;
  const progress = (score / 100) * circumference;

  donutSegment.style.strokeDasharray = `${progress} ${circumference}`;

  if (score > 80) {
    donutSegment.style.stroke = '#28a745';
    scoreText.style.color = '#28a745';
  } else if (score > 60) {
    donutSegment.style.stroke = '#ffc107';
    scoreText.style.color = '#ffc107';
  } else {
    donutSegment.style.stroke = '#dc3545';
    scoreText.style.color = '#dc3545';
  }
}

// Update UI
function updateUI(data) {
  const { altTextIssues, contrastIssues, score } = data;

  updateDonutChart(score);

  document.getElementById('alt-text-count').textContent = altTextIssues;
  document.getElementById('contrast-count').textContent = contrastIssues;

  const statusElement = document.getElementById('status');
  const fixBtn = document.getElementById('fixContrastBtn');

  if (altTextIssues === 0 && contrastIssues === 0) {
    statusElement.textContent = "✅ Perfect accessibility!";
    statusElement.style.color = "#28a745";
    fixBtn.style.display = 'none';
  } else {
    statusElement.textContent = `${altTextIssues + contrastIssues} issues found`;
    statusElement.style.color = "#ffc107";
    fixBtn.style.display = contrastIssues > 0 ? 'flex' : 'none';
  }
}

// Send message to content script
async function sendMessage(type) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tab.id, { type }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Message error:', chrome.runtime.lastError);
        resolve({ success: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(response || { success: false });
      }
    });
  });
}

// Event listeners
document.addEventListener('DOMContentLoaded', async () => {
  updateDonutChart(0);

  // Auto-scan on popup open
  const data = await sendMessage('GET_SCAN_DATA');
  if (data.success) {
    updateUI(data);
  }

  // Scan button
  document.getElementById('scanButton').addEventListener('click', async () => {
    const btn = document.getElementById('scanButton');
    btn.disabled = true;
    btn.textContent = 'Scanning...';

    const data = await sendMessage('GET_SCAN_DATA');
    if (data.success) {
      updateUI(data);
    }

    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">🔍</span>Scan Page';
  });

  // Generate Alt Text button
  document.getElementById('generateAltBtn').addEventListener('click', async () => {
    const btn = document.getElementById('generateAltBtn');
    btn.disabled = true;
    btn.textContent = 'Generating...';

    const result = await sendMessage('GENERATE_ALT_TEXT');

    if (result.success && result.count > 0) {
      document.getElementById('status').textContent = `✅ Added alt text to ${result.count} images!`;
      // Refresh data after a delay
      setTimeout(async () => {
        const data = await sendMessage('GET_SCAN_DATA');
        if (data.success) updateUI(data);
      }, 1500);
    }

    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">🤖</span>Generate AI Alt Text';
  });

  // Fix Contrast button
  document.getElementById('fixContrastBtn').addEventListener('click', async () => {
    const btn = document.getElementById('fixContrastBtn');
    btn.disabled = true;
    btn.textContent = 'Fixing...';

    const result = await sendMessage('FIX_CONTRAST');

    if (result.success && result.count > 0) {
      document.getElementById('status').textContent = `✅ Fixed ${result.count} contrast issues!`;
      // Refresh data after a delay
      setTimeout(async () => {
        const data = await sendMessage('GET_SCAN_DATA');
        if (data.success) updateUI(data);
      }, 1500);
    }

    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">🎨</span>Fix Contrast Issues';
  });
});
