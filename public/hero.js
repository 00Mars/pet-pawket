// hero.js - module version

const slidesData = [
  {
    layout: "split-left",
    background: "/assets/images/HeroBG1.svg",
    headline: "Where Every Pet Story Begins Again",
    subtext: "From rescue to revival — shop with heart, play with purpose.",
    button: { text: "Discover the Journey", link: "#", visible: true },
    hasHeaderPlaceholder: true
  },
  {
    layout: "centered",
    background: "#FFA625",
    headline: "Top Picks of the Week",
    subtext: "",
    button: { text: "Shop Now", link: "#", visible: true },
    hasHeaderPlaceholder: false
  },
  {
    layout: "centered",
    background: "#00C6D7",
    headline: "Support Animal Rescue",
    subtext: "Every purchase helps fund the CHARM Foundation.",
    button: { text: "Learn More", link: "#", visible: true },
    hasHeaderPlaceholder: false
  },
  {
    layout: "centered",
    background: "#FF9B2A",
    headline: "Pawket Pals are Coming",
    subtext: "Our gamified pet experience is almost here!",
    button: { text: "Meet the Pals", link: "#", visible: true },
    hasHeaderPlaceholder: false
  }
];

export function injectHero() {
  const heroContainer = document.getElementById("hero-container");
  if (!heroContainer) {
    console.warn("[Hero] No #hero-container found to inject hero section.");
    return;
  }

  heroContainer.innerHTML = `
    <section class="hero-backdrop">
      <div class="hero-slider-container">
        <div class="hero-slide-track"></div>
        <div class="hero-indicators"></div>
        <button class="arrow prev">‹</button>
        <button class="arrow next">›</button>
      </div>
    </section>
  `;

  const track = document.querySelector(".hero-slide-track");
  const indicators = document.querySelector(".hero-indicators");

  slidesData.forEach((slide, i) => {
    const div = document.createElement("div");
    div.className = "hero-slide-item";
    if (i === 0) div.classList.add("active");
    div.style.backgroundImage = slide.background.startsWith("#") ? "none" : `url('${slide.background}')`;
    div.style.backgroundColor = slide.background.startsWith("#") ? slide.background : "transparent";
    div.style.borderRadius = "25px";

    let content = "";
    if (slide.layout === "split-left") {
      content = `
        <div class="hero-layout">
          <div class="hero-left">
            ${slide.hasHeaderPlaceholder ? '<div class="hero-slide-header-placeholder"></div>' : ""}
            <h1>${slide.headline}</h1>
            ${slide.subtext ? `<p>${slide.subtext}</p>` : ""}
            ${slide.button.visible ? `<button class="hero-button">${slide.button.text}</button>` : ""}
          </div>
          <div class="hero-right"></div>
        </div>
      `;
    } else {
      content = `
        <div class="hero-slide-content">
          <h1>${slide.headline}</h1>
          ${slide.subtext ? `<p>${slide.subtext}</p>` : ""}
          ${slide.button.visible ? `<button class="hero-button">${slide.button.text}</button>` : ""}
        </div>
      `;
    }

    div.innerHTML = `${content}<button class="pause-btn">❚❚</button>`;
    track.appendChild(div);

    const dot = document.createElement("div");
    dot.className = "hero-indicator" + (i === 0 ? " active" : "");
    dot.dataset.index = i;
    indicators.appendChild(dot);
  });

  initializeHeroSlider();
}

function initializeHeroSlider() {
  const heroContainer = document.querySelector(".hero-slider-container");
  if (!heroContainer) return;

  const slides = heroContainer.querySelectorAll(".hero-slide-item");
  const indicators = heroContainer.querySelectorAll(".hero-indicator");
  const nextBtn = heroContainer.querySelector(".arrow.next");
  const prevBtn = heroContainer.querySelector(".arrow.prev");
  const pauseBtns = heroContainer.querySelectorAll(".pause-btn");

    // SWIPE LOGIC
  let startX = 0;
  let endX = 0;

  heroContainer.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
  });

  heroContainer.addEventListener("touchmove", (e) => {
    endX = e.touches[0].clientX;
  });

  heroContainer.addEventListener("touchend", () => {
    const threshold = 50; // swipe distance threshold
    const deltaX = endX - startX;

    if (deltaX > threshold) {
      changeSlide(-1); // swipe right → previous
    } else if (deltaX < -threshold) {
      changeSlide(1); // swipe left → next
    }

    // Reset after gesture
    startX = 0;
    endX = 0;
  });


  if (slides.length === 0) return;

  let current = 0;
  let paused = false;
  let interval = setInterval(() => changeSlide(1), 12000);

  function showSlide(index) {
    slides.forEach((slide, i) => {
      slide.classList.remove("active");
      slide.style.left = "100%";
      indicators[i]?.classList.remove("active");
    });
    slides[index].classList.add("active");
    slides[index].style.left = "10px";
    indicators[index]?.classList.add("active");
  }

  function changeSlide(step) {
    current = (current + step + slides.length) % slides.length;
    showSlide(current);
  }

  nextBtn?.addEventListener("click", () => changeSlide(1));
  prevBtn?.addEventListener("click", () => changeSlide(-1));

  indicators.forEach(dot => {
    dot.addEventListener("click", () => {
      const index = parseInt(dot.dataset.index);
      if (!isNaN(index)) {
        current = index;
        showSlide(current);
      }
    });
  });

  pauseBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (paused) {
        interval = setInterval(() => changeSlide(1), 12000);
        btn.textContent = "❚❚";
      } else {
        clearInterval(interval);
        btn.textContent = "▶";
      }
      paused = !paused;
    });
  });

  showSlide(current);
} 

// Optional dev utility
window.getCurrentSlides = () => JSON.stringify(slidesData, null, 2);
