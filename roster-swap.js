import { players, teams, renderRoster } from "./roster.js";
import { playSound, createSoundToggle } from "./site-audio.js";
import { createSwapSequence } from "./swap-sequence.js";

// Composition du swap : les éliminations ultérieures ne changent pas ce tirage.
export const swapTeams = {
  avispa: ["byphantom", "dvil", "aelita", "hurakan", "jenna", "anthorus"],
  conong: ["faeten", "kchouky", "paulo", "chifuyu", "mel", "flopy19"],
  bumbar: ["templik", "sparya", "xyneas", "romain", "salamix", "twizzyx"],
};
const assignments = Object.fromEntries(
  Object.entries(swapTeams).flatMap(([team, ids]) =>
    ids.map((id) => [id, team]),
  ),
);
const seenKey = "survisland-season32-swap1-seen";
const viewKey = "survisland-season32-swap1-view";
function readPreference(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function remember(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Keep the in-page state if storage is unavailable. */
  }
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
  launch.dataset.sound = "none";
  const before = node("button", "btn btn-secondary", "Avant le swap");
  const after = node("button", "btn btn-secondary", "Après le swap");
  const replay = node("button", "btn btn-secondary", "Revoir l’animation");
  replay.dataset.sound = "none";
  for (const button of [launch, before, after, replay]) button.type = "button";
  before.hidden = after.hidden = replay.hidden = true;
  controls.append(launch, before, after, replay);
  container.before(controls);
  let seen = readPreference(seenKey) === "yes";
  let afterSwap = seen && readPreference(viewKey) !== "before";
  let episode = null,
    stage = null,
    generation = 0,
    overlay = null;
  let scrollPosition = null;
  let sequence = null;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  function cleanup() {
    generation++;
    sequence?.cancel();
    sequence = null;
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
  async function start() {
    if (stage) return;
    if (reducedMotion.matches) {
      playSound("swapEnd");
      finish();
      return;
    }
    const run = ++generation;
    launch.disabled = true;
    replay.disabled = true;
    before.hidden = after.hidden = true;
    scrollPosition = { left: window.scrollX, top: window.scrollY };
    document.body.style.setProperty(
      "--swap-scroll-top",
      `${-window.scrollY}px`,
    );
    document.documentElement.classList.add("swap-playing");
    container.hidden = true;
    overlay = node("dialog", "swap-overlay");
    overlay.setAttribute("aria-label", "Animation du swap des équipes");
    overlay.tabIndex = -1;
    overlay.addEventListener("cancel", (event) => event.preventDefault());
    overlay.addEventListener("wheel", (event) => event.preventDefault(), {
      passive: false,
    });
    overlay.addEventListener("touchmove", (event) => event.preventDefault(), {
      passive: false,
    });
    overlay.addEventListener("keydown", (event) => {
      if (
        [
          " ",
          "ArrowDown",
          "ArrowUp",
          "ArrowLeft",
          "ArrowRight",
          "PageDown",
          "PageUp",
          "Home",
          "End",
        ].includes(event.key) &&
        !event.target.closest("button")
      )
        event.preventDefault();
    });
    const soundToggle = createSoundToggle();
    soundToggle.classList.add("swap-sound-toggle");
    overlay.append(soundToggle);
    document.body.append(overlay);
    stage = node("div", "swap-stage");
    stage.setAttribute("aria-hidden", "true");
    overlay.append(stage);
    overlay.showModal();
    overlay.focus({ preventScroll: true });
    const compact = window.innerWidth < 600;
    const width = compact ? Math.min(420, window.innerWidth - 24) : 920;
    stage.classList.add("sw-cinema");
    stage.classList.toggle("sw-compact", compact);
    stage.style.width = `${width}px`;
    stage.style.height = compact ? "690px" : "720px";
    fitStage();
    sequence = createSwapSequence(stage, { players, teams, swapTeams });
    await sequence.finished;
    if (run === generation) finish();
  }
  function play() {
    start().catch(() => {
      if (stage) showView(false);
    });
  }
  launch.addEventListener("click", play);
  replay.addEventListener("click", play);
  before.addEventListener("click", () => showView(false));
  after.addEventListener("click", () => showView(true));
  function fitStage() {
    if (!stage) return;
    const viewport = window.visualViewport;
    const scale = Math.min(
      1,
      ((viewport?.width || window.innerWidth) - 32) / stage.offsetWidth,
      ((viewport?.height || window.innerHeight) - 100) / stage.offsetHeight,
    );
    stage.style.transform = `translate(-50%, -50%) scale(${Math.max(0.1, scale)})`;
  }
  window.addEventListener("resize", fitStage);
  window.visualViewport?.addEventListener("resize", fitStage);
  reducedMotion.addEventListener("change", () => {
    if (stage && reducedMotion.matches) finish();
  });
  return {
    update(nextEpisode = null) {
      episode = nextEpisode;
      showView(afterSwap);
    },
  };
}
