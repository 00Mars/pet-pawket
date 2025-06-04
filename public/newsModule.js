export function injectNews() {
    console.log("[NewsModule] Starting news injection...");
  
    fetch('news.html')
      .then(res => {
        console.log("[NewsModule] Fetch response:", res);
        if (!res.ok) throw new Error("Failed to load news.html");
        return res.text();
      })
      .then(html => {
        const target = document.getElementById('news-container');
        if (!target) {
          console.warn("[NewsModule] #news-container not found");
          return;
        }
        console.log("[NewsModule] Injecting content into #news-container");
        target.innerHTML = html;
  
        const script = document.createElement('script');
        script.type = 'module';
        script.src = 'news.js';
        document.body.appendChild(script);
        console.log("[NewsModule] news.js appended and executed.");
      })
      .catch(err => console.error("[NewsModule] Injection failed:", err));
  }
  