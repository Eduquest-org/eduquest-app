document
    .getElementById("quizForm")
    .addEventListener("submit", function (e) {

        e.preventDefault();

        const q1 = document.querySelector(
            'input[name="q1"]:checked'
        );

        const q2 = document.querySelector(
            'input[name="q2"]:checked'
        );

        const q3 = document.querySelector(
            'input[name="q3"]:checked'
        );

        if (!q1 || !q2 || !q3) {
            alert("Responde todas las preguntas.");
            return;
        }

        let score = 0;

        if (q1.value === "2.5") score++;
        if (q2.value === "1") score++;
        if (q3.value === "2") score++;

        alert(`Puntaje: ${score}/3`);
    });