// floatingShapes.js (restored multi-shape spawn with spaced-out reentries)

const SHAPE_SVG_PATHS = [
  'assets/images/dogpaw.svg',
  'assets/images/dogbone.svg',
  'assets/images/starshape.svg',
  'assets/images/heartshape.svg',
  'assets/images/clovershape.svg'
];

const SHAPE_SIZE = 48;
const DRIFT_SPEED = 0.3;
const ROTATION_SPEED = 0.2;
const FADE_DURATION = 1000;
const MIN_RESPAWN_DELAY = 3000;
const MAX_RESPAWN_DELAY = 8000;
const MIN_SPAWN_DISTANCE = 150;

let lastSpawnPosition = null;

function random(min, max) {
  return Math.random() * (max - min) + min;
}

function getRandomPositionFarFromLast() {
  let tries = 0;
  let x, y;
  do {
    x = random(0, window.innerWidth - SHAPE_SIZE);
    y = random(0, window.innerHeight - SHAPE_SIZE);
    tries++;
  } while (
    lastSpawnPosition &&
    Math.hypot(lastSpawnPosition[0] - x, lastSpawnPosition[1] - y) < MIN_SPAWN_DISTANCE &&
    tries < 10
  );
  lastSpawnPosition = [x, y];
  return [x, y];
}

function getRandomDirection() {
  const angle = random(0, 2 * Math.PI);
  return [Math.cos(angle) * DRIFT_SPEED, Math.sin(angle) * DRIFT_SPEED];
}

function createShapeElement(src, id) {
  const shape = document.createElement('img');
  shape.src = src;
  shape.className = 'floating-shape';
  const [dx, dy] = getRandomDirection();
  shape.dataset.dx = dx;
  shape.dataset.dy = dy;
  shape.dataset.rotation = 0;
  shape.dataset.spin = Math.random() < 0.5 ? 1 : -1;
  shape.dataset.id = id;
  const [x, y] = getRandomPositionFarFromLast();
  shape.style.left = `${x}px`;
  shape.style.top = `${y}px`;
  shape.style.transition = `opacity ${FADE_DURATION}ms ease-in-out`;
  shape.style.opacity = '0';
  return shape;
}

function updateShapePosition(shape) {
  let dx = parseFloat(shape.dataset.dx);
  let dy = parseFloat(shape.dataset.dy);
  let x = parseFloat(shape.style.left);
  let y = parseFloat(shape.style.top);

  if (isNaN(x) || isNaN(y)) return;

  x += dx;
  y += dy;

  if (x <= 0 || x >= window.innerWidth - SHAPE_SIZE) {
    dx = -dx;
    shape.dataset.dx = dx;
    shape.dataset.spin = -parseFloat(shape.dataset.spin);
  }

  if (y <= 0 || y >= window.innerHeight - SHAPE_SIZE) {
    dy = -dy;
    shape.dataset.dy = dy;
    shape.dataset.spin = -parseFloat(shape.dataset.spin);
  }

  shape.style.left = `${Math.max(0, Math.min(x, window.innerWidth - SHAPE_SIZE))}px`;
  shape.style.top = `${Math.max(0, Math.min(y, window.innerHeight - SHAPE_SIZE))}px`;

  let r = parseFloat(shape.dataset.rotation) + ROTATION_SPEED * parseFloat(shape.dataset.spin);
  shape.dataset.rotation = r;
  shape.style.transform = `rotate(${r}deg)`;
}

function animateShapes() {
  const shapes = document.querySelectorAll('.floating-shape');
  requestAnimationFrame(function step() {
    shapes.forEach(updateShapePosition);
    requestAnimationFrame(step);
  });
}

function fadeCycle(shape) {
  const startCycle = () => {
    shape.style.opacity = '1';
    setTimeout(() => {
      shape.style.opacity = '0';
      setTimeout(() => {
        const [x, y] = getRandomPositionFarFromLast();
        const [dx, dy] = getRandomDirection();
        shape.style.left = `${x}px`;
        shape.style.top = `${y}px`;
        shape.dataset.dx = dx;
        shape.dataset.dy = dy;
        shape.dataset.rotation = 0;
        shape.dataset.spin = Math.random() < 0.5 ? 1 : -1;

        setTimeout(startCycle, random(MIN_RESPAWN_DELAY, MAX_RESPAWN_DELAY));
      }, FADE_DURATION);
    }, random(MIN_RESPAWN_DELAY, MAX_RESPAWN_DELAY));
  };

  setTimeout(startCycle, random(1000, 3000));
}

export function initializeFloatingShapes() {
  const container = document.getElementById('shapes-container');
  container.innerHTML = '';

  SHAPE_SVG_PATHS.forEach((src, i) => {
    for (let j = 0; j < 2; j++) {
      const shape = createShapeElement(src, `shape-${i}-${j}`);
      container.appendChild(shape);
      fadeCycle(shape);
    }
  });

  animateShapes();
}
