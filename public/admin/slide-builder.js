// Slide builder logic + dynamic height-sync with live hero

const slides = [];
let stagedImageFile = null;

// Element references
const form             = document.getElementById("slideForm");
const preview          = document.getElementById("slidesPreview");
const dropZone         = document.getElementById("dropZone");
const imageUpload      = document.getElementById("imageUpload");
const backgroundInput  = document.getElementById("background");
const previewImage     = document.getElementById("previewImage");
const undoImageBtn     = document.getElementById("undoImageBtn");
const livePreview      = document.getElementById("livePreview");

// Initialize preview & height on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  updateLivePreview();
  syncHeroHeight();
  form.addEventListener('input', updateLivePreview);
  form.addEventListener('change', updateLivePreview);
});

// Stage image for preview
function stageImage(file) {
  if (!file || !file.type.startsWith("image/")) return;
  stagedImageFile = file;
  const objectURL = URL.createObjectURL(file);
  previewImage.src = objectURL;
  previewImage.style.display = "block";
  undoImageBtn.style.display = "inline-block";
  backgroundInput.value = objectURL;
  updateLivePreview();
}

// Undo staged image
undoImageBtn.addEventListener("click", () => {
  stagedImageFile = null;
  previewImage.src = "";
  previewImage.style.display = "none";
  undoImageBtn.style.display = "none";
  backgroundInput.value = "";
  updateLivePreview();
});

// Update slide preview content
function updateLivePreview() {
  const layout         = document.getElementById("layout").value;
  const background     = backgroundInput.value;
  const leftHeadline   = document.getElementById("leftHeadline").value;
  const leftSubtext    = document.getElementById("leftSubtext").value;
  const leftBtnText    = document.getElementById("leftBtnText").value;
  const leftBtnVisible = document.getElementById("leftBtnVisible").checked;

  const headlineAlign  = document.getElementById("leftHeadlineAlign").value;
  const subtextAlign   = document.getElementById("leftSubtextAlign").value;
  const btnAlign       = document.getElementById("leftBtnAlign").value;

  const headlineColor   = document.getElementById("headlineColor").value;
  const subtextColor    = document.getElementById("subtextColor").value;
  const buttonColor     = document.getElementById("buttonColor").value;
  const buttonTextColor = document.getElementById("buttonTextColor").value;

  const gapAfterHeadline = document.getElementById("gapAfterHeadline").value;
  const gapAfterSubtext  = document.getElementById("gapAfterSubtext").value;
  const gapAboveButton   = document.getElementById("gapAboveButton").value;

  const borderRadius = document.getElementById('buttonBorderRadius').value;
  const padding      = document.getElementById('buttonPadding').value;

  // Apply background
  livePreview.className = "hero-slide-item active";
  if (background.startsWith("#")) {
    livePreview.style.backgroundColor = background;
    livePreview.style.backgroundImage = "none";
  } else {
    livePreview.style.backgroundImage = `url('${background}')`;
    livePreview.style.backgroundColor = "transparent";
  }
  livePreview.style.borderRadius = "25px";

  // Build slide content
  const headlineHTML = leftHeadline ? 
    `<h1 style="color:${headlineColor}; text-align:${headlineAlign}; margin-bottom:${gapAfterHeadline}px;">
      ${leftHeadline}
    </h1>` : '';

  const subtextHTML = leftSubtext ? 
    `<p style="color:${subtextColor}; text-align:${subtextAlign}; margin-bottom:${gapAfterSubtext}px;">
      ${leftSubtext}
    </p>` : '';

  const buttonHTML = leftBtnVisible ? 
    `<button class="hero-button" style="background:${buttonColor}; color:${buttonTextColor}; 
       border-radius:${borderRadius}px; padding:${padding}; margin-top:${gapAboveButton}px; text-align:${btnAlign};">
       ${leftBtnText}
     </button>` : '';

  const combinedHTML = `
    <div class="hero-layout">
      <div class="hero-left">
        <div class="hero-left-inner">
          ${headlineHTML}
          ${subtextHTML}
          ${buttonHTML}
        </div>
      </div>
    </div>
  `;

  livePreview.innerHTML = combinedHTML;
  syncHeroHeight();
}

// Sync mock preview height to live hero slider height
function syncHeroHeight() {
  const real = document.querySelector('.hero-backdrop .hero-slider-container');
  const mock = document.querySelector('#heroMockContainer .hero-slider-container');
  if (!real || !mock) return;
  mock.style.height = `${real.offsetHeight}px`;
}

// Run height-sync on window events
window.addEventListener('load', syncHeroHeight);
window.addEventListener('resize', syncHeroHeight);

// Dropzone and file input handlers
dropZone.addEventListener("click", () => imageUpload.click());
dropZone.addEventListener("dragover", e => { e.preventDefault(); dropZone.style.borderColor = "#000"; });
dropZone.addEventListener("dragleave", () => { dropZone.style.borderColor = "#999"; });
dropZone.addEventListener("drop", e => {
  e.preventDefault();
  dropZone.style.borderColor = "#999";
  stageImage(e.dataTransfer.files[0]);
});
imageUpload.addEventListener("change", () => stageImage(imageUpload.files[0]));

// Add slide on form submit
form.addEventListener("submit", async e => {
  e.preventDefault();
  let imagePath = backgroundInput.value;

  if (stagedImageFile) {
    const formData = new FormData();
    formData.append("file", stagedImageFile);
    try {
      const res = await fetch("/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || !data.path) throw new Error("Upload failed");
      imagePath = data.path;
      backgroundInput.value = imagePath;
      updateLivePreview();
      alert("Image uploaded and slide saved.");
    } catch (err) {
      alert("Failed to upload image.");
      console.error(err);
      return;
    }
  }

  const slide = {
    label:   document.getElementById("slideLabel").value,
    layout:  document.getElementById("layout").value,
    intent:  document.getElementById("intent").value,
    background: imagePath,
    left: {
      headline: document.getElementById("leftHeadline").value,
      subtext:  document.getElementById("leftSubtext").value,
      button: {
        text:    document.getElementById("leftBtnText").value,
        link:    document.getElementById("leftBtnLink").value,
        visible: document.getElementById("leftBtnVisible").checked
      }
    },
    right: {
      headline: document.getElementById("rightHeadline").value,
      subtext:  document.getElementById("rightSubtext").value,
      button: {
        text:    document.getElementById("rightBtnText").value,
        link:    document.getElementById("rightBtnLink").value,
        visible: document.getElementById("rightBtnVisible").checked
      }
    },
    hasHeaderPlaceholder: document.getElementById("hasHeaderPlaceholder").checked
  };

  slides.push(slide);
  preview.textContent = JSON.stringify(slides, null, 2);
  stagedImageFile = null;
  previewImage.src = "";
  previewImage.style.display = "none";
  undoImageBtn.style.display = "none";
  form.reset();
  updateLivePreview();
});

// Download slides JSON
function downloadSlidesJSON() {
  const blob = new Blob([JSON.stringify(slides, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "slidesData.json";
  link.click();
}

window.getSlidesJSON = () => JSON.stringify(slides, null, 2);
