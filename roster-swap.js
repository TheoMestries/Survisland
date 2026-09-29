import { players, teams, renderRoster } from "./roster.js";

// Composition du swap : les éliminations ultérieures ne changent pas ce tirage.
export const swapTeams = {
  avispa: ["byphantom", "dvil", "aelita", "hurakan", "jenna", "anthorus"],
  conong: ["faeten", "kchouky", "paulo", "chifuyu", "romain", "flopy19"],
  bumbar: ["templik", "sparya", "xyneas", "mel", "salamix", "twizzyx"],
};
const assignments = Object.fromEntries(Object.entries(swapTeams).flatMap(
  ([team, ids]) => ids.map(id => [id, team]),
));
const seenKey = "survisland-season32-swap1-seen";
const viewKey = "survisland-season32-swap1-view";
function readPreference(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function remember(key, value) {
  try { localStorage.setItem(key, value); } catch { /* Keep the in-page state if storage is unavailable. */ }
}

function node(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  if (text) element.textContent = text;
  return element;
}

export function createRosterSwap(container) {
  const summary = container.parentElement.querySelector("summary");
  const controls = node("div", "swap-controls");
  const launch = node("button", "btn swap-alert", "⚠ Attention, swap !");
  const before = node("button", "btn btn-secondary", "Avant le swap");
  const after = node("button", "btn btn-secondary", "Après le swap");
  const replay = node("button", "btn btn-secondary", "Revoir l’animation");
  for (const button of [launch, before, after, replay]) button.type = "button";
  before.hidden = after.hidden = replay.hidden = true;
  controls.append(launch, before, after, replay);
  container.before(controls);
  let seen = readPreference(seenKey) === "yes";
  let afterSwap = seen && readPreference(viewKey) !== "before";
  let episode = null, stage = null, generation = 0, overlay = null;
  let scrollPosition = null;
  const animations = new Set();
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  function cleanup() {
    generation++;
    for (const animation of animations) animation.cancel();
    animations.clear();
    stage?.remove();
    stage = null;
    container.hidden = false;
    overlay?.close();
    overlay?.remove();
    overlay = null;
    if (scrollPosition) {
      document.documentElement.classList.remove("swap-playing");
      document.body.style.removeProperty("--swap-scroll-top");
      window.scrollTo({ ...scrollPosition, behavior: "instant" });
      scrollPosition = null;
    }
    launch.disabled = false;
    replay.disabled = false;
  }
  function showView(afterValue) {
    cleanup();
    afterSwap = seen && afterValue;
    renderRoster(container, episode, afterSwap ? assignments : null);
    summary.textContent = afterSwap
      ? "Les 18 joueurs · Les équipes après le swap"
      : "Les 20 joueurs · Les équipes de départ";
    launch.hidden = seen;
    before.hidden = after.hidden = replay.hidden = !seen;
    before.setAttribute("aria-pressed", String(!afterSwap));
    after.setAttribute("aria-pressed", String(afterSwap));
    if (seen) remember(viewKey, afterSwap ? "after" : "before");
  }
  function finish() {
    seen = true;
    remember(seenKey, "yes");
    showView(true);
    after.focus({ preventScroll: true });
  }
  async function move(element, frames, duration, delay = 0) {
    const animation = element.animate(frames, {
      duration, delay, easing: "cubic-bezier(.22,.68,.2,1)", fill: "forwards",
    });
    animations.add(animation);
    try { await animation.finished; } catch { /* Annulation : changement d’épisode ou passage immédiat. */ }
    animations.delete(animation);
  }
  async function start() {
    if (stage) return;
    if (reducedMotion.matches) { finish(); return; }
    const run = ++generation;
    launch.disabled = true;
    replay.disabled = true;
    before.hidden = after.hidden = true;
    scrollPosition = { left: window.scrollX, top: window.scrollY };
    document.body.style.setProperty("--swap-scroll-top", `${-window.scrollY}px`);
    document.documentElement.classList.add("swap-playing");
    container.hidden = true;
    overlay = node("dialog", "swap-overlay");
    overlay.setAttribute("aria-label", "Animation du swap des équipes");
    overlay.tabIndex = -1;
    overlay.addEventListener("cancel", event => event.preventDefault());
    overlay.addEventListener("wheel", event => event.preventDefault(), { passive: false });
    overlay.addEventListener("touchmove", event => event.preventDefault(), { passive: false });
    overlay.addEventListener("keydown", event => {
      if (["Tab", " ", "ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "PageDown", "PageUp", "Home", "End"].includes(event.key)) event.preventDefault();
    });
    document.body.append(overlay);
    stage = node("div", "swap-stage");
    stage.setAttribute("aria-hidden", "true");
    overlay.append(stage);
    overlay.showModal();
    overlay.focus({ preventScroll: true });
    const arena = stage;
    const width = Math.min(900, window.innerWidth - 32);
    arena.style.width = `${width}px`;
    const size = width < 500 ? 42 : 56;
    const stride = size + 18;
    const height = 6 * stride + 180;
    arena.style.height = `${height}px`;
    fitStage();
    const hive = node("div", "swap-hive");
    hive.append(node("span", "swap-hive-label", "La ruche"));
    hive.style.top = `${height - 140}px`;
    arena.append(hive);
    const center = { x: (width - size) / 2, y: height - 103 };
    const position = (column, row, columns) => ({
      x: width * (column + .5) / columns - size / 2,
      y: 62 + row * stride,
    });
    const transform = (point, scale = 1) => `translate(${point.x}px, ${point.y}px) scale(${scale})`;
    function headings(list) {
      arena.querySelectorAll(".swap-team-label").forEach(label => label.remove());
      list.forEach((id, i) => {
        const label = node("div", `swap-team-label team-${id}`, teams.find(t => t.id === id).name);
        label.style.left = `${i * 100 / list.length}%`;
        label.style.width = `${100 / list.length}%`;
        arena.append(label);
      });
    }
    headings(teams.map(t => t.id));
    const portraits = new Map();
    teams.forEach((team, column) => {
      players.filter(p => p.team === team.id).forEach((player, row) => {
        const portrait = node("img", `swap-portrait team-${team.id}`);
        portrait.src = player.image;
        portrait.alt = "";
        portrait.dataset.player = player.id;
        portrait.style.width = portrait.style.height = `${size}px`;
        const origin = position(column, row, 4);
        portrait.style.transform = transform(origin);
        arena.append(portrait);
        portraits.set(player.id, { portrait, origin });
      });
    });
    await Promise.all([...portraits.values()].map(({portrait}) => portrait.decode().catch(() => {})));
    if (run !== generation) return;
    await Promise.all([...portraits].map(async ([id, {portrait, origin}], i) => {
      const alive = Boolean(assignments[id]);
      await move(portrait, [
        { transform: transform(origin), opacity: 1 },
        { transform: alive ? transform(center, .65) : `translate(${origin.x + 30}px, ${height + 100}px) rotate(70deg)`, opacity: alive ? 1 : 0 },
      ], 950, i * 45);
      if (run === generation && !alive) portrait.remove();
    }));
    if (run !== generation) return;
    const newTeams = Object.keys(swapTeams);
    headings(newTeams);
    const spins = new Map();
    const remaining = newTeams.flatMap((team, column) =>
      swapTeams[team].map((id, row) => ({ id, team, column, row })),
    );
    remaining.forEach(({ id }, i) => {
      const { portrait } = portraits.get(id);
      const phase = i * Math.PI * 2 / remaining.length;
      const radius = i % 2 ? 65 : 39;
      const frames = Array.from({ length: 33 }, (_, step) => {
        const angle = phase + step / 32 * Math.PI * 2;
        return {
          transform: `${transform({ x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * 21 }, .48)} rotate(${Math.sin(angle) * 22}deg)`,
        };
      });
      const spin = portrait.animate(frames, {
        duration: 1500, iterations: Infinity, easing: "linear",
      });
      animations.add(spin);
      spins.set(id, spin);
    });
    // Keep the others swirling while each selected portrait leaves the hive.
    await move(hive, [
      { transform: "translateX(-50%) rotate(0deg)" },
      { transform: "translateX(-50%) rotate(-3deg)", offset: .25 },
      { transform: "translateX(-50%) rotate(3deg)", offset: .5 },
      { transform: "translateX(-50%) rotate(-3deg)", offset: .75 },
      { transform: "translateX(-50%) rotate(0deg)" },
    ], 1800);
    let previousTeam = null;
    while (remaining.length) {
        if (run !== generation) return;
        // Vary the reveal order, keeping the actual team assignments unchanged.
        const candidates = remaining.filter(entry => entry.team !== previousTeam);
        const pool = candidates.length ? candidates : remaining;
        const next = pool[Math.floor(Math.random() * pool.length)];
        const { id, team, column, row } = next;
        remaining.splice(remaining.indexOf(next), 1);
        previousTeam = team;
        const { portrait } = portraits.get(id);
        const departure = getComputedStyle(portrait).transform;
        const spin = spins.get(id);
        spin.cancel();
        animations.delete(spin);
        portrait.className = `swap-portrait team-${team}`;
        portrait.style.zIndex = "2";
        await move(portrait, [
          { transform: departure },
          { transform: transform(position(column, row, 3)) },
        ], 480);
        portrait.style.zIndex = "1";
    }
    if (run === generation) finish();
  }
  function play() {
    start().catch(() => { if (stage) showView(false); });
  }
  launch.addEventListener("click", play);
  replay.addEventListener("click", play);
  before.addEventListener("click", () => showView(false));
  after.addEventListener("click", () => showView(true));
  function fitStage() {
    if (!stage) return;
    const viewport = window.visualViewport;
    const scale = Math.min(1,
      ((viewport?.width || window.innerWidth) - 32) / stage.offsetWidth,
      ((viewport?.height || window.innerHeight) - 32) / stage.offsetHeight);
    stage.style.transform = `translate(-50%, -50%) scale(${Math.max(.1, scale)})`;
  }
  window.addEventListener("resize", fitStage);
  window.visualViewport?.addEventListener("resize", fitStage);
  reducedMotion.addEventListener("change", () => { if (stage && reducedMotion.matches) finish(); });
  return { update(nextEpisode = null) { episode = nextEpisode; showView(afterSwap); } };
}
