<div align="center">
  <img src="assets/img/logos/eduquest-logo.ico" alt="EduQuest Logo" width="120" />
  <h1>EduQuest Web App</h1>
  <p><strong>Plataforma Inteligente de Preparación Preuniversitaria</strong></p>
</div>

---

**EduQuest** es un entorno de aprendizaje SaaS (Software as a Service) gamificado e impulsado por Inteligencia Artificial. Está diseñado específicamente para la preparación académica de élite enfocada en exámenes de admisión de alta exigencia en Perú, tales como la Universidad Nacional de Ingeniería (UNI), Universidad Nacional Mayor de San Marcos (UNMSM) y la Pontificia Universidad Católica del Perú (PUCP).

La premisa central de EduQuest es democratizar el acceso a una tutoría de altísima calidad mediante el uso de tecnologías de **Retrieval-Augmented Generation (RAG)** y análisis de datos en tiempo real. En lugar de ofrecer un currículo estático y lineal que frustra a los estudiantes, EduQuest evalúa las capacidades iniciales del alumno, identifica brechas de conocimiento a través de un diagnóstico impulsado por IA, y personaliza el proceso educativo generando rutas de estudio adaptativas. Este sistema dinámico, sumado a mecánicas avanzadas de gamificación, incrementa dramáticamente la retención, la motivación y, en última instancia, el éxito en los exámenes de admisión.

---

## Historial de Versiones (Changelog)

A continuación se detallan las integraciones principales (Pull Requests) que han marcado el paso desde el entorno de desarrollo (`develop`) hacia la versión estable (`main`):

| Versión | PR / Rama | Descripción de los Cambios |
| :--- | :--- | :--- |
| **v1.4.0** | `feature/learning-routes` | **Bloqueo Freemium y Ruteo Dinámico**: Implementación de modelo Freemium para rutas de aprendizaje, protegiendo nodos de IA avanzados, reduciendo consumo de tokens (Groq) y añadiendo navegación profunda por URLs. |
| **v1.3.5** | `PR #38` / `#39` | **Integración Docente con Supabase**: Consolidación del panel de control del profesor, manejo de errores asíncronos en la carga de la hoja de ruta y resolución de dependencias de estado. |
| **v1.3.0** | `PR #36` | **Módulo de Quizzes Docentes**: Capacidad para que los profesores generen, administren y califiquen cuestionarios (quizzes) de manera remota e interactiva. |
| **v1.2.0** | `PR #34` | **Rankings e Integración P2P**: Carga dinámica del perfil, insignias, edición de bio, interfaz de 'Mis Clases', feed social comunitario y leaderboards basados en XP. |
| **v1.1.0** | `PR #15` | **RAG Optimization**: Remasterización del `ai-engine`, migración hacia modelos más potentes (Llama 3 70B vía Groq) y mejoras en el motor de inferencia. |
| **v1.0.5** | `PR #7` | **Generación de Rutas IA & RAG**: *Core Milestone.* Primera implementación real de la arquitectura RAG, algoritmos de generación secuencial de rutas con *Cascade Prompting* y consultas a la base de datos vectorial Pinecone. |
| **v1.0.0** | `develop` -> `main` | **Lanzamiento Base**: Arquitectura inicial de Vanilla JS, React Flow customizado (grafos SVG), motor de autenticación RLS con Supabase y base vectorial Pinecone. |

---

## Características Principales

### Experiencia del Estudiante
- **Rutas Inteligentes (Roadmaps):** Grafos interactivos de aprendizaje estructurados dinámicamente según los objetivos del alumno (universidad objetivo, fortalezas, debilidades y métricas de desempeño). Se hace uso de algoritmos de ordenamiento topológico (Topological Sort) para garantizar que los pre-requisitos académicos se cumplan antes de avanzar de nivel.
- **Gamificación Avanzada:** Sistema de recompensas en Puntos de Experiencia (XP), rachas de estudio diarias (streaks), retos dinámicos (misiones del día), vitrina de insignias coleccionables y ligas competitivas.
- **Simulacros y Evaluaciones:** Cuestionarios interactivos con validación inmediata, cronómetro, corrección explicada en tiempo real y asignación de puntaje en función de la precisión y velocidad del usuario.
- **Comunidad y Red de Estudio:** Tablón interactivo (Feed) para la interacción entre estudiantes de la misma área, grupos de estudio, foros moderados y resolución de dudas Peer-to-Peer.

### Motor de Inteligencia Artificial (AI Engine)
El subsistema de Inteligencia Artificial (`ai-engine.js`) es el diferencial tecnológico del proyecto. Se apoya en una arquitectura de **Retrieval-Augmented Generation (RAG)** altamente optimizada para latencias bajas, estructurada algorítmicamente de la siguiente manera:

1. **Generación de Prioridades (Cascade Prompting Phase 1):** 
   - Cuando el usuario finaliza su registro, el motor evalúa su *Diagnóstico Inicial* para identificar lagunas de conocimiento. 
   - Empleando una técnica algorítmica de **Cascade Prompting**, el backend formatea estos resultados junto con el catálogo general de cursos y los *Pesos de Admisión* matemáticos específicos de la universidad objetivo elegida. 
   - Se realiza una consulta inicial estructurada al LLM (Llama-3 vía API de Groq) para inferir un orden de prioridad de materias, reduciendo la ventana de contexto necesaria en subsecuentes pasos.

2. **Base de Datos Vectorial e Incrustaciones Semánticas (RAG):** 
   - En segundo plano (procesamiento asíncrono), los recursos educativos estáticos (videos, PDF, lecturas) son vectorizados mediante modelos locales (`all-MiniLM-L6-v2` vía `Xenova/transformers.js`), convirtiéndolos en representaciones de alta densidad semántica.
   - Estos vectores bidireccionales residen en un índice persistente en **Pinecone**. 
   - Al iterar sobre el mapa de cada curso, el backend (`/api/generate-route`) computa un vector (embedding) con el prompt dinámico de las debilidades del alumno en tiempo de ejecución.
   - Se realiza una **Búsqueda Semántica K-NN** (Vecinos Más Cercanos) en Pinecone para recuperar única y exclusivamente los recursos educacionales más pertinentes, insertándolos como contexto (Augmented Context) en un prompt final de baja tokenización.

3. **Estructuras Topológicas y Fallbacks Híbridos:** 
   - Con el contexto enriquecido, Groq procesa los datos y los devuelve estrictamente en formato JSON válido. El cliente extrae esto y construye un **Grafo Dirigido Acíclico (DAG)**, empleando algoritmos de Ordenamiento Topológico (Topological Sort) para garantizar secuencias lógicas de aprendizaje sin ciclos dependientes.
   - Para maximizar la escalabilidad a nivel SaaS, el sistema incluye un esquema **Híbrido Freemium**: Los primeros 3 cursos de la cola de procesamiento gozan del costoso ciclo completo de RAG+LLM. Los cursos subsiguientes activan un *Fallback*, generándose nativamente como nodos bloqueados que no interrogan a la API, optimizando drásticamente los gastos operativos para cuentas gratuitas.

---

## Módulos del Sistema

EduQuest está compuesto por diversos módulos altamente cohesivos, diseñados para abordar todas las facetas de la preparación preuniversitaria:

### 1. Panel de Control (Dashboard)
El centro de operaciones del estudiante. Incluye widgets interactivos de rendimiento (gráficos circulares de aciertos/errores), un sistema de misiones diarias (Daily Challenges) orientadas a mantener la retención, y un visualizador del Top 3 dinámico de estudiantes de la misma aula basado en Puntos de Experiencia (XP).

### 2. Motor de Rutas IA (Roadmap)
El núcleo de personalización. Utilizando un modelo Freemium, genera mallas curriculares mediante grafos SVG interactivos y renderizados nativamente (sin librerías pesadas). Emplea un backend RAG (Pinecone + Groq) para los temas iniciales y un sistema de bloqueos/paywalls visual (modal animado) para el contenido avanzado. Incluye un ruteo dinámico por URL (History API) para facilitar la navegación profunda y el acceso directo a mapas específicos.

### 3. Centro de Evaluaciones (Quizzes y Exámenes)
Un motor de evaluación estructurada. Permite a los estudiantes realizar simulacros generales, quices de repaso por tema y desafíos finales. Registra respuestas correctas e incorrectas en tiempo real, calcula el puntaje y actualiza inmediatamente las estadísticas del perfil del usuario en la base de datos centralizada.

### 4. Comunidad y Círculos (Community Circles)
Una red de apoyo Peer-to-Peer (P2P). Los estudiantes pueden participar en foros de discusión segmentados por área de estudio o curso. Permite publicar dudas, resolver preguntas de compañeros mediante comentarios anidados y fomentar el aprendizaje colaborativo.

### 5. Aulas Virtuales (Classrooms)
Entornos de estudio organizados. Permite agrupar a los estudiantes en clases específicas bajo la tutela de un docente. La plataforma consolida los datos de pertenencia a un aula para generar métricas relativas (como los leaderboards) enfocadas estrictamente en el grupo de estudio correspondiente, incentivando la sana competencia.

### 6. Sistema de Perfiles y Analítica (Profile & Analytics)
Rastrea exhaustivamente el progreso a nivel granular (temas completados, niveles superados, XP ganada). Proporciona visualizaciones a través de gráficos integrados del rendimiento del usuario en distintas competencias a lo largo del tiempo, permitiendo a tutores y padres monitorear el avance.

---

## Stack Tecnológico

La plataforma fue diseñada con una filosofía de **bajo acoplamiento, alta cohesión y rendimiento óptimo** en el cliente sin depender de frameworks frontend pesados. Todo el motor visual está construido de cero para maximizar la velocidad de carga.

### Frontend
- **Estructura y Estilos:** HTML5 Semántico, Vanilla CSS3 (CSS Modules, Custom Properties nativas, Flexbox/Grid para layouts responsivos).
- **Lógica de Cliente:** Vanilla JavaScript (ES6+), promesas, asincronía y carga modular de componentes web (`component-loader.js`). Se hace uso exhaustivo del `localStorage` para caché del estado de la interfaz de la IA.
- **Librerías Adicionales:** Chart.js (Visualización de estadísticas y métricas complejas en el dashboard y el perfil).

### Backend y Servicios (BaaS)
- **Autenticación y Base de Datos:** [Supabase](https://supabase.com) (PostgreSQL, Row Level Security, Supabase Storage). Maneja la sesión persistente y el esquema relacional complejo de aulas, progreso y cursos.
- **Procesamiento de IA:** [Groq](https://groq.com) (Modelos Llama-3 de baja latencia para generación rápida de planes y parseo de JSONs estructurados).
- **Base de Datos Vectorial:** [Pinecone](https://www.pinecone.io) (Recuperación semántica de enlaces y recursos RAG basados en la consulta de debilidades y fortalezas).
- **Embeddings Locales:** `Xenova/transformers.js` (`all-MiniLM-L6-v2`) para el procesamiento en el servidor de incrustaciones de texto sin depender de APIs de terceros (ahorro de costos).
- **Node.js + Express:** API Middleware para gestionar peticiones complejas al LLM y Pinecone, implementando estrategias de caché y limitación de tasa (rate-limiting) para proteger la capa gratuita de la aplicación.

---

## Arquitectura del Proyecto

El código fuente sigue un patrón estructural modular, separando responsabilidades por vistas y roles (estudiante vs. profesor):

```text
eduquest/
├── index.html                   # Landing Page (Marketing y Conversión)
├── components/                  # Fragmentos HTML reutilizables (inyectados por JS)
│   ├── navbar.html              # Barra de navegación superior
│   ├── sidebar.html             # Menú lateral para estudiantes y profesores
│   └── footer.html              # Pie de página global
├── pages/                       # Vistas principales del sistema
│   ├── auth/                    # Flujos de inicio de sesión y registro seguros
│   ├── public/                  # Vistas estáticas (Acerca de, Precios, Recursos)
│   ├── student/                 # Core de la plataforma para alumnos
│   │   ├── dashboard.html       # Vista general y retos diarios
│   │   ├── roadmap.html         # Visualizador de rutas de IA (SVG Canvas)
│   │   ├── quizzes.html         # Centro de simulacros
│   │   ├── profile.html         # Perfil del usuario e insignias
│   │   ├── classrooms.html      # Aulas y grupos de estudio colaborativos
│   │   ├── community-circles.html # Foros de discusión P2P y publicaciones
│   │   └── rankings.html        # Tablas de clasificación dinámica
│   └── teacher/                 # Interfaz administrativa para docentes
├── assets/                      # Recursos estáticos y lógica JS
│   ├── css/                     # Sistema de diseño escalable
│   │   ├── global/              # Reset, variables (CSS tokens), tipografía base
│   │   ├── components/          # Estilos de botones, cards, modals (UI Kit)
│   │   └── pages/               # Estilos encapsulados por vista específica
│   ├── js/                      # Controladores Vanilla JS (Patrón MVC simple)
│   │   ├── config/              # Clientes e inicialización (Supabase Auth)
│   │   ├── core/                # Lógica central (Auth Manager, AI Engine)
│   │   ├── student/             # Controladores de las vistas del alumno
│   │   ├── teacher/             # Controladores de los reportes del profesorado
│   │   └── utils/               # Formateadores, validadores, utilitarios de caché
│   └── img/                     # Banco de imágenes, avatares, logotipos vectoriales
└── mock/                        # Archivos JSON con datos semilla/falsos para testing
```

---

## Configuración y Despliegue Local

Sigue estas instrucciones paso a paso para levantar una instancia de EduQuest en un entorno de desarrollo local.

### 1. Clonar el Repositorio
Obtén el código fuente utilizando git:
```bash
git clone https://github.com/bktmatjv/eduquest-app.git
cd eduquest-app
```

### 2. Configurar Variables de Entorno (Backend)
En caso de que vayas a levantar la API de intermediación de Inteligencia Artificial (ubicada en la carpeta `/backend` en un repositorio separado o adjunto):

```bash
cd ../backend
npm install
```

Crea un archivo `.env` en la raíz del backend basándote en el archivo de ejemplo (`.env.example`):
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

Levanta el servidor Backend (Asegúrate de que no haya conflictos de puerto):
```bash
node index.js
```

### 3. Configurar y Servir el Frontend
Regresa a la carpeta del proyecto Frontend (`eduquest-app`). Dado que utilizamos módulos ES6 de forma estricta (usando `import`/`export`) y solicitamos fragmentos HTML a través de peticiones `fetch` (CORS estricto en los navegadores modernos), es **completamente obligatorio** servir el proyecto con un servidor local (`http://localhost`), en lugar de abrir los archivos con el protocolo `file://` dando doble clic en el explorador.

Si tienes `Node.js` instalado, la forma más rápida es usar `serve`:
```bash
npx serve -p 3000 .
```

*Otras opciones viables para servir el frontend:*
- **Python 3**: `python -m http.server 3000`
- **VS Code**: Instala y usa la extensión "Live Server" y haz clic en "Go Live".

Accede a `http://localhost:3000` en tu navegador web de preferencia (se recomienda Chrome o Firefox).

---

## Seguridad y Privacidad

El proyecto está diseñado bajo el principio del menor privilegio y seguridad por diseño:

- **Row Level Security (RLS)**: Las políticas de seguridad a nivel de fila están activadas de manera estricta en todas las tablas críticas de Supabase (perfiles de usuarios, progreso, posteos en foros). Cada estudiante solo puede consultar, modificar o eliminar su propio progreso y datos personales.
- **Ocultamiento de Tokens de API**: Todas las peticiones complejas relacionadas con la Inteligencia Artificial (Groq) y las consultas a la base de datos vectorial (Pinecone) se realizan estrictamente desde la capa del servidor backend (Node.js). El cliente en el navegador (Frontend) nunca expone la `API_KEY` de Groq o Pinecone, mitigando así el riesgo de abuso y secuestro de tokens.

---

## Licencia
Este proyecto es propiedad intelectual exclusiva. Funciona como un prototipo privado desarrollado para fines académicos y de viabilidad comercial dentro del alcance del producto tecnológico "EduQuest". Todo el código fuente, la lógica del modelo IA, los diseños de interfaz gráfica y la arquitectura relacional de base de datos están estrictamente reservados y sujetos a las leyes vigentes de derechos de autor.