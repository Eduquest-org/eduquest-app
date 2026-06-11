let currentRole = 'student';

const Auth = {
    async initDB() {
        if (!localStorage.getItem("eduquest_db_users")) {
            try {
                const response = await fetch("../../mock/seed_data.json");
                if (response.ok) {
                    const data = await response.json();
                    localStorage.setItem("eduquest_db_users", JSON.stringify(data.users));
                }
            } catch (error) {
                console.error("Error loading seed_data.json:", error);
            }
        }
    },

    generateMockToken() {
        return 'eq_tok_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    },

    login() {
        const user = document.getElementById('login-user').value.trim().toLowerCase();
        const pass = document.getElementById('login-pass').value.trim();
        const errDiv = document.getElementById('login-error');

        const users = JSON.parse(localStorage.getItem("eduquest_db_users")) || [];
        const matchedUser = users.find(u => u.email === user && u.password === pass);

        if (matchedUser) {
            if (errDiv) errDiv.style.display = 'none';

            const issuedAt = Date.now();
            const expiresAt = issuedAt + (60 * 60 * 1000); 

            const session = {
                accessToken: this.generateMockToken(),
                userId: matchedUser.id,
                role: matchedUser.role,
                issuedAt: issuedAt,
                expiresAt: expiresAt
            };

            Storage.saveSession(session);
            
            window.location.href = matchedUser.role === 'student' ? '../student/dashboard.html' : '../teacher/dashboard.html';
        } else {
            if (errDiv) {
                errDiv.style.display = 'block';
                errDiv.innerText = "❌ Correo o contraseña incorrectos.";
            }
        }
    },

    logout() {
        Storage.removeSession();
        window.location.href = '../auth/login.html';
    },

    checkSession(redirectOnFail = true) {
        const session = Storage.getSession();
        if (!session) {
            if (redirectOnFail) this.logout();
            return false;
        }

        if (Date.now() > session.expiresAt) {
            if (redirectOnFail) this.logout();
            return false;
        }

        return true;
    },

    getCurrentUser() {
        return Storage.getSession();
    },

    hasRole(role) {
        const session = this.getCurrentUser();
        return session && session.role === role;
    },

    requireAuth() {
        if (!this.checkSession(false)) {
            this.logout();
        }
    },

    requireRole(role) {
        if (!this.hasRole(role)) {
            const session = this.getCurrentUser();
            if (session) {
                window.location.href = session.role === 'student' ? '../student/dashboard.html' : '../teacher/dashboard.html';
            } else {
                this.logout();
            }
        }
    },

    register() {
        const nameInput = document.getElementById('reg-name');
        const emailInput = document.getElementById('reg-email');
        const passInput = document.getElementById('reg-password');
        const targetInput = document.getElementById('reg-target');
        const careerInput = document.getElementById('reg-career');

        if (!nameInput || !emailInput || !passInput) return;

        const name = nameInput.value.trim();
        const email = emailInput.value.trim().toLowerCase();
        const pass = passInput.value.trim();

        if (!name || !email || !pass) {
            alert("⚠️ Por favor completa los campos obligatorios.");
            return;
        }

        const users = JSON.parse(localStorage.getItem("eduquest_db_users")) || [];

        if (users.some(u => u.email === email)) {
            alert("⚠️ Este correo electrónico ya está registrado.");
            return;
        }

        const newUser = {
            id: "U_" + Math.random().toString(36).substr(2, 9).toUpperCase(),
            name: name,
            email: email,
            password: pass,
            role: currentRole,
            avatar: currentRole === 'student' ? "🚀" : "👨‍🏫"
        };

        if (currentRole === 'student') {
            newUser.target = targetInput?.value || "Meta: UNI";
            newUser.career = careerInput?.value || "Ingeniería de Sistemas";
            newUser.totalXp = 0;
            newUser.streakDays = 1;
            newUser.rankingPos = "Nuevo Alumno";
        } else {
            newUser.classrooms = ["Aula Pro - Sin Asignar"];
        }

        users.push(newUser);
        localStorage.setItem("eduquest_db_users", JSON.stringify(users));

        nameInput.value = ""; emailInput.value = ""; passInput.value = "";
        if (careerInput) careerInput.value = "";

        navigateTo('s-login');
    },

    selectRole(role) {
        currentRole = role;
        document.getElementById('card-student')?.classList.remove('active');
        document.getElementById('card-teacher')?.classList.remove('active');
        
        if (role === 'student') {
            document.getElementById('card-student')?.classList.add('active');
            const extraFields = document.getElementById("student-conditional-fields");
            if (extraFields) extraFields.style.display = 'block';
        } else {
            document.getElementById('card-teacher')?.classList.add('active');
            const extraFields = document.getElementById("student-conditional-fields");
            if (extraFields) extraFields.style.display = 'none';
        }
    }
};

function navigateTo(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) targetScreen.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.Auth = Auth;
window.login = () => Auth.login();
window.register = () => Auth.register();
window.logout = () => Auth.logout();
window.selectRole = (role) => Auth.selectRole(role);
window.navigateTo = navigateTo;