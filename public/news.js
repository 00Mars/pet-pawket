export function injectNews() {
    console.log("[NewsModule] injectNews() called");
  
    fetch('news.html')
      .then(res => {
        console.log("[NewsModule] Fetch status:", res.status);
        if (!res.ok) throw new Error("Failed to load news.html");
        return res.text();
      })
      .then(html => {
        const target = document.getElementById('news-container');
        if (!target) {
          console.warn("[NewsModule] #news-container not found in DOM");
          return;
        }
  
        console.log("[NewsModule] Injecting news.html into #news-container");
        target.innerHTML = html;
  
        // Dynamically load the script after the HTML is injected
        const script = document.createElement('script');
        script.type = 'module';
        script.src = 'news.js';
        script.onload = () => console.log("[NewsModule] news.js loaded successfully");
        script.onerror = () => console.error("[NewsModule] Failed to load news.js");
        document.body.appendChild(script);
      })
      .catch(err => console.error("[NewsModule] Error injecting news.html:", err));
  }
  