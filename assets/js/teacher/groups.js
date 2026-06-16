// ==========================================================================
// assets/js/teacher/groups.js
// Grupos de estudio del aula (tarjetas + alta de grupo).
// ==========================================================================

const Groups = {
  data: { groups: [] },

  async init() {
    this.data = await TeacherData.load();
    const n = document.getElementById("teacher-classroom-name");
    if (n) n.textContent = this.data.classroomName || "tu aula";
    this.render();
    hideTeacherPreloader();
  },

  render() {
    const grid = document.getElementById("groups-grid");
    if (!grid) return;
    if (!this.data.groups.length) {
      grid.innerHTML = `<p class="sm col-m">Aún no hay grupos. Crea el primero con «+ Crear grupo».</p>`;
      return;
    }
    grid.innerHTML = this.data.groups.map(g => {
      const parts = String(g.name).split("—");
      const title = teacherEsc(parts[0].trim());
      const meta = parts[1] ? `Meta: ${teacherEsc(parts[1].trim())}` : "Grupo de estudio";
      const badge = g.status === "atencion"
        ? `<span class="badge ba">Atención</span>`
        : `<span class="badge bg">Activo</span>`;
      return `
        <div class="group-card">
          <div class="group-card-top">
            <div>
              <div class="group-card-name">${title}</div>
              <div class="group-card-meta">${meta}</div>
            </div>
            ${badge}
          </div>
          <div class="group-card-foot">
            <span class="group-card-num">${g.members}</span>
            <span class="group-card-num-lbl">alumnos</span>
          </div>
        </div>`;
    }).join("");
  }
};

function createGroup() {
  const name = prompt("Nombre del grupo (ej: «Grupo D — UNI»):");
  if (!name || !name.trim()) return;
  const members = parseInt(prompt("Número de alumnos:", "0"), 10) || 0;
  Groups.data.groups.push({ name: name.trim(), members, status: "activo" });
  Groups.render();
  teacherToast("✅ Grupo creado");
}

document.addEventListener("DOMContentLoaded", () => Groups.init());
window.createGroup = createGroup;
window.Groups = Groups;
