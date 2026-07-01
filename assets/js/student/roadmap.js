/**
 * @fileoverview Controlador de la interfaz gráfica del Mapa de Aprendizaje (Roadmap).
 * Responsable de orquestar el renderizado dinámico de la ruta generada por la IA,
 * dibujar el grafo SVG interactivo de niveles y manejar la navegación a los recursos.
 */

import { supabase } from '../config/supabase.js';

/** Secuencia de inicialización principal */
async function initRoadmap() {
    // Sincronizar el estado de sesión antes de renderizar la interfaz
    if (window.CurrentUserService) {
        await CurrentUserService.init();
    }
    
    buildStudentProfileBanner();
    buildCourseSelectionGrid();

    setTimeout(() => {
        const preloader = document.getElementById("app-preloader");
        if (preloader) preloader.classList.add("fade-out-loader");
    }, 350);
}

if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", initRoadmap);
} else {
    initRoadmap();
}

function buildStudentProfileBanner() {
    const bannerContainer = document.getElementById("student-profile-summary");
    if (!bannerContainer) return;

    bannerContainer.innerHTML = `
        <div class="profile-express-left">
            <div class="profile-express-avatar" data-user-avatar></div>
            <div class="profile-express-welcome">
                <h3>¡Hola, <span data-user-firstname></span>!</h3>
                <p>Meta: <span data-user-target></span> • <span data-user-career></span></p>
            </div>
        </div>
        <div class="profile-express-stats">
            <div class="express-stat-item">
                <span class="express-stat-val" style="color: var(--green);" data-user-xp></span>
                <span class="express-stat-label">Progreso Total</span>
            </div>
            <div class="express-stat-item">
                <span class="express-stat-val" style="color: var(--amber);">🔥 <span data-user-streak></span></span>
                <span class="express-stat-label">Racha Activa</span>
            </div>
            <div class="express-stat-item">
                <span class="express-stat-val" style="color: var(--indigo);" data-user-ranking></span>
                <span class="express-stat-label">Competencia</span>
            </div>
        </div>
    `;

    if (window.UserBindingManager) UserBindingManager.bindAll();
}

async function fetchDynamicRoadmap() {
    const { data: { session } } = await supabase.auth.getSession();

    // Recuperar el registro de tópicos completados desde la base de datos
    let completedTopics = [];
    if (session) {
        const { data: progressData } = await supabase
            .from('user_topic_progress')
            .select('topic_id')
            .eq('user_id', session.user.id)
            .eq('status', 'completed');
            
        if (progressData) {
            completedTopics = progressData.map(p => p.topic_id);
        }
    }

    // Priorizar el renderizado de la ruta personalizada si se encuentra disponible
    if (window.CurrentUserService) {
        const userProfile = CurrentUserService.getProfile();
        let aiRoutes = userProfile?.ai_roadmap || [];
        
        // Manejar deserialización por compatibilidad de tipos
        if (typeof aiRoutes === 'string') {
            try { aiRoutes = JSON.parse(aiRoutes); } catch(e) { aiRoutes = []; }
        }

        if (aiRoutes && aiRoutes.length > 0) {
            // Recalcular métricas de progreso utilizando tópicos completados reales
            return aiRoutes.map(route => {
                const safeNodes = route.nodes || [];
                const completedLevels = safeNodes.filter(n => completedTopics.includes(n.id)).length;
                const totalLevels = safeNodes.length;
                const progressPct = totalLevels > 0 ? Math.round((completedLevels / totalLevels) * 100) : 0;

                return {
                    ...route,
                    completedLevels,
                    progressPct,
                    xpEarned: completedLevels * 50,
                    nodes: safeNodes.map(n => {
                        const title = n.data ? n.data.title : n.title;
                        if (completedTopics.includes(n.id)) {
                            return { ...n, title, status: 'completed' };
                        }
                        // Configurar el estado de niveles pendientes a desbloqueados por defecto
                        return { ...n, title, status: 'unlocked' };
                    })
                };
            });
        }
    }

    // Emplear catálogo genérico en caso de no existir ruta personalizada
    const [coursesRes, topicsRes] = await Promise.all([
        supabase.from('courses').select('id, name, icon, color'),
        supabase.from('topics').select('id, name, course_id')
    ]);
    const courses = coursesRes.data || [];
    const topics = (topicsRes.data || []).map(t => ({ id: t.id, name: t.name, courseId: t.course_id }));

    let userTarget = "UNI";
    if (window.CurrentUserService) {
        userTarget = CurrentUserService.getStat('target') || "UNI";
    }

    return courses.map(course => {
        const courseTopics = topics.filter(t => t.courseId === course.id);
        const completedLevels = courseTopics.filter(t => completedTopics.includes(t.id)).length;
        const total = courseTopics.length;
        const progressPct = total > 0 ? Math.round((completedLevels / total) * 100) : 0;

        return {
            id: course.id,
            name: course.name,
            icon: course.icon,
            color: course.color,
            meta: `Meta: ${userTarget}`,
            progressPct: progressPct,
            completedLevels: completedLevels,
            totalLevels: total,
            xpEarned: completedLevels * 50,
            nodes: courseTopics.map((t, idx) => {
                if (completedTopics.includes(t.id)) {
                    return { id: t.id, title: t.name, status: 'completed' };
                }
                // Configurar el estado de niveles pendientes a desbloqueados por defecto
                return { id: t.id, title: t.name, status: 'unlocked' };
            })
        };
    });
}

async function buildCourseSelectionGrid() {
    const grid = document.getElementById("courses-grid");
    if (!grid) return;

    const urlParams = new URLSearchParams(window.location.search);
    
    // Invocar la generación automática al detectar diagnóstico previo sin ruta
    const { data: { session } } = await supabase.auth.getSession();
    let hasValidRoadmap = false;
    let hasDiagnostic = false;
    
    if (window.CurrentUserService) {
        const user = CurrentUserService.getProfile();
        hasDiagnostic = !!(user && user.diagnostic_results);
        if (user && user.ai_roadmap) {
            hasValidRoadmap = Array.isArray(user.ai_roadmap) && user.ai_roadmap.length > 0;
            if (hasValidRoadmap && user.ai_roadmap[0].id === 'course_fallback') hasValidRoadmap = false;
        }
    }

    const isPhase1Active = localStorage.getItem('aiPhase1') === 'true';
    const isPhase2Active = (localStorage.getItem('aiQueue') || '[]') !== '[]';

    if (!isPhase1Active && !isPhase2Active) {
        if (urlParams.get('generate') === 'true' || (hasDiagnostic && !hasValidRoadmap)) {
            // Persistir parámetro de generación en almacenamiento local
            localStorage.setItem('pendingAIGeneration', 'true');
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    if (localStorage.getItem('pendingAIGeneration') === 'true') {
        // Eliminar el indicador de estado transitorio inmediatamente
        localStorage.removeItem('pendingAIGeneration');
        
        const preloader = document.getElementById("app-preloader");
        if (preloader) preloader.classList.add("fade-out-loader");

        // Inicializar generación de ruta delegando la fase extendida a segundo plano
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession && window.CurrentUserService && window.AIEngine) {
            const user = CurrentUserService.getProfile();
            if (user && user.diagnostic_results) {
                // Ejecutar proceso asíncrono manteniendo el hilo principal libre
                (async () => {
                    try {
                        localStorage.setItem('aiPhase1', 'true');
                        // Forzar actualización de interfaz para presentar el indicador de análisis preliminar
                        buildCourseSelectionGrid();
                        
                        await AIEngine.generatePersonalizedRoadmap(user.diagnostic_results);
                        
                        localStorage.removeItem('aiPhase1');
                        // Forzar actualización de interfaz para presentar el indicador de procesamiento asíncrono
                        buildCourseSelectionGrid();
                    } catch (e) {
                        console.error("Generación interrumpida o fallida:", e);
                        localStorage.removeItem('aiPhase1');
                        buildCourseSelectionGrid();
                    }
                })();
                return; // Interrumpir flujo sincrónico delegando renderizado a la subrutina asíncrona
            }
        }
    }

    grid.innerHTML = "";

    const isPhase1 = localStorage.getItem('aiPhase1') === 'true';
    const aiQueueStr = localStorage.getItem('aiQueue');
    const isPhase2 = aiQueueStr && aiQueueStr !== '[]';

    // Renderizar componentes de notificación de estado
    if (isPhase1 || isPhase2) {
        const banner = document.createElement("div");
        banner.style.gridColumn = "1 / -1";
        banner.style.display = "flex";
        banner.style.alignItems = "center";
        banner.style.gap = "16px";
        banner.style.padding = "16px 24px";
        banner.style.background = "rgba(29, 158, 117, 0.1)";
        banner.style.border = "1px solid var(--green)";
        banner.style.borderRadius = "12px";
        banner.style.marginBottom = "24px";
        
        let title = isPhase1 ? "Analizando resultados..." : "Generando rutas personalizadas...";
        let desc = isPhase1 
            ? "El tutor IA está calibrando las prioridades de estudio." 
            : `Quedan ${JSON.parse(aiQueueStr).length} cursos por procesar. Navegación libre habilitada mientras culmina el proceso.`;

        banner.innerHTML = `
            <div class="spinner" style="width: 24px; height: 24px; border: 3px solid rgba(29,158,117,0.3); border-top-color: var(--green); border-radius: 50%; animation: spin 0.85s linear infinite; flex-shrink: 0;"></div>
            <div>
                <h4 style="margin: 0; color: var(--green); font-size: 15px;">${title}</h4>
                <p style="margin: 4px 0 0 0; color: var(--text-light); font-size: 13px;">${desc}</p>
            </div>
            <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
        `;
        grid.appendChild(banner);
    }

    const globalRutasData = await fetchDynamicRoadmap();
    window._cachedRutasData = globalRutasData; 

    globalRutasData.forEach(curso => {
        const card = document.createElement("div");
        card.className = "course-card";
        
        card.innerHTML = `
            <div class="card-top">
                <div class="course-icon-box" style="background: ${curso.color}">${curso.icon}</div>
                <div class="course-meta-title">
                    <h3>${curso.name}</h3>
                    <span>${curso.meta}</span>
                </div>
            </div>
            
            <div class="card-stats">
                <div>Progreso: <span class="stat-highlight">${curso.completedLevels}/${curso.totalLevels} Nivel</span></div>
                <div><span class="stat-highlight" style="color:${curso.color}">+${curso.xpEarned} XP</span></div>
            </div>

            <div class="progress-wrapper">
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${curso.progressPct}%; background: ${curso.color}"></div>
                </div>
                <span class="progress-text-pct" style="color: ${curso.color}">${curso.progressPct}% Completado</span>
            </div>

            <button class="btn-enter-route" onclick="openSpecificCourseMap('${curso.id}')">Explorar Mapa</button>
        `;
        grid.appendChild(card);
    });
}

function openSpecificCourseMap(courseId) {
    const globalRutasData = window._cachedRutasData || [];
    const cursoSeleccionado = globalRutasData.find(c => c.id === courseId);
    if (!cursoSeleccionado) return;

    document.getElementById("current-map-title").innerText = `Mundo: ${cursoSeleccionado.name}`;
    
    const mapContainer = document.getElementById("dynamic-map-container");
    mapContainer.innerHTML = '';

    const nodes = cursoSeleccionado.nodes;
    const nodeCount = nodes.length;

    // Definir constantes geométricas del grafo visual
    const isMobile = window.innerWidth <= 600;
    const svgWidth = isMobile ? 380 : 560;
    const nodeSpacingY = 190;
    const leftX = isMobile ? 80 : 100;
    const midX = isMobile ? 190 : 280;
    const rightX = isMobile ? 300 : 460;
    const svgHeight = 120 + nodeCount * nodeSpacingY;

    // Computar coordenadas nodales iterando en patrón serpenteante
    const positions = nodes.map((_, idx) => {
        let x;
        const cycle = idx % 4;
        if (cycle === 0) x = leftX;
        else if (cycle === 1) x = midX;
        else if (cycle === 2) x = rightX;
        else x = midX; 

        const y = 80 + idx * nodeSpacingY;
        return { x, y };
    });

    // Construir trazado poligonal alternando vectores rectilíneos
    let pathSegments = [];
    let cornerPoints = [];
    for (let i = 0; i < positions.length - 1; i++) {
        const from = positions[i];
        const to = positions[i + 1];
        
        pathSegments.push(`M ${from.x} ${from.y}`);
        
        if (i % 4 === 1 || i % 4 === 3) {
            // Articular segmento en eje transversal seguido del eje longitudinal
            pathSegments.push(`L ${to.x} ${from.y}`);
            pathSegments.push(`L ${to.x} ${to.y}`);
            cornerPoints.push({ x: to.x, y: from.y });
        } else {
            // Articular segmento en eje longitudinal seguido del eje transversal
            pathSegments.push(`L ${from.x} ${to.y}`);
            pathSegments.push(`L ${to.x} ${to.y}`);
            cornerPoints.push({ x: from.x, y: to.y });
        }
    }
    const pathD = pathSegments.join(' ');

    // Definir matriz de paletas de color según estado
    const stateColors = {
        completed: { shadow: '#0A5C2C', body: '#16A34A', face: '#22C55E', highlight: '#4ADE80', textColor: '#fff', labelColor: '#0A5C2C', badgeBg: '#BBF7D0', badgeText: '#0A5C2C' },
        unlocked:  { shadow: '#7A3E00', body: '#CC5E00', face: '#FF8C1A', highlight: '#FFAA44', textColor: '#fff', labelColor: '#6B3A00', badgeBg: '#FFAA44', badgeText: '#7A3E00' },
        locked:    { shadow: '#3A3A3A', body: '#5A5A5A', face: '#888888', highlight: '#AAAAAA', textColor: '#fff', labelColor: '#888888', badgeBg: '#CCCCCC', badgeText: '#666666' }
    };

    const stateLabels = {
        completed: 'SUPERADO',
        unlocked: 'DISPONIBLE',
        locked: 'BLOQUEADO'
    };

    // Proceder con la composición del lienzo vectorial
    let svgContent = '';

    // Capa base de trazado
    svgContent += `<path d="${pathD}" fill="none" stroke="#D4A070" stroke-width="10" opacity="0.4" stroke-linecap="round" stroke-linejoin="round"/>`;

    // Capa de animación dinámica del trazado
    svgContent += `<path d="${pathD}" fill="none" stroke="#FF8C00" stroke-width="4.5" stroke-dasharray="14 8" stroke-linecap="round" stroke-linejoin="round" style="animation: brilliantDash 1s linear infinite;"/>`;

    // Elementos de intersección
    cornerPoints.forEach(pt => {
        svgContent += `<circle cx="${pt.x}" cy="${pt.y}" r="5" fill="#FF8C00"/>`;
    });

    // Nodos interactivos
    nodes.forEach((lvl, idx) => {
        const pos = positions[idx];
        const status = lvl.status || 'unlocked';
        const colors = stateColors[status] || stateColors.unlocked;
        const label = stateLabels[status] || 'DISPONIBLE';
        const title = lvl.title || `Nivel ${idx + 1}`;
        const isFirst = idx === 0;
        const isLocked = status === 'locked';
        const groupOpacity = status === 'locked' ? 0.38 : (status === 'completed' ? 1 : 1);
        const lockedClass = isLocked ? ' is-locked' : '';

        // Inyectar anillo de pulso indicador exclusivo para el nodo actual de trabajo
        let pulseRing = '';
        if (isFirst && status === 'unlocked') {
            pulseRing = `<circle cx="${pos.x}" cy="${pos.y}" fill="#FF8C00" style="animation: brilliantPulse 2s ease-in-out infinite;"><animate attributeName="r" values="36;44;36" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.22;0.55;0.22" dur="2s" repeatCount="indefinite"/></circle>`;
        }

        // Dimensiones paramétricas del nodo
        const bw = 58, bh = 54, br = 9;
        const bx = pos.x - bw / 2;
        const by = pos.y - bh / 2;

        const nodeContent = isLocked ? '🔒' : (idx + 1);
        const fontSize = isLocked ? 20 : 24;

        const nodeBlock = `
            ${pulseRing}
            <g class="brilliant-node-group${lockedClass}" data-node-idx="${idx}" opacity="${groupOpacity}">
                <!-- Base oscura -->
                <rect x="${bx}" y="${by + 3}" width="${bw}" height="${bh}" rx="${br}" fill="${colors.shadow}" opacity="0.45"/>
                <!-- Volumen principal -->
                <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${br}" fill="${colors.body}"/>
                <!-- Superficie superior -->
                <rect class="node-face-top" x="${bx}" y="${by}" width="${bw}" height="${bh - 8}" rx="${br}" fill="${colors.face}"/>
                <!-- Highlight -->
                <rect x="${bx}" y="${by}" width="${bw}" height="${Math.floor(bh / 2.4)}" rx="${br}" fill="${colors.highlight}" opacity="0.6"/>
                <!-- Etiqueta representativa -->
                <text x="${pos.x}" y="${pos.y + 2}" text-anchor="middle" dominant-baseline="central" fill="${colors.textColor}" font-family="'Sora', sans-serif" font-size="${fontSize}" font-weight="800">${nodeContent}</text>
            </g>
        `;

        svgContent += nodeBlock;

        // Texto de estado subordinado al nodo
        const labelY = pos.y + bh / 2 + 18;
        svgContent += `
            <text x="${pos.x}" y="${labelY}" text-anchor="middle" fill="${colors.labelColor}" font-family="'Inter', sans-serif" font-size="13" font-weight="700">${title}</text>
            <rect x="${pos.x - 55}" y="${labelY + 6}" width="110" height="17" rx="8.5" fill="${colors.badgeBg}"/>
            <text x="${pos.x}" y="${labelY + 18}" text-anchor="middle" fill="${colors.badgeText}" font-family="'Inter', sans-serif" font-size="9" font-weight="800">${label}</text>
        `;
    });

    const svg = `<svg id="brilliant-map-svg" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">${svgContent}</svg>`;
    mapContainer.innerHTML = svg;

    // Asignar controladores de eventos interactivos en la capa vectorial
    mapContainer.querySelectorAll('.brilliant-node-group').forEach(g => {
        g.addEventListener('click', () => {
            const idx = parseInt(g.getAttribute('data-node-idx'));
            showLevelDetail(cursoSeleccionado, idx);
            // Aplicar enfoque visual al elemento interactuado
            mapContainer.querySelectorAll('.brilliant-node-group').forEach(n => n.style.opacity = n === g ? '1' : '');
        });
    });

    document.getElementById("course-selection-view").classList.remove("active");
    document.getElementById("course-map-view").classList.add("active");

    // Presentar e inicializar el panel de contenido contextual
    const detailPanel = document.getElementById("level-detail-panel");
    if (detailPanel) detailPanel.style.display = "block";
    
    document.getElementById("detail-empty").style.display = "flex";
    document.getElementById("detail-content").style.display = "none";
}

/** Renderizar la información detallada de nivel en el panel contextual */
function showLevelDetail(curso, idx) {
    const lvl = curso.nodes[idx];
    if (!lvl) return;

    const status = lvl.status || 'unlocked';
    const title = lvl.title || lvl.data?.title || `Nivel ${idx + 1}`;

    // Conmutar la visibilidad hacia la capa de contenido
    document.getElementById("detail-empty").style.display = "none";
    document.getElementById("detail-content").style.display = "block";

    // Refrescar cabecera
    const badge = document.getElementById("detail-badge");
    badge.textContent = idx + 1;

    // Seleccionar esquema de color acorde a la bandera de estado
    const badgeColors = {
        completed: { bg: '#22C55E', shadow: '#16A34A' },
        unlocked:  { bg: '#FF8C1A', shadow: '#CC5E00' },
        locked:    { bg: '#888888', shadow: '#5A5A5A' }
    };
    const bc = badgeColors[status] || badgeColors.unlocked;
    badge.style.background = bc.bg;
    badge.style.boxShadow = `0 3px 0 ${bc.shadow}`;

    document.getElementById("detail-title").textContent = title;

    const statusPill = document.getElementById("detail-status");
    statusPill.className = `detail-status-pill status-${status}`;
    const statusTexts = { completed: 'Superado', unlocked: 'Disponible', locked: 'Bloqueado 🔒' };
    statusPill.textContent = statusTexts[status] || 'Disponible';

    // Generar elementos de contenido interactivo inyectados
    const itemsList = document.getElementById("detail-items-list");
    itemsList.innerHTML = '';
    const content = lvl.data ? lvl.data.content : null;

    if (content) {
        const types = [
            { key: 'lecciones', icon: '📚', typeClass: 'type-leccion', label: 'Lección' },
            { key: 'recursos', icon: '📎', typeClass: 'type-recurso', label: 'Recurso' },
            { key: 'quiz', icon: '🧠', typeClass: 'type-quiz', label: 'Quiz' },
            { key: 'examen', icon: '📝', typeClass: 'type-examen', label: 'Examen' },
            { key: 'desafio_final', icon: '🏆', typeClass: 'type-desafio', label: 'Desafío' }
        ];

        let hasItems = false;
        types.forEach(t => {
            if (content[t.key] && content[t.key].length > 0) {
                content[t.key].forEach(item => {
                    hasItems = true;
                    const div = document.createElement('div');
                    div.className = `detail-item ${t.typeClass}`;
                    div.onclick = () => handleRagItemClick(event, item.id, t.key, status);
                    div.innerHTML = `
                        <div class="detail-item-icon">${t.icon}</div>
                        <div class="detail-item-info">
                            <span class="detail-item-type">${t.label}</span>
                            <span class="detail-item-title">${item.title || 'Contenido Recomendado'}</span>
                        </div>
                    `;
                    itemsList.appendChild(div);
                });
            }
        });

        if (!hasItems) {
            itemsList.innerHTML = '<div class="detail-empty-inline">Práctica libre disponible en breve.</div>';
        }
    } else {
        const div = document.createElement('div');
        div.className = 'detail-item type-quiz';
        div.onclick = () => handleRagItemClick(event, lvl.id, 'quiz', status);
        div.innerHTML = `
            <div class="detail-item-icon">🧠</div>
            <div class="detail-item-info">
                <span class="detail-item-type">Simulacro</span>
                <span class="detail-item-title">Práctica General</span>
            </div>
        `;
        itemsList.appendChild(div);
    }

    // Invocar desplazamiento animado hacia la sección activa en dispositivos de menor resolución
    if (window.innerWidth <= 900) {
        document.getElementById("level-detail-panel").scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function switchBackToSelection() {
    document.getElementById("course-map-view").classList.remove("active");
    document.getElementById("course-selection-view").classList.add("active");
    
    // Deshabilitar la visibilidad del panel de información contextual
    const detailPanel = document.getElementById("level-detail-panel");
    if (detailPanel) detailPanel.style.display = "none";
}

function handleRagItemClick(event, id, type, status) {
    if (event) event.stopPropagation();
    
    if (status === "locked") return;

    if (type === 'quiz' || type === 'examen' || type === 'desafio_final') {
        window.location.href = `quizzes.html?level=${id}&type=${type}`;
    } else {
        // Consultar el registro directamente en la base de datos delegando la carga estática
        supabase.from('resources').select('url').eq('id', id).single()
            .then(({ data, error }) => {
                if (error || !data) {
                    console.error("Error al cargar recurso desde Supabase:", error);
                    alert(`No se encontró el recurso con ID: ${id} en la base de datos.`);
                } else if (data.url) {
                    openResourceModal(data.url);
                } else {
                    alert(`El recurso ${id} no tiene una URL válida.`);
                }
            })
            .catch(err => {
                console.error("Error de red:", err);
                alert(`Error conectando a la base de datos para abrir el ID: ${id}`);
            });
    }
}

function openResourceModal(url) {
    let finalUrl = url;
    // Adaptar URLs de YouTube para poder ser insertadas en iframes
    if (url.includes("youtube.com/watch?v=")) {
        const videoId = url.split("v=")[1].split("&")[0];
        finalUrl = `https://www.youtube.com/embed/${videoId}`;
    } else if (url.includes("youtu.be/")) {
        const videoId = url.split("youtu.be/")[1].split("?")[0];
        finalUrl = `https://www.youtube.com/embed/${videoId}`;
    }

    let modal = document.getElementById("resource-modal-overlay");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "resource-modal-overlay";
        modal.className = "resource-modal-overlay";

        modal.innerHTML = `
            <div class="resource-modal-content">
                <div class="resource-modal-header">
                    <h3>Recurso de Aprendizaje</h3>
                    <button class="resource-modal-close" onclick="document.getElementById('resource-modal-overlay').style.display='none'; document.getElementById('resource-iframe').src='';">&times;</button>
                </div>
                <div class="resource-modal-body">
                    <iframe id="resource-iframe" class="resource-modal-iframe" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                document.getElementById('resource-iframe').src = '';
            }
        });
    }

    document.getElementById("resource-iframe").src = finalUrl;
    modal.style.display = "flex";
}

window.openSpecificCourseMap = openSpecificCourseMap;
window.switchBackToSelection = switchBackToSelection;
window.refreshRoadmapUI = buildCourseSelectionGrid;
