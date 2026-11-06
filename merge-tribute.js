import { playSound } from "./site-audio.js?v=5f9c2819ac25f95a";

// Historical departure order and teams, independent of later swaps and jury status.
const departures = [
  { id: "sheep", team: "bumbar" },
  { id: "fusoya", team: "hornet" },
  { id: "templik", team: "bumbar", name: "Templik / Avelic" },
  { id: "romain", team: "bumbar", name: "RomainLeroux" },
  { id: "chifuyu", team: "conong" },
  { id: "dvil", team: "avispa" },
  { id: "twizzyx", team: "bumbar" },
  { id: "kchouky", team: "conong" },
];

function node(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  if (text) element.textContent = text;
  return element;
}

// All waits and animations belong to the parent sequence, including cancellation.
export async function playMergeTribute(stage, { players, teams, animate, wait, isActive }) {
  const tribute = node("div", "mt-tribute");
  const title = node("div", "sw-title mt-title");
  title.append(node("strong", "", "AVANT LA RÉUNIFICATION"));
  const hero = node("div", "mt-hero");
  const portrait = node("img", "mt-portrait");
  portrait.alt = "";
  portrait.draggable = false;
  const name = node("strong", "mt-name");
  const teamName = node("span", "mt-team");
  const torch = node("div", "mt-torch");
  const flame = node("div", "mt-flame");
  flame.append(node("span", "mt-flame-outer"), node("span", "mt-flame-inner"));
  const smoke = node("div", "mt-smoke");
  smoke.append(node("span", ""), node("span", ""), node("span", ""));
  torch.append(node("div", "mt-torch-stem"), node("div", "mt-torch-bowl"), flame, smoke);
  hero.append(portrait, name, teamName, torch);
  const memories = node("div", "mt-memories");
  const entries = departures.map((departure) => {
    const player = players.find((player) => player.id === departure.id);
    const team = teams.find((team) => team.id === departure.team);
    const memory = node("div", "mt-memory");
    memory.dataset.player = player.id;
    memory.dataset.team = team.id;
    const image = node("img", "");
    image.src = player.image;
    image.alt = "";
    image.draggable = false;
    memory.append(image, node("span", "", departure.name || player.name));
    memories.append(memory);
    return { player, team, name: departure.name || player.name, memory, image };
  });
  tribute.append(title, hero, memories);
  stage.append(tribute);
  stage.dataset.phase = "tribute";
  try {
    await Promise.race([
      Promise.all(entries.map(({ image }) => image.decode().catch(() => {}))),
      wait(1200),
    ]);
    for (const entry of entries) {
      if (!isActive()) return;
      tribute.dataset.player = entry.player.id;
      tribute.dataset.state = "lit";
      hero.className = `mt-hero team-${entry.team.id}`;
      hero.dataset.team = entry.team.id;
      hero.style.filter = "none";
      flame.style.opacity = "1";
      flame.style.transform = "scale(1)";
      portrait.src = entry.player.image;
      name.textContent = entry.name;
      teamName.textContent = entry.team.name;
      playSound("tribute", { volume: .8 });
      await animate(hero, [
        { opacity: "0", transform: "translate(-50%, -50%) translateY(12px) scale(.94)" },
        { opacity: "1", transform: "translate(-50%, -50%) translateY(0) scale(1)" },
      ], 350);
      await wait(750);
      if (!isActive()) return;
      tribute.dataset.state = "extinguishing";
      playSound("flameOut");
      await Promise.all([
        animate(flame, [
          { opacity: "1", transform: "scale(1)" },
          { opacity: ".8", transform: "scale(.7, .45)" },
          { opacity: "0", transform: "scale(.1, .02)" },
        ], 650),
        animate(hero, [
          { filter: "grayscale(0) brightness(1)" },
          { filter: "grayscale(1) brightness(.65)" },
        ], 850),
      ]);
      if (!isActive()) return;
      tribute.dataset.state = "extinguished";
      entry.memory.classList.add("is-extinguished");
      await wait(350);
      await animate(hero, [{ opacity: "1" }, { opacity: "0" }], 250);
    }
    if (!isActive()) return;
    await wait(500);
    await animate(tribute, [{ opacity: "1" }, { opacity: "0" }], 500);
  } finally {
    tribute.remove();
  }
}
