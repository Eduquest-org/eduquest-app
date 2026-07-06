// ==========================================================================
// assets/js/teacher/teacher-ui.js
// HELPERS DE INTERFAZ DEL PANEL DOCENTE (modales, toasts, portapapeles)
// ==========================================================================
// Sin dependencias externas. Expuesto como window.TeacherUI.
// ==========================================================================

(function () {
  "use strict";

  let activeOverlay = null;
  let lastFocused = null;

  function onKeydown(e) {
    if (e.key === "Escape" && activeOverlay) {
      TeacherUI.closeModal(activeOverlay.id);
    }
  }

  const TeacherUI = {
    /**
     * Abre un modal por id. Enfoca el primer campo, cierra con ESC y con
     * click en el backdrop.
     * @param {string} overlayId  id del elemento `.tmodal-overlay`
     */
    openModal(overlayId) {
      const overlay = document.getElementById(overlayId);
      if (!overlay) return;

      lastFocused = document.activeElement;
      overlay.classList.add("open");
      overlay.setAttribute("aria-hidden", "false");
      activeOverlay = overlay;
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", onKeydown);

      // Enfocar el primer control disponible.
      const focusable = overlay.querySelector(
        "input, select, textarea, button:not(.tmodal-close)"
      );
      if (focusable) setTimeout(() => focusable.focus(), 60);
    },

    /** Cierra un modal por id. */
    closeModal(overlayId) {
      const overlay = document.getElementById(overlayId);
      if (!overlay) return;
      overlay.classList.remove("open");
      overlay.setAttribute("aria-hidden", "true");
      if (activeOverlay === overlay) activeOverlay = null;
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeydown);
      if (lastFocused && typeof lastFocused.focus === "function") {
        lastFocused.focus();
      }
    },

    /**
     * Conecta el cierre por backdrop y por elementos con [data-close-modal].
     * Llamar una vez por overlay tras inyectarlo en el DOM.
     */
    wireModal(overlayId) {
      const overlay = document.getElementById(overlayId);
      if (!overlay || overlay.dataset.wired) return;
      overlay.dataset.wired = "1";

      overlay.addEventListener("mousedown", (e) => {
        if (e.target === overlay) this.closeModal(overlayId);
      });
      overlay.querySelectorAll("[data-close-modal]").forEach((el) => {
        el.addEventListener("click", () => this.closeModal(overlayId));
      });
    },

    /** Muestra un toast reutilizando el global de app.js si existe. */
    toast(message, type = "success") {
      if (window.app && typeof window.app.showToast === "function") {
        window.app.showToast(message, type);
      } else {
        console.log(`[toast:${type}] ${message}`);
      }
    },

    /** Copia texto al portapapeles con fallback para contextos no seguros. */
    async copy(text) {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch (_) {
        /* fallback abajo */
      }
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        return true;
      } catch (_) {
        return false;
      }
    },

    /**
     * Pinta los errores de validación en un formulario.
     * @param {HTMLElement} root  contenedor del formulario
     * @param {Object} errors     mapa { fieldName: mensaje }
     */
    showFieldErrors(root, errors) {
      root.querySelectorAll(".field.invalid").forEach((f) => f.classList.remove("invalid"));
      Object.entries(errors || {}).forEach(([name, message]) => {
        const input = root.querySelector(`[name="${name}"]`);
        const field = input ? input.closest(".field") : root.querySelector(`[data-field="${name}"]`);
        if (!field) return;
        field.classList.add("invalid");
        const errEl = field.querySelector(".field-error");
        if (errEl) errEl.textContent = message;
      });
    },

    /** Limpia el estado de error de un formulario. */
    clearFieldErrors(root) {
      root.querySelectorAll(".field.invalid").forEach((f) => f.classList.remove("invalid"));
    },
  };

  window.TeacherUI = TeacherUI;
})();
