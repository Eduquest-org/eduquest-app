import { supabase, signIn, signUp, signOut } from '../config/supabase.js';

let currentRole = 'student';

const Auth = {
    async initDB() {
        // Nada que hacer aquí, Supabase maneja la DB remota
    },

    async login() {
        const user = document.getElementById('login-user').value.trim().toLowerCase();
        const pass = document.getElementById('login-pass').value.trim();
        const errDiv = document.getElementById('login-error');

        try {
            const data = await signIn({ email: user, password: pass });
            
            if (errDiv) errDiv.style.display = 'none';

            // Obtener el perfil para saber si es estudiante o profesor
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', data.user.id)
                .single();

            const role = profile ? profile.role : 'student';
            
            // Limpiar cualquier sesión mock anterior
            localStorage.removeItem('mock_session');

            window.location.href = role === 'student' ? '../student/dashboard.html' : '../teacher/dashboard.html';
        } catch (error) {
            console.error("Supabase login failed:", error);
            if (errDiv) {
                const textSpan = errDiv.querySelector('span:last-child') || errDiv;
                textSpan.textContent = '⚠️ Credenciales incorrectas o error de conexión.';
                errDiv.style.display = 'flex';
                errDiv.style.animation = 'none';
                void errDiv.offsetWidth;
                errDiv.style.animation = '';
                setTimeout(() => { errDiv.style.display = 'none'; }, 5000);
            }
        }
    },

    async logout() {
        localStorage.removeItem('mock_session');
        await signOut();
        window.location.href = '../auth/login.html';
    },

    async checkSession(redirectOnFail = true) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            if (redirectOnFail) this.logout();
            return false;
        }
        return true;
    },

    getCurrentUser() {
        
        if (window.CurrentUserService) return CurrentUserService.getProfile();
        return null;
    },

    hasRole(role) {
        const session = this.getCurrentUser();
        return session && session.role === role;
    },

    async requireAuth() {
        const hasSession = await this.checkSession(false);
        if (!hasSession) {
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

    async register() {
        const nameInput = document.getElementById('reg-name');
        const emailInput = document.getElementById('reg-email');
        const passInput = document.getElementById('reg-password');
        const termsCheckbox = document.getElementById('reg-terms');
        const termsErrorEl = document.getElementById('reg-terms-error');

        if (!nameInput || !emailInput || !passInput) return;

        const name = nameInput.value.trim();
        const email = emailInput.value.trim().toLowerCase();
        const pass = passInput.value.trim();

        if (!name || !email || !pass) {
            Auth._showRegError('reg-fields-error', '⚠️ Por favor completa todos los campos obligatorios.');
            return;
        }

        if (termsCheckbox && !termsCheckbox.checked) {
            if (termsErrorEl) {
                termsErrorEl.style.display = 'flex';
                termsErrorEl.style.animation = 'none';
                void termsErrorEl.offsetWidth;
                termsErrorEl.style.animation = '';
            }
            return;
        }
        if (termsErrorEl) termsErrorEl.style.display = 'none';

        try {
            const data = await signUp({ email, password: pass, name, role: currentRole });

            // Supabase maneja la sesión automáticamente

            nameInput.value = ""; emailInput.value = ""; passInput.value = "";

            if (currentRole === 'student') {
                window.location.href = '../auth/onboarding.html';
            } else {
                window.location.href = '../teacher/dashboard.html';
            }
        } catch (error) {
            let errorMsg = error.message;
            if (errorMsg.includes('security purposes') && errorMsg.includes('seconds')) {
                const seconds = errorMsg.match(/\d+/) ? errorMsg.match(/\d+/)[0] : 'unos';
                errorMsg = `Por seguridad, espera ${seconds} segundos antes de intentarlo de nuevo.`;
            } else if (errorMsg.includes('email rate limit exceeded')) {
                errorMsg = 'Límite de correos excedido. Intenta con otro correo o espera 1 hora.';
            } else if (errorMsg.includes('User already registered')) {
                errorMsg = 'Este correo electrónico ya está registrado.';
            } else if (errorMsg.includes('Password should be at least')) {
                errorMsg = 'La contraseña debe tener al menos 6 caracteres.';
            }
            Auth._showRegError('reg-fields-error', '⚠️ ' + errorMsg);
        }
    },

    selectRole(role) {
        currentRole = role;
        document.querySelectorAll('.role-card-student').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.role-card-teacher').forEach(el => el.classList.remove('active'));
        
        if (role === 'student') {
            document.querySelectorAll('.role-card-student').forEach(el => el.classList.add('active'));
            const extraFields = document.getElementById("student-conditional-fields");
            if (extraFields) extraFields.style.display = 'block';
        } else {
            document.querySelectorAll('.role-card-teacher').forEach(el => el.classList.add('active'));
            const extraFields = document.getElementById("student-conditional-fields");
            if (extraFields) extraFields.style.display = 'none';
        }
    },

    _showRegError(elementId, message) {
        const el = document.getElementById(elementId);
        if (el) {
            const textSpan = el.querySelector('span:last-child') || el;
            textSpan.textContent = message;
            el.style.display = 'flex';
            el.style.animation = 'none';
            void el.offsetWidth;
            el.style.animation = '';
            setTimeout(() => { el.style.display = 'none'; }, 5000);
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