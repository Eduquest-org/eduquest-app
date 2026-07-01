<div align="center">
  <img src="assets/img/logos/eduquest-logo.ico" alt="EduQuest Logo" width="120" />
  <h1>EduQuest Web App</h1>
  <p><strong>Plataforma Inteligente de Preparación Preuniversitaria</strong></p>
</div>

---

**EduQuest** es un entorno de aprendizaje SaaS (Software as a Service) gamificado e impulsado por Inteligencia Artificial. Está diseñado específicamente para la preparación académica de élite enfocada en exámenes de admisión de alta exigencia en Perú (UNI, UNMSM, PUCP). 

Mediante el uso de tecnologías de **Retrieval-Augmented Generation (RAG)** y análisis de datos en tiempo real, EduQuest personaliza el proceso educativo generando rutas de estudio adaptativas, incrementando la retención de los estudiantes mediante mecánicas avanzadas de gamificación.

---

## 🎯 Características Principales

### 👨‍🎓 Experiencia del Estudiante
- **Rutas Inteligentes (Roadmaps):** Grafos interactivos de aprendizaje estructurados dinámicamente según los objetivos del alumno (universidad objetivo, fortalezas, debilidades y métricas de desempeño).
- **Gamificación Avanzada:** Sistema de recompensas en Puntos de Experiencia (XP), rachas de estudio diarias (streaks), retos dinámicos, vitrina de insignias coleccionables y ligas competitivas.
- **Simulacros y Evaluaciones:** Cuestionarios interactivos con validación inmediata, cronómetro, corrección explicada en tiempo real y asignación de puntaje en función de la precisión.
- **Comunidad y Red de Estudio:** Tablón interactivo para interacción entre estudiantes de la misma área, grupos de estudio y foros moderados.

### 🧠 Motor de Inteligencia Artificial (AI Engine)
- **Generación de Temarios (Plan Priorities):** Un LLM evalúa el perfil del estudiante junto a la currícula para asignar niveles de prioridad a cada materia.
- **Recuperación Vectorial (Pinecone):** Búsqueda semántica en un repositorio de recursos educativos estructurados para recomendar videos o documentos específicos por cada tema a tratar.
- **Nodos Estructurados (React Flow):** Mapeo de la currícula en grafos directos para facilitar la progresión secuencial (lecciones, recursos, tests y desafíos finales).

---

## 🛠 Stack Tecnológico

La plataforma fue diseñada con una filosofía de bajo acoplamiento, alta cohesión y rendimiento óptimo en el cliente sin depender de frameworks frontend pesados.

### Frontend
- **Estructura y Estilos:** HTML5 Semántico, Vanilla CSS3 (CSS Modules, Custom Properties nativas, Flexbox/Grid).
- **Lógica de Cliente:** Vanilla JavaScript (ES6+), promesas, asincronía y carga modular de componentes web (`component-loader.js`).
- **Librerías Adicionales:** 
  - Chart.js (Visualización de estadísticas y métricas).

### Backend y Servicios (BaaS)
- **Autenticación y Base de Datos:** [Supabase](https://supabase.com) (PostgreSQL, Row Level Security, Supabase Storage).
- **Procesamiento de IA:** [Groq](https://groq.com) (Modelos Llama-3 de baja latencia para generación rápida de planes).
- **Base de Datos Vectorial:** [Pinecone](https://www.pinecone.io) (Recuperación semántica de enlaces y recursos RAG).
- **Embeddings Locales:** `Xenova/transformers.js` (`all-MiniLM-L6-v2`) para procesamiento en servidor de incrustaciones de texto.
- **Node.js + Express:** API Middleware para gestionar peticiones complejas al LLM y Pinecone, implementando estrategias de caché (LRU) y rate-limiting.

---

## 📂 Arquitectura del Proyecto

El código fuente está estructurado de la siguiente forma:

```text
eduquest/
├── index.html                   # Landing Page (Marketing y Conversión)
├── components/                  # Fragmentos HTML reutilizables
│   ├── navbar.html              # Barra de navegación superior
│   ├── sidebar.html             # Menú lateral para estudiantes
│   └── footer.html              # Pie de página global
├── pages/                       # Vistas principales del sistema
│   ├── auth/                    # Flujos de inicio de sesión y registro
│   ├── public/                  # Vistas estáticas (About, Pricing, Resources)
│   ├── student/                 # Core de la plataforma para alumnos
│   │   ├── dashboard.html       # Vista general y retos diarios
│   │   ├── roadmap.html         # Visualizador de rutas de IA
│   │   ├── quizzes.html         # Centro de simulacros
│   │   ├── profile.html         # Perfil del usuario e insignias
│   │   └── rankings.html        # Tablas de clasificación
│   └── teacher/                 # (Beta) Interfaz para docentes
├── assets/                      # Recursos estáticos y lógica JS
│   ├── css/                     # Sistema de diseño
│   │   ├── global/              # Reset, variables, tipografía base
│   │   ├── components/          # Estilos de botones, cards, modals
│   │   └── pages/               # Estilos encapsulados por vista
│   ├── js/                      # Controladores Vanilla JS
│   │   ├── config/              # Clientes e inicialización (Supabase)
│   │   ├── core/                # Lógica central (Auth, Routers, AI Engine)
│   │   ├── student/             # Controladores de las vistas del alumno
│   │   ├── teacher/             # Controladores del profesorado
│   │   └── utils/               # Formateadores, validadores, cargadores
│   └── img/                     # Imágenes, avatares, logos
└── mock/                        # Archivos JSON con datos semilla/falsos
```

---

## 🚀 Configuración y Despliegue Local

Sigue estas instrucciones para ejecutar EduQuest en un entorno de desarrollo.

### 1. Clonar el Repositorio
```bash
git clone https://github.com/bktmatjv/eduquest-app.git
cd eduquest-app
```

### 2. Configurar Variables de Entorno (Backend)
En caso de que vayas a levantar la API de intermediación de Inteligencia Artificial (carpeta `/backend` en el repositorio principal del backend):

```bash
cd ../backend
npm install
```

Crea un archivo `.env` basándote en un archivo `.env.example`:
```env
PORT=3001
SUPABASE_URL=tu_supabase_url
SUPABASE_SERVICE_KEY=tu_supabase_service_role_key
GROQ_API_KEY=tu_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile
PINECONE_API_KEY=tu_pinecone_api_key
PINECONE_INDEX_HOST=tu_pinecone_host
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

Levanta el servidor Backend:
```bash
node index.js
```

### 3. Configurar y Servir el Frontend
Regresa a la carpeta del proyecto Frontend (`eduquest-app`). Dado que utilizamos módulos ES6 y solicitamos fragmentos HTML (CORS estricto en el navegador web), es **obligatorio** servir el proyecto con un servidor local, en lugar de abrir los archivos `file://` directamente.

Si tienes `Node.js` instalado:
```bash
npx serve -p 3000 .
```

*Otras opciones viables:*
- **Python**: `python -m http.server 3000`
- **VS Code**: Extensión "Live Server"

Accede a `http://localhost:3000` en tu navegador.

---

## 🔒 Seguridad y Privacidad

- **Row Level Security (RLS)**: Activado en todas las tablas críticas de Supabase (perfiles, progreso). Cada estudiante solo puede consultar y alterar su propio progreso.
- **Ocultamiento de Tokens**: Las peticiones de la Inteligencia Artificial y Pinecone se realizan estrictamente desde el backend. El cliente nunca expone la API KEY de Groq o Pinecone.

---

## 📝 Licencia
Este proyecto es un prototipo privado para fines académicos y comerciales dentro del alcance del producto EduQuest. Todo el código fuente está reservado y sujeto a derechos de autor.