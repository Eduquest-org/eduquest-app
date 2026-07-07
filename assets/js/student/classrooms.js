import { supabase } from '../config/supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verificar Autenticación
    const userDoc = await UserManager.getCurrentUserDoc();
    if (!userDoc) {
        window.location.href = '../../index.html';
        return;
    }

    const currentStudentId = userDoc.id;
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
                .select('*, profiles(name)')
                .in('id', classIds)
                .order('created_at', { ascending: false });

            if (classError) throw classError;

            renderClassrooms(classrooms);
        } catch (error) {
            console.error("Error al cargar las clases:", error);
            gridEl.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">⚠️</div>
                    <h3 class="empty-state-title">Error de conexión</h3>
                    <p class="empty-state-desc">No pudimos cargar tus clases. Intenta recargar la página.</p>
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
            <div class="class-card">
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
                    <button class="btn outline full" style="border-color:var(--brand); color:var(--brand); pointer-events:none;">Ver Tareas (Próximamente)</button>
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
            // 1. Buscar la clase por código
            const { data: classData, error: searchError } = await supabase
                .from('classrooms')
                .select('id, name')
                .eq('join_code', code)
                .single();

            if (searchError || !classData) {
                if (window.app && window.app.showToast) {
                    window.app.showToast("Código de clase inválido o no existe.", "error");
                } else {
                    alert("Código de clase inválido o no existe.");
                }
                btnJoin.disabled = false;
                btnJoin.innerHTML = '<span class="btn-text">Unirse a clase</span>';
                return;
            }

            // 2. Unirse a la clase (insertar en classroom_students)
            const { error: joinError } = await supabase
                .from('classroom_students')
                .insert({
                    classroom_id: classData.id,
                    student_id: currentStudentId
                });

            if (joinError) {
                // Posible error de duplicado (ya está inscrito)
                if (joinError.code === '23505') {
                    if (window.app && window.app.showToast) {
                        window.app.showToast("Ya estás inscrito en esta clase.", "warning");
                    }
                } else {
                    console.error("Error al unirse:", joinError);
                    if (window.app && window.app.showToast) {
                        window.app.showToast("Error al unirse a la clase. " + joinError.message, "error");
                    }
                }
            } else {
                if (window.app && window.app.showToast) {
                    window.app.showToast(`¡Te uniste a ${classData.name} exitosamente!`, "success");
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

    // Iniciar carga
    loadMyClassrooms();
});
