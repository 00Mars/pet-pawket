export async function injectMission() {
    const res = await fetch('mission.html');
    const html = await res.text();
    document.getElementById('mission-container').innerHTML = html;
  }