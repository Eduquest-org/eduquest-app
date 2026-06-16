// assets/js/student/feed.js
// CONTROLADOR DE FORO Y COMUNIDAD DE ESTUDIANTES

document.addEventListener("DOMContentLoaded", () => {
    loadFeedPosts();
});

async function loadFeedPosts() {
    const container = document.getElementById("feed-container");
    if (!container) return;

    try {
        const [postsRes, usersRes, commentsRes] = await Promise.all([
            fetch("../../mock/posts.json"),
            fetch("../../mock/users.json"),
            fetch("../../mock/comments.json")
        ]);
        
        const mockPosts = await postsRes.json();
        const usersData = await usersRes.json();
        const users = usersData.users;
        const comments = await commentsRes.json();

        // Cargar posts personalizados de localStorage
        const customPosts = JSON.parse(localStorage.getItem("eduquest_custom_posts")) || [];
        const posts = [...customPosts, ...mockPosts];

        container.innerHTML = ""; 

        const enrichedPosts = posts.map(post => {
            // Si es un post personalizado, ya tiene los campos del autor agregados
            if (post.id && post.id.toString().startsWith("post_custom_")) {
                return post;
            }
            
            const author = users.find(u => u.id === post.authorId) || {};
            const postComments = comments.filter(c => c.postId === post.id);
            
            return {
                ...post,
                authorName: author.name || "Usuario",
                authorAvatar: (author.profile && author.profile.avatar) ? author.profile.avatar : (author.avatar || "👤"),
                authorTarget: (author.profile && author.profile.target) ? `Meta: ${author.profile.target}` : "",
                commentsCount: postComments.length,
                timeText: "Reciente" 
            };
        });

        enrichedPosts.forEach(post => {
            const postCard = document.createElement("div");
            postCard.className = "feed-card";
            postCard.innerHTML = `
                <div class="card-header">
                    <div class="author-avatar">${post.authorAvatar || post.avatar || "👤"}</div>
                    <div class="author-info">
                        <h4>${post.authorName || post.author} <span class="user-target">${post.authorTarget || post.target || ""}</span></h4>
                        <span class="post-time">${post.timeText || "Reciente"}</span>
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
                    <button class="action-btn">💬 Comentar (${post.commentsCount})</button>
                </div>
            `;
            container.appendChild(postCard);
        });
    } catch (error) {
        console.error("Error cargando el feed interactivo:", error);
    }
}

function toggleUpvote(button, currentUpvotes) {
    if (button.classList.contains("active")) {
        button.classList.remove("active");
        button.innerHTML = `🔼 Útil (${currentUpvotes})`;
    } else {
        button.classList.add("active");
        button.innerHTML = `🔥 ¡Apoyado! (${currentUpvotes + 1})`;
    }
}

// Publicar una nueva duda en el foro
function addNewPost() {
    const input = document.getElementById("post-input");
    if (!input) return;

    const content = input.value.trim();
    if (!content) {
        alert("⚠️ Por favor escribe el contenido de tu duda antes de publicar.");
        return;
    }

    const session = Storage.getSession();
    if (!session) return;

    const user = UserManager.getUserById(session.userId);
    if (!user) return;

    const userTarget = (user.profile && user.profile.target) ? user.profile.target : "UNI";

    const newPost = {
        id: "post_custom_" + Date.now(),
        authorId: user.id,
        authorName: user.name,
        authorAvatar: (user.profile && user.profile.avatar) ? user.profile.avatar : "🚀",
        authorTarget: `Meta: ${userTarget}`,
        tag: "Duda Académica",
        content: content,
        upvotes: 0,
        commentsCount: 0,
        timeText: "Ahora mismo"
    };

    // Agregar al localStorage de posts
    const customPosts = JSON.parse(localStorage.getItem("eduquest_custom_posts")) || [];
    customPosts.unshift(newPost);
    localStorage.setItem("eduquest_custom_posts", JSON.stringify(customPosts));

    // Limpiar campo de texto
    input.value = "";

    // Recargar feed en pantalla
    loadFeedPosts();

    // Recompensar al estudiante con XP por participación
    UserManager.addXp(user.id, 50);

    // Sumar progreso al reto diario de publicación
    if (window.GamificationManager) {
        GamificationManager.updateDailyChallengeProgress("create_post", 1);
        
        // Otorgar insignia de participación en la comunidad
        GamificationManager.checkAndAwardBadge(user.id, "badge_curious");
    }

    // Actualizar XP en la interfaz
    if (window.UserBindingManager) UserBindingManager.bindAll();
}

// Compartir la función globalmente para que el botón HTML la encuentre
window.addNewPost = addNewPost;