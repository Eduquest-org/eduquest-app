# EduQuest Web App — Plataforma de Clasificación Académica

Prototipo de alta fidelidad para **EduQuest**, un SaaS educativo gamificado e impulsado por Inteligencia Artificial enfocado en la preparación preuniversitaria de élite para exámenes de admisión en el Perú (UNI, UNMSM, PUCP).

---

## Arquitectura de Archivos y Componentes

El proyecto sigue una estructura limpia y desacoplada para mitigar la duplicidad de código y asegurar la inyección síncrona de componentes compartidos:

```text
eduquest/
├── index.html                  # Landing Page Principal de la Startup
├── mock/
│   └── seed_data.json          # Semillero inicial de usuarios de prueba
├── core/
│   └── auth.js                 # Controlador de autenticación y motor SPA local
├── assets/
│   ├── css/
│   │   ├── global/
│   │   │   ├── reset.css       # Normalización de estilos de renderizado
│   │   │   └── variables.css   # Paleta cromática corporativa y utilitarios
│   │   └── pages/
│   │       ├── login.css       # Armazón de pasarela de accesos
│   │       ├── roadmap.css     # Estilos tridimensionales del mapa sinuoso
│   │       └── community.css   # Grilla y widgets flotantes del tablón
│   └── js/
│       ├── student/
│       │   ├── roadmap.js      # Inyector gráfico de senderos Candy Crush
│       │   └── community.js    # Controlador dinámico de filtros por cursos
│       └── utils/
│           └── component-loader.js # Cargador modular asíncrono (Topbar/Sidebar)
└── pages/
    ├── auth/
    │   └── login.html          # Pasarela SPA unificada de Login y Registro
    └── student/
        ├── dashboard.html      # Feed social y retención de procrastinación
        ├── roadmap.html        # Vista del Hub de Rutas Inteligentes
        ├── community-circles.html # Tablón interactivo de círculos de estudio
        └── rankings.html       # Tabla de posiciones de la Liga Élite