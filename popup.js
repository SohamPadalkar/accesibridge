console.log('AccessiBridge popup loaded');

// Update the SVG donut chart
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

// Update UI with scan results
function updateUI(altTextIssues, contrastIssues, score = 0) {
  const statusElement = document.getElementById('status');
  const contrastCountElement = document.getElementById('contrast-count');
  const altTextCountElement = document.getElementById('alt-text-count');
  const fixContrastBtn = document.getElementById('fixContrastBtn');

  console.log('Updating UI with:', { altTextIssues, contrastIssues, score });

  const displayScore = typeof score === 'number' ? score : 0;

  updateDonutChart(displayScore);

  contrastCountElement.textContent = contrastIssues || 0;
  altTextCountElement.textContent = altTextIssues || 0;

  // Show/hide fix contrast button based on issues found
  if (contrastIssues > 0) {
    fixContrastBtn.style.display = 'flex';
    fixContrastBtn.classList.add('show');
  } else {
    fixContrastBtn.style.display = 'none';
    fixContrastBtn.classList.remove('show');
  }

  if (contrastIssues === 0 && altTextIssues === 0) {
    statusElement.textContent = "✅ Perfect accessibility score!";
    statusElement.style.color = "#28a745";
  } else {
    statusElement.textContent = `${altTextIssues + contrastIssues} issues detected`;
    statusElement.style.color = "#ffc107";
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

// Auto-scan when popup opens
document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup opened, running auto-scan...');
  updateDonutChart(0);
  setTimeout(async () => {
    const data = await sendMessage('GET_SCAN_DATA');
    if (data.success) {
      updateUI(data.altTextIssues, data.contrastIssues, data.score);
    }
  }, 200);
});

// Scan button
document.getElementById('scanButton').addEventListener('click', async () => {
  const button = document.getElementById('scanButton');
  const statusElement = document.getElementById('status');

  button.innerHTML = '<span class="btn-icon">🔄</span>Scanning...';
  button.disabled = true;
  statusElement.textContent = "Analyzing page accessibility...";
  statusElement.style.color = "#6c757d";

  const data = await sendMessage('GET_SCAN_DATA');

  if (data.success) {
    updateUI(data.altTextIssues, data.contrastIssues, data.score);
  } else {
    statusElement.textContent = "❌ Scan failed - Check server";
    statusElement.style.color = "#dc3545";
  }

  button.innerHTML = '<span class="btn-icon">🔍</span>Scan Page';
  button.disabled = false;
});

// AI Alt Text button
document.getElementById('generateAltBtn').addEventListener('click', async () => {
  const button = document.getElementById('generateAltBtn');
  const statusElement = document.getElementById('status');

  button.innerHTML = '<span class="btn-icon">🤖</span>Generating...';
  button.disabled = true;
  statusElement.textContent = "AI is generating alt text...";
  statusElement.style.color = "#6c757d";

  const result = await sendMessage('GENERATE_ALT_TEXT');

  if (result.success && result.count > 0) {
    statusElement.textContent = `✅ AI added alt text to ${result.count} images!`;
    statusElement.style.color = "#28a745";
    // Auto re-scan to update counters
    setTimeout(async () => {
      const data = await sendMessage('GET_SCAN_DATA');
      if (data.success) updateUI(data.altTextIssues, data.contrastIssues, data.score);
    }, 1500);
  } else if (result.success && result.count === 0) {
    statusElement.textContent = "ℹ️ All images already have alt text";
    statusElement.style.color = "#17a2b8";
  } else {
    statusElement.textContent = `❌ AI generation failed: ${result.error || 'Unknown error'}`;
    statusElement.style.color = "#dc3545";
  }

  button.innerHTML = '<span class="btn-icon">🤖</span>Generate AI Alt Text';
  button.disabled = false;
});

// Fix Contrast button
document.getElementById('fixContrastBtn').addEventListener('click', async () => {
  const button = document.getElementById('fixContrastBtn');
  const statusElement = document.getElementById('status');

  button.innerHTML = '<span class="btn-icon">🎨</span>Fixing...';
  button.disabled = true;
  statusElement.textContent = "Fixing contrast issues...";
  statusElement.style.color = "#6c757d";

  const result = await sendMessage('FIX_CONTRAST');

  if (result.success && result.count > 0) {
    statusElement.textContent = `✅ Fixed ${result.count} contrast issues!`;
    statusElement.style.color = "#28a745";

    // Wait longer for DOM changes to settle, then re-scan
    setTimeout(async () => {
      const data = await sendMessage('GET_SCAN_DATA');
      if (data.success) updateUI(data.altTextIssues, data.contrastIssues, data.score);
    }, 2000);
  } else if (result.success && result.count === 0) {
    statusElement.textContent = "ℹ️ No contrast issues to fix";
    statusElement.style.color = "#17a2b8";
  } else {
    statusElement.textContent = `❌ Fix failed: ${result.error || 'Unknown error'}`;
    statusElement.style.color = "#dc3545";
  }

  button.innerHTML = '<span class="btn-icon">🎨</span>Fix Contrast Issues';
  button.disabled = false;
});

// AI Report button
document.getElementById('aiReportBtn').addEventListener('click', async () => {
  const button = document.getElementById('aiReportBtn');
  const statusElement = document.getElementById('status');

  button.innerHTML = '<span class="btn-icon">📄</span>Generating...';
  button.disabled = true;
  statusElement.textContent = "AI is generating comprehensive report...";
  statusElement.style.color = "#6c757d";

  const result = await sendMessage('GENERATE_AI_REPORT');

  button.innerHTML = '<span class="btn-icon">📄</span>Generate AI Report';
  button.disabled = false;

  if (result.success) {
    // Show modal with report
    const modal = document.getElementById('reportModal');
    const content = document.getElementById('reportContent');
    const warning = result.warning ? `\n\n⚠️ Note: ${result.warning}` : '';
    content.textContent = (result.reportMarkdown || 'No report generated.') + warning;
    modal.style.display = 'flex';

    statusElement.textContent = "📄 Report generated successfully!";
    statusElement.style.color = "#28a745";
  } else {
    statusElement.textContent = `❌ Report failed: ${result.error || 'Unknown error'}`;
    statusElement.style.color = "#dc3545";
  }
});

// Modal controls
document.getElementById('closeReport').addEventListener('click', () => {
  document.getElementById('reportModal').style.display = 'none';
});

document.getElementById('copyReport').addEventListener('click', async () => {
  const txt = document.getElementById('reportContent').textContent || '';
  try {
    await navigator.clipboard.writeText(txt);
    const btn = document.getElementById('copyReport');
    const originalText = btn.innerHTML;
    btn.innerHTML = '✅ Copied!';
    setTimeout(() => {
      btn.innerHTML = originalText;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy text: ', err);
  }
});

document.getElementById('downloadReport').addEventListener('click', () => {
  const txt = document.getElementById('reportContent').textContent || '';
  const blob = new Blob([txt], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `accessibility-report-${new Date().toISOString().split('T')[0]}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
});

// Close modal when clicking outside
document.getElementById('reportModal').addEventListener('click', (e) => {
  if (e.target.id === 'reportModal') {
    document.getElementById('reportModal').style.display = 'none';
  }
});
