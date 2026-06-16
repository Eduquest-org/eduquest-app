let currentRole = 'student';

const Auth = {
    async initDB() {
        if (!localStorage.getItem("eduquest_db_users")) {
            try {
                const response = await fetch("../../mock/users.json");
                if (response.ok) {
                    const data = await response.json();
                    localStorage.setItem("eduquest_db_users", JSON.stringify(data.users));
                }
            } catch (error) {
                console.error("Error loading users.json:", error);
            }
        }

        // Migrar usuarios con estructura plana (v1) al nuevo esquema (v2)
        if (window.UserManager) {
            UserManager.migrateUsersToNewSchema();
        }
    },

    generateMockToken() {
        return 'eq_tok_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    },

    login() {
        const user = document.getElementById('login-user').value.trim().toLowerCase();
        const pass = document.getElementById('login-pass').value.trim();
        const errDiv = document.getElementById('login-error');

        const users = UserManager.getAllUsers();
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
        const lastNameInput = document.getElementById('reg-lastname');
        const emailInput = document.getElementById('reg-email');
        const passInput = document.getElementById('reg-password');
        const birthdateInput = document.getElementById('reg-birthdate');
        const gradYearInput = document.getElementById('reg-grad-year');

        if (!nameInput || !emailInput || !passInput) return;

        const firstName = nameInput.value.trim();
        const lastName = lastNameInput?.value.trim() || '';
        const name = lastName ? `${firstName} ${lastName}` : firstName;
        const email = emailInput.value.trim().toLowerCase();
        const pass = passInput.value.trim();

        if (!name || !email || !pass) {
            alert("⚠️ Por favor completa los campos obligatorios.");
            return;
        }

        const users = UserManager.getAllUsers();

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
            profile: {
                avatar: currentRole === 'student' ? "🚀" : "👨‍🏫"
            }
        };

        if (currentRole === 'student') {
            newUser.profile.birthdate = birthdateInput?.value || null;
            newUser.profile.gradYear = gradYearInput?.value || null;
            newUser.profile.target = null; // To be set during onboarding
            newUser.profile.career = null; // To be set during onboarding
            newUser.stats = {
                totalXp: 0,
                streakDays: 1,
                rankingPos: "Nuevo Alumno"
            };
            newUser.learningProgress = {
                lastAccessedCourse: null,
                lastAccessedTopic: null,
                completedTopics: [],
                diagnosticResults: [],
                hardestCourse: null,
                customRoadmap: []
            };
        } else {
            newUser.classrooms = ["Aula Pro - Sin Asignar"];
        }

        users.push(newUser);
        UserManager.saveAllUsers(users);

        // Auto login after registration
        const issuedAt = Date.now();
        const expiresAt = issuedAt + (60 * 60 * 1000); 

        const session = {
            accessToken: this.generateMockToken(),
            userId: newUser.id,
            role: newUser.role,
            issuedAt: issuedAt,
            expiresAt: expiresAt
        };

        Storage.saveSession(session);

        nameInput.value = ""; emailInput.value = ""; passInput.value = "";
        if (lastNameInput) lastNameInput.value = "";
        if (birthdateInput) birthdateInput.value = "";
        if (gradYearInput) gradYearInput.value = "";

        // Redirect to diagnostic exam (onboarding) if student, else to teacher dashboard
        if (newUser.role === 'student') {
            window.location.href = '../auth/onboarding.html';
        } else {
            window.location.href = '../teacher/dashboard.html';
        }
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