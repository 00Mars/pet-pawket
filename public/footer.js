export function injectFooter() {
    fetch('footer.html')
      .then(res => res.text())
      .then(data => {
        document.getElementById('footer-container').innerHTML = data;
        console.log("[Fetch] footer.html fetched and injected.");
      });
  }
  