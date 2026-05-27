class GlobalLoader {

  static messages = [
    "Cada quiz es una oportunidad de detectar errores antes del examen.",
    "La consistencia supera a las sesiones maratónicas de estudio.",
    "No memorices: entiende el patrón detrás del problema.",
    "Aprender un poco cada día vence al estrés de última hora.",
    "Tu progreso no siempre se nota hoy, pero se acumula.",
    "Resolver preguntas difíciles es parte del entrenamiento.",
    "La práctica frecuente fortalece la memoria a largo plazo.",
    "Dominar un tema empieza por aceptar no entenderlo aún.",
    "Pequeñas mejoras diarias generan grandes resultados.",
    "Consejo: revisa tus errores, ahí suele estar el mayor aprendizaje."
  ];

  static init() {

    if (document.getElementById("global-loader")) return;

    const message =
      this.messages[
        Math.floor(Math.random() * this.messages.length)
      ];

    document.body.insertAdjacentHTML(
      "afterbegin",
      `
      <div id="global-loader">

        <div class="loader-card">

          <div class="loader-logo-wrapper">

            <div class="loader-ring">
              <div class="loader-orb"></div>
            </div>

            <div class="loader-logo">
              EQ
            </div>

          </div>

          <h1 class="loader-title">
            Eduquest
          </h1>

          <p class="loader-subtitle">
            Preparando tu experiencia de aprendizaje
          </p>

          <div id="loader-message"
               class="loader-message">
            ${message}
          </div>

          <div class="loader-progress">
            <div class="loader-progress-bar"></div>
          </div>

        </div>

      </div>
      `
    );
  }

  static hide(delay = 1000) {

    setTimeout(() => {

      const loader =
        document.getElementById(
          "global-loader"
        );

      if (!loader) return;

      loader.style.opacity = "0";

      setTimeout(() => {
        loader.remove();
      }, 500);

    }, delay);
  }
}

GlobalLoader.init();