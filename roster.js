export const teams = [
  { id: "bumbar", name: "Bumbar", color: "Jaune" },
  { id: "avispa", name: "Avispa", color: "Bleu" },
  { id: "hornet", name: "Hornet", color: "Vert" },
  { id: "conong", name: "Conong", color: "Violet" },
];

// Team assignments come from the season table, not the portrait backgrounds.
export const players = [
  {
    id: "kchouky",
    name: "Kchouky",
    team: "avispa",
    aliases: [],
    image: "assets/images/players/kchouky.png",
  },
  {
    id: "xyneas",
    name: "XyneAs",
    team: "conong",
    aliases: [],
    image: "assets/images/players/xyneas.png",
  },
  {
    id: "sparya",
    name: "Sparya",
    team: "avispa",
    aliases: [],
    image: "assets/images/players/sparya.png",
  },
  {
    id: "twizzyx",
    name: "TwiZzyx",
    team: "bumbar",
    aliases: [],
    image: "assets/images/players/twizzyx.png",
  },
  {
    id: "anthorus",
    name: "Anthorus",
    team: "bumbar",
    aliases: [],
    image: "assets/images/players/anthorus.png",
  },
  {
    id: "sheep",
    name: "Sheep",
    team: "bumbar",
    aliases: [],
    image: "assets/images/players/sheep.png",
  },
  {
    id: "aelita",
    name: "Aelita",
    team: "avispa",
    aliases: ["Aelita A"],
    image: "assets/images/players/aelita.png",
  },
  {
    id: "chifuyu",
    name: "Chifuyu",
    team: "conong",
    aliases: [],
    image: "assets/images/players/chifuyu.png",
  },
  {
    id: "byphantom",
    name: "ByPhantom",
    team: "hornet",
    aliases: [],
    image: "assets/images/players/byphantom.png",
  },
  {
    id: "mel",
    name: "Mel",
    team: "conong",
    aliases: ["Melley"],
    image: "assets/images/players/mel.png",
  },
  {
    id: "romain",
    name: "Romain",
    team: "conong",
    aliases: ["RomainLeroux"],
    image: "assets/images/players/romain.png",
  },
  {
    id: "flopy19",
    name: "Flopy19",
    team: "bumbar",
    aliases: ["Flopy"],
    image: "assets/images/players/flopy19.png",
  },
  {
    id: "paulo",
    name: "Paulo",
    team: "avispa",
    aliases: [],
    image: "assets/images/players/paulo.png",
  },
  {
    id: "templik",
    name: "Templik",
    team: "hornet",
    aliases: [],
    image: "assets/images/players/templik.png",
  },
  {
    id: "salamix",
    name: "Salamix",
    team: "bumbar",
    aliases: [],
    image: "assets/images/players/salamix.png",
  },
  {
    id: "fusoya",
    name: "Fusoya",
    team: "hornet",
    aliases: [],
    image: "assets/images/players/fusoya.png",
  },
  {
    id: "dvil",
    name: "DVil",
    team: "hornet",
    aliases: [],
    image: "assets/images/players/dvil.png",
  },
  {
    id: "hurakan",
    name: "Hurakan",
    team: "avispa",
    aliases: [],
    image: "assets/images/players/hurakan.png",
  },
  {
    id: "faeten",
    name: "Faeten",
    team: "hornet",
    aliases: [],
    image: "assets/images/players/faeten.png",
  },
  {
    id: "jenna",
    name: "Jenna",
    team: "conong",
    aliases: [],
    image: "assets/images/players/jenna.png",
  },
];

export function findPlayer(name) {
  const key = name.trim().toLocaleLowerCase("fr");
  return players.find((player) =>
    [player.name, ...player.aliases].some(
      (alias) => alias.toLocaleLowerCase("fr") === key,
    ),
  );
}
export function freshRanking() {
  return players
    .filter((player) => player.id !== "flopy19")
    .map((player) => ({ name: player.name, tier: "U", reason: "" }));
}
export function playerIdentity(name) {
  const player = findPlayer(name);
  const fragment = document.createDocumentFragment();
  if (!player) {
    const avatar = document.createElement("span");
    avatar.className = "person-avatar";
    avatar.textContent = name.slice(0, 2).toUpperCase();
    fragment.append(avatar);
    return fragment;
  }
  const image = document.createElement("img");
  image.className = "player-portrait";
  image.src = player.image;
  image.alt = "Portrait de " + player.name;
  image.width = 800;
  image.height = 800;
  image.loading = "lazy";
  const badge = document.createElement("span");
  badge.className = "team-badge team-" + player.team;
  badge.textContent = teams.find((team) => team.id === player.team).name;
  fragment.append(image, badge);
  return fragment;
}
export function renderRoster(container, episode = null) {
  container.replaceChildren();
  const eliminatedIds = new Set(
    (episode?.people || [])
      .filter((person) => person.eliminated)
      .map((person) => findPlayer(person.name)?.id)
      .filter(Boolean),
  );
  for (const team of teams) {
    const section = document.createElement("section");
    section.className = "roster-team team-" + team.id;
    const heading = document.createElement("h3");
    heading.textContent = team.name + " · " + team.color;
    const grid = document.createElement("div");
    grid.className = "roster-grid";
    for (const player of players.filter((player) => player.team === team.id)) {
      const card = document.createElement("article");
      card.className = "roster-player";
      const name = document.createElement("h4");
      name.textContent = player.name;
      card.append(playerIdentity(player.name), name);
      if (eliminatedIds.has(player.id)) {
        card.classList.add("roster-player--eliminated");
        const badge = document.createElement("span");
        badge.className = "eliminated-badge";
        badge.textContent = "Éliminé";
        card.append(badge);
      }
      grid.append(card);
    }
    section.append(heading, grid);
    container.append(section);
  }
}
