import { tiers, el, renderEpisode, rankedPeople } from "./episode-view.js";
import { players, findPlayer, freshRanking, playerIdentity } from "./roster.js";
import { imageUrl } from "./episode-gallery.js";
const $ = (selector) => document.querySelector(selector);
let csrf = "",
  records = [],
  current,
  dirty = false,
  busy = false;
function notice(message, error = false) {
  $("#admin-status").textContent = message;
  $("#admin-status").classList.toggle("error", error);
}
function requireLogin() {
  $("#login-form").hidden = false;
  notice("Ta session a expiré. Reconnecte-toi ci-dessous : ta saisie reste dans cette page.", true);
}
let checkingSession = false;
async function keepSessionAlive() {
  if (!current || busy || checkingSession || document.hidden) return;
  checkingSession = true;
  try {
    const session = await request("session");
    csrf = session.csrf;
    if (!session.authenticated) requireLogin();
  } catch {
    // A temporary network failure must never interrupt editing.
  } finally {
    checkingSession = false;
  }
}
function markDirty() {
  dirty = true;
  $("#save-state").textContent = "Modifications non enregistrées.";
  $("#preview").hidden = true;
}
async function request(action, body) {
  const response = await fetch(
    `api.php?action=${action}`,
    body === undefined
      ? { cache: "no-store" }
      : {
          method: "POST",
          headers:
            body instanceof FormData
              ? { "X-CSRF-Token": csrf }
              : { "Content-Type": "application/json", "X-CSRF-Token": csrf },
          body: body instanceof FormData ? body : JSON.stringify(body),
        },
  );
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "Le serveur PHP est indisponible. Ouvre le site via MAMP, puis réessaie.",
    );
  }
  if (!response.ok) {
    if (current && action !== "login" && [401, 403].includes(response.status)) {
      requireLogin();
      throw new Error("Reconnecte-toi ci-dessous, puis réessaie. Ta saisie est conservée dans cette page.");
    }
    throw new Error(data.error || "La demande a échoué.");
  }
  return data;
}
function canLeave() {
  return (
    !dirty ||
    confirm("Des modifications ne sont pas enregistrées. Les abandonner ?")
  );
}
function fillPicker() {
  const picker = $("#admin-picker");
  picker.replaceChildren();
  [...records]
    .sort((a, b) => b.draft.number - a.draft.number)
    .forEach((record) => {
      const option = el(
        "option",
        "",
        `${record.draft.number}. ${record.draft.title} · ${record.published ? "Publié" : "Brouillon"}`,
      );
      option.value = record.id;
      picker.append(option);
    });
  picker.value = current?.id || "";
}
function newEpisode(people) {
  if (!people) {
    const latest = [...records].sort(
      (a, b) => b.draft.number - a.draft.number,
    )[0];
    people = freshRanking().map((person) => ({
      ...person,
      eliminated: !!latest?.draft.people.find(
        (previous) =>
          (findPlayer(previous.name)?.id || previous.name.toLowerCase()) ===
          findPlayer(person.name).id,
      )?.eliminated,
    }));
  }
  current = {
    id: "",
    revision: 0,
    published: null,
    draft: {
      number: Math.max(0, ...records.map((r) => r.draft.number)) + 1,
      title: "",
      summary: "",
      questions: [],
      images: [],
      people: structuredClone(people),
    },
  };
  display();
  markDirty();
  $("#episode-title").focus();
}
function previousEpisode() {
  return records
    .filter(
      (record) =>
        record.id !== current.id && record.draft.number < current.draft.number,
    )
    .sort((a, b) => b.draft.number - a.draft.number)[0];
}
function updatePreviousRankingButton() {
  const previous = previousEpisode();
  $("#copy-previous-ranking").disabled = !previous;
  $("#copy-previous-ranking").title = previous
    ? `Épisode ${previous.draft.number} — ${previous.draft.title}`
    : "Aucun épisode précédent";
}
function display() {
  current.draft.images ??= [];
  dirty = false;
  fillPicker();
  $("#episode-number").value = current.draft.number;
  $("#episode-title").value = current.draft.title;
  $("#episode-summary").value = current.draft.summary;
  $("#episode-state").textContent = current.published
    ? "Publié"
    : "Brouillon privé";
  $("#publish-button").textContent = current.published
    ? "Publier les modifications"
    : "Publier";
  $("#unpublish-button").hidden = !current.published;
  $("#save-state").textContent = current.id
    ? "Dernière version enregistrée chargée."
    : "Nouvel épisode · Non enregistré.";
  $("#preview").hidden = true;
  renderQuestions();
  renderPeople();
  renderImages();
  $("#image-upload-status").textContent = "";
  updatePreviousRankingButton();
}
function button(text, handler, label = text) {
  const btn = el("button", "btn btn-secondary btn-small", text);
  btn.type = "button";
  btn.setAttribute("aria-label", label);
  btn.addEventListener("click", handler);
  return btn;
}
function field(parent, caption, value, onChange, options = {}) {
  const label = el("label", "", caption);
  const input = el(options.multiline ? "textarea" : "input");
  input.value = value;
  input.maxLength = options.max || 2000;
  if (options.required) input.required = true;
  input.addEventListener("input", () => {
    onChange(input.value);
    markDirty();
  });
  label.append(input);
  parent.append(label);
  return input;
}
function moveItem(items, index, offset, render) {
  const target = index + offset;
  if (target < 0 || target >= items.length) return;
  [items[index], items[target]] = [items[target], items[index]];
  markDirty();
  render();
}
function renderImages() {
  const parent = $("#image-editor");
  parent.replaceChildren();
  current.draft.images.forEach((image, i) => {
    const card = el("div", "image-edit-card");
    const thumbnail = el("img");
    thumbnail.src = imageUrl(image.id);
    thumbnail.alt = `Image ${i + 1}`;
    thumbnail.loading = "lazy";
    card.append(thumbnail);
    field(
      card,
      "Légende (facultatif)",
      image.caption || "",
      (value) => (image.caption = value),
      { max: 500 },
    );
    const actions = el("div", "toolbar");
    const up = button(
      "←",
      () => moveItem(current.draft.images, i, -1, renderImages),
      `Avancer l’image ${i + 1}`,
    );
    up.disabled = i === 0;
    const down = button(
      "→",
      () => moveItem(current.draft.images, i, 1, renderImages),
      `Reculer l’image ${i + 1}`,
    );
    down.disabled = i === current.draft.images.length - 1;
    actions.append(
      up,
      down,
      button("Retirer", () => {
        current.draft.images.splice(i, 1);
        markDirty();
        renderImages();
      }),
    );
    card.append(actions);
    parent.append(card);
  });
  $("#episode-images").disabled = current.draft.images.length >= 20;
}

async function uploadImages(files) {
  if (busy || !files.length) return;
  if (current.draft.images.length + files.length > 20) {
    notice("Maximum 20 images par épisode.", true);
    $("#episode-images").value = "";
    return;
  }
  busy = true;
  const controls = [
    ...$("#admin-app").querySelectorAll("button,input,textarea,select"),
  ].map((node) => [node, node.disabled]);
  controls.forEach(([node]) => (node.disabled = true));
  let uploaded = 0;
  const failures = [];
  try {
    for (const [index, file] of files.entries()) {
      $("#image-upload-status").textContent =
        `Envoi ${index + 1} / ${files.length}…`;
      try {
        if (file.size > 8 * 1024 * 1024)
          throw new Error("Maximum 8 Mo par image.");
        const form = new FormData();
        form.append("image", file);
        const result = await request("upload", form);
        current.draft.images.push(result.image);
        uploaded++;
        markDirty();
      } catch (error) {
        failures.push(`${file.name} : ${error.message}`);
      }
    }
  } finally {
    controls.forEach(([node, disabled]) => (node.disabled = disabled));
    busy = false;
    $("#episode-images").value = "";
    renderImages();
    $("#image-upload-status").textContent = `${uploaded} image(s) ajoutée(s).`;
    if (failures.length) notice(failures.join("\n"), true);
    else
      notice("Images ajoutées. Enregistre le brouillon ou publie l’épisode.");
  }
}

function renderQuestions() {
  const parent = $("#question-editor");
  parent.replaceChildren();
  current.draft.questions.forEach((question, i) => {
    const card = el("div", "edit-item");
    field(
      card,
      `Question ${i + 1}`,
      question.question,
      (value) => (question.question = value),
      { required: true },
    );
    field(
      card,
      "Ma réponse",
      question.answer,
      (value) => (question.answer = value),
      { multiline: true, max: 20000 },
    );
    const actions = el("div", "toolbar");
    const up = button(
      "↑",
      () => moveItem(current.draft.questions, i, -1, renderQuestions),
      `Monter la question ${i + 1}`,
    );
    up.disabled = i === 0;
    const down = button(
      "↓",
      () => moveItem(current.draft.questions, i, 1, renderQuestions),
      `Descendre la question ${i + 1}`,
    );
    down.disabled = i === current.draft.questions.length - 1;
    actions.append(
      up,
      down,
      button("Supprimer", () => {
        if (
          (question.question || question.answer) &&
          !confirm("Supprimer cette question et sa réponse ?")
        )
          return;
        current.draft.questions.splice(i, 1);
        markDirty();
        renderQuestions();
      }),
    );
    card.append(actions);
    parent.append(card);
  });
}
function renderPeople() {
  const parent = $("#people-editor");
  parent.replaceChildren();
  // Canonical order: tiers S–D, then the manually chosen order within each tier.
  current.draft.people.sort(
    (a, b) =>
      Number(!!a.eliminated) - Number(!!b.eliminated) ||
      tiers.findIndex((t) => t.id === a.tier) -
        tiers.findIndex((t) => t.id === b.tier),
  );
  const ranked = rankedPeople(current.draft.people);
  const alive = current.draft.people.filter((person) => !person.eliminated);
  current.draft.people.forEach((person, i) => {
    const card = el("div", `edit-item tier-${person.tier}`);
    card.classList.toggle("is-eliminated", !!person.eliminated);
    const identity = el("div", "editor-player-identity");
    identity.append(playerIdentity(person.name));
    const rank = ranked.indexOf(person) + 1;
    const rankLabel = el(
      "strong",
      "editor-rank",
      person.eliminated
        ? "Éliminé"
        : rank
          ? `#${rank} / ${alive.length}`
          : "À classer",
    );
    identity.append(rankLabel);
    card.append(identity);
    const nameInput = field(
      card,
      "Pseudo",
      person.name,
      (value) => {
        person.name = value;
        identity.replaceChildren(playerIdentity(value));
        identity.append(rankLabel);
        elimination.setAttribute(
          "aria-label",
          `${value || "Ce joueur"} : éliminé à cet épisode (ou auparavant)`,
        );
      },
      {
        required: true,
        max: 80,
      },
    );
    nameInput.setAttribute("list", "season-player-names");
    const eliminationLabel = el("label", "elimination-toggle");
    const elimination = el("input");
    elimination.type = "checkbox";
    elimination.setAttribute(
      "aria-label",
      `${person.name || "Ce joueur"} : éliminé à cet épisode (ou auparavant)`,
    );
    elimination.checked = !!person.eliminated;
    elimination.addEventListener("change", () => {
      person.eliminated = elimination.checked;
      markDirty();
      renderPeople();
    });
    eliminationLabel.append(
      elimination,
      document.createTextNode("Éliminé à cet épisode (ou auparavant)"),
    );
    card.append(eliminationLabel);
    const label = el("label", "", "Niveau de confiance");
    const select = el("select");
    tiers.forEach((tier) => {
      const option = el("option", "", `${tier.id} — ${tier.label}`);
      option.value = tier.id;
      select.append(option);
    });
    select.value = person.tier;
    select.disabled = !!person.eliminated;
    select.addEventListener("change", () => {
      person.tier = select.value;
      markDirty();
      renderPeople();
    });
    label.append(select);
    card.append(label);
    field(
      card,
      "Ma justification (facultatif)",
      person.reason,
      (value) => (person.reason = value),
      { multiline: true, max: 5000 },
    );
    const actions = el("div", "toolbar");
    const up = button(
      "↑",
      () => moveItem(current.draft.people, i, -1, renderPeople),
      `Monter ${person.name || "cette personne"} dans son niveau`,
    );
    up.disabled =
      !!person.eliminated ||
      i === 0 ||
      current.draft.people[i - 1].tier !== person.tier ||
      !!current.draft.people[i - 1].eliminated;
    const down = button(
      "↓",
      () => moveItem(current.draft.people, i, 1, renderPeople),
      `Descendre ${person.name || "cette personne"} dans son niveau`,
    );
    down.disabled =
      !!person.eliminated ||
      i === current.draft.people.length - 1 ||
      current.draft.people[i + 1].tier !== person.tier ||
      !!current.draft.people[i + 1].eliminated;
    actions.append(
      up,
      down,
      button("Supprimer", () => {
        if (
          (person.name || person.reason) &&
          !confirm("Retirer cette personne du classement de cet épisode ?")
        )
          return;
        current.draft.people.splice(i, 1);
        markDirty();
        renderPeople();
      }),
    );
    card.append(actions);
    parent.append(card);
  });
}
async function openApp() {
  records = (await request("list", {})).episodes;
  $("#login-form").hidden = true;
  $("#admin-app").hidden = false;
  $("#password").value = "";
  if (records.length) {
    current = structuredClone(
      [...records].sort((a, b) => b.draft.number - a.draft.number)[0],
    );
    display();
  } else {
    newEpisode();
    dirty = false;
  }
  notice("Carnet privé ouvert.");
}
async function save(mode) {
  if (busy || !$("#episode-form").reportValidity()) return;
  if (
    mode === "publish" &&
    !confirm(
      "Publier cette version ? Les spectateurs pourront lire toutes ses réponses et son classement.",
    )
  )
    return;
  if (
    mode === "unpublish" &&
    !confirm(
      "Retirer cet épisode de la vue spectateur ? Il restera dans ton carnet.",
    )
  )
    return;
  busy = true;
  const disabled = [
    ...$("#admin-app").querySelectorAll("button,input,textarea,select"),
  ].map((node) => [node, node.disabled]);
  disabled.forEach(([node]) => (node.disabled = true));
  try {
    const { episode } = await request("save", {
      id: current.id,
      revision: current.revision,
      episode: current.draft,
      mode,
    });
    const index = records.findIndex((r) => r.id === episode.id);
    if (index < 0) records.push(episode);
    else records[index] = episode;
    current = structuredClone(episode);
    display();
    const message =
      mode === "publish"
        ? "Épisode publié. Il est maintenant visible dans le confessional."
        : mode === "unpublish"
          ? "Épisode retiré du public. Ton brouillon est conservé."
          : "Brouillon enregistré sur le serveur.";
    notice(message);
    $("#save-state").textContent = message;
  } catch (error) {
    notice(error.message, true);
    $("#save-state").textContent =
      "Échec de l’enregistrement. Tes modifications restent dans cette page.";
  } finally {
    disabled.forEach(([node, wasDisabled]) => (node.disabled = wasDisabled));
    busy = false;
  }
}
$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const btn = event.submitter;
  btn.disabled = true;
  try {
    const session = await request("session");
    csrf = session.csrf;
    await request("login", { password: $("#password").value });
    if (current) {
      $("#login-form").hidden = true;
      $("#password").value = "";
      notice("Reconnecté. Ta saisie est conservée ; tu peux enregistrer ou réessayer l’envoi des images.");
    } else {
      await openApp();
    }
  } catch (error) {
    notice(error.message, true);
  } finally {
    btn.disabled = false;
  }
});
$("#new-episode").addEventListener("click", () => {
  if (canLeave()) newEpisode();
});
$("#copy-episode").addEventListener("click", () => {
  if (canLeave()) newEpisode(current.draft.people);
});
$("#copy-previous-ranking").addEventListener("click", () => {
  const previous = previousEpisode();
  if (!previous || busy) return;
  const hasRanking = current.draft.people.some(
    (person) => person.tier !== "U" || person.reason || person.eliminated,
  );
  if (
    hasRanking &&
    !confirm(
      `Remplacer le classement en cours, ses justifications et ses éliminations par ceux de l’épisode ${previous.draft.number} ? Tes questions et réponses seront conservées.`,
    )
  )
    return;
  current.draft.people = structuredClone(previous.draft.people);
  markDirty();
  renderPeople();
  notice(
    `Classement de l’épisode ${previous.draft.number} repris. Enregistre le brouillon pour conserver ces modifications.`,
  );
});
$("#admin-picker").addEventListener("change", (event) => {
  if (!canLeave()) {
    event.target.value = current.id;
    return;
  }
  const record = records.find((r) => r.id === event.target.value);
  if (record) {
    current = structuredClone(record);
    display();
  }
});
$("#episode-number").addEventListener("input", (event) => {
  current.draft.number = Number(event.target.value);
  markDirty();
  updatePreviousRankingButton();
});
$("#episode-title").addEventListener("input", (event) => {
  current.draft.title = event.target.value;
  markDirty();
});
$("#episode-summary").addEventListener("input", (event) => {
  current.draft.summary = event.target.value;
  markDirty();
});
$("#add-question").addEventListener("click", () => {
  current.draft.questions.push({ question: "", answer: "" });
  markDirty();
  renderQuestions();
  $("#question-editor .edit-item:last-child input").focus();
});
const playerNames = el("datalist");
playerNames.id = "season-player-names";
players.forEach((player) => {
  const option = el("option");
  option.value = player.name;
  playerNames.append(option);
});
document.body.append(playerNames);
$("#add-roster").addEventListener("click", () => {
  const missing = freshRanking().filter(
    (player) =>
      !current.draft.people.some(
        (person) =>
          (findPlayer(person.name)?.id || person.name.toLowerCase()) ===
          findPlayer(player.name).id,
      ),
  );
  if (!missing.length) {
    notice("Les 19 autres joueurs sont déjà dans ce classement.");
    return;
  }
  current.draft.people.push(...missing);
  markDirty();
  renderPeople();
  notice(
    `${missing.length} joueur(s) ajouté(s), à classer. Les commentaires existants sont conservés.`,
  );
});
$("#add-person").addEventListener("click", () => {
  current.draft.people.push({ name: "", tier: "U", reason: "" });
  markDirty();
  renderPeople();
  const cards = [...$("#people-editor").children];
  cards
    .find((card) => !card.querySelector("input").value)
    ?.querySelector("input")
    .focus();
});
$("#episode-form").addEventListener("submit", (event) => {
  event.preventDefault();
  save("draft");
});
$("#episode-images").addEventListener("change", (event) =>
  uploadImages([...event.target.files]),
);
$("#publish-button").addEventListener("click", () => save("publish"));
$("#unpublish-button").addEventListener("click", () => save("unpublish"));
$("#preview-button").addEventListener("click", () => {
  renderEpisode($("#preview-content"), current.draft);
  $("#preview").hidden = false;
  $("#preview").scrollIntoView({
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
  });
});
$("#logout").addEventListener("click", async () => {
  if (!canLeave()) return;
  try {
    await request("logout", {});
    dirty = false;
    location.reload();
  } catch (error) {
    notice(error.message, true);
  }
});
window.addEventListener("beforeunload", (event) => {
  if (dirty || busy) {
    event.preventDefault();
    event.returnValue = "";
  }
});
setInterval(keepSessionAlive, 5 * 60 * 1000);
document.addEventListener("visibilitychange", keepSessionAlive);
window.addEventListener("online", keepSessionAlive);
try {
  const session = await request("session");
  csrf = session.csrf;
  if (session.authenticated) await openApp();
  else if (!session.configured)
    notice(
      "Première utilisation : exécute php setup-admin.php dans le dossier du site pour créer ton mot de passe. Recharge ensuite cette page.",
    );
  else {
    $("#login-form").hidden = false;
    notice("Connecte-toi pour retrouver tes épisodes.");
  }
} catch (error) {
  notice(error.message, true);
}
