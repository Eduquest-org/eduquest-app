
new Chart(
    document.getElementById("subjectChart"),
    {
        type: "bar",

        data: {
            labels: [
                "Álgebra",
                "Aritmética",
                "Geometría",
                "Física",
                "Química"
            ],

            datasets: [

                {
                    label: "Aciertos (%)",
                    data: [90,78,72,65,83],
                    backgroundColor: "#22c55e"
                },

                {
                    label: "Errores (%)",
                    data: [10,22,28,35,17],
                    backgroundColor: "#ef4444"
                }

            ]
        },

        options: {
            responsive:true,
            scales:{
                y:{
                    beginAtZero:true,
                    max:100
                }
            }
        }
    }
);


new Chart(
    document.getElementById("globalChart"),
    {
        type: "doughnut",

        data:{
            labels:[
                "Aciertos",
                "Errores"
            ],

            datasets:[
                {
                    data:[78,22],
                    backgroundColor:[
                        "#22c55e",
                        "#ef4444"
                    ]
                }
            ]
        },

        options:{
            responsive:true
        }
    }
);