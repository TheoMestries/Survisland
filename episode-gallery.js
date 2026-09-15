export function imageUrl(id) {
  return `api.php?action=image&id=${encodeURIComponent(id)}`;
}

export function renderGallery(container, images, episodeNumber) {
  if (!images?.length) return;
  const gallery = document.createElement("section");
  gallery.className = "episode-gallery";
  gallery.tabIndex = 0;
  gallery.setAttribute("aria-label", `Images de l’épisode ${episodeNumber}`);
  gallery.setAttribute("aria-roledescription", "carrousel");
  const frame = document.createElement("figure");
  frame.className = "gallery-frame";
  const photo = document.createElement("img");
  photo.className = "gallery-photo";
  photo.decoding = "async";
  const caption = document.createElement("figcaption");
  caption.className = "gallery-caption";
  const error = document.createElement("p");
  error.className = "gallery-error";
  error.textContent = "Image indisponible.";
  error.hidden = true;
  photo.addEventListener("error", () => {
    error.hidden = false;
  });
  photo.addEventListener("load", () => {
    error.hidden = true;
  });
  frame.append(photo, caption, error);
  const controls = document.createElement("div");
  controls.className = "gallery-controls";
  const previous = document.createElement("button");
  previous.type = "button";
  previous.className = "btn btn-secondary btn-small";
  previous.textContent = "←";
  previous.setAttribute("aria-label", "Image précédente");
  const next = document.createElement("button");
  next.type = "button";
  next.className = previous.className;
  next.textContent = "→";
  next.setAttribute("aria-label", "Image suivante");
  const count = document.createElement("span");
  count.className = "gallery-count";
  count.setAttribute("aria-live", "polite");
  count.setAttribute("aria-atomic", "true");
  controls.append(previous, count, next);
  controls.hidden = images.length < 2;
  const thumbnails = document.createElement("div");
  thumbnails.className = "gallery-thumbnails";
  thumbnails.hidden = images.length < 2;
  let index = 0;
  const buttons = images.map((image, i) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gallery-thumbnail";
    button.setAttribute("aria-label", `Voir l’image ${i + 1}`);
    const thumb = document.createElement("img");
    thumb.src = imageUrl(image.id);
    thumb.alt = "";
    thumb.loading = "lazy";
    button.append(thumb);
    button.addEventListener("click", () => show(i));
    thumbnails.append(button);
    return button;
  });
  function show(position) {
    index = (position + images.length) % images.length;
    photo.src = imageUrl(images[index].id);
    photo.alt =
      images[index].caption || `Épisode ${episodeNumber} — Image ${index + 1}`;
    caption.textContent = images[index].caption || "";
    caption.hidden = !caption.textContent;
    error.hidden = true;
    count.textContent = `${index + 1} / ${images.length}`;
    buttons.forEach((button, i) => {
      if (i === index) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    });
  }
  previous.addEventListener("click", () => show(index - 1));
  next.addEventListener("click", () => show(index + 1));
  gallery.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      show(index + (event.key === "ArrowLeft" ? -1 : 1));
    }
  });
  let touch;
  frame.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse")
      touch = { x: event.clientX, y: event.clientY };
  });
  frame.addEventListener("pointercancel", () => {
    touch = null;
  });
  frame.addEventListener("pointerup", (event) => {
    if (!touch) return;
    const dx = event.clientX - touch.x,
      dy = event.clientY - touch.y;
    touch = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy))
      show(index + (dx < 0 ? 1 : -1));
  });
  gallery.append(frame, controls, thumbnails);
  container.append(gallery);
  show(0);
}
