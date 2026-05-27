document.addEventListener("DOMContentLoaded", () => {
    loadFeedPosts();
});

// Función para leer el JSON e inyectarlo en el HTML
async function loadFeedPosts() {
    const container = document.getElementById("feed-container");
    if (!container) return;

    try {
        // En la estructura, retrocedemos carpetas para llegar a mock/
        const response = await fetch("../../mock/forum-posts.json");
        const posts = await response.json();

        container.innerHTML = ""; // Limpiar

        posts.forEach(post => {
            const postCard = document.createElement("div");
            postCard.className = "feed-card";
            postCard.innerHTML = `
                <div class="card-header">
                    <div class="author-avatar">${post.avatar}</div>
                    <div class="author-info">
                        <h4>${post.author} <span class="user-target">${post.target}</span></h4>
                        <span class="post-time">${post.time}</span>
                    </div>
                    <span class="post-tag">${post.tag}</span>
                </div>
                <div class="card-body">
                    <p>${post.content}</p>
                </div>
                <div class="card-footer">
                    <button class="action-btn upvote-btn" onclick="toggleUpvote(this, ${post.upvotes})">
                        🔼 Útil (${post.upvotes})
                    </button>
                    <button class="action-btn">💬 Comentar (${post.comments})</button>
                </div>
            `;
            container.appendChild(postCard);
        });
    } catch (error) {
        console.error("Error cargando el feed interactivo:", error);
    }
}

// Lógica interactiva de Upvotes (US-15)
function toggleUpvote(button, currentUpvotes) {
    if (button.classList.contains("active")) {
        button.classList.remove("active");
        button.innerHTML = `🔼 Útil (${currentUpvotes})`;
    } else {
        button.classList.add("active");
        button.innerHTML = `🔥 ¡Apoyado! (${currentUpvotes + 1})`;
    }
}