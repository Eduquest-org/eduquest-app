import { supabase } from '../config/supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verificar Autenticación
    const userDoc = await UserManager.getCurrentUserDoc();
    if (!userDoc) {
        window.location.href = '../../index.html';
        return;
    }

    const currentStudentId = userDoc.id;
    let cachedClassrooms = [];
    let currentClassroomId = null;

    const gridEl = document.getElementById('classrooms-grid');
    const joinForm = document.getElementById('join-class-form');
    const joinInput = document.getElementById('join-code-input');
    const btnJoin = document.getElementById('btn-join');

    // 2. Cargar mis clases
    async function loadMyClassrooms() {
        try {
            // Obtenemos los classroom_id en los que está inscrito el alumno
            const { data: enrollments, error: enrollError } = await supabase
                .from('classroom_students')
                .select('classroom_id')
                .eq('student_id', currentStudentId);

            if (enrollError) throw enrollError;

            if (!enrollments || enrollments.length === 0) {
                renderEmptyState();
                return;
            }

            const classIds = enrollments.map(e => e.classroom_id);

            // Obtenemos el detalle de esas clases junto con el nombre del profesor
            const { data: classrooms, error: classError } = await supabase
                .from('classrooms')
                .select('*, profiles!classrooms_teacher_id_fkey(name)')
                .in('id', classIds)
                .order('created_at', { ascending: false });

            if (classError) throw classError;

            cachedClassrooms = classrooms;
            renderClassrooms(classrooms);

            // Revisar parámetros de URL (Ej: desde el buscador global)
            const urlParams = new URLSearchParams(window.location.search);
            const sectionId = urlParams.get('section');
            const activityId = urlParams.get('activity');
            if (sectionId) {
                window.history.replaceState({}, document.title, window.location.pathname); // Limpiar URL
                const cls = classrooms.find(c => c.id === sectionId);
                if (cls) {
                    // Abrir modal de clase
                    await window.openClassroomModal(sectionId);
                    if (activityId) {
                        // Esperar a que se rendericen las actividades y hacer clic en entregar
                        setTimeout(() => {
                            const btn = document.querySelector(`button[onclick*="'${activityId}'"]`);
                            if (btn) btn.click();
                        }, 500);
                    }
                }
            }
        } catch (error) {
            console.error("Error al cargar las clases:", error);
            gridEl.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">⚠️</div>
                    <h3 class="empty-state-title">Error de conexión</h3>
                    <p class="empty-state-desc">Error detallado: ${error.message || JSON.stringify(error)}</p>
                </div>
            `;
        }
    }

    // 3. Renderizar vista vacía
    function renderEmptyState() {
        gridEl.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🏫</div>
                <h3 class="empty-state-title">Aún no tienes clases</h3>
                <p class="empty-state-desc">Pídele el código de unión a tu profesor e ingrésalo en la parte superior para matricularte.</p>
            </div>
        `;
    }

    // 4. Renderizar tarjetas de clases
    function renderClassrooms(classrooms) {
        if (!classrooms || classrooms.length === 0) {
            renderEmptyState();
            return;
        }

        gridEl.innerHTML = classrooms.map(c => {
            const teacherName = c.profiles?.name || "Profesor";
            const schedule = c.schedule || "Horario no definido";
            const cycle = c.cycle || "Ciclo general";
            
            return `
            <div class="class-card" style="cursor: pointer; transition: transform 0.2s;" onclick="window.openClassroomModal('${c.id}')" onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='translateY(0)'">
                <div class="class-card-header">
                    <div class="class-card-course">${c.course || 'General'}</div>
                    <div class="class-card-title">${c.name}</div>
                    <div class="class-card-teacher">
                        <span>👨‍🏫</span>
                        <span>Prof. ${teacherName}</span>
                    </div>
                </div>
                <div class="class-card-body">
                    <div class="class-detail">
                        <span>📅</span>
                        <span>${schedule}</span>
                    </div>
                    <div class="class-detail">
                        <span>🔄</span>
                        <span>${cycle}</span>
                    </div>
                </div>
                <div class="class-card-footer">
                    <button class="btn outline full" style="border-color:var(--brand); color:var(--brand);" onclick="event.stopPropagation(); window.openClassroomModal('${c.id}')">Ver Clase y Tareas</button>
                </div>
            </div>
            `;
        }).join('');
    }

    // 5. Manejar el evento de Unirse a Clase
    joinForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = joinInput.value.trim().toUpperCase();
        if (!code) return;

        btnJoin.disabled = true;
        btnJoin.innerHTML = '<span class="btn-text">Buscando...</span>';

        try {
            // 1. Llamar a la función RPC para unirse usando el código (Bypass RLS)
            const { data: rpcResult, error: rpcError } = await supabase
                .rpc('join_classroom_by_code', { p_code: code });

            if (rpcError) {
                console.error("Error al llamar RPC:", rpcError);
                if (window.app && window.app.showToast) {
                    window.app.showToast("Error de conexión al intentar unirse.", "error");
                }
                return;
            }

            // Manejar las respuestas lógicas de la RPC
            if (rpcResult.error) {
                if (rpcResult.error === 'not_found') {
                    if (window.app && window.app.showToast) {
                        window.app.showToast("Código de clase inválido o no existe.", "error");
                    }
                } else if (rpcResult.error === 'already_joined') {
                    if (window.app && window.app.showToast) {
                        window.app.showToast("Ya estás inscrito en esta clase.", "warning");
                    }
                } else {
                    if (window.app && window.app.showToast) {
                        window.app.showToast(rpcResult.error, "error");
                    }
                }
                return;
            }

            // Éxito
            if (rpcResult.success) {
                if (window.app && window.app.showToast) {
                    window.app.showToast(`¡Te uniste a ${rpcResult.classroom_name} exitosamente!`, "success");
                }
                joinInput.value = '';
                // Recargar lista
                await loadMyClassrooms();
            }

        } catch (err) {
            console.error(err);
        } finally {
            btnJoin.disabled = false;
            btnJoin.innerHTML = '<span class="btn-text">Unirse a clase</span>';
        }
    });

    // ==========================================
    // LÓGICA DEL MODAL CENTRAL (AULAS)
    // ==========================================

    window.openClassroomModal = async (classId) => {
        const cls = cachedClassrooms.find(c => c.id === classId);
        if (!cls) return;
        currentClassroomId = classId;

            window.classroomActivitiesData = activities;
        // Info General
        document.getElementById('modal-header-content').innerHTML = `
            <span style="font-size: 11px; background: rgba(255,255,255,0.5); padding: 4px 8px; border-radius: 4px; color: var(--brand); font-weight: 700;">${cls.course || 'GENERAL'}</span>
            <h2 style="font-size: 24px; font-weight: 800; margin-top: 8px; color: var(--dark);">${cls.name}</h2>
        `;
        document.getElementById('modal-info-content').innerHTML = `
            <p style="margin-bottom: 12px;"><strong>👨‍🏫 Profesor:</strong><br>${cls.profiles?.name || 'No definido'}</p>
            <p style="margin-bottom: 12px;"><strong>📅 Horario:</strong><br>${cls.schedule || 'No definido'}</p>
            <p><strong>📝 Descripción:</strong><br>${cls.description || 'Sin descripción.'}</p>
        `;

        document.getElementById('classroom-center-modal').classList.add('open');
        document.body.style.overflow = 'hidden'; // Bloquear scroll
        
        switchClassroomTab('activities');
        await renderModalActivities(classId);
        await renderModalRanking(classId);
    };

    window.closeClassroomModal = () => {
        document.getElementById('classroom-center-modal').classList.remove('open');
        document.body.style.overflow = '';
        currentClassroomId = null;
    };

    window.switchClassroomTab = (tabId) => {
        document.querySelectorAll('.center-modal-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.modal-tab-content').forEach(c => c.style.display = 'none');
        
        if (tabId === 'activities') {
            document.getElementById('btn-tab-activities').classList.add('active');
            document.getElementById('modal-tab-activities').style.display = 'block';
        } else {
            document.getElementById('btn-tab-ranking').classList.add('active');
            document.getElementById('modal-tab-ranking').style.display = 'block';
        }
    };

    // Renderizar Actividades y su estado de envío
    async function renderModalActivities(classId) {
        const listEl = document.getElementById('modal-activities-list');
        const countEl = document.getElementById('modal-activities-count');
        listEl.innerHTML = '<div style="padding: 20px; text-align: center;">Cargando tareas...</div>';

        try {
            // 1. Obtener tareas de la clase
            const { data: activities, error: actError } = await supabase
                .from('classroom_activities')
                .select('*')
                .eq('classroom_id', classId)
                .order('created_at', { ascending: false });
            if (actError) throw actError;

            // 2. Obtener envíos del alumno para estas tareas
            const { data: submissions, error: subError } = await supabase
                .from('activity_submissions')
                .select('*')
                .eq('student_id', currentStudentId);
            if (subError) throw subError;

            countEl.textContent = activities.length;

            if (activities.length === 0) {
                listEl.innerHTML = '<div style="padding: 20px; color: var(--sub);">El profesor aún no ha dejado tareas.</div>';
                return;
            }

            listEl.innerHTML = activities.map(act => {
                const sub = submissions.find(s => s.activity_id === act.id);
                
                let statusHtml = '';
                let actionHtml = '';

                if (!sub) {
                    statusHtml = '<span style="color: var(--danger); font-weight: 500; font-size: 13px;">🔴 Pendiente</span> <span style="background: #E8F5E9; color: #2E7D32; font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 4px; margin-left: 8px; border: 1px solid #C8E6C9;">NUEVA</span>';

                    if (act.type === 'quiz' && act.quizz_data) {
                        actionHtml = `<button class="btn btn-primary btn-sm" style="background: #10B981; border-color: #10B981; color: white;" onclick="window.openQuizRunner('${act.id}')">Empezar Quiz</button>`;
                    } else {
                        actionHtml = `<button class="btn btn-primary btn-sm" onclick="window.openSubmitActivityModal('${act.id}', '${act.title.replace(/'/g, "\\'")}')">Entregar</button>`;
                    }
                } else if (sub.status === 'pending') {
                    statusHtml = '<span style="color: var(--warning); font-weight: 500; font-size: 13px;">🟡 Enviado, en revisión</span>';
                    actionHtml = `<button class="btn outline btn-sm" onclick="window.openSubmitActivityModal('${act.id}', '${act.title.replace(/'/g, "\\'")}', true)">Actualizar envío</button>`;
                } else if (sub.status === 'graded') {
                    statusHtml = `<span style="color: var(--success); font-weight: 500; font-size: 13px;">🟢 Calificado: ${sub.score || 0} pts</span>`;
                    actionHtml = sub.feedback ? `<div style="font-size: 12px; margin-top: 8px; padding: 8px; background: rgba(0,0,0,0.05); border-radius: 6px;"><strong>Nota del Prof:</strong> ${sub.feedback}</div>` : '';
                }

                return `
                <div style="background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <div style="font-size: 11px; text-transform: uppercase; color: var(--brand); font-weight: 700;">${act.type || 'Tarea'}</div>
                            <div style="font-size: 16px; font-weight: 600; margin: 4px 0;">${act.title}</div>
                            <div style="font-size: 13px; color: var(--sub);">${act.topic || ''}</div>
                        </div>
                        <div style="text-align: right;">
                            ${statusHtml}
                        </div>
                    </div>
                    <div style="margin-top: 16px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 12px; color: var(--sub);">Vence: ${act.due_date ? new Date(act.due_date).toLocaleDateString() : 'Sin fecha'}</span>
                        ${actionHtml}
                    </div>
                </div>
                `;
            }).join('');

        } catch (error) {
            console.error(error);
            listEl.innerHTML = '<div style="color:red; padding:20px;">Error al cargar las tareas.</div>';
        }
    }

    // Renderizar Leaderboard de la clase
    async function renderModalRanking(classId) {
        const rankEl = document.getElementById('modal-ranking-list');
        rankEl.innerHTML = '<div style="padding: 20px; text-align: center;">Cargando ranking...</div>';

        try {
            // Obtenemos todos los envíos calificados para esta clase
            const { data: acts, error: actsError } = await supabase
                .from('classroom_activities')
                .select('id')
                .eq('classroom_id', classId);
            
            if (actsError || !acts || acts.length === 0) {
                rankEl.innerHTML = '<div style="padding: 20px; color: var(--sub);">Aún no hay calificaciones en esta clase.</div>';
                return;
            }

            const actIds = acts.map(a => a.id);

            const { data: subs, error: subsError } = await supabase
                .from('activity_submissions')
                .select('student_id, score, profiles(name)')
                .in('activity_id', actIds)
                .eq('status', 'graded');
            
            if (subsError) throw subsError;

            // Agrupar por estudiante y sumar notas
            const scores = {};
            subs.forEach(s => {
                if (!s.score) return;
                if (!scores[s.student_id]) {
                    scores[s.student_id] = { name: s.profiles?.name || 'Desconocido', total: 0 };
                }
                scores[s.student_id].total += s.score;
            });

            const rankArray = Object.values(scores).sort((a, b) => b.total - a.total);

            if (rankArray.length === 0) {
                rankEl.innerHTML = '<div style="padding: 20px; color: var(--sub);">Aún no hay calificaciones en esta clase.</div>';
                return;
            }

            rankEl.innerHTML = rankArray.map((r, i) => {
                const medal = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : `${i + 1}º`));
                return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid var(--border);">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 18px; width: 30px; text-align: center;">${medal}</span>
                        <span style="font-weight: 500;">${r.name}</span>
                    </div>
                    <span style="color: var(--brand); font-weight: 700;">${r.total} pts</span>
                </div>
                `;
            }).join('');

        } catch (error) {
            console.error(error);
            rankEl.innerHTML = '<div style="color:red; padding:20px;">Error al cargar el ranking.</div>';
        }
    }

    // ==========================================
    // MODAL DE ENVÍO DE TAREAS
    // ==========================================
    let currentActivityId = null;

    window.openSubmitActivityModal = (activityId, title, isUpdate = false) => {
        currentActivityId = activityId;
        document.getElementById('submit-activity-title').textContent = title;
        document.getElementById('submit-activity-content').value = '';
        document.getElementById('btn-submit-task').textContent = isUpdate ? 'Actualizar Envío' : 'Enviar Tarea';

    let activeQuiz = null;
    let quizState = { currentIdx: 0, answers: [] };

    window.openQuizRunner = (actId) => {
        const activities = window.classroomActivitiesData || [];
        activeQuiz = activities.find(a => a.id === actId);
        if (!activeQuiz || !activeQuiz.quizz_data) return;

        quizState = { currentIdx: 0, answers: [] };
        document.getElementById('quiz-runner-title').textContent = activeQuiz.title;
        document.getElementById('quiz-runner-modal').style.display = 'flex';

        setTimeout(() => {
            document.getElementById('quiz-runner-modal').style.opacity = '1';
        }, 10);

        renderQuizQuestion();
    };

    window.closeQuizRunner = () => {
        const modal = document.getElementById('quiz-runner-modal');
        modal.style.display = 'none';
        modal.style.opacity = '0';
        activeQuiz = null;
    };

    function renderQuizQuestion() {
        const questions = activeQuiz.quizz_data;
        const currentQ = questions[quizState.currentIdx];
        const body = document.getElementById('quiz-runner-body');

        document.getElementById('quiz-runner-progress').textContent = `Pregunta ${quizState.currentIdx + 1} de ${questions.length}`;

        let html = `<h3 style="font-size: 16px; margin-bottom: 20px; font-weight: 600; line-height: 1.5; color: var(--dark);">${currentQ.question}</h3>`;
        html += `<div style="display: flex; flex-direction: column; gap: 12px;">`;

        currentQ.options.forEach((opt, idx) => {
            const isSelected = quizState.answers[quizState.currentIdx] === idx;
            html += `
                <label style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; border: 1px solid ${isSelected ? '#10B981' : 'var(--border)'}; border-radius: 8px; cursor: pointer; background: ${isSelected ? 'rgba(16, 185, 129, 0.08)' : '#fff'}; transition: all 0.2s;">
                    <input type="radio" name="quiz_opt" value="${idx}" ${isSelected ? 'checked' : ''} onchange="window.selectQuizOption(${idx})" style="width: 18px; height: 18px; accent-color: #10B981;">
                    <span style="font-size: 14px;">${opt}</span>
                </label>
            `;
        });

        html += `</div>`;
        body.innerHTML = html;

        const btnNext = document.getElementById('btn-quiz-next');
        btnNext.onclick = handleNextQuizQuestion;

        if (quizState.currentIdx === questions.length - 1) {
            btnNext.textContent = 'Enviar Quiz';
        } else {
            btnNext.textContent = 'Siguiente';
        }
    }

    window.selectQuizOption = (idx) => {
        quizState.answers[quizState.currentIdx] = idx;
        renderQuizQuestion();
    };

    async function handleNextQuizQuestion() {
        if (quizState.answers[quizState.currentIdx] === undefined) {
            alert("Por favor, selecciona una respuesta antes de continuar.");
            return;
        }

        const questions = activeQuiz.quizz_data;

        if (quizState.currentIdx === questions.length - 1) {
            let correctCount = 0;
            questions.forEach((q, idx) => {
                if (quizState.answers[idx] === q.correctIndex) {
                    correctCount++;
                }
            });

            const maxPoints = Number(activeQuiz.points) || 100;
            const finalScore = Math.round((correctCount / questions.length) * maxPoints) || 0;
            
            const btnNext = document.getElementById('btn-quiz-next');
            btnNext.disabled = true;
            btnNext.textContent = 'Enviando...';

            try {
                const { data: existing, error: checkErr } = await supabase
                    .from('activity_submissions')
                    .select('id')
                    .eq('activity_id', activeQuiz.id)
                    .eq('student_id', currentStudentId)
                    .maybeSingle();

                if (checkErr) throw checkErr;

                const payload = {
                    score: finalScore,
                    status: 'graded',
                    content: JSON.stringify({ answers: quizState.answers, correctCount, total: questions.length })
                };

                if (existing) {
                    const { error } = await supabase.from('activity_submissions').update(payload).eq('id', existing.id);
                    if (error) throw error;
                } else {
                    const { error } = await supabase.from('activity_submissions').insert({
                        ...payload,
                        activity_id: activeQuiz.id,
                        student_id: currentStudentId
                    });
                    if (error) throw error;
                }

                const classroomId = activeQuiz.classroom_id;
                window.closeQuizRunner();
                
                if (window.app && window.app.showToast) {
                    window.app.showToast(`Quiz completado. Obtuviste ${finalScore} pts`, 'success');
                } else {
                    alert(`¡Quiz completado!\nObtuviste ${correctCount} de ${questions.length} correctas.\nPuntaje: ${finalScore} pts`);
                }
                
                renderModalActivities(classroomId);
            } catch (err) {
                console.error(err);
                alert("Error al guardar tu calificación: " + (err.message || JSON.stringify(err)));
            } finally {
                btnNext.disabled = false;
            }

        } else {
            quizState.currentIdx++;
            renderQuizQuestion();
        }
    }
        document.getElementById('submit-activity-modal').classList.add('open');
    };

    window.closeSubmitActivityModal = () => {
        document.getElementById('submit-activity-modal').classList.remove('open');
        currentActivityId = null;
    };

    document.getElementById('submit-activity-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const content = document.getElementById('submit-activity-content').value.trim();
        if (!content || !currentActivityId) return;

        const btn = document.getElementById('btn-submit-task');
        btn.disabled = true;
        btn.textContent = 'Enviando...';

        try {
            // Verificar si ya existe el registro usando un query normal
            const { data: existing, error: checkErr } = await supabase
                .from('activity_submissions')
                .select('id')
                .eq('activity_id', currentActivityId)
                .eq('student_id', currentStudentId)
                .maybeSingle();

            if (checkErr) throw checkErr;

            if (existing) {
                // Update
                const { error: updErr } = await supabase
                    .from('activity_submissions')
                    .update({ content: content, status: 'pending', submitted_at: new Date() })
                    .eq('id', existing.id);
                if (updErr) throw updErr;
            } else {
                // Insert
                const { error: insErr } = await supabase
                    .from('activity_submissions')
                    .insert({
                        activity_id: currentActivityId,
                        student_id: currentStudentId,
                        content: content,
                        status: 'pending'
                    });
                if (insErr) throw insErr;
            }

            if (window.app && window.app.showToast) {
                window.app.showToast('Tarea enviada exitosamente', 'success');
            }
            closeSubmitActivityModal();
            if (currentClassroomId) {
                await renderModalActivities(currentClassroomId);
            }
        } catch (error) {
            console.error(error);
            if (window.app && window.app.showToast) {
                window.app.showToast('Error al enviar la tarea', 'error');
            }
        } finally {
            btn.disabled = false;
        }
    });

    // Iniciar carga
    loadMyClassrooms();
});
