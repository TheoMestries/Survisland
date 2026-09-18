import { playerIdentity, findPlayer } from "./roster.js";
import { renderGallery } from "./episode-gallery.js";
export const tiers = [
  { id: "S", label: "Confiance totale", note: "Le cœur de la ruche" },
  { id: "A", label: "Bonne confiance", note: "Des liens solides" },
  { id: "B", label: "À confirmer", note: "Je garde les yeux ouverts" },
  { id: "C", label: "Méfiance", note: "Attention aux piqûres" },
  { id: "D", label: "Aucune confiance", note: "À distance de la ruche" },
  { id: "U", label: "À classer", note: "Confiance non évaluée" },
];
export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
export function rankedPeople(people) {
  return people
    .filter((person) => !person.eliminated && person.tier !== "U")
    .sort(
      (a, b) =>
        tiers.findIndex((t) => t.id === a.tier) -
        tiers.findIndex((t) => t.id === b.tier),
    );
}

function openPlayer(person, rank, total) {
  let dialog = document.querySelector("#player-dialog");
  if (!dialog) {
    dialog = el("dialog", "player-dialog");
    dialog.id = "player-dialog";
    dialog.setAttribute("aria-labelledby", "player-dialog-name");
    dialog.addEventListener("click", (event) => {
      const rect = dialog.getBoundingClientRect();
      if (
        event.target === dialog &&
        (event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom)
      )
        dialog.close();
    });
    dialog.addEventListener("close", () =>
      document.body.classList.remove("modal-open"),
    );
    document.body.append(dialog);
  }
  const close = el(
    "button",
    "btn btn-secondary btn-small dialog-close",
    "Fermer ×",
  );
  close.type = "button";
  close.autofocus = true;
  close.addEventListener("click", () => dialog.close());
  const title = el("h2", "", person.name);
  title.id = "player-dialog-name";
  const identity = el("div", "dialog-identity");
  identity.append(playerIdentity(person.name));
  const state = person.eliminated
    ? "Éliminé · Hors classement"
    : rank
      ? `Confiance : ${rank} / ${total} · ${tiers.find((t) => t.id === person.tier)?.label || ""}`
      : "À classer";
  dialog.replaceChildren(
    close,
    identity,
    title,
    el("p", "eyebrow", state),
    el("h3", "", "Ma justification"),
    el(
      "p",
      "multiline dialog-reason",
      person.reason || "Aucune justification renseignée pour cet épisode.",
    ),
  );
  dialog.showModal();
  document.body.classList.add("modal-open");
}

function portraitButton(person, rank, total) {
  const button = el("button", "ranked-portrait");
  button.type = "button";
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute(
    "aria-label",
    `${person.name} · ${person.eliminated ? "Éliminé" : rank ? `Rang ${rank} sur ${total}` : "À classer"} · Voir la justification`,
  );
  button.title = person.name;
  const identity = playerIdentity(person.name);
  identity.querySelector(".team-badge")?.remove();
  const player = findPlayer(person.name);
  const frame = el("span", "portrait-frame" + (player ? ` team-${player.team}` : ""));
  frame.append(identity);
  button.append(frame);
  if (rank) button.append(el("span", "rank-number", String(rank)));
  button.addEventListener("click", () => openPlayer(person, rank, total));
  return button;
}

export function renderEpisode(container, episode) {
  document.querySelector("#player-dialog[open]")?.close();
  container.replaceChildren();
  const header = el("header", "episode-heading");
  header.append(
    el("p", "eyebrow", `Épisode ${episode.number}`),
    el("h2", "", episode.title),
  );
  if (episode.summary) header.append(el("p", "multiline", episode.summary));
  container.append(header);
  renderGallery(container, episode.images, episode.number);
  const answers = el("section", "answers-section");
  answers.append(
    el("h3", "subheading", "Dans le confessional"),
    el(
      "p",
      "field-help",
      `${episode.questions.length} question(s) · Mes réponses à cet épisode`,
    ),
  );
  episode.questions.forEach((item, index) => {
    const card = el("article", "answer-card");
    card.append(
      el("p", "eyebrow", `Question ${String(index + 1).padStart(2, "0")}`),
      el("h4", "", item.question),
      el("p", "multiline", item.answer || "Pas encore de réponse."),
    );
    answers.append(card);
  });
  if (!episode.questions.length)
    answers.append(el("p", "empty-state", "Aucune question pour cet épisode."));
  container.append(answers);
  const board = el("section", "trust-board");
  const ranked = rankedPeople(episode.people);
  const alive = episode.people.filter((person) => !person.eliminated);
  board.append(el("h3", "subheading", "À qui je confie mon miel"));
  tiers.forEach((tier) => {
    if (tier.id === "U" && !alive.some((person) => person.tier === "U")) return;
    const row = el("div", `tier-row tier-${tier.id}`);
    const label = el("div", "tier-label");
    label.append(el("strong", "", tier.id), el("span", "", tier.label));
    const people = el("div", "tier-people");
    alive
      .filter((person) => person.tier === tier.id)
      .forEach((person) => {
        const rank = ranked.indexOf(person) + 1;
        people.append(portraitButton(person, rank, alive.length));
      });
    if (!people.childElementCount)
      people.append(el("p", "tier-empty", "Personne à ce niveau."));
    row.append(label, people);
    board.append(row);
  });
  container.append(board);
  const eliminated = episode.people.filter((person) => person.eliminated);
  if (eliminated.length) {
    const section = el("section", "eliminated-section");
    section.append(
      el("h3", "subheading", `Hors jeu · ${eliminated.length} éliminé(s)`),
    );
    const portraits = el("div", "eliminated-portraits");
    eliminated.forEach((person) =>
      portraits.append(portraitButton(person, 0, alive.length)),
    );
    section.append(portraits);
    container.append(section);
  }
}
