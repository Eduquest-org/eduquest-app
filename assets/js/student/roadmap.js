// assets/js/student/roadmap.js

document.addEventListener("DOMContentLoaded", () => {
    buildStudentProfileBanner();
    buildCourseSelectionGrid();

    setTimeout(() => {
        const preloader = document.getElementById("app-preloader");
        if (preloader) preloader.classList.add("fade-out-loader");
    }, 350);
});

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
    const session = Storage.getSession();

    // Obtener temas completados del usuario para calcular progreso
    let completedTopics = [];
    if (session && window.UserManager) {
        const user = UserManager.getUserById(session.userId);
        if (user && user.learningProgress) {
            completedTopics = user.learningProgress.completedTopics || [];
        }
    }

    // Si existe una ruta IA personalizada, mostrar SOLO esa ruta
    if (session && window.UserManager) {
        const aiRoutes = UserManager.getCustomRoadmap(session.userId);
        if (aiRoutes.length > 0) {
            // Recalcular progreso basado en completedTopics
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
                    nodes: safeNodes.map((n, idx) => {
                        const title = n.data ? n.data.title : n.title;
                        if (completedTopics.includes(n.id)) {
                            return { ...n, title, status: 'completed' };
                        }
                        // Todos los niveles no completados están desbloqueados por defecto (modo exploración)
                        return { ...n, title, status: 'unlocked' };
                    })
                };
            });
        }
    }

    // Fallback: si no hay ruta IA (usuario sin diagnóstico), mostrar catálogo genérico
    const [coursesRes, topicsRes] = await Promise.all([
        fetch("../../mock/courses.json"),
        fetch("../../mock/topics.json")
    ]);
    const courses = await coursesRes.json();
    const topics = await topicsRes.json();

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
                // Todos los niveles no completados están desbloqueados por defecto
                return { id: t.id, title: t.name, status: 'unlocked' };
            })
        };
    });
}

async function buildCourseSelectionGrid() {
    const grid = document.getElementById("courses-grid");
    if (!grid) return;
    grid.innerHTML = "";

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

    // Dimensiones del layout
    const isMobile = window.innerWidth <= 600;
    const svgWidth = isMobile ? 380 : 560;
    const nodeSpacingY = 190;
    const leftX = isMobile ? 80 : 100;
    const midX = isMobile ? 190 : 280;
    const rightX = isMobile ? 300 : 460;
    const svgHeight = 120 + nodeCount * nodeSpacingY;

    // Calcular posiciones de cada nodo (serpiente: izq, medio, der, medio, izq...)
    const positions = nodes.map((_, idx) => {
        let x;
        const cycle = idx % 4;
        if (cycle === 0) x = leftX;
        else if (cycle === 1) x = midX;
        else if (cycle === 2) x = rightX;
        else x = midX; // cycle === 3

        const y = 80 + idx * nodeSpacingY;
        return { x, y };
    });

    // Construir la ruta (segmentos verticales y horizontales alternados)
    let pathSegments = [];
    let cornerPoints = [];
    for (let i = 0; i < positions.length - 1; i++) {
        const from = positions[i];
        const to = positions[i + 1];
        
        pathSegments.push(`M ${from.x} ${from.y}`);
        
        if (i % 4 === 1 || i % 4 === 3) {
            // Nodo Medio: Sale horizontal (der/izq) hacia to.x, luego baja a to.y
            pathSegments.push(`L ${to.x} ${from.y}`);
            pathSegments.push(`L ${to.x} ${to.y}`);
            cornerPoints.push({ x: to.x, y: from.y });
        } else {
            // Nodo Extremo (Izq/Der): Baja verticalmente a to.y, luego dobla horizontal a to.x
            pathSegments.push(`L ${from.x} ${to.y}`);
            pathSegments.push(`L ${to.x} ${to.y}`);
            cornerPoints.push({ x: from.x, y: to.y });
        }
    }
    const pathD = pathSegments.join(' ');

    // Colores por estado
    const stateColors = {
        completed: { shadow: '#0A5C2C', body: '#16A34A', face: '#22C55E', highlight: '#4ADE80', textColor: '#fff', labelColor: '#0A5C2C', badgeBg: '#BBF7D0', badgeText: '#0A5C2C' },
        unlocked:  { shadow: '#7A3E00', body: '#CC5E00', face: '#FF8C1A', highlight: '#FFAA44', textColor: '#fff', labelColor: '#6B3A00', badgeBg: '#FFAA44', badgeText: '#7A3E00' },
        locked:    { shadow: '#3A3A3A', body: '#5A5A5A', face: '#888888', highlight: '#AAAAAA', textColor: '#fff', labelColor: '#888888', badgeBg: '#CCCCCC', badgeText: '#666666' }
    };

    const stateLabels = {
        completed: '¡SUPERADO! ✨',
        unlocked: '¡DISPONIBLE! 🔥',
        locked: 'BLOQUEADO'
    };

    // Construir SVG
    let svgContent = '';

    // 1. Capa de sombra de la ruta
    svgContent += `<path d="${pathD}" fill="none" stroke="#D4A070" stroke-width="10" opacity="0.4" stroke-linecap="round" stroke-linejoin="round"/>`;

    // 2. Capa animada de la ruta
    svgContent += `<path d="${pathD}" fill="none" stroke="#FF8C00" stroke-width="4.5" stroke-dasharray="14 8" stroke-linecap="round" stroke-linejoin="round" style="animation: brilliantDash 1s linear infinite;"/>`;

    // 3. Círculos en las esquinas
    cornerPoints.forEach(pt => {
        svgContent += `<circle cx="${pt.x}" cy="${pt.y}" r="5" fill="#FF8C00"/>`;
    });

    // 4. Nodos (bloques 3D)
    nodes.forEach((lvl, idx) => {
        const pos = positions[idx];
        const status = lvl.status || 'unlocked';
        const colors = stateColors[status] || stateColors.unlocked;
        const label = stateLabels[status] || '¡DISPONIBLE! 🔥';
        const title = lvl.title || `Nivel ${idx + 1}`;
        const isFirst = idx === 0;
        const isLocked = status === 'locked';
        const groupOpacity = status === 'locked' ? 0.38 : (status === 'completed' ? 1 : 1);
        const lockedClass = isLocked ? ' is-locked' : '';

        // Pulse ring solo para el primer nodo no completado (activo)
        let pulseRing = '';
        if (isFirst && status === 'unlocked') {
            pulseRing = `<circle cx="${pos.x}" cy="${pos.y}" fill="#FF8C00" style="animation: brilliantPulse 2s ease-in-out infinite;"><animate attributeName="r" values="36;44;36" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.22;0.55;0.22" dur="2s" repeatCount="indefinite"/></circle>`;
        }

        // Block dimensions
        const bw = 58, bh = 54, br = 9;
        const bx = pos.x - bw / 2;
        const by = pos.y - bh / 2;

        const nodeContent = isLocked ? '🔒' : (idx + 1);
        const fontSize = isLocked ? 20 : 24;

        const nodeBlock = `
            ${pulseRing}
            <g class="brilliant-node-group${lockedClass}" data-node-idx="${idx}" opacity="${groupOpacity}">
                <!-- Sombra base -->
                <rect x="${bx}" y="${by + 3}" width="${bw}" height="${bh}" rx="${br}" fill="${colors.shadow}" opacity="0.45"/>
                <!-- Cuerpo -->
                <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${br}" fill="${colors.body}"/>
                <!-- Cara superior -->
                <rect class="node-face-top" x="${bx}" y="${by}" width="${bw}" height="${bh - 8}" rx="${br}" fill="${colors.face}"/>
                <!-- Highlight -->
                <rect x="${bx}" y="${by}" width="${bw}" height="${Math.floor(bh / 2.4)}" rx="${br}" fill="${colors.highlight}" opacity="0.6"/>
                <!-- Número/Ícono -->
                <text x="${pos.x}" y="${pos.y + 2}" text-anchor="middle" dominant-baseline="central" fill="${colors.textColor}" font-family="'Sora', sans-serif" font-size="${fontSize}" font-weight="800">${nodeContent}</text>
            </g>
        `;

        svgContent += nodeBlock;

        // Label (nombre + badge) debajo del nodo
        const labelY = pos.y + bh / 2 + 18;
        svgContent += `
            <text x="${pos.x}" y="${labelY}" text-anchor="middle" fill="${colors.labelColor}" font-family="'Inter', sans-serif" font-size="13" font-weight="700">${title}</text>
            <rect x="${pos.x - 55}" y="${labelY + 6}" width="110" height="17" rx="8.5" fill="${colors.badgeBg}"/>
            <text x="${pos.x}" y="${labelY + 18}" text-anchor="middle" fill="${colors.badgeText}" font-family="'Inter', sans-serif" font-size="9" font-weight="800">${label}</text>
        `;
    });

    const svg = `<svg id="brilliant-map-svg" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">${svgContent}</svg>`;
    mapContainer.innerHTML = svg;

    // Event listeners en nodos SVG — poblamos el panel lateral
    mapContainer.querySelectorAll('.brilliant-node-group').forEach(g => {
        g.addEventListener('click', () => {
            const idx = parseInt(g.getAttribute('data-node-idx'));
            showLevelDetail(cursoSeleccionado, idx);
            // Resaltar nodo activo
            mapContainer.querySelectorAll('.brilliant-node-group').forEach(n => n.style.opacity = n === g ? '1' : '');
        });
    });

    document.getElementById("course-selection-view").classList.remove("active");
    document.getElementById("course-map-view").classList.add("active");

    // Mostrar panel lateral y resetearlo
    const detailPanel = document.getElementById("level-detail-panel");
    if (detailPanel) detailPanel.style.display = "block";
    
    document.getElementById("detail-empty").style.display = "flex";
    document.getElementById("detail-content").style.display = "none";
}

// Muestra los detalles de un nivel en el panel lateral derecho
function showLevelDetail(curso, idx) {
    const lvl = curso.nodes[idx];
    if (!lvl) return;

    const status = lvl.status || 'unlocked';
    const title = lvl.title || lvl.data?.title || `Nivel ${idx + 1}`;

    // Ocultar estado vacío, mostrar contenido
    document.getElementById("detail-empty").style.display = "none";
    document.getElementById("detail-content").style.display = "block";

    // Actualizar header
    const badge = document.getElementById("detail-badge");
    badge.textContent = idx + 1;

    // Colores del badge según estado
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
    const statusTexts = { completed: '¡Superado! ✨', unlocked: '¡Disponible! 🔥', locked: 'Bloqueado 🔒' };
    statusPill.textContent = statusTexts[status] || 'Disponible';

    // Generar items RAG
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

    // Scroll suave al panel en móvil
    if (window.innerWidth <= 900) {
        document.getElementById("level-detail-panel").scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function switchBackToSelection() {
    document.getElementById("course-map-view").classList.remove("active");
    document.getElementById("course-selection-view").classList.add("active");
    
    // Ocultar panel lateral
    const detailPanel = document.getElementById("level-detail-panel");
    if (detailPanel) detailPanel.style.display = "none";
}

function handleRagItemClick(event, id, type, status) {
    if (event) event.stopPropagation();
    
    if (status === "locked") return;

    if (type === 'quiz' || type === 'examen' || type === 'desafio_final') {
        window.location.href = `quizzes.html?level=${id}&type=${type}`;
    } else {
        alert(`Abrir visor de recurso para el ID: ${id} (Próximamente modal integrado)`);
    }
}