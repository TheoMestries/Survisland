import { playSound, startSwarm, startMusic } from "./site-audio.js?v=69426dcba7f0d919";
import { createSwapParticles } from "./swap-particles.js?v=69426dcba7f0d919";
import { playMergeTribute } from "./merge-tribute.js?v=69426dcba7f0d919";

function node(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  if (text) element.textContent = text;
  return element;
}

const pose = (x, y, scale = 1, rotation = 0) =>
  `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${scale}) rotate(${rotation}deg)`;

// The six letters of BUMBAR become UMAR BB, then each survivor joins the cast.
export function createMergeSequence(stage, { players, teams, mergeTeams, previousAssignments }) {
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  const compact = stage.classList.contains("sw-compact");
  const size = compact ? Math.min(46, (width - 90) / 4) : 66;
  const center = { x: width / 2, y: compact ? 280 : 300 };
  const [teamId, ids] = Object.entries(mergeTeams)[0];
  const team = teams.find((team) => team.id === teamId);
  const sourceTeam = teams.find((team) => team.id === "bumbar");
  const survivors = ids.map((id) => players.find((player) => player.id === id));
  const animations = new Set();
  const timers = new Map();
  let active = true;
  let stopSwarm = null;
  stage.classList.add("sw-merge", "team-bumbar");
  stage.dataset.phase = "intro";
  const sourceColor = getComputedStyle(stage).getPropertyValue("--team-color").trim();

  const canvas = node("canvas", "sw-atmosphere");
  const title = node("div", "sw-title");
  title.append(node("strong", "", "LA RÉUNIFICATION"));
  title.hidden = true;
  const wordmark = node("div", "sm-wordmark");
  wordmark.setAttribute("aria-label", sourceTeam.name);
  const spotlight = node("div", "sm-spotlight");
  spotlight.style.left = `${center.x}px`;
  spotlight.style.top = `${compact ? 295 : 305}px`;
  const deck = node("div", "sm-team-deck");
  const beeLayer = node("div", "sm-bees");
  stage.append(canvas, title, deck, spotlight, wordmark, beeLayer);
  const particles = createSwapParticles(canvas, { width, height, center });

  const letterStep = compact ? (width - 58) / 6 : 90;
  const dockScale = compact ? .82 : .65;
  // Match actual letter nodes so both Bs move to the end without replacing text.
  const targetLetters = [...team.name.toUpperCase()];
  const used = new Set();
  const letters = [...sourceTeam.name.toUpperCase()].map((letter, index) => {
    const targetIndex = targetLetters.findIndex((value, i) => value === letter && !used.has(i));
    used.add(targetIndex);
    const from = { x: center.x + (index - 2.5) * letterStep, y: center.y };
    const targetOffset = (targetIndex - 2.5) * letterStep + (targetIndex >= 4 ? .22 : -.11) * letterStep;
    const to = { x: center.x + targetOffset, y: center.y };
    const dock = { x: center.x + targetOffset * dockScale, y: compact ? 126 : 132 };
    const element = node("span", "sm-letter", letter);
    element.dataset.targetIndex = targetIndex;
    element.style.setProperty("--glitch-delay", `${-index * .17}s`);
    wordmark.append(element);
    const bee = node("div", "sm-bee");
    const image = node("img", "sm-bee-sprite");
    image.src = "assets/images/bee.svg?v=69426dcba7f0d919";
    image.alt = "";
    image.draggable = false;
    bee.append(image);
    beeLayer.append(bee);
    return { element, bee, from, to, dock, index };
  });

  const columns = compact ? 4 : 6;
  const spacing = compact ? (width - 38) / columns : 122;
  const cards = survivors.map((player, index) => {
    const to = {
      x: width / 2 + (index % columns - (columns - 1) / 2) * spacing,
      y: (compact ? 444 : 493) + Math.floor(index / columns) * (compact ? 79 : 113),
    };
    const slot = node("div", "sm-cast-slot");
    slot.style.width = `${size}px`;
    slot.style.height = `${size}px`;
    // The card includes its caption below the portrait.
    slot.style.transform = pose(to.x, to.y - (compact ? 9 : 11));
    stage.append(slot);
    const card = node("div", `sm-card team-${previousAssignments[player.id]}`);
    card.dataset.player = player.id;
    card.style.width = `${size}px`;
    const image = node("img", "");
    image.src = player.image;
    image.alt = "";
    image.draggable = false;
    card.append(image, node("span", "sm-player-name", player.name));
    stage.append(card);
    return { card, image, player, to, slot };
  });

  let timeScale = 1;
  function wait(duration, scaled = true) {
    if (!active) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = setTimeout(() => { timers.delete(timer); resolve(); }, duration * (scaled ? timeScale : 1));
      timers.set(timer, resolve);
    });
  }
  async function animate(element, frames, duration, delay = 0, easing = "cubic-bezier(.4,0,.2,1)") {
    if (!active) return;
    const animation = element.animate(frames, { duration: duration * timeScale, delay: delay * timeScale, easing, fill: "both" });
    animations.add(animation);
    try {
      await animation.finished;
      if (active) {
        for (const [key, value] of Object.entries(frames.at(-1))) {
          if (!["offset", "easing", "composite"].includes(key)) element.style[key] = value;
        }
      }
    } catch { /* Cancellation also settles every pending animation. */ }
    animation.cancel();
    animations.delete(animation);
  }

  let music;
  let startedAt;
  // File duration is also the silent fallback if playback is blocked or fails.
  const fallbackDuration = 36389;
  function remainingMusicTime() {
    const track = music.track;
    if (Number.isFinite(track.duration) && !track.error && (!track.paused || track.ended)) {
      return Math.max(0, (track.duration - track.currentTime) * 1000);
    }
    return Math.max(0, fallbackDuration - (performance.now() - startedAt));
  }
  async function run() {
    startedAt = performance.now();
    music = startMusic("assets/audio/horn-of-plenty.mp3?v=69426dcba7f0d919");
    await Promise.race([
      Promise.all([music.ready, ...cards.map(({ image }) => image.decode().catch(() => {}))]),
      wait(1000, false),
    ]);
    if (!active) return;
    // The unscaled sequence through the final layout lasts 49.11 seconds.
    // Reserve a final hold and some room for image decoding/frame scheduling.
    // Keeping one scale preserves the rhythm of every departure and cast reveal.
    timeScale = Math.max(.1, (remainingMusicTime() - 3500) / 49110);
    await playMergeTribute(stage, { players, teams, animate, wait, isActive: () => active });
    if (!active) return;
    title.hidden = false;
    stage.dataset.phase = "intro";
    playSound("swapStart");
    await Promise.all(letters.map(({ element, from }, i) => animate(element, [
      { opacity: "0", transform: pose(from.x, from.y + 25, .7) },
      { opacity: "1", transform: pose(from.x, from.y) },
    ], 450, i * 55)));
    await wait(650);
    if (!active) return;

    stage.dataset.phase = "swarm";
    particles.setMode("gather");
    stopSwarm = startSwarm();
    const lift = compact ? 37 : 64;
    await Promise.all(letters.map(({ bee, from }, i) => animate(bee, [
      { opacity: "0", transform: pose(i % 2 ? width + 40 : -40, 100 + i * 65, .6) },
      { opacity: "1", transform: pose(from.x, from.y - lift) },
    ], 650, i * 45)));
    if (!active) return;
    stage.dataset.phase = "shuffle";
    particles.setMode("vortex");
    await Promise.all(letters.flatMap(({ element, bee, from, to, index }) => {
      const path = Array.from({ length: 49 }, (_, step) => {
        const t = step / 48;
        const arc = Math.sin(t * Math.PI);
        const angle = t * Math.PI * 2 + index * Math.PI / 3;
        return {
          x: from.x + (to.x - from.x) * t + Math.cos(angle) * arc * (compact ? 54 : 150),
          y: center.y + Math.sin(angle) * arc * (compact ? 90 : 125),
          rotation: Math.sin(angle) * arc * 24,
        };
      });
      particles.trail(path, sourceColor);
      return [
        animate(element, path.map(({ x, y, rotation }) => ({ transform: pose(x, y, 1, rotation) })), 1900, index * 35),
        animate(bee, path.map(({ x, y, rotation }) => ({ transform: pose(x, y - lift, 1, rotation) })), 1900, index * 35),
      ];
    }));
    if (!active) return;

    wordmark.setAttribute("aria-label", "UMAR BB");
    stage.dataset.phase = "glitch";
    // A brief chromatic offset on the letters, without flashing the whole screen.
    await animate(wordmark, [
      { color: sourceColor, transform: "translateX(0)", textShadow: "3px 0 #82bbef, -3px 0 #c0a0ef" },
      { color: "#82bbef", transform: "translateX(-4px)", textShadow: "-5px 1px #ef5350, 4px -1px #f5c84c" },
      { color: "#99cc85", transform: "translateX(2px)", textShadow: "3px 0 #c0a0ef, -3px 1px #82bbef" },
      { color: "#c0a0ef", transform: "translateX(3px)", textShadow: "4px -2px #82bbef, -3px 1px #ef5350" },
      { color: "#ef5350", transform: "translateX(-2px)", textShadow: "-3px 0 #f5c84c, 3px 0 #82bbef" },
      { color: "#ef5350", transform: "translateX(0)", textShadow: "0 0 28px #ef535070" },
    ], 850, 0, "steps(1, end)");
    if (!active) return;
    stage.classList.replace("team-bumbar", `team-${teamId}`);
    stage.dataset.phase = "reveal";
    const color = getComputedStyle(stage).getPropertyValue("--team-color").trim();
    particles.setMode("reveal");
    particles.burst(center.x, center.y, color, 60);
    stopSwarm?.();
    stopSwarm = null;
    playSound("reveal");
    await wait(450);
    if (!active) return;
    await Promise.all(letters.flatMap(({ element, bee, to, dock, index }) => [
      animate(element, [
        { transform: pose(to.x, to.y) },
        { transform: pose(dock.x, dock.y, dockScale) },
      ], 650),
      animate(bee, [
        { opacity: "1", transform: pose(to.x, to.y - lift) },
        { opacity: "0", transform: pose(index % 2 ? width + 60 : -60, -40, .6, index % 2 ? -30 : 30) },
      ], 550, index * 25),
    ]));
    if (!active) return;

    stage.dataset.phase = "cast";
    particles.setMode("finale");
    const feature = { x: center.x, y: compact ? 293 : 305 };
    const featureScale = compact ? 3.1 : 3.15;
    for (const [index, { card, player, to, slot }] of cards.entries()) {
      if (!active) return;
      stage.dataset.featured = player.id;
      card.classList.add("is-featured");
      playSound("reveal", { pitch: 1 + (index % 4) * .06 });
      await animate(card, [
        { opacity: "0", transform: pose(feature.x, feature.y + 24, featureScale * .8) },
        { opacity: "1", transform: pose(feature.x, feature.y, featureScale) },
      ], 380);
      await wait(700);
      if (!active) return;
      card.classList.replace(`team-${previousAssignments[player.id]}`, `team-${teamId}`);
      card.dataset.team = teamId;
      await animate(card, [
        { transform: pose(feature.x, feature.y, featureScale) },
        { transform: pose(feature.x + (to.x - feature.x) * .25, feature.y - 18, featureScale * .72) },
        { transform: pose(to.x, to.y, 1) },
      ], 560);
      if (!active) return;
      card.classList.remove("is-featured");
      card.classList.add("is-landed");
      slot.classList.add("is-filled");
      particles.burst(to.x, to.y, color, 12);
      playSound("drop", { pitch: 1.2 });
      await wait(90);
    }
    if (!active) return;
    delete stage.dataset.featured;
    stage.dataset.phase = "finale";
    playSound("swapEnd");
    await Promise.all([
      animate(deck, [
        { top: compact ? "401px" : "437px", bottom: compact ? "40px" : "30px" },
        { top: "227px", bottom: "40px" },
      ], 650),
      ...cards.map(({ card, to }, index) => animate(card, [
        { transform: pose(to.x, to.y, 1) },
        { transform: pose(to.x, (compact ? 290 : 320) + Math.floor(index / columns) * (compact ? 115 : 160), compact ? 1.15 : 1.3) },
      ], 650)),
    ]);
    // Hold the complete team until the track finishes, without looping the song.
    // The event includes the audio output latency; the timeout handles stalled media.
    await Promise.race([
      music.finished.then((ended) => ended ? undefined : wait(remainingMusicTime(), false)),
      wait(remainingMusicTime() + (music.track.paused ? 0 : 1000), false),
    ]);
  }
  function cancel() {
    if (!active) return;
    active = false;
    music?.stop();
    stopSwarm?.();
    for (const animation of animations) animation.cancel();
    animations.clear();
    for (const [timer, resolve] of timers) { clearTimeout(timer); resolve(); }
    timers.clear();
    particles.destroy();
  }
  return { finished: run().finally(cancel), cancel };
}
