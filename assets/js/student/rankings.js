// ==========================================================================
import { supabase } from '../config/supabase.js';
// assets/js/student/rankings.js
// CONTROLADOR LOGICO DEL LEADERBOARD ACADÉMICO
// ==========================================================================

// assets/js/student/rankings.js

document.addEventListener("DOMContentLoaded", () => {
    buildRankingProfileBanner();
    renderLeaderboardTable();

    setTimeout(() => {
        const preloader = document.getElementById("app-preloader");
        if (preloader) preloader.classList.add("fade-out-loader");
    }, 350);
});

function buildRankingProfileBanner() {
    const container = document.getElementById("ranking-profile-summary");
    if (!container) return;

    container.innerHTML = `
        <div class="profile-express-left">
            <div class="profile-express-avatar" data-user-avatar></div>
            <div class="profile-express-welcome">
                <h3>Liga de <span data-user-firstname></span></h3>
                <p>Meta: <span data-user-target></span> • <span data-user-career></span></p>
            </div>
        </div>
        <div class="profile-express-stats">
            <div class="express-stat-item">
                <span class="express-stat-val" style="color: var(--green);" data-user-xp></span>
                <span class="express-stat-label">Mis XP Semanales</span>
            </div>
            <div class="express-stat-item">
                <span class="express-stat-val" style="color: var(--amber);">🔥 <span data-user-streak></span></span>
                <span class="express-stat-label">Racha Activa</span>
            </div>
            <div class="express-stat-item">
                <span class="express-stat-val" style="color: var(--indigo);" data-user-ranking></span>
                <span class="express-stat-label">Puesto Aula</span>
            </div>
        </div>
    `;

    if (window.UserBindingManager) UserBindingManager.bindAll();
}

async function renderLeaderboardTable(scope = 'global', specificId = null) {
    const tbody = document.getElementById("leaderboard-tbody");
    if (!tbody) return;
    
    // Add loading indicator
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px; color:var(--sub);">Cargando clasificación...</td></tr>`;

    let activeUserId = null;
    if (window.CurrentUserService) {
        const profile = CurrentUserService.getProfile();
        if (profile) activeUserId = profile.id;
    }

    try {
        let users = [];
        
        if (scope === 'global') {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('total_xp', { ascending: false })
                .limit(30); // Limite de 30 para Semanal General
            if (error) throw error;
            users = data || [];
        } 
        else if (scope === 'classroom') {
            if (!activeUserId) throw new Error("No user");
            
            let classId = specificId;
            if (!classId) {
                // Buscar aula si no se provee
                const { data: enrollments, error: enrErr } = await supabase
                    .from('classroom_students')
                    .select('classroom_id')
                    .eq('student_id', activeUserId);
                
                if (enrErr) throw enrErr;
                
                if (!enrollments || enrollments.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px; color:var(--sub);">No estás inscrito en ninguna sección. ¡Únete a un aula para competir!</td></tr>`;
                    return;
                }
                classId = enrollments[0].classroom_id;
            }
            
            // Obtener estudiantes del aula
            const { data: studentsEnrolled, error: stuErr } = await supabase
                .from('classroom_students')
                .select('student_id')
                .eq('classroom_id', classId);
                
            if (stuErr) throw stuErr;
            const studentIds = studentsEnrolled.map(e => e.student_id);
            
            // Obtener profiles y ordenar
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .in('id', studentIds)
                .order('total_xp', { ascending: false })
                .limit(15);
            if (error) throw error;
            users = data || [];
        }
        else if (scope === 'circle') {
            if (!activeUserId) throw new Error("No user");
            
            let circleId = specificId;
            if (!circleId) {
                // Buscar circulo
                const { data: circleEnrollments, error: cirErr } = await supabase
                    .from('circles_table_student')
                    .select('id_circle')
                    .eq('id_student', activeUserId);
                    
                if (cirErr) throw cirErr;
                
                if (!circleEnrollments || circleEnrollments.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px; color:var(--sub);">No perteneces a ninguna comunidad de estudio. ¡Crea o únete a un círculo!</td></tr>`;
                    return;
                }
                circleId = circleEnrollments[0].id_circle;
            }
            
            // Obtener estudiantes del circulo
            const { data: studentsEnrolled, error: stuErr } = await supabase
                .from('circles_table_student')
                .select('id_student')
                .eq('id_circle', circleId);
                
            if (stuErr) throw stuErr;
            const studentIds = studentsEnrolled.map(e => e.id_student);
            
            // Obtener profiles y ordenar
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .in('id', studentIds)
                .order('total_xp', { ascending: false })
                .limit(15);
            if (error) throw error;
            users = data || [];
        }
        
        tbody.innerHTML = "";

        const combinedRanking = users.map(u => {
            return {
                id: u.id,
                name: u.name || "Usuario Desconocido",
                career: u.career || "Preuniversitario",
                streak: (u.streak_days || 0) + " días",
                xp: u.total_xp || 0,
                avatar: u.avatar_url || "👤",
                isCurrent: activeUserId === u.id
            };
        });

        // Ya vienen ordenados por XP de Supabase


        combinedRanking.forEach((student, index) => {
            const row = document.createElement("tr");
            
            if (student.isCurrent) {
                row.className = "current-user-highlight";
            }

            let puestoLabel = index + 1;
            if (puestoLabel === 1) puestoLabel = `<span class="rank-badge-cell rank-1">🥇 1</span>`;
            else if (puestoLabel === 2) puestoLabel = `<span class="rank-badge-cell rank-2">🥈 2</span>`;
            else if (puestoLabel === 3) puestoLabel = `<span class="rank-badge-cell rank-3">🥉 3</span>`;
            else puestoLabel = `<span class="rank-badge-cell" style="color: var(--sub);">${puestoLabel}</span>`;

            const nameDisplay = student.isCurrent ? `<strong>${student.name} (Tú)</strong>` : student.name;

            const { emoji: studentEmoji, color: studentColor } = window.parseAvatar ? window.parseAvatar(student.avatar) : { emoji: student.avatar, color: 'var(--indigo)' };

            row.innerHTML = `
                <td style="text-align: center;">${puestoLabel}</td>
                <td>
                    <div class="student-row-info">
                        <span class="student-avatar-mini" style="background-color: ${studentColor};">${studentEmoji}</span>
                        <div class="student-name-meta">
                            <span>${nameDisplay}</span>
                            <span class="mobile-only-meta sub-meta-text" style="display: none;">${student.career}</span>
                        </div>
                    </div>
                </td>
                <td class="sub-meta-text desktop-only-meta">${student.career}</td>
                <td style="text-align: center; font-weight: 500; font-size: 13px;">🔥 ${student.streak}</td>
                <td class="xp-points-cell">${Number(student.xp).toLocaleString()} XP</td>
            `;

            tbody.appendChild(row);
        });
    } catch(err) {
        console.error("Error building dynamic ranking:", err);
        const tbody = document.getElementById("leaderboard-tbody");
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px; color:red;">Error al cargar el ranking. Intenta nuevamente.</td></tr>`;
    }
}

window.switchRankingScope = async function(scope, btn) {
    window.currentRankingScope = scope;
    
    document.querySelectorAll('.rank-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    
    // Update title
    const titleEl = document.querySelector('.view-header h2');
    if (titleEl) {
        if (scope === 'global') titleEl.innerText = '🏆 Tabla de Clasificación Semanal';
        else if (scope === 'classroom') titleEl.innerText = '📚 Tabla de Clasificación del Aula';
        else if (scope === 'circle') titleEl.innerText = '🔮 Tabla de Clasificación de tu Comunidad';
    }
    
    const selectorContainer = document.getElementById("ranking-scope-selector-container");
    const selectEl = document.getElementById("ranking-scope-select");
    const labelEl = document.getElementById("ranking-scope-label");
    
    if (scope === 'global') {
        if (selectorContainer) selectorContainer.style.display = 'none';
        renderLeaderboardTable(scope);
        return;
    }
    
    // We need active user to fetch enrollments
    let activeUserId = null;
    if (window.CurrentUserService) {
        const profile = CurrentUserService.getProfile();
        if (profile) activeUserId = profile.id;
    }
    
    if (!activeUserId) return;
    
    if (selectorContainer) {
        selectorContainer.style.display = 'flex';
        selectEl.innerHTML = '<option value="">Cargando...</option>';
        labelEl.innerText = scope === 'classroom' ? 'Sección' : 'Comunidad';
    }

    try {
        let optionsHtml = '';
        let firstId = null;

        if (scope === 'classroom') {
            const { data, error } = await supabase
                .from('classroom_students')
                .select('classroom_id, classrooms(name)')
                .eq('student_id', activeUserId);
                
            if (!error && data && data.length > 0) {
                firstId = data[0].classroom_id;
                optionsHtml = data.map(d => `<option value="${d.classroom_id}">${d.classrooms?.name || 'Aula Desconocida'}</option>`).join('');
            }
        } else if (scope === 'circle') {
            const { data, error } = await supabase
                .from('circles_table_student')
                .select('id_circle, circles_table(name)')
                .eq('id_student', activeUserId);
                
            if (!error && data && data.length > 0) {
                firstId = data[0].id_circle;
                optionsHtml = data.map(d => `<option value="${d.id_circle}">${d.circles_table?.name || 'Círculo Desconocido'}</option>`).join('');
            }
        }
        
        if (selectEl) {
            selectEl.innerHTML = optionsHtml;
            if (optionsHtml === '') {
                selectEl.innerHTML = '<option value="">No perteneces a ninguna</option>';
            }
        }
        
        // Cargar ranking con el primer ID disponible
        renderLeaderboardTable(scope, firstId);
        
    } catch(err) {
        console.error("Error cargando opciones de ranking:", err);
        renderLeaderboardTable(scope); // Fallback normal
    }
}