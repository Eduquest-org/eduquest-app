// assets/js/auth/onboarding.js
// ── Lógica del flujo de Onboarding y Diagnóstico Inicial ──

/* ── Data & State ── */
let CAREERS = {};
let COURSES = [];
let QS = [];

const D = { uni: null, career: null, hard: null, easy: null };
let qIdx = 0;
let ans = [];
const diagnosticResults = [];

async function loadMockData() {
    try {
        const [uniRes, coursesRes, problemsRes] = await Promise.all([
            fetch('../../mock/universities.json').then(r => r.ok ? r : Promise.reject('universities')),
            fetch('../../mock/courses.json').then(r => r.ok ? r : Promise.reject('courses')),
            fetch('../../mock/problems.json').then(r => r.ok ? r : Promise.reject('problems'))
        ]);

        const universities = await uniRes.json();
        const allCourses = await coursesRes.json();
        const allProblems = await problemsRes.json();

        // 1. Careers
        universities.forEach(u => {
            let uCareers = [];
            if (u.admissionAreas) {
                u.admissionAreas.forEach(area => {
                    if (area.careers) {
                        uCareers = uCareers.concat(area.careers);
                    }
                });
            }
            CAREERS[u.id] = uCareers;
        });

        // 2. Courses
        COURSES = allCourses.map(c => c.name);

        // 3. Random Problems (4 RM, 4 RV)
        const rmProblems = allProblems.filter(p => p.id && p.id.includes('prob_rm_'));
        const rvProblems = allProblems.filter(p => p.id && (p.id.includes('prob_rv_') || p.id.includes('prob_lect_')));
        
        const shuffle = array => array.sort(() => 0.5 - Math.random());
        const selectedRM = shuffle([...rmProblems]).slice(0, 4);
        const selectedRV = shuffle([...rvProblems]).slice(0, 4);
        
        QS = [...selectedRM, ...selectedRV].map(p => {
            const isRM = p.id.includes('prob_rm_');
            return {
                cat: isRM ? 'RM' : 'RV',
                topicId: p.topicId,
                q: p.statement,
                o: p.options,
                a: p.correctOption
            };
        });
        
        ans = new Array(QS.length).fill(null);
    } catch (err) {
        console.error("Error al cargar mock data:", err);
    }
}

// Cargar datos al iniciar
loadMockData();

/* ── Progress helpers ── */
function setPills(n) {
    for (let i = 0; i < 5; i++) {
        const p = document.getElementById('pill' + i);
        p.className = 'sp' + (i < n ? ' done' : i === n ? ' active' : '');
    }
    document.getElementById('topbar').style.width = ((n / 5) * 100) + '%';
}

/* ── Step navigation ── */
function go(n) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
    document.getElementById('s' + n).classList.add('on');
    setPills(n);
    if (n === 1) buildChips('career-chips', CAREERS[D.uni] || [], 'career', 's1-btn', 's1-dn', 2);
    if (n === 2) buildChips('hard-chips', COURSES, 'hard', 's2-btn', 's2-dn', 3);
    if (n === 3) {
        const ez = COURSES.filter(c => c !== D.hard);
        buildChips('easy-chips', ez, 'easy', 's3-btn', 's3-dn', 4);
    }
}

/* ── University pick ── */
function pickUni(id, el) {
    document.querySelectorAll('.uni-tile').forEach(t => t.classList.remove('sel'));
    el.classList.add('sel');
    D.uni = id;
    document.getElementById('s0-btn').disabled = false;
    document.getElementById('s0-dn').removeAttribute('disabled');
    setTimeout(() => go(1), 220);
}

/* ── Chip builder ── */
function buildChips(cid, items, key, btnId, dnId, nextStep) {
    const w = document.getElementById(cid);
    w.innerHTML = '';
    items.forEach(item => {
        const el = document.createElement('div');
        el.className = 'chip' + (D[key] === item ? ' sel' : '');
        el.textContent = item;
        el.onclick = () => {
            w.querySelectorAll('.chip').forEach(c => c.classList.remove('sel'));
            el.classList.add('sel');
            D[key] = item;
            document.getElementById(btnId).disabled = false;
            const dn = document.getElementById(dnId);
            if (dn) dn.removeAttribute('disabled');
            if (nextStep !== undefined) setTimeout(() => go(nextStep), 200);
        };
        w.appendChild(el);
    });
}

/* ── Start quiz ── */
function startQuiz() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
    document.getElementById('sq').classList.add('on');
    setPills(5);
    qIdx = 0;
    renderQ();
}

/* ── Render question ── */
function renderQ() {
    const q = QS[qIdx];
    document.getElementById('q-cat').textContent = q.cat === 'RM' ? 'Razonamiento Matemático' : 'Razonamiento Verbal';
    document.getElementById('q-num').textContent = (qIdx + 1) + ' / ' + QS.length;
    document.getElementById('q-text').textContent = q.q;
    document.getElementById('q-pbar').style.width = ((qIdx / QS.length) * 100) + '%';

    const hasAns = ans[qIdx] !== null;
    const isLast = qIdx === QS.length - 1;

    const btn = document.getElementById('q-btn');
    btn.disabled = !hasAns;
    btn.innerHTML = (isLast ? 'Finalizar' : 'Siguiente') + ' <i class="ti ti-arrow-right" style="font-size:15px"></i>';

    document.getElementById('q-dn').disabled = !hasAns || isLast;
    document.getElementById('q-up').disabled = qIdx === 0;

    const opts = document.getElementById('q-opts');
    opts.innerHTML = '';
    const letters = ['A', 'B', 'C', 'D'];
    q.o.forEach((opt, i) => {
        const el = document.createElement('div');
        el.className = 'opt' + (ans[qIdx] === i ? ' sel' : '');
        el.innerHTML = `<span class="opt-letter">${letters[i]}</span><span>${opt}</span>`;
        el.onclick = () => {
            opts.querySelectorAll('.opt').forEach(o => o.classList.remove('sel'));
            el.classList.add('sel');
            ans[qIdx] = i;
            document.getElementById('q-btn').disabled = false;
            if (!isLast) document.getElementById('q-dn').removeAttribute('disabled');
            if (qIdx < QS.length - 1) setTimeout(() => qNav(1), 280);
            else {
                document.getElementById('q-btn').innerHTML = 'Finalizar <i class="ti ti-arrow-right" style="font-size:15px"></i>';
                document.getElementById('q-btn').disabled = false;
            }
        };
        opts.appendChild(el);
    });
}

/* ── Quiz navigation ── */
function qNav(dir) {
    if (dir === 1) {
        if (ans[qIdx] === null) return;
        if (qIdx === QS.length - 1) { finish(); return; }
        qIdx++;
    } else {
        if (qIdx === 0) return;
        qIdx--;
    }
    renderQ();
}

/* ── Finish ── */
function finish() {
    QS.forEach((q, i) => {
        diagnosticResults.push({ topicId: q.topicId, isCorrect: ans[i] === q.a });
    });

    const session = Storage.getSession();
    if (session && window.UserManager) {
        UserManager.updateProfile(session.userId, { target: D.uni, career: D.career });
        
        const users = UserManager.getAllUsers();
        const userIdx = users.findIndex(u => u.id === session.userId);
        if (userIdx !== -1) {
            if (!users[userIdx].learningProgress) {
                users[userIdx].learningProgress = {
                    lastAccessedCourse: null,
                    lastAccessedTopic: null,
                    completedTopics: [],
                    diagnosticResults: [],
                    hardestCourse: null,
                    customRoadmap: []
                };
            }
            users[userIdx].learningProgress.hardestCourse = D.hard;
            // Limpiar el roadmap para forzar regeneración
            users[userIdx].learningProgress.customRoadmap = [];
            UserManager.saveAllUsers(users);
        }

        UserManager.saveDiagnosticResults(session.userId, diagnosticResults);
    }

    console.log('Diagnóstico completado:', { perfil: D, resultados: diagnosticResults });
    
    // Pasamos un parámetro por URL en lugar de storage para ser a prueba de balas contra la caché
    window.location.href = '../student/roadmap.html?generate=true';
}
