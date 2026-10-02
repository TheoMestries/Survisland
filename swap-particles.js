const TAU = Math.PI * 2;
const HONEY = "#ffc85b";
const MODES = new Set(["intro", "gather", "vortex", "reveal", "finale"]);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Decorative particles use CSS pixels, relative to the swap stage. */
export function createSwapParticles(canvas, options = {}) {
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) {
    return { setMode() {}, burst() {}, trail() {}, destroy() {} };
  }

  const width = Math.max(1, Number(options.width) || canvas.clientWidth || 1);
  const height = Math.max(
    1,
    Number(options.height) || canvas.clientHeight || 1,
  );
  const center = {
    x: Number.isFinite(options.center?.x) ? options.center.x : width / 2,
    y: Number.isFinite(options.center?.y) ? options.center.y : height / 2,
  };
  const compact = width < 500;
  const density = compact ? 72 : 136;
  const sparkLimit = compact ? 110 : 220;
  const ratio = clamp(window.devicePixelRatio || 1, 1, 2);
  const orbitWidth = Math.min(width * 0.19, 155);
  const orbitHeight = Math.min(height * 0.1, 65);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  const particles = Array.from({ length: density }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    angle: Math.random() * TAU,
    orbit: 0.55 + Math.random() * 1.25,
    speed: 0.32 + Math.random() * 0.62,
    size: 0.55 + Math.random() * 1.05,
    light: 0.25 + Math.random() * 0.6,
    delay: Math.random() * 550,
    seed: Math.random() * TAU,
  }));
  const sparks = [];
  const trails = [];
  const glowCache = new Map();
  let mode = "intro";
  let modeAge = 0;
  let clock = 0;
  let lastFrame = 0;
  let frame = 0;
  let destroyed = false;

  function glow(color) {
    if (glowCache.has(color)) return glowCache.get(color);
    const sprite = document.createElement("canvas");
    sprite.width = 40;
    sprite.height = 40;
    const brush = sprite.getContext("2d");
    if (!brush) return null;
    const gradient = brush.createRadialGradient(20, 20, 0, 20, 20, 20);
    gradient.addColorStop(0, "#fff8df");
    gradient.addColorStop(0.14, color);
    gradient.addColorStop(1, "transparent");
    brush.fillStyle = gradient;
    brush.fillRect(0, 0, 40, 40);
    if (glowCache.size < 12) glowCache.set(color, sprite);
    return sprite;
  }

  const honeyGlow = glow(HONEY);

  function drawDot(x, y, radius, alpha, sprite = honeyGlow) {
    if (!sprite || alpha <= 0) return;
    context.globalAlpha = clamp(alpha, 0, 1);
    const extent = radius * 5;
    context.drawImage(sprite, x - extent / 2, y - extent / 2, extent, extent);
  }

  function animateParticles(delta) {
    const seconds = delta / 1000;
    const motion = mode === "vortex" ? 2.6 : mode === "gather" ? 1.6 : 0.6;
    const settle = 1 - Math.exp(-seconds * (mode === "gather" ? 2.9 : 1.7));
    const age = modeAge / 1000;
    for (const particle of particles) {
      particle.angle += seconds * particle.speed * motion;
      let targetX;
      let targetY;
      let opacity;

      if (mode === "gather" || mode === "vortex") {
        const gathering =
          mode === "vortex"
            ? 1
            : clamp((modeAge - particle.delay) / 1400, 0, 1);
        const spread = 1 - gathering;
        const rx = orbitWidth * particle.orbit + spread * width * 0.55;
        const ry = orbitHeight * particle.orbit + spread * height * 0.46;
        targetX = center.x + Math.cos(particle.angle) * rx;
        targetY = center.y + Math.sin(particle.angle) * ry;
        opacity = particle.light * (0.65 + gathering * 0.3);
      } else if (mode === "reveal") {
        const expansion = Math.min(age * 0.16, 0.85);
        targetX =
          center.x + Math.cos(particle.angle) * width * (0.16 + expansion);
        targetY =
          center.y + Math.sin(particle.angle) * height * (0.1 + expansion);
        opacity = particle.light * 0.48;
      } else if (mode === "finale") {
        targetX =
          center.x +
          Math.cos(particle.seed) * width * 0.61 +
          Math.sin(age + particle.seed) * 12;
        targetY =
          (((height * (particle.orbit / 1.8) -
            age * (15 + particle.speed * 15)) %
            height) +
            height) %
          height;
        opacity = particle.light * 0.65;
      } else {
        targetX =
          center.x + Math.cos(particle.angle) * width * 0.5 * particle.orbit;
        targetY =
          center.y + Math.sin(particle.angle) * height * 0.4 * particle.orbit;
        opacity = particle.light * 0.37;
      }

      const previousX = particle.x;
      const previousY = particle.y;
      particle.x += (targetX - particle.x) * settle;
      particle.y += (targetY - particle.y) * settle;
      const flicker = 0.82 + Math.sin(clock / 900 + particle.seed) * 0.18;

      if (mode === "gather" || mode === "vortex") {
        context.globalAlpha = opacity * 0.26;
        context.strokeStyle = HONEY;
        context.lineWidth = particle.size * 0.6;
        context.beginPath();
        context.moveTo(previousX, previousY);
        context.lineTo(particle.x, particle.y);
        context.stroke();
      }
      drawDot(particle.x, particle.y, particle.size, opacity * flicker);
    }
  }

  function animateSparks(delta) {
    const seconds = delta / 1000;
    const drag = Math.exp(-seconds * 2.1);
    for (let index = sparks.length - 1; index >= 0; index -= 1) {
      const spark = sparks[index];
      spark.age += delta;
      if (spark.age >= spark.life) {
        sparks.splice(index, 1);
        continue;
      }
      const previousX = spark.x;
      const previousY = spark.y;
      spark.x += spark.vx * seconds;
      spark.y += spark.vy * seconds;
      spark.vx *= drag;
      spark.vy = spark.vy * drag + seconds * 32;
      const opacity = Math.pow(1 - spark.age / spark.life, 1.5);
      context.globalAlpha = opacity * 0.55;
      context.strokeStyle = spark.color;
      context.lineWidth = spark.size * 0.6;
      context.beginPath();
      context.moveTo(previousX, previousY);
      context.lineTo(spark.x, spark.y);
      context.stroke();
      drawDot(spark.x, spark.y, spark.size, opacity, spark.sprite);
    }
  }

  function animateTrails(delta) {
    for (let index = trails.length - 1; index >= 0; index -= 1) {
      const effect = trails[index];
      effect.age += delta;
      if (effect.age >= effect.life) {
        trails.splice(index, 1);
        continue;
      }
      const opacity = Math.pow(1 - effect.age / effect.life, 1.7);
      context.strokeStyle = effect.color;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.beginPath();
      effect.points.forEach((point, pointIndex) => {
        if (pointIndex === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      });
      context.globalAlpha = opacity * 0.08;
      context.lineWidth = 10;
      context.stroke();
      context.globalAlpha = opacity * 0.22;
      context.lineWidth = 3;
      context.stroke();
      context.globalAlpha = opacity * 0.58;
      context.lineWidth = 0.9;
      context.stroke();
    }
  }

  function tick(timestamp) {
    frame = 0;
    if (destroyed || document.hidden) return;
    const delta = lastFrame ? clamp(timestamp - lastFrame, 0, 40) : 16;
    lastFrame = timestamp;
    clock += delta;
    modeAge += delta;
    context.clearRect(0, 0, width, height);
    context.globalCompositeOperation = "lighter";
    animateTrails(delta);
    animateParticles(delta);
    animateSparks(delta);
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
    frame = requestAnimationFrame(tick);
  }

  function visibilityChanged() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastFrame = 0;
    if (!destroyed && !document.hidden) frame = requestAnimationFrame(tick);
  }

  function burst(x, y, color = HONEY, count = compact ? 18 : 30) {
    if (destroyed || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const total = clamp(Math.round(Number(count) || 0), 0, sparkLimit);
    const sprite = glow(color);
    for (let index = 0; index < total; index += 1) {
      const angle = (index / Math.max(1, total)) * TAU + Math.random() * 0.35;
      const speed = 35 + Math.random() * (compact ? 100 : 150);
      sparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.8,
        age: 0,
        life: 400 + Math.random() * 500,
        size: 0.7 + Math.random() * 1.7,
        color,
        sprite,
      });
    }
    if (sparks.length > sparkLimit)
      sparks.splice(0, sparks.length - sparkLimit);
  }

  function trail(points, color = HONEY) {
    if (destroyed || !Array.isArray(points)) return;
    const usablePoints = points
      .slice(-64)
      .filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y))
      .map(({ x, y }) => ({ x, y }));
    if (usablePoints.length < 2) return;
    trails.push({ points: usablePoints, color, age: 0, life: 550 });
    const limit = compact ? 9 : 18;
    if (trails.length > limit) trails.splice(0, trails.length - limit);
  }

  document.addEventListener("visibilitychange", visibilityChanged);
  visibilityChanged();

  return {
    setMode(nextMode) {
      if (destroyed || !MODES.has(nextMode) || nextMode === mode) return;
      mode = nextMode;
      modeAge = 0;
    },
    burst,
    trail,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", visibilityChanged);
      particles.length = 0;
      sparks.length = 0;
      trails.length = 0;
      glowCache.clear();
      context.clearRect(0, 0, width, height);
    },
  };
}
