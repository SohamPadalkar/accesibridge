// This script auto-fills missing alts on page load
async function sendMissingAltImages() {
  const imgs = Array.from(document.querySelectorAll("img"))
    .filter(img => !img.hasAttribute("alt") || img.getAttribute("alt") === "");

  if (imgs.length === 0) return;

  const urls = imgs.map(img => img.src);

  try {
    const res = await fetch("http://localhost:5000/generate-alt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_urls: urls })
    });

    const data = await res.json();
    if (data.alts) {
      data.alts.forEach(({ url, alt }) => {
        const target = imgs.find(img => img.src === url);
        if (target) {
          target.setAttribute("alt", alt);
          console.log(`Added alt="${alt}" to`, url);
        }
      });
    }
  } catch (err) {
    console.error("Error contacting Flask server", err);
  }
}

window.addEventListener("load", sendMissingAltImages);
