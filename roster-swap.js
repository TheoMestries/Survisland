import { players, teams, renderRoster, swapTeams, secondSwapTeams, secondSwapMoves, markSwapViewed } from "./roster.js";
import { playSound, createSoundToggle } from "./site-audio.js";
import { createSwapSequence } from "./swap-sequence.js";
import { createSecondSwapSequence } from "./swap-second-sequence.js";

// Composition du swap : les éliminations ultérieures ne changent pas ce tirage.
export { swapTeams };
const assignments = Object.fromEntries(
  Object.entries(swapTeams).flatMap(([team, ids]) =>
    ids.map((id) => [id, team]),
  ),
);
const seenKey = "survisland-season32-swap1-seen";
const viewKey = "survisland-season32-swap1-view";
const secondSeenKey = "survisland-season32-swap2-seen";
const secondViewKey = "survisland-season32-swap2-view";
const secondAssignments = Object.fromEntries(
  Object.entries(secondSwapTeams).flatMap(([team, ids]) => ids.map((id) => [id, team])),
);
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
  const after = node("button", "btn btn-secondary", "Après le swap 1");
  const replay = node("button", "btn btn-secondary", "Revoir le swap 1");
  const secondLaunch = node("button", "btn swap-alert", "⚠ Nouveau swap · 3 joueurs !");
  const secondAfter = node("button", "btn btn-secondary", "Après le swap 2");
  const secondReplay = node("button", "btn btn-secondary", "Revoir le swap 2");
  secondLaunch.dataset.sound = secondReplay.dataset.sound = "none";
  replay.dataset.sound = "none";
  const buttons = [launch, before, after, replay, secondLaunch, secondAfter, secondReplay];
  for (const button of buttons) button.type = "button";
  before.hidden = after.hidden = replay.hidden = secondLaunch.hidden = secondAfter.hidden = secondReplay.hidden = true;
  controls.append(...buttons);
  container.before(controls);
  let seen = readPreference(seenKey) === "yes";
  let secondSeen = seen && readPreference(secondSeenKey) === "yes";
  const savedView = readPreference(secondViewKey);
  let currentView = secondSeen && savedView === "2" ? 2
    : seen && readPreference(viewKey) !== "before" ? 1 : 0;
  let playingSwap = 1;
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
    for (const button of buttons) button.disabled = false;
  }
  function showView(value) {
    cleanup();
    currentView = !seen ? 0 : value === 2 && secondSeen ? 2 : value ? 1 : 0;
    renderRoster(container, episode, currentView === 2 ? secondAssignments : currentView === 1 ? assignments : null);
    summary.textContent = currentView
      ? `Les 18 joueurs · Les équipes après le swap ${currentView}`
      : "Les 20 joueurs · Les équipes de départ";
    launch.hidden = seen;
    before.hidden = after.hidden = replay.hidden = !seen;
    secondLaunch.hidden = !seen || secondSeen;
    secondAfter.hidden = secondReplay.hidden = !seen || !secondSeen;
    before.setAttribute("aria-pressed", String(currentView === 0));
    after.setAttribute("aria-pressed", String(currentView === 1));
    secondAfter.setAttribute("aria-pressed", String(currentView === 2));
    if (seen) {
      remember(viewKey, currentView ? "after" : "before");
      remember(secondViewKey, String(currentView));
    }
  }
  function finish() {
    if (playingSwap === 2) {
      secondSeen = true;
      remember(secondSeenKey, "yes");
    } else {
      seen = true;
      remember(seenKey, "yes");
    }
    markSwapViewed(playingSwap);
    showView(playingSwap);
    (playingSwap === 2 ? secondAfter : after).focus({ preventScroll: true });
  }
  async function start(swap = 1) {
    if (stage || (swap === 2 && !seen)) return;
    playingSwap = swap;
    if (reducedMotion.matches) {
      playSound("swapEnd");
      finish();
      return;
    }
    const run = ++generation;
    for (const button of buttons) button.disabled = true;
    scrollPosition = { left: window.scrollX, top: window.scrollY };
    document.body.style.setProperty(
      "--swap-scroll-top",
      `${-window.scrollY}px`,
    );
    document.documentElement.classList.add("swap-playing");
    container.hidden = true;
    overlay = node("dialog", "swap-overlay");
    overlay.setAttribute("aria-label", `Animation du swap ${swap} des équipes`);
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
    sequence = swap === 2
      ? createSecondSwapSequence(stage, { players, teams, moves: secondSwapMoves })
      : createSwapSequence(stage, { players, teams, swapTeams });
    await sequence.finished;
    if (run === generation) finish();
  }
  function play(swap = 1) {
    start(swap).catch(() => {
      if (stage) showView(currentView);
    });
  }
  launch.addEventListener("click", () => play(1));
  replay.addEventListener("click", () => play(1));
  secondLaunch.addEventListener("click", () => play(2));
  secondReplay.addEventListener("click", () => play(2));
  before.addEventListener("click", () => showView(0));
  after.addEventListener("click", () => showView(1));
  secondAfter.addEventListener("click", () => showView(2));
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
      showView(currentView);
    },
  };
}
