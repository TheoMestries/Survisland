import { playSound, startSwarm } from "./site-audio.js";
import { createSwapParticles } from "./swap-particles.js";

// A three-way exchange through a luminous triangle, separate from the hive draw.
export function createSecondSwapSequence(stage, { players, teams, moves }) {
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  const compact = stage.classList.contains("sw-compact");
  const size = compact ? 70 : 104;
  const center = { x: width / 2, y: 350 };
  const points = [
    { x: width / 2, y: 205 },
    { x: width * 0.78, y: 460 },
    { x: width * 0.22, y: 460 },
  ];
  const colors = { bumbar: "#ffd15b", avispa: "#7fc8ff", conong: "#c9a0ff" };
  const animations = new Set();
  let active = true;
  let stopSwarm = null;
  stage.classList.add("sw-exchange");
  stage.dataset.phase = "intro";
  function node(tag, className, text) {
    const element = document.createElement(tag);
    element.className = className;
    if (text) element.textContent = text;
    return element;
  }
  const canvas = node("canvas", "sw-atmosphere");
  const title = node("div", "sw-title");
  title.append(node("span", "sw-eyebrow", "Swap 02"), node("strong", "", "LE TRIANGLE"));
  const seal = node("div", "sx-seal", "⬡");
  seal.style.left = `${center.x}px`;
  seal.style.top = `${center.y}px`;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "sx-circuit");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const path = document.createElementNS(svg.namespaceURI, "path");
  path.setAttribute("d", `M ${points.map((point) => `${point.x} ${point.y}`).join(" L ")} Z`);
  svg.append(path);
  stage.append(canvas, svg, title, seal);
  const particles = createSwapParticles(canvas, { width, height, center });
  const gates = moves.map((move, index) => {
    const gate = node("div", `sx-gate team-${move.from}`);
    gate.style.left = `${points[index].x}px`;
    gate.style.top = `${points[index].y}px`;
    gate.append(node("div", "sx-gate-ring"));
    gate.append(node("strong", "sx-team-label", teams.find((team) => team.id === move.from).name));
    stage.append(gate);
    return gate;
  });
  const cards = moves.map((move, index) => {
    const player = players.find((player) => player.id === move.id);
    const card = node("div", `sx-card team-${move.from}`);
    card.dataset.player = move.id;
    card.style.width = `${size}px`;
    card.style.left = `${points[index].x}px`;
    card.style.top = `${points[index].y}px`;
    const image = node("img", "");
    image.src = player.image;
    image.alt = "";
    image.draggable = false;
    card.append(image, node("span", "sx-player-name", player.name));
    stage.append(card);
    return { card, image, move, index };
  });
  async function animate(element, frames, duration, delay = 0) {
    if (!active) return;
    const animation = element.animate(frames, {
      duration, delay, easing: "cubic-bezier(.4,0,.2,1)", fill: "both",
    });
    animations.add(animation);
    try {
      await animation.finished;
      if (active) {
        for (const [key, value] of Object.entries(frames.at(-1))) {
          if (!["offset", "easing"].includes(key)) element.style[key] = value;
        }
      }
    } catch { /* Cancelled when the selected episode changes. */ }
    animation.cancel();
    animations.delete(animation);
  }
  const transform = (x = 0, y = 0, scale = 1, rotation = 0) =>
    `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale}) rotate(${rotation}deg)`;
  async function run() {
    // The wait is cancellable, including while portrait images are decoding.
    await Promise.race([
      Promise.all(cards.map(({ image }) => image.decode().catch(() => {}))),
      animate(title, [{ opacity: "1" }, { opacity: "1" }], 1500),
    ]);
    if (!active) return;
    playSound("swapStart");
    await Promise.all(cards.map(({ card }, i) => animate(card, [
      { opacity: "0", transform: transform(0, 32, 0.5, -12) },
      { opacity: "1", transform: transform() },
    ], 550, i * 100)));
    if (!active) return;
    stage.dataset.phase = "charge";
    particles.setMode("gather");
    stopSwarm = startSwarm();
    await animate(seal, [
      { transform: "translate(-50%, -50%) scale(.6) rotate(0deg)", opacity: ".3" },
      { transform: "translate(-50%, -50%) scale(1.1) rotate(180deg)", opacity: "1" },
    ], 650);
    if (!active) return;
    stage.dataset.phase = "exchange";
    particles.setMode("vortex");
    playSound("drop");
    await Promise.all(cards.map(async ({ card, move, index }) => {
      const from = points[index];
      const targetIndex = moves.findIndex((other) => other.from === move.to);
      const to = points[targetIndex];
      // Three curved lanes, each with its own colour and slightly staggered departure.
      const frames = Array.from({ length: 61 }, (_, step) => {
        const t = step / 60;
        const a = 1 - t;
        const bend = { x: center.x + (from.x - to.x) * .3, y: center.y - 120 };
        const x = a * a * from.x + 2 * a * t * bend.x + t * t * to.x;
        const y = a * a * from.y + 2 * a * t * bend.y + t * t * to.y;
        return { transform: transform(x - from.x, y - from.y, 1 + Math.sin(t * Math.PI) * .28, Math.sin(t * Math.PI * 2) * 12) };
      });
      particles.trail(frames.map((_, step) => {
        const t = step / 60, a = 1 - t;
        const bend = { x: center.x + (from.x - to.x) * .3, y: center.y - 120 };
        return { x: a * a * from.x + 2 * a * t * bend.x + t * t * to.x,
          y: a * a * from.y + 2 * a * t * bend.y + t * t * to.y };
      }), colors[move.to]);
      await animate(card, frames, 2100, index * 160);
      if (!active) return;
      card.className = `sx-card team-${move.to} is-landed`;
      card.dataset.team = move.to;
      gates[targetIndex].classList.add("is-landed");
      particles.burst(to.x, to.y, colors[move.to], 35);
      playSound("reveal", { pitch: 1 + index * .1 });
    }));
    if (!active) return;
    stopSwarm?.();
    stopSwarm = null;
    stage.dataset.phase = "finale";
    particles.setMode("finale");
    playSound("swapEnd");
    await animate(seal, [
      { transform: "translate(-50%, -50%) scale(1.1) rotate(180deg)", opacity: "1" },
      { transform: "translate(-50%, -50%) scale(1.6) rotate(240deg)", opacity: ".2" },
    ], 1000);
  }
  function cancel() {
    if (!active) return;
    active = false;
    stopSwarm?.();
    for (const animation of animations) animation.cancel();
    animations.clear();
    particles.destroy();
  }
  return { finished: run(), cancel };
}
