import { createSwapParticles } from "./swap-particles.js";
import { playSound, startSwarm } from "./site-audio.js";

const timingScale = 0.55;

const colors = {
  bumbar: "#ffd15b",
  avispa: "#7fc8ff",
  hornet: "#a6d989",
  conong: "#c9a0ff",
};
function el(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}
function pose(point, scale = 1, rotation = 0) {
  return `translate(${point.x}px, ${point.y}px) scale(${scale}) rotate(${rotation}deg)`;
}
function curve(from, bend, to, steps = 24) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps,
      a = 1 - t;
    return {
      x: a * a * from.x + 2 * a * t * bend.x + t * t * to.x,
      y: a * a * from.y + 2 * a * t * bend.y + t * t * to.y,
    };
  });
}

// One self-contained scene. cancel() releases every animation, timer and sound.
export function createSwapSequence(stage, { players, teams, swapTeams }) {
  const compact = stage.classList.contains("sw-compact");
  const width = stage.clientWidth,
    height = stage.clientHeight;
  const size = compact ? 44 : 64;
  const slotSize = compact ? Math.min(40, Math.floor((width - 84) / 6)) : 50;
  const center = { x: width / 2, y: compact ? 240 : 265 };
  const centerPose = { x: center.x - size / 2, y: center.y - size / 2 };
  const assignments = Object.fromEntries(
    Object.entries(swapTeams).flatMap(([team, ids]) =>
      ids.map((id) => [id, team]),
    ),
  );
  let active = true,
    stopSwarm = null;
  const animations = new Set(),
    timers = new Map(),
    cards = new Map();
  stage.dataset.phase = "intro";
  const canvas = el("canvas", "sw-atmosphere");
  const title = el("div", "sw-title");
  title.append(
    el("span", "sw-eyebrow", "Saison 32"),
    el("strong", "", "LE SWAP"),
  );
  const oldLabels = el("div", "sw-old-labels");
  const core = el("div", "sw-core");
  core.dataset.state = "gather";
  core.style.left = `${center.x}px`;
  core.style.top = `${center.y}px`;
  const rings = el("div", "sw-core-rings");
  rings.append(el("span", ""), el("span", ""), el("span", ""));
  const hive = el("img", "sw-core-hive");
  hive.src = "assets/images/swap-hive.svg";
  hive.alt = "";
  core.append(
    el("div", "sw-vortex-ring"),
    el("div", "sw-vortex-ring sw-vortex-ring--outer"),
    rings,
    hive,
  );
  const destinations = el("div", "sw-destinations");
  const teamPanels = new Map(),
    slots = new Map();
  Object.entries(swapTeams).forEach(([teamId, ids]) => {
    const team = teams.find((t) => t.id === teamId);
    const panel = el("section", `sw-team team-${teamId}`);
    panel.dataset.team = teamId;
    const header = el("div", "sw-team-header");
    header.append(
      el("strong", "", team.name),
      el("span", "sw-team-count", "0 / 6"),
    );
    const grid = el("div", "sw-team-slots");
    ids.forEach((id) => {
      const slot = el("div", "sw-slot");
      slot.style.width = slot.style.height = `${slotSize}px`;
      slot.dataset.player = id;
      slots.set(id, slot);
      grid.append(slot);
    });
    panel.append(header, grid);
    teamPanels.set(teamId, panel);
    destinations.append(panel);
  });
  destinations.hidden = true;
  const finale = el("div", "sw-final-glow");
  const progress = el("div", "sw-progress");
  progress.append(el("span", ""));
  stage.append(canvas, title, oldLabels, core, destinations, finale, progress);
  const particles = createSwapParticles(canvas, { width, height, center });
  teams.forEach((team, column) => {
    const label = el("div", `sw-old-label team-${team.id}`, team.name);
    label.style.left = `${(column * width) / 4}px`;
    label.style.width = `${width / 4}px`;
    label.style.top = compact ? "88px" : "105px";
    oldLabels.append(label);
    players
      .filter((p) => p.team === team.id)
      .forEach((player, row) => {
        const card = el("div", `sw-portrait team-${team.id}`);
        card.dataset.player = player.id;
        card.style.width = card.style.height = `${size}px`;
        const photo = el("img", "");
        photo.src = player.image;
        photo.alt = "";
        photo.draggable = false;
        const name = el("span", "sw-portrait-name", player.name);
        card.append(photo, name);
        const origin = {
          x: ((column + 0.5) * width) / 4 - size / 2,
          y: (compact ? 118 : 144) + row * (compact ? 58 : 83),
        };
        card.style.transform = pose(origin);
        card.style.opacity = "0";
        stage.append(card);
        cards.set(player.id, { card, photo, player, origin });
      });
  });
  function wait(ms, scale = timingScale) {
    if (!active) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        resolve();
      }, ms * scale);
      timers.set(timer, resolve);
    });
  }
  async function animate(
    node,
    frames,
    duration,
    delay = 0,
    easing = "cubic-bezier(.22,.7,.2,1)",
  ) {
    if (!active) return;
    const animation = node.animate(frames, {
      duration: duration * timingScale,
      delay: delay * timingScale,
      easing,
      fill: "both",
    });
    animations.add(animation);
    try {
      await animation.finished;
      if (active) {
        // Explicit final styles avoid retained animation effects fighting later phases.
        const last = frames[frames.length - 1];
        for (const [key, value] of Object.entries(last))
          if (!["offset", "easing", "composite"].includes(key))
            node.style[key] = value;
      }
    } catch {
      /* Scene cancelled. */
    }
    animation.cancel();
    animations.delete(animation);
  }
  function cardPoint(id) {
    const scene = stage.getBoundingClientRect(),
      box = slots.get(id).getBoundingClientRect();
    const scale = scene.width / stage.offsetWidth;
    // Cards scale around their centre, so their unscaled origin is offset.
    return {
      x: (box.left - scene.left) / scale - stage.clientLeft - (size - slotSize) / 2,
      y: (box.top - scene.top) / scale - stage.clientTop - (size - slotSize) / 2,
    };
  }
  const living = [...cards].filter(([id]) => assignments[id]);
  const orbit = (i, angle = 0) => {
    const phase = (i * Math.PI * 2) / living.length + angle;
    const radius = compact ? (i % 2 ? 114 : 83) : i % 2 ? 195 : 147;
    return {
      x: centerPose.x + Math.cos(phase) * radius,
      y: centerPose.y + Math.sin(phase) * (compact ? 65 : 85),
      scale: 0.54 + (Math.sin(phase) + 1) * 0.12,
      rotation: Math.cos(phase) * 14,
    };
  };
  const spins = new Map();
  function beginOrbit(id, index) {
    const { card } = cards.get(id);
    const frames = Array.from({ length: 65 }, (_, frame) => {
      const point = orbit(index, (frame / 64) * Math.PI * 2);
      return { transform: pose(point, point.scale, point.rotation) };
    });
    const animation = card.animate(frames, {
      duration: 3100,
      iterations: Infinity,
      easing: "linear",
    });
    animations.add(animation);
    spins.set(id, animation);
  }
  async function run() {
    await Promise.race([
      Promise.all(
        [...cards.values()].map(({ photo }) => photo.decode().catch(() => {})),
      ),
      wait(1800, 1),
    ]);
    if (!active) return;
    playSound("swapStart");
    particles.setMode("intro");
    await Promise.all(
      [...cards.values()].map(({ card, origin }, i) =>
        animate(
          card,
          [
            {
              transform: `${pose({ x: origin.x, y: origin.y + 30 }, 0.72)} perspective(500px) rotateY(65deg)`,
              opacity: "0",
            },
            { transform: pose(origin), opacity: "1" },
          ],
          520,
          i * 26,
        ),
      ),
    );
    await wait(450);
    if (!active) return;
    stage.dataset.phase = "gather";
    particles.setMode("gather");
    progress.style.setProperty("--progress", "12%");
    playSound("drop");
    void animate(oldLabels, [{ opacity: "1" }, { opacity: "0" }], 350);
    const gathering = living.map(async ([id, { card, origin }], i) => {
      const target = orbit(i);
      const points = curve(
        origin,
        {
          x: width / 2 + (origin.x - width / 2) * 1.3,
          y: Math.min(origin.y, center.y) - 55,
        },
        target,
      );
      await animate(
        card,
        points.map((point, step) => ({
          transform: pose(
            point,
            1 + ((target.scale - 1) * step) / 24,
            (target.rotation * step) / 24,
          ),
          opacity: "1",
        })),
        1150,
        i * 24,
      );
      if (active) beginOrbit(id, i);
    });
    const falling = [...cards]
      .filter(([id]) => !assignments[id])
      .map(async ([, { card, origin }], i) => {
        card.classList.add("is-eliminated");
        await animate(
          card,
          [
            { transform: pose(origin), opacity: "1" },
            {
              transform: pose(
                { x: origin.x + 18, y: origin.y - 18 },
                1.05,
                -12,
              ),
              opacity: ".8",
              offset: 0.2,
            },
            {
              transform: pose({ x: origin.x + 50, y: height + 140 }, 0.5, 85),
              opacity: "0",
            },
          ],
          1250,
          i * 150,
        );
        if (active) card.remove();
      });
    await Promise.all([...gathering, ...falling]);
    if (!active) return;
    stage.dataset.phase = "vortex";
    core.dataset.state = "vortex";
    particles.setMode("vortex");
    stopSwarm = startSwarm();
    await wait(1800);
    if (!active) return;
    destinations.hidden = false;
    stage.dataset.phase = "reveal";
    core.dataset.state = "reveal";
    particles.setMode("reveal");
    await animate(
      destinations,
      [
        { opacity: "0", transform: "translateY(28px)" },
        { opacity: "1", transform: "translateY(0)" },
      ],
      450,
    );
    const remaining = Object.entries(swapTeams).flatMap(([team, ids]) =>
      ids.map((id) => ({ team, id })),
    );
    const counts = Object.fromEntries(
      Object.keys(swapTeams).map((team) => [team, 0]),
    );
    let previous = null;
    while (remaining.length && active) {
      const choices = remaining.filter((p) => p.team !== previous);
      const pool = choices.length ? choices : remaining;
      const next = pool[Math.floor(Math.random() * pool.length)];
      remaining.splice(remaining.indexOf(next), 1);
      previous = next.team;
      const { card } = cards.get(next.id),
        panel = teamPanels.get(next.team);
      const departure = getComputedStyle(card).transform;
      card.style.transform = departure;
      const spin = spins.get(next.id);
      spin.cancel();
      animations.delete(spin);
      spins.delete(next.id);
      card.style.zIndex = "10";
      card.className = `sw-portrait team-${next.team} is-featured`;
      core.classList.add("is-revealing");
      panel.classList.add("is-receiving");
      await animate(
        card,
        [
          { transform: departure },
          { transform: pose(centerPose, compact ? 1.7 : 1.9) },
        ],
        320,
      );
      if (!active) return;
      playSound("reveal", {
        pitch: 1 + Object.keys(swapTeams).indexOf(next.team) * 0.1,
      });
      particles.burst(center.x, center.y, colors[next.team], 18);
      await wait(130);
      if (!active) return;
      card.classList.remove("is-featured");
      const destination = cardPoint(next.id);
      const points = curve(
        centerPose,
        {
          x: destination.x + (destination.x - centerPose.x) * 0.28,
          y: centerPose.y + 40,
        },
        destination,
      );
      particles.trail(
        points.map((p) => ({ x: p.x + size / 2, y: p.y + size / 2 })),
        colors[next.team],
      );
      await animate(
        card,
        points.map((point, i) => ({
          transform: pose(
            point,
            (compact ? 1.7 : 1.9) +
              ((slotSize / size - (compact ? 1.7 : 1.9)) * i) / 24,
          ),
        })),
        370,
      );
      if (!active) return;
      card.style.zIndex = "3";
      card.classList.add("is-arrived");
      slots.get(next.id).classList.add("is-filled");
      particles.burst(
        destination.x + size / 2,
        destination.y + size / 2,
        colors[next.team],
        10,
      );
      panel.querySelector(".sw-team-count").textContent =
        `${++counts[next.team]} / 6`;
      panel.classList.remove("is-receiving");
      core.classList.remove("is-revealing");
      progress.style.setProperty(
        "--progress",
        `${25 + ((18 - remaining.length) / 18) * 75}%`,
      );
    }
    if (!active) return;
    stopSwarm?.();
    stopSwarm = null;
    stage.dataset.phase = "finale";
    core.dataset.state = "complete";
    particles.setMode("finale");
    playSound("swapEnd");
    particles.burst(center.x, center.y, "#ffcf65", 55);
    await animate(
      finale,
      [{ opacity: "0" }, { opacity: ".65", offset: 0.3 }, { opacity: "0" }],
      1000,
    );
    await wait(550);
  }
  function cancel() {
    if (!active) return;
    active = false;
    stopSwarm?.();
    stopSwarm = null;
    for (const animation of animations) animation.cancel();
    animations.clear();
    for (const [timer, resolve] of timers) {
      clearTimeout(timer);
      resolve();
    }
    timers.clear();
    particles.destroy();
  }
  return { finished: run(), cancel };
}
