document.getElementById("scanButton").addEventListener("click", async () => {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Tell content.js to run scan
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: runAccessibilityScan
  });
});

// This will execute inside the page context
async function runAccessibilityScan() {
  const imgs = Array.from(document.querySelectorAll("img"))
    .filter(img => !img.hasAttribute("alt") || img.getAttribute("alt") === "");

  const contrast = []; // TODO: Add contrast detection logic

  const res = await fetch("http://localhost:5000/accessibility-score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      images: imgs.map(img => img.src),
      contrast: contrast
    })
  });

  const data = await res.json();
  alert(`Accessibility Score: ${data.score}\nMissing alts: ${data.issues.missing_alt}\nContrast issues: ${data.issues.contrast_issues}`);
}
