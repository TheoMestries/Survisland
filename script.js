const quotes = [
  "Je suis investi d'un glorieux destin.",
  "Agenouillez-vous devant moi.",
  "L'art exige une certaine cruauté.",
  "Dans le carnage, j'éclos comme une fleur à l'aube.",
  "Vous avez été faits pour être gouvernés.",
  "Fais confiance à ma rage.",
  "Ils sont les marionnettes. Je tire les ficelles. Et puis ils dansent.",
  "Pour ceux qui suivront.",
  "Demain viendra.",
  "Quand l'un tombe, on continue.",
];

const quoteText = document.getElementById("quoteText");
const newQuoteButton = document.getElementById("newQuoteButton");
const hero = document.querySelector(".hero");
const tiltTargets = document.querySelectorAll(".plan-card, .quote-box, .media-placeholder:not(.hero__media)");
const revealTargets = document.querySelectorAll(
  ".section-heading, .panel, .identity-card, .plan-card, .media-placeholder, .media-caption, .quote-box"
);

function getRandomQuote() {
  const current = quoteText ? quoteText.textContent.replace(/^"|"$/g, "") : "";
  const remainingQuotes = quotes.filter((quote) => quote !== current);
  const pool = remainingQuotes.length ? remainingQuotes : quotes;
  return pool[Math.floor(Math.random() * pool.length)];
}

function updateScrollProgress() {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const progress = maxScroll > 0 ? (window.scrollY / maxScroll) * 100 : 0;
  document.body.style.setProperty("--scroll-progress", progress.toFixed(2));
}

function setupQuoteButton() {
  if (!quoteText || !newQuoteButton) {
    return;
  }

  newQuoteButton.addEventListener("click", () => {
    quoteText.classList.add("is-swapping");

    window.setTimeout(() => {
      quoteText.textContent = `"${getRandomQuote()}"`;
      quoteText.classList.remove("is-swapping");
    }, 180);
  });
}

function setupReveal() {
  if (!revealTargets.length) {
    return;
  }

  revealTargets.forEach((element) => {
    element.classList.add("reveal");
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.16,
      rootMargin: "0px 0px -8% 0px"
    }
  );

  revealTargets.forEach((element) => {
    observer.observe(element);
  });
}

function setupHeroParallax() {
  if (!hero || !window.matchMedia("(pointer: fine)").matches) {
    return;
  }

  hero.addEventListener("pointermove", (event) => {
    const rect = hero.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    hero.style.setProperty("--hero-x", x.toFixed(2));
    hero.style.setProperty("--hero-y", y.toFixed(2));
  });

  hero.addEventListener("pointerleave", () => {
    hero.style.setProperty("--hero-x", "50");
    hero.style.setProperty("--hero-y", "50");
  });
}

function setupTilt() {
  if (!tiltTargets.length || !window.matchMedia("(pointer: fine)").matches) {
    return;
  }

  tiltTargets.forEach((element) => {
    element.addEventListener("pointermove", (event) => {
      const rect = element.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      const rotateY = (x - 0.5) * 8;
      const rotateX = (0.5 - y) * 8;

      element.style.setProperty("--tilt-x", `${rotateX.toFixed(2)}deg`);
      element.style.setProperty("--tilt-y", `${rotateY.toFixed(2)}deg`);
    });

    element.addEventListener("pointerleave", () => {
      element.style.setProperty("--tilt-x", "0deg");
      element.style.setProperty("--tilt-y", "0deg");
    });
  });
}

setupQuoteButton();
setupReveal();
setupHeroParallax();
setupTilt();
updateScrollProgress();

window.addEventListener("scroll", updateScrollProgress, { passive: true });
window.addEventListener("resize", updateScrollProgress);
