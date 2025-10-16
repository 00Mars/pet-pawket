<<<<<<< HEAD
// public/footer.js
console.debug('[footer] module loaded');

async function fetchWithFallback(paths) {
  for (const p of paths) {
    try {
      const res = await fetch(p, { credentials: 'same-origin' });
      if (res.ok) return await res.text();
      console.warn(`[footer] fetch ${p} -> ${res.status}`);
    } catch (e) {
      console.warn(`[footer] fetch ${p} failed:`, e);
    }
  }
  throw new Error(`[footer] template not found at any of: ${paths.join(', ')}`);
}

export async function injectFooter() {
  const container = document.getElementById('footer-container');
  if (!container) {
    console.warn('[footer] #footer-container not found; skipping injection');
    return;
  }

  try {
    const html = await fetchWithFallback(['/footer.html', '/partials/footer.html', 'footer.html']);
    container.innerHTML = html;
    console.log('[footer] injected');
  } catch (e) {
    console.error('[footer] injection failed:', e);
  }
}
=======
export function injectFooter() {
    fetch('footer.html')
      .then(res => res.text())
      .then(data => {
        document.getElementById('footer-container').innerHTML = data;
        console.log("[Fetch] footer.html fetched and injected.");
      });
  }
  
>>>>>>> c2470ba (Initial real commit)
