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

import { supabase } from '../config/supabase.js';

async function loadData() {
    try {
        const [uniRes, careersRes, coursesRes, rmRes, rvRes] = await Promise.all([
            supabase.from('universities').select('id, name'),
            supabase.from('careers').select('name, admission_areas(university_id)'),
            supabase.from('courses').select('id, name'),
            supabase.from('problems').select('id, topic_id, statement, options, correct_option').like('id', 'prob_rm_%').limit(10),
            supabase.from('problems').select('id, topic_id, statement, options, correct_option').or('id.like.prob_rv_%,id.like.prob_lect_%').limit(10)
        ]);

        const universities = uniRes.data || [];
        const allCareers = careersRes.data || [];
        const allCourses = coursesRes.data || [];
        const rmProblems = rmRes.data || [];
        const rvProblems = rvRes.data || [];

        // 1. Careers mapping
        universities.forEach(u => {
            CAREERS[u.id] = allCareers
                .filter(c => c.admission_areas && c.admission_areas.university_id === u.id)
                .map(c => c.name);
        });

        // 2. Courses
        COURSES = allCourses.map(c => c.name);

        // 3. Random Problems (4 RM, 4 RV)
        const shuffle = array => array.sort(() => 0.5 - Math.random());
        const selectedRM = shuffle([...rmProblems]).slice(0, 4);
        const selectedRV = shuffle([...rvProblems]).slice(0, 4);

        QS = [...selectedRM, ...selectedRV].map(p => {
            const isRM = p.id.includes('prob_rm_');
            return {
                cat: isRM ? 'RM' : 'RV',
                topicId: p.topic_id,
                q: p.statement,
                o: p.options,
                a: p.correct_option
            };
        });

        ans = new Array(QS.length).fill(null);
    } catch (err) {
        console.error("Error al cargar datos:", err);
    }
}

// Cargar datos al iniciar
loadData();

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

async function finish() {
    QS.forEach((q, i) => {
        diagnosticResults.push({ topicId: q.topicId, isCorrect: ans[i] === q.a });
    });

    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
        const userId = session.user.id;

        await supabase
            .from('profiles')
            .update({
                target_university_id: D.uni,
                career: D.career,
                diagnostic_results: diagnosticResults,
                ai_roadmap: []
            })
            .eq('id', userId);
    }

    console.log('Diagnóstico completado:', { perfil: D, resultados: diagnosticResults });
    window.location.href = '../student/roadmap.html?generate=true';
}


window.pickUni = pickUni;
window.go = go;
window.startQuiz = startQuiz;
window.qNav = qNav;
window.D = D;
