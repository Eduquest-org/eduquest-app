let currentRole = "student";

const Auth = {
  async initDB() {
    if (!localStorage.getItem("eduquest_db_users")) {
      try {
        const response = await fetch("../../mock/users.json");

        if (response.ok) {
          const data = await response.json();
          localStorage.setItem(
            "eduquest_db_users",
            JSON.stringify(data.users)
          );
        }
      } catch (error) {
        console.error("Error loading users.json:", error);
      }
    }

    if (window.UserManager) {
      UserManager.migrateUsersToNewSchema();
    }
  },

  generateMockToken() {
    return (
      "eq_tok_" +
      Math.random().toString(36).substr(2, 9) +
      Date.now().toString(36)
    );
  },

  login() {
    const user = document
      .getElementById("login-user")
      .value.trim()
      .toLowerCase();

    const pass = document
      .getElementById("login-pass")
      .value.trim();

    const errDiv = document.getElementById("login-error");

    const users = UserManager.getAllUsers();

    const matchedUser = users.find(
      u => u.email === user && u.password === pass
    );

    if (!matchedUser) {
      if (errDiv) {
        errDiv.style.display = "block";
        errDiv.innerText = "❌ Correo o contraseña incorrectos.";
      }

      return;
    }

    if (errDiv) errDiv.style.display = "none";

    const issuedAt = Date.now();
    const expiresAt = issuedAt + 60 * 60 * 1000;

    const session = {
      accessToken: this.generateMockToken(),
      userId: matchedUser.id,
      role: matchedUser.role,
      issuedAt,
      expiresAt
    };

    Storage.saveSession(session);

    window.location.href =
      matchedUser.role === "student"
        ? "../student/dashboard.html"
        : "../teacher/dashboard.html";
  },

  register() {
    const nameInput = document.getElementById("reg-name");
    const lastNameInput = document.getElementById("reg-lastname");
    const emailInput = document.getElementById("reg-email");
    const passInput = document.getElementById("reg-password");
    const confirmPassInput = document.getElementById("reg-confirm-password");
    const birthdateInput = document.getElementById("reg-birthdate");
    const gradYearInput = document.getElementById("reg-grad-year");

    if (!nameInput || !emailInput || !passInput) {
      alert("Error: faltan campos obligatorios en el formulario.");
      return;
    }

    const name = nameInput.value.trim();
    const lastname = lastNameInput?.value.trim() || "";
    const fullName = `${name} ${lastname}`.trim();

    const email = emailInput.value.trim().toLowerCase();
    const pass = passInput.value.trim();
    const confirmPass = confirmPassInput?.value.trim() || "";

    const birthdate = birthdateInput?.value || "";
    const gradYear = gradYearInput?.value || "";

    if (!name || !email || !pass) {
      alert("⚠️ Por favor completa nombre, correo y contraseña.");
      return;
    }

    if (confirmPassInput && pass !== confirmPass) {
      alert("⚠️ Las contraseñas no coinciden.");
      return;
    }

    const users = UserManager.getAllUsers();

    if (users.some(u => u.email === email)) {
      alert("⚠️ Este correo electrónico ya está registrado.");
      return;
    }

    const newUser = {
      id:
        "U_" +
        Math.random()
          .toString(36)
          .substr(2, 9)
          .toUpperCase(),

      name: fullName,
      email,
      password: pass,
      role: currentRole,

      profile: {
        avatar: currentRole === "student" ? "🚀" : "👨‍🏫"
      }
    };

    if (currentRole === "student") {
      newUser.profile.birthdate = birthdate || null;
      newUser.profile.gradYear = gradYear || null;
      newUser.profile.target = null;
      newUser.profile.career = null;

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

    const issuedAt = Date.now();
    const expiresAt = issuedAt + 60 * 60 * 1000;

    const session = {
      accessToken: this.generateMockToken(),
      userId: newUser.id,
      role: newUser.role,
      issuedAt,
      expiresAt
    };

    Storage.saveSession(session);

    alert("🎉 ¡Cuenta creada con éxito!");

    window.location.href =
      newUser.role === "student"
        ? "../student/dashboard.html"
        : "../teacher/dashboard.html";
  },

  logout() {
    Storage.removeSession();
    window.location.href = "../auth/login.html";
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
        window.location.href =
          session.role === "student"
            ? "../student/dashboard.html"
            : "../teacher/dashboard.html";
      } else {
        this.logout();
      }
    }
  },

  selectRole(role) {
    currentRole = role;

    document.getElementById("card-student")?.classList.remove("active");
    document.getElementById("card-teacher")?.classList.remove("active");

    const extraFields = document.getElementById("student-conditional-fields");

    if (role === "student") {
      document.getElementById("card-student")?.classList.add("active");
      if (extraFields) extraFields.style.display = "block";
    } else {
      document.getElementById("card-teacher")?.classList.add("active");
      if (extraFields) extraFields.style.display = "none";
    }
  }
};

function login() {
  Auth.login();
}

function register() {
  Auth.register();
}

function logout() {
  Auth.logout();
}

function selectRole(role) {
  Auth.selectRole(role);
}

function selectOption(element) {
  if (!element) return;

  const parent = element.parentElement;

  parent
    .querySelectorAll(".option-btn, .quiz-option, .qopt")
    .forEach(opt => opt.classList.remove("selected", "sel"));

  if (element.classList.contains("qopt")) {
    element.classList.add("sel");
  } else {
    element.classList.add("selected");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  Auth.initDB();
});