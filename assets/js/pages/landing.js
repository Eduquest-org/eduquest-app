// Smooth scroll para navbar y links internos
document.addEventListener("click", (e) => {
  const link = e.target.closest("[data-target]");
  if (!link) return;

  const target = document.querySelector(link.dataset.target);
  if (!target) return;

  e.preventDefault();

  window.scrollTo({
    top: target.offsetTop - 70,
    behavior: "smooth"
  });
});

// Interacción "Cómo funciona"
document.addEventListener("click", (e) => {
  const step = e.target.closest(".hiw-step");
  if (!step) return;

  document.querySelectorAll(".step-circle")
    .forEach(c => c.classList.remove("active"));

  step.querySelector(".step-circle")?.classList.add("active");
});

// Toggle modo competitivo
document.addEventListener("DOMContentLoaded", () => {
  const toggleRow = document.getElementById("comp-toggle");
  const togglePill = document.getElementById("comp-pill");
  const statusText = document.getElementById("comp-status");
  const meRow = document.getElementById("rank-me-row");
  const liveDot = document.getElementById("live-dot-indicator");

  if (!toggleRow) return;

  let compActive = true;

  toggleRow.addEventListener("click", () => {
    compActive = !compActive;

    togglePill.classList.toggle("inactive", !compActive);
    statusText.textContent = compActive
      ? "Activo — registrando actividad de hoy"
      : "Inactivo — modo fantasma activado";

    meRow.style.opacity = compActive ? "1" : "0.3";
    liveDot.style.animation = compActive
      ? "blink 1.8s ease-in-out infinite"
      : "none";
    liveDot.style.opacity = compActive ? "1" : "0.2";
  });
});

// Animación reveal
document.addEventListener("DOMContentLoaded", () => {
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  document.querySelectorAll(".reveal").forEach(el => observer.observe(el));
});

// Cargar posts reales de la comunidad en la landing
document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("landing-community-posts");
  if (!container) return;

  try {
    const response = await fetch("./mock/forum-posts.json");
    const posts = await response.json();

    container.innerHTML = "";

    posts.slice(0, 3).forEach(post => {
      const card = document.createElement("div");
      card.className = "thread-card reveal visible";

      card.innerHTML = `
        <div class="thread-user">
          <div class="thread-av" style="display:flex;align-items:center;justify-content:center;font-size:18px;">
            ${post.avatar}
          </div>
          <div>
            <div class="thread-name">${post.author}</div>
            <div class="thread-time">${post.time} · ${post.comments} respuestas</div>
          </div>
        </div>

        <p class="body" style="font-size:14px;line-height:1.55;margin:12px 0;color:#555;">
          ${post.content}
        </p>

        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
          <span class="thread-tag">${post.tag}</span>
          <span class="thread-tag">🔼 ${post.upvotes} útiles</span>
        </div>
      `;

      container.appendChild(card);
    });
  } catch (error) {
    console.error("No se pudieron cargar los posts de comunidad:", error);
  }
});