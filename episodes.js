import { el, renderEpisode } from "./episode-view.js";
import { renderRoster } from "./roster.js";
renderRoster(document.querySelector("#season-roster"));
const status = document.querySelector("#viewer-status");
try {
  const response = await fetch("api.php?action=public", { cache: "no-store" });
  if (!response.ok) throw new Error();
  const { episodes } = await response.json();
  if (!episodes.length) {
    status.className = "empty-state";
    status.textContent =
      "La ruche se prépare. Le premier épisode apparaîtra ici dès sa publication.";
  } else {
    status.hidden = true;
    document.querySelector("#journal-layout").hidden = false;
    const list = document.querySelector("#episode-list");
    const links = new Map();
    episodes.sort((a, b) => b.number - a.number);
    episodes.forEach((episode) => {
      const item = el("li");
      const link = el("a", "episode-link");
      link.href = `#${new URLSearchParams({ episode: episode.id })}`;
      link.append(
        el("span", "episode-link-number", `Épisode ${episode.number}`),
        el("span", "episode-link-title", episode.title),
      );
      links.set(episode.id, link);
      item.append(link);
      list.append(item);
    });
    function show() {
      const requested = new URLSearchParams(location.hash.slice(1)).get(
        "episode",
      );
      const episode = episodes.find((e) => e.id === requested) || episodes[0];
      links.forEach((link, id) => {
        if (id === episode.id) link.setAttribute("aria-current", "true");
        else link.removeAttribute("aria-current");
      });
      renderEpisode(document.querySelector("#episode-view"), episode);
      renderRoster(document.querySelector("#season-roster"), episode);
    }
    window.addEventListener("hashchange", show);
    show();
  }
} catch {
  status.className = "empty-state";
  status.textContent =
    "Le confessional est momentanément indisponible. Réessaie dans quelques instants.";
}
