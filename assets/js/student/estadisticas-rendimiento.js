document.addEventListener("DOMContentLoaded", async () => {
    // Asegurar que el usuario está inicializado
    if (window.CurrentUserService && typeof CurrentUserService.init === 'function') {
        await CurrentUserService.init();
    }
    const user = window.CurrentUserService ? CurrentUserService.getProfile() : null;
    if (!user) return;

    await loadRealPerformanceStats(user.id);
});

let subjectChartInstance = null;
let globalChartInstance = null;

async function loadRealPerformanceStats(userId) {
    try {
        let statsData = [];
        if (window.UserManager) {
            statsData = await UserManager.getAllUserTopicStats(userId);
        }

        let topics = [];
        let courses = [];
        try {
            const [topicsRes, coursesRes] = await Promise.all([
                fetch("../../mock/topics.json"),
                fetch("../../mock/courses.json")
            ]);
            topics = await topicsRes.json();
            courses = await coursesRes.json();
        } catch (e) {
            console.error("Error fetching topics/courses", e);
        }

        const getCourseName = (cId) => {
            if (cId === 'general') return 'Simulacros General';
            const course = courses.find(c => c.id === cId);
            return course ? course.name : cId;
        };

        let totalSimulacros = 0;
        let totalCorrect = 0;
        let totalQuestions = 0;

        let courseStats = {};

        statsData.forEach(stat => {
            totalSimulacros += stat.total_attempts || 0;
            const correct = stat.correct_answers || 0;
            const incorrect = stat.incorrect_answers || 0;
            const totalQ = correct + incorrect;

            totalCorrect += correct;
            totalQuestions += totalQ;

            let cId = 'general';
            if (stat.topic_id !== 'general') {
                const topicObj = topics.find(t => t.id === stat.topic_id);
                if (topicObj) cId = topicObj.courseId;
            }

            if (!courseStats[cId]) {
                courseStats[cId] = { correct: 0, incorrect: 0, total: 0 };
            }
            courseStats[cId].correct += correct;
            courseStats[cId].incorrect += incorrect;
            courseStats[cId].total += totalQ;
        });

        const overallPromedio = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

        let courseArray = [];
        for (let cId in courseStats) {
            const stats = courseStats[cId];
            const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
            courseArray.push({
                id: cId,
                name: getCourseName(cId),
                pct: pct,
                correct: stats.correct,
                incorrect: stats.incorrect,
                total: stats.total
            });
        }

        courseArray.sort((a, b) => b.pct - a.pct);

        let mejorMateria = courseArray.length > 0 ? courseArray[0] : null;
        let peorMateria = courseArray.length > 0 ? courseArray[courseArray.length - 1] : null;
        document.getElementById("stat-promedio").innerText = overallPromedio + "%";
        document.getElementById("stat-simulacros").innerText = totalSimulacros;

        if (mejorMateria && totalSimulacros > 0) {
            document.getElementById("stat-mejor-materia").innerText = mejorMateria.name;
            document.getElementById("stat-mejor-pct").innerText = mejorMateria.pct + "%";
        } else {
            document.getElementById("stat-mejor-materia").innerText = "N/A";
            document.getElementById("stat-mejor-pct").innerText = "-";
        }

        if (peorMateria && totalSimulacros > 0) {
            document.getElementById("stat-peor-materia").innerText = peorMateria.name;
            document.getElementById("stat-peor-pct").innerText = peorMateria.pct + "%";
        } else {
            document.getElementById("stat-peor-materia").innerText = "N/A";
            document.getElementById("stat-peor-pct").innerText = "-";
        }

        // Update table
        const tbody = document.getElementById("table-body-materias");
        tbody.innerHTML = "";

        if (courseArray.length === 0) {
            tbody.innerHTML = "<tr><td colspan='4' style='text-align:center;'>Aún no hay datos de rendimiento. ¡Realiza algunos simulacros!</td></tr>";
        }

        let subjectLabels = [];
        let subjectCorrectPcts = [];
        let subjectIncorrectPcts = [];

        courseArray.forEach(c => {
            const tr = document.createElement("tr");

            let badgeClass = "bueno";
            let badgeText = "Bueno";
            if (c.pct >= 80) { badgeClass = "excelente"; badgeText = "Excelente"; }
            else if (c.pct < 70) { badgeClass = "reforzar"; badgeText = "Reforzar"; }

            const errPct = 100 - c.pct;

            tr.innerHTML = `
                <td>${c.name}</td>
                <td>${c.pct}%</td>
                <td>${errPct}%</td>
                <td><span class="badge ${badgeClass}">${badgeText}</span></td>
            `;
            tbody.appendChild(tr);

            if (c.id !== 'general') {
                subjectLabels.push(c.name);
                subjectCorrectPcts.push(c.pct);
                subjectIncorrectPcts.push(errPct);
            }
        });

        // Update recommendations
        const recList = document.getElementById("list-recomendaciones");
        recList.innerHTML = "";

        if (peorMateria) {
            const weakSubjects = courseArray.filter(c => c.pct < 70);
            if (weakSubjects.length > 0) {
                weakSubjects.forEach(w => {
                    const li = document.createElement("li");
                    li.innerText = `${w.name}: Te sugerimos repasar la teoría de los últimos temas y realizar más prácticas.`;
                    recList.appendChild(li);
                });
            } else {
                recList.innerHTML = "<li>¡Excelente rendimiento en todas las materias! Sigue practicando para mantener el nivel.</li>";
            }
        } else {
            recList.innerHTML = "<li>Completa simulacros para obtener recomendaciones personalizadas.</li>";
        }

        // Render Charts
        renderCharts(subjectLabels, subjectCorrectPcts, subjectIncorrectPcts, totalCorrect, totalQuestions - totalCorrect);

    } catch (error) {
        console.error("Error al cargar las estadísticas de rendimiento reales:", error);
    }
}

function renderCharts(labels, correctPcts, incorrectPcts, totalCorrect, totalIncorrect) {
    if (subjectChartInstance) subjectChartInstance.destroy();
    if (globalChartInstance) globalChartInstance.destroy();

    const subjectCtx = document.getElementById("subjectChart");
    if (subjectCtx && labels.length > 0) {
        subjectChartInstance = new Chart(subjectCtx, {
            type: "bar",
            data: {
                labels: labels,
                datasets: [
                    {
                        label: "Aciertos (%)",
                        data: correctPcts,
                        backgroundColor: "#22c55e"
                    },
                    {
                        label: "Errores (%)",
                        data: incorrectPcts,
                        backgroundColor: "#ef4444"
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }

    const globalCtx = document.getElementById("globalChart");
    if (globalCtx) {
        const hasData = (totalCorrect > 0 || totalIncorrect > 0);
        const dataVals = hasData ? [totalCorrect, totalIncorrect] : [1];
        const bgColors = hasData ? ["#22c55e", "#ef4444"] : ["#cbd5e1"];
        const gLabels = hasData ? ["Aciertos", "Errores"] : ["Sin datos"];

        globalChartInstance = new Chart(globalCtx, {
            type: "doughnut",
            data: {
                labels: gLabels,
                datasets: [
                    {
                        data: dataVals,
                        backgroundColor: bgColors
                    }
                ]
            },
            options: {
                responsive: true
            }
        });
    }
}