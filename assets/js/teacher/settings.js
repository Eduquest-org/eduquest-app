// ==========================================================================
// assets/js/teacher/settings.js
// Configuración del docente. Persiste nombre en el doc de usuario y las
// preferencias en localStorage (frontend-only).
// ==========================================================================

const SETTINGS_KEY = "eduquest_teacher_settings";
const DEFAULT_SETTINGS = { classroom: "Aula 3246 - UNI", target: "UNI", notifRisk: true, notifWeekly: false, notifNew: true };

const Settings = {
  async init() {
    // Asegurar BD sembrada antes de leer el usuario (initDB es idempotente)
    if (window.Auth && Auth.initDB) { try { await Auth.initDB(); } catch (e) { /* noop */ } }

    const user = window.CurrentUserService ? CurrentUserService.getProfile() : null;
    const saved = this.read();

    setVal("set-name", user ? user.name : "");
    setVal("set-email", user ? user.email : "");
    setVal("set-class", saved.classroom);
    setVal("set-target", saved.target);
    setChecked("notif-risk", saved.notifRisk);
    setChecked("notif-weekly", saved.notifWeekly);
    setChecked("notif-new", saved.notifNew);

    hideTeacherPreloader();
  },

  read() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? Object.assign({}, DEFAULT_SETTINGS, JSON.parse(raw)) : Object.assign({}, DEFAULT_SETTINGS);
    } catch (e) {
      return Object.assign({}, DEFAULT_SETTINGS);
    }
  }
};

function setVal(id, v) { const el = document.getElementById(id); if (el) el.value = v ?? ""; }
function setChecked(id, v) { const el = document.getElementById(id); if (el) el.checked = !!v; }
function getVal(id) { const el = document.getElementById(id); return el ? el.value : ""; }
function getChecked(id) { const el = document.getElementById(id); return el ? el.checked : false; }

function saveSettings() {
  // 1. Persistir el nombre en el documento de usuario (vía UserManager)
  const newName = getVal("set-name").trim();
  if (newName && window.Storage && window.UserManager) {
    const session = Storage.getSession();
    if (session) {
      const users = UserManager.getAllUsers();
      const u = users.find(x => x.id === session.userId);
      if (u) { u.name = newName; UserManager.saveAllUsers(users); }
    }
  }

  // 2. Persistir las preferencias en localStorage
  const settings = {
    classroom: getVal("set-class").trim() || DEFAULT_SETTINGS.classroom,
    target: getVal("set-target"),
    notifRisk: getChecked("notif-risk"),
    notifWeekly: getChecked("notif-weekly"),
    notifNew: getChecked("notif-new")
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

  // 3. Refrescar el nombre mostrado en sidebar/topbar
  if (window.UserBindingManager) UserBindingManager.bindAll();

  teacherToast("✅ Cambios guardados");
}

function resetSettings() {
  localStorage.removeItem(SETTINGS_KEY);
  Settings.init();
  teacherToast("↩ Preferencias restablecidas");
}

document.addEventListener("DOMContentLoaded", () => Settings.init());
window.saveSettings = saveSettings;
window.resetSettings = resetSettings;
window.Settings = Settings;
