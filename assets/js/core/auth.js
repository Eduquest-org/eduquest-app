// 🔥 SEMILLERO AUTOMÁTICO: Colócalo en la línea 1 de tu auth.js
(async function initDatabaseFromJSON() {
    if (!localStorage.getItem("eduquest_db_users")) {
        try {
            // Como login.html está en /pages/auth/, sube dos niveles para buscar la raíz
            const response = await fetch("../../mock/seed_data.json");
            if (!response.ok) throw new Error();
            const data = await response.json();
            localStorage.setItem("eduquest_db_users", JSON.stringify(data.users));
            console.log("🌱 Base de datos local sembrada con éxito desde el JSON.");
        } catch (error) {
            console.error("Error cargando seed_data.json en LocalStorage:", error);
        }
    }
})();


// ==========================================================================
// core/auth.js
// MOTOR DE AUTENTICACIÓN SAAS Y CONTROLADOR SPA (EDUQUEST)
// ==========================================================================

let currentRole = 'student'; // Rol por defecto en el registro

// 🔥 SEMILLERO AUTOMÁTICO DESDE TU ARCHIVO JSON (API Rest Simulada)
(async function initDatabaseFromJSON() {
    if (!localStorage.getItem("eduquest_db_users")) {
        try {
            // Al estar en pages/auth/login.html, subimos dos niveles para leer la raíz
            const response = await fetch("../../mock/seed_data.json");
            if (!response.ok) throw new Error("No se pudo leer el archivo de semillas JSON.");
            
            const data = await response.json();
            localStorage.setItem("eduquest_db_users", JSON.stringify(data.users));
            console.log("🌱 Base de datos de EduQuest inicializada con éxito desde JSON.");
        } catch (error) {
            console.error("Error cargando el semillero JSON:", error);
        }
    }
})();

/**
 * 🔥 FUNCIÓN CRÍTICA RESTAURADA: Intercambia las vistas de la SPA sin recargar
 */
function navigateTo(screenId) {
    // 1. Ocultar todas las pantallas quitando la clase activa
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
    });
    
    // 2. Encender la pantalla que el usuario solicitó
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
    } else {
        console.error(`La pantalla con ID "${screenId}" no existe en tu login.html`);
    }
    
    // Scroll suave hacia arriba para mejorar el IHC (Experiencia de Usuario)
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Selecciona el rol en la pantalla de Registro (Estudiante / Docente)
 */
function selectRole(role) {
    currentRole = role; //
    document.getElementById('card-student')?.classList.remove('active'); //
    document.getElementById('card-teacher')?.classList.remove('active'); //
    
    if (role === 'student') {
        document.getElementById('card-student')?.classList.add('active'); //
        // Mostrar campos condicionales de alumno si los tienes maquetados
        const extraFields = document.getElementById("student-conditional-fields");
        if (extraFields) extraFields.style.display = 'block';
    } else {
        document.getElementById('card-teacher')?.classList.add('active'); //
        // Ocultar campos condicionales si es profesor
        const extraFields = document.getElementById("student-conditional-fields");
        if (extraFields) extraFields.style.display = 'none';
    }
}

/**
 * LÓGICA DE INICIO DE SESIÓN COMPATIBLE CON TUS INPUTS
 */
// Lógica de Login modificada para buscar en la base de datos local
function login() {
  const user = document.getElementById('login-user').value.trim().toLowerCase(); // Conserva tu ID original
  const pass = document.getElementById('login-pass').value.trim(); // Conserva tu ID original
  const errDiv = document.getElementById('login-error'); // Conserva tu ID original

  // Traer los usuarios guardados
  const users = JSON.parse(localStorage.getItem("eduquest_db_users")) || [];
  
  // Buscar coincidencia exacta por correo electrónico
  const matchedUser = users.find(u => u.email === user && u.password === pass);

  if (matchedUser) {
    if (errDiv) errDiv.style.display = 'none'; //
    
    // GUARDAR SESIÓN: Recordamos de forma global quién acaba de entrar
    localStorage.setItem("eduquest_current_session", JSON.stringify(matchedUser));

    // Redirección física inteligente por roles para separar los entornos
    if (matchedUser.role === 'student') {
        window.location.href = '../student/dashboard.html'; //
    } else if (matchedUser.role === 'teacher') {
        window.location.href = '../teacher/dashboard.html';
    }
  } else {
    // Si falla, activamos tu banner de error original
    if (errDiv) {
        errDiv.style.display = 'block'; //
        errDiv.innerText = "❌ Correo o contraseña incorrectos.";
    }
  }
}



/**
 * LÓGICA DE REGISTRO SPA CON PERSISTENCIA REAL
 */
// Lógica de Registro con persistencia en LocalStorage
function register() {
  // Capturar los campos interactivos de tu formulario
  const nameInput = document.getElementById('reg-name');
  const emailInput = document.getElementById('reg-email');
  const passInput = document.getElementById('reg-password');
  const targetInput = document.getElementById('reg-target'); // Selector opcional
  const careerInput = document.getElementById('reg-career'); // Entrada opcional

  if (!nameInput || !emailInput || !passInput) {
    alert("Error de maquetación: Asegúrate de ponerle los ids 'reg-name', 'reg-email' y 'reg-password' a tus inputs de registro.");
    return;
  }

  const name = nameInput.value.trim();
  const email = emailInput.value.trim().toLowerCase();
  const pass = passInput.value.trim();

  if (!name || !email || !pass) {
    alert("⚠️ Por favor completa los campos obligatorios.");
    return;
  }

  const users = JSON.parse(localStorage.getItem("eduquest_db_users")) || [];

  // Evitar duplicar cuentas con el mismo correo
  if (users.some(u => u.email === email)) {
    alert("⚠️ Este correo electrónico ya está registrado.");
    return;
  }

  // Estructurar el nuevo perfil respetando la variable 'currentRole' de tu código
  const newUser = {
    id: "U_" + Math.random().toString(36).substr(2, 9).toUpperCase(),
    name: name,
    email: email,
    password: pass,
    role: currentRole, // Usa tu variable nativa de selección
    avatar: currentRole === 'student' ? "🚀" : "👨‍🏫"
  };

  // Cargar estadísticas iniciales si es un alumno
  if (currentRole === 'student') {
    newUser.target = targetInput?.value || "Meta: UNI";
    newUser.career = careerInput?.value || "Ingeniería de Sistemas";
    newUser.totalXp = 0;
    newUser.streakDays = 1;
    newUser.rankingPos = "Nuevo Alumno";
  } else {
    newUser.classrooms = ["Aula Pro - Sin Asignar"];
  }

  // Guardar en la colección local
  users.push(newUser);
  localStorage.setItem("eduquest_db_users", JSON.stringify(users));

  alert("🎉 ¡Cuenta creada con éxito!");
  
  // Limpiar inputs
  nameInput.value = ""; emailInput.value = ""; passInput.value = "";
  if (careerInput) careerInput.value = "";

  // Volver al login usando tu propia función nativa de SPA
  navigateTo('s-login'); //
}


/**
 * CIERRE DE SESIÓN GLOBAL
 */
function logout() {
    localStorage.removeItem("eduquest_current_session");
    window.location.href = '../auth/login.html';
}

/**
 * Función visual para seleccionar opciones (Heredada y mejorada de tu diseño)
 */
function selectOption(element) { //
    if (!element) return;
    const parent = element.parentElement;
    parent.querySelectorAll('.option-btn, .quiz-option, .qopt').forEach(opt => opt.classList.remove('selected', 'sel')); //
    
    // Soporta tanto tus clases .sel de los simulacros como las tradicionales .selected
    if (element.classList.contains('qopt')) {
        element.classList.add('sel'); //
    } else {
        element.classList.add('selected');
    }
}