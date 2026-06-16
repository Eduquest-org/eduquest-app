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
        
        const posts = await postsRes.json();
        const usersData = await usersRes.json();
        const users = usersData.users;
        const comments = await commentsRes.json();

        container.innerHTML = ""; 

        const enrichedPosts = posts.map(post => {
            const author = users.find(u => u.id === post.authorId) || {};
            const postComments = comments.filter(c => c.postId === post.id);
            
            return {
                ...post,
                authorName: author.name || "Usuario",
                authorAvatar: author.avatar || "👤",
                authorTarget: author.target ? `Meta: ${author.target}` : "",
                commentsCount: postComments.length,
                timeText: "Reciente" 
            };
        });

        enrichedPosts.forEach(post => {
            const postCard = document.createElement("div");
            postCard.className = "feed-card";
            postCard.innerHTML = `
                <div class="card-header">
                    <div class="author-avatar">${post.authorAvatar}</div>
                    <div class="author-info">
                        <h4>${post.authorName} <span class="user-target">${post.authorTarget}</span></h4>
                        <span class="post-time">${post.timeText}</span>
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