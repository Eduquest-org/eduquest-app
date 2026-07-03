import { UserCirclesManager } from '../core/circles-manager.js';
import { CirclesManager } from '../core/circles-manager.js';
import { SubjectManager} from '../core/circles-manager.js';

//function for getting the colors
function getCourseColor(courseId) {
    const courseColors = {
    'course_algebra': 'var(--algebra)',
    'course_aritmetica': 'var(--aritmetica)',
    'course_biologia': 'var(--biologia)',
    'course_civica': 'var(--EducaciónCivica)',
    'course_economia': 'var(--Economía)',
    'course_filosofia': 'var(--Filosofía)',
    'course_fisica': 'var(--Física)',
    'course_geografia': 'var(--Geografía)',
    'course_geometria': 'var(--Geometría)',
    'course_historia_peru': 'var(--HistoriaPeru)',
    'course_historia_universal': 'var(--HistoriaUniver)',
    'course_ingles': 'var(--Ingles)',
    'course_lectura': 'var(--ComprensionLectora)',
    'course_lenguaje': 'var(--Lenguaje)',
    'course_literatura': 'var(--Literatura)',
    'course_logica': 'var(--Logica)',
    'course_probabilidad': 'var(--Probabilidad)',
    'course_psicologia': 'var(--Psicologia)',
    'course_quimica': 'var(--Quimica)',
    'course_rm': 'var(--RazonaMatematico)',
    'course_rv': 'var(--RazonamientoVerbal)',
    'course_trigonometrica': 'var(--Trigonometria)'
};
    return courseColors[courseId] || 'var(--muted)';
}
//for getting the background color for the titlecards
function getCourseBackground(courseId, opacity = 0.1) {
    const color = getCourseColor(courseId);
    // Return as rgba with opacity using CSS
    return `color-mix(in srgb, ${color} ${opacity * 100}%, transparent)`;
}


const mockCirclesData = [
    {
        id: "C_01",
        courseCode: "ALGEBRA",
        courseName: "Álgebra",
        title: "Vectores y Matrices UNI",
        description: "Salón de práctica intensiva enfocado en el examen de admisión UNI. Compartimos boletines pasados de Cepre.",
        membersCount: 24,
        colorTheme: "#1D9E75",
        bgTheme: "rgba(29, 158, 117, 0.1)",
        isJoined: false
    },
    {
        id: "C_02",
        courseCode: "LECTORA",
        courseName: "Lectura",
        title: "Comprensión Crítica San Marcos",
        description: "Análisis de textos complejos, inferencias y paradojas de exámenes de admisión reales. ¡Ven a debatir!",
        membersCount: 38,
        colorTheme: "#E24B4A",
        bgTheme: "rgba(226, 75, 74, 0.1)",
        isJoined: true
    },
    {
        id: "C_03",
        courseCode: "FISICA",
        courseName: "Física",
        title: "Cinemática y MRUV Express",
        description: "Grupo de amanecida para resolver problemas de caída libre y movimiento parabólico nivel intermedio.",
        membersCount: 15,
        colorTheme: "#EF9F27",
        bgTheme: "rgba(239, 159, 39, 0.1)",
        isJoined: false
    },
    {
        id: "C_04",
        courseCode: "GEOMETRIA",
        courseName: "Geometría",
        title: "Geometría del Espacio desde Cero",
        description: "Para los que volamos en el espacio tridimensional. Hacemos videollamadas rápidas para trazar juntos.",
        membersCount: 19,
        colorTheme: "#7F77DD",
        bgTheme: "rgba(127, 119, 221, 0.1)",
        isJoined: false
    }
];

let activeCourseFilter = "ALL";

document.addEventListener("DOMContentLoaded", async () => {
    if (window.CurrentUserService) {
        await CurrentUserService.init();
    }
    buildCommunityProfileBanner();
    renderCirclesStream();

    setTimeout(() => {
        const preloader = document.getElementById("app-preloader");
        if (preloader) preloader.classList.add("fade-out-loader");
    }, 350);
});

function buildCommunityProfileBanner() {
    const container = document.getElementById("community-profile-summary");
    if (!container) return;

    container.innerHTML = `
        <div class="profile-express-left">
            <div class="profile-express-avatar" data-user-avatar></div>
            <div class="profile-express-welcome">
                <h3>Comunidad de <span data-user-firstname></span></h3>
                <p><span data-user-target></span> • <span data-user-career></span></p>
            </div>
        </div>
        <div class="profile-express-stats">
            <div class="express-stat-item">
                <span id="banner-joined-count" class="express-stat-val" style="color: var(--indigo);">0 Salas</span>
                <span class="express-stat-label">Mis Círculos</span>
            </div>
            <div class="express-stat-item">
                <span class="express-stat-val" style="color: var(--green);" data-user-xp></span>
                <span class="express-stat-label">Aportes Aula</span>
            </div>
            <div class="express-stat-item">
                <span class="express-stat-val" style="color: var(--amber);">🔥 <span data-user-streak></span></span>
                <span class="express-stat-label">Racha Activa</span>
            </div>
        </div>
    `;

    if (window.UserBindingManager) UserBindingManager.bindAll();

    const totalJoined = mockCirclesData.filter(c => c.isJoined).length;
    document.getElementById("banner-joined-count").innerText = `${totalJoined} ${totalJoined === 1 ? 'Sala' : 'Salas'}`;
}

async function renderCirclesStream() {

    const container = document.getElementById("active-circles-container");
    if (!container) return;
    container.innerHTML = "";

    const circles = await CirclesManager.getAllCircles()
    const subjects = await SubjectManager.getAllSubjects()

    if (!circles||circles.length === 0) {
        container.innerHTML = `<p style="grid-column:1/-1; text-align:center; padding:40px; color:var(--sub); font-size:14px;">🔒 No hay círculos activos para esta materia. ¡Sé el primero en crear uno!</p>`;
        return;
    }

    const UsersCircles = await UserCirclesManager.getCirclesByUserId(window.CurrentUserService.getId())

    circles.forEach(circle => {
        const partOfCircle = UsersCircles?.some(c => c.id_circle === circle.id) || false;
        const subject = subjects.find(s => s.id === circle.id_theme);
        const card = document.createElement("div");
        
        card.className = `circle-item-card ${partOfCircle? 'joined-active' : ''}`;
        
        const buttonText = partOfCircle ? "🟢 Dentro del Círculo" : "Unirse al Círculo";

        let subjectLeterColor = getCourseColor(circle.id_theme)
        card.innerHTML = `
            <div class="circle-card-header">
                <span class="circle-course-badge" stlye= "color: ${subjectLeterColor}">${subject.name}</span>
                <span class="circle-meta-members">👥 ${circle.number_students} alumnos</span>
            </div>
            <h3>${circle.name}</h3>
            <p>${circle.description}</p>
            <button class="btn-join-circle" onclick="toggleCircleMembership('${circle.id}')">${buttonText}</button>
        `;
        container.appendChild(card);
    });
}

function filterCirclesByCourse(courseCode) {
    activeCourseFilter = courseCode;

    const tabs = document.querySelectorAll(".filter-tabs-bar .tab-btn");
    tabs.forEach(tab => {
        if (tab.getAttribute("onclick").includes(`'${courseCode}'`)) {
            tab.classList.add("active");
        } else {
            tab.classList.remove("active");
        }
    });

    renderCirclesStream();
}

function toggleCircleMembership(id) {
    const circle = mockCirclesData.find(c => c.id === id);
    if (!circle) return;

    if (circle.isJoined) {
        circle.isJoined = false;
        circle.membersCount--;
    } else {
        circle.isJoined = true;
        circle.membersCount++;
    }

    const totalJoined = mockCirclesData.filter(c => c.isJoined).length;
    document.getElementById("banner-joined-count").innerText = `${totalJoined} ${totalJoined === 1 ? 'Sala' : 'Salas'}`;

    renderCirclesStream();
}

function triggerCreateCircleMock() {
    const input = document.getElementById("new-circle-input");
    if (!input || input.value.trim() === "") {
        alert("Por favor escribe un nombre para tu círculo de estudio.");
        return;
    }
    alert(`🚀 ¡Círculo "${input.value}" Maquetado con Éxito! Al conectar tu Base de Datos en la siguiente entrega, esta acción disparará un método POST asíncrono para guardarlo en la nube.`);
    input.value = "";
}
async function updateCirclesCurrentUser(){
  try {
        const userId = window.CurrentUserService?.getId();
        if (!userId) {
            console.log('No user ID found');
            return;
        }
        console.log(`this is the ucrrent user id ${userId}`)
        const currentCircles = await CirclesManager.getAllCircles();
        const size = currentCircles ? currentCircles.length : 0;
        console.log(`there are ${size} circles:`, currentCircles);

    } catch (error) {
        console.error('Error fetching user circles:', error);
    }
}

//listeners

document.addEventListener('DOMContentLoaded',() => {
    let btnCirclesTest = document.getElementById("circles-test-size");
        if(btnCirclesTest){
            btnCirclesTest.addEventListener('click',async () =>{
                await updateCirclesCurrentUser();
            });
        }
});