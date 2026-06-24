// assets/js/student/feed.js
// CONTROLADOR DE FORO Y COMUNIDAD DE ESTUDIANTES
// Implementa: publicación de imágenes, validación de formato, comentarios inline,
// respuesta fijada y sugerencias de posts similares.

/* ========================================================
   ESTADO GLOBAL DEL MÓDULO
   ======================================================== */
let _selectedImageData = null; // base64 de la imagen seleccionada
let _selectedImageMime = null; // mime type
let _selectedTag = null; // etiqueta seleccionada por el usuario
let _allPosts = [];   // caché de todos los posts (para búsqueda de similares)
let _allComments = [];   // caché de todos los comentarios
let _similarSearchTimer = null; // debounce para búsqueda de similares
let _currentUserId = null; // id del usuario en sesión

// Formatos de imagen válidos
const VALID_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
const MAX_IMAGE_SIZE_MB = 5;

/* ========================================================
   INICIALIZACIÓN
   ======================================================== */
document.addEventListener('DOMContentLoaded', () => {
    loadFeedPosts();
    initPostInputListener();

    // Cerrar dropdowns al hacer clic fuera
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('tag-dropdown');
        const tagBtn = document.getElementById('btn-tag-selector');
        if (dropdown && tagBtn && !tagBtn.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('open');
        }
    });
});

/* ========================================================
   CARGA Y RENDERIZADO DEL FEED
   ======================================================== */
async function loadFeedPosts() {
    const container = document.getElementById('feed-container');
    if (!container) return;

    try {
        const [postsRes, usersRes, commentsRes] = await Promise.all([
            fetch('../../mock/posts.json'),
            fetch('../../mock/users.json'),
            fetch('../../mock/comments.json')
        ]);

        const mockPosts = await postsRes.json();
        const usersData = await usersRes.json();
        const users = usersData.users || usersData;
        _allComments = await commentsRes.json();

        // Cargar posts personalizados de localStorage (van primero)
        const customPosts = JSON.parse(localStorage.getItem('eduquest_custom_posts')) || [];
        _allPosts = [...customPosts, ...mockPosts];

        container.innerHTML = '';

        // Guardar userId del usuario en sesión ANTES de renderizar
        const session = (typeof Storage !== 'undefined') ? Storage.getSession() : null;
        _currentUserId = session?.userId || null;

        const enrichedPosts = _allPosts.map(post => {
            const timeStr = post.createdAt ? formatTime(post.createdAt) : (post.timeText || 'Reciente');

            if (post.id && post.id.toString().startsWith('post_custom_')) {
                return { ...post, timeText: timeStr };
            }

            const author = (users || []).find(u => u.id === post.authorId) || {};
            const postComments = _allComments.filter(c => c.postId === post.id);

            return {
                ...post,
                authorName: post.authorName || author.name || 'Usuario',
                authorAvatar: post.authorAvatar || (author.profile?.avatar) || author.avatar || '👤',
                authorTarget: post.authorTarget || (author.profile?.target ? `Meta: ${author.profile.target}` : ''),
                commentsCount: post.commentsCount ?? postComments.length,
                timeText: timeStr
            };
        });

        enrichedPosts.forEach(post => renderPostCard(post, container));

    } catch (error) {
        console.error('Error cargando el feed:', error);
        const container = document.getElementById('feed-container');
        if (container) container.innerHTML = '<p style="color:#9ca3af;padding:24px;text-align:center;">No se pudo cargar el feed. Intenta recargar la página.</p>';
    }
}

function renderPostCard(post, container) {
    const postCard = document.createElement('div');
    postCard.className = 'feed-card';
    postCard.id = `post-card-${post.id}`;

    const isDuda = (post.tag || '').toLowerCase().includes('duda');
    const tagClass = isDuda ? 'post-tag duda-tag' : 'post-tag';
    const tagLabel = post.tag || 'General';

    // Imagen adjunta
    const imageHtml = post.imageUrl ? `
        <div class="card-image" onclick="openImageLightbox('${post.imageUrl.replace(/'/g, "\\'")}')">
            <span class="card-image-badge">📷 Imagen adjunta</span>
            <img src="${post.imageUrl}" alt="Imagen del ejercicio" loading="lazy">
        </div>` : '';

    // Recuperar comentarios de localStorage si es post custom
    const storedComments = JSON.parse(localStorage.getItem(`eduquest_comments_${post.id}`)) || [];
    const feedComments = _allComments.filter(c => c.postId === post.id);
    const allPostComments = [...feedComments, ...storedComments];
    const commentCount = allPostComments.length;
    const pinnedId = post.pinnedCommentId || null;

    // Indicador de respuesta fijada
    const pinnedBadge = pinnedId ? `<span class="pin-badge">📌 Respuesta fijada</span>` : '';

    // Botón de eliminar post (solo si es su post)
    const canDeletePost = _currentUserId && post.authorId === _currentUserId;
    const deletePostBtn = canDeletePost ? `<button class="delete-post-btn" onclick="deletePost('${post.id}')" title="Eliminar publicación">🗑️</button>` : '';

    postCard.innerHTML = `
        <div class="card-header">
            <div class="author-avatar">${post.authorAvatar || '👤'}</div>
            <div class="author-info">
                <h4>${post.authorName || post.author || 'Usuario'}
                    ${post.authorTarget ? `<span class="user-target">${post.authorTarget}</span>` : ''}
                    ${pinnedBadge}
                </h4>
                <span class="post-time">${post.timeText || 'Reciente'}</span>
            </div>
            ${deletePostBtn}
            <span class="${tagClass}">${tagLabel}</span>
        </div>
        <div class="card-body">
            <p>${post.content}</p>
            ${imageHtml}
        </div>
        <div class="card-footer">
            <button class="action-btn upvote-btn" id="upvote-btn-${post.id}" onclick="toggleUpvote(this, ${post.upvotes || 0})">
                🔼 Útil (${post.upvotes || 0})
            </button>
            <button class="action-btn comment-toggle-btn" onclick="toggleComments('${post.id}')">
                💬 Comentar (${commentCount})
            </button>
        </div>
        <div class="comments-section" id="comments-${post.id}"></div>
    `;

    container.appendChild(postCard);

    // Precarga los comentarios en el DOM (ocultos hasta click)
    renderComments(post.id, pinnedId);
}

/* ========================================================
   COMENTARIOS INLINE
   ======================================================== */
function toggleComments(postId) {
    const section = document.getElementById(`comments-${postId}`);
    if (!section) return;
    section.classList.toggle('open');

    // Si se abre y está vacío, renderliza comentarios
    if (section.classList.contains('open') && section.children.length === 0) {
        renderComments(postId);
    }
}

function renderComments(postId, pinnedId) {
    const section = document.getElementById(`comments-${postId}`);
    if (!section) return;

    const feedComments = _allComments.filter(c => c.postId === postId);
    const storedComments = JSON.parse(localStorage.getItem(`eduquest_comments_${postId}`)) || [];
    const allComments = [...feedComments, ...storedComments];

    // Determinar pin guardado en localStorage
    const savedPinnedId = localStorage.getItem(`eduquest_pinned_${postId}`) || pinnedId;

    section.innerHTML = '';

    if (allComments.length === 0) {
        section.innerHTML = '<p style="font-size:13px;color:#9ca3af;text-align:center;padding:8px 0 16px;">Sé el primero en responder esta duda 👇</p>';
    } else {
        // Ordenar: pinned primero
        const sorted = [...allComments].sort((a, b) => {
            if (a.id === savedPinnedId) return -1;
            if (b.id === savedPinnedId) return 1;
            return 0;
        });

        sorted.forEach(comment => {
            const isPinned = comment.id === savedPinnedId;
            const commentEl = document.createElement('div');
            commentEl.className = `comment-item${isPinned ? ' pinned-comment' : ''}`;
            commentEl.id = `comment-item-${comment.id}`;

            // Acciones: fijar y eliminar
            const isCommentAuthor = _currentUserId && comment.authorId === _currentUserId;
            const canPin = _currentUserId != null;

            let actionsHtml = '';
            const actionButtons = [];

            if (canPin) {
                actionButtons.push(`<button class="pin-btn ${isPinned ? 'active' : ''}" id="pin-btn-${comment.id}" onclick="togglePinComment('${postId}', '${comment.id}')">${isPinned ? '📌 Fijado' : '📌 Fijar'}</button>`);
            }
            if (isCommentAuthor) {
                actionButtons.push(`<button class="delete-action-btn" onclick="deleteComment('${postId}', '${comment.id}')" title="Eliminar respuesta">🗑️</button>`);
            }

            if (actionButtons.length > 0) {
                actionsHtml = `<div class="comment-actions-group">${actionButtons.join('')}</div>`;
            }

            commentEl.innerHTML = `
                ${actionsHtml}
                <div class="comment-avatar">${comment.authorAvatar || '👤'}</div>
                <div class="comment-body">
                    <div class="comment-author-row">
                        <span class="comment-author">${comment.authorName || 'Usuario'}</span>
                        ${isPinned ? '<span class="pin-badge">📌 Respuesta más útil</span>' : ''}
                        <span class="comment-time">${comment.createdAt ? formatTime(comment.createdAt) : 'Reciente'}</span>
                    </div>
                    <p class="comment-text">${comment.content}</p>
                </div>
            `;
            section.appendChild(commentEl);
        });
    }

    // Campo para nuevo comentario
    const inputRow = document.createElement('div');
    inputRow.className = 'comment-input-row';
    inputRow.innerHTML = `
        <textarea class="comment-input" id="comment-input-${postId}"
            placeholder="Escribe tu respuesta o solución paso a paso..."
            rows="1"
            oninput="autoResizeTextarea(this)"
            onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();submitComment('${postId}');}"
        ></textarea>
        <button class="comment-submit-btn" onclick="submitComment('${postId}')">Responder</button>
    `;
    section.appendChild(inputRow);
}

function submitComment(postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    if (!input) return;

    const content = input.value.trim();
    if (!content) return;

    const session = (typeof Storage !== 'undefined') ? Storage.getSession() : null;
    const userName = 'Tú';
    const userAvatar = '🚀';

    if (session && typeof UserManager !== 'undefined') {
        try {
            const user = UserManager.getUserById(session.userId);
            if (user) {
                // userName = user.name;
                // userAvatar = user.profile?.avatar || '🚀';
            }
        } catch (e) { }
    }

    const newComment = {
        id: `comment_${Date.now()}`,
        postId: postId,
        authorId: session?.userId || 'anonymous',
        authorName: 'Tú',
        authorAvatar: '🚀',
        content: content,
        isPinned: false,
        createdAt: new Date().toISOString()
    };

    // Guardar en localStorage
    const storedComments = JSON.parse(localStorage.getItem(`eduquest_comments_${postId}`)) || [];
    storedComments.push(newComment);
    localStorage.setItem(`eduquest_comments_${postId}`, JSON.stringify(storedComments));
    // Limpiar input y volver a renderizar
    input.value = '';
    input.style.height = 'auto';
    renderComments(postId);

    // Actualizar contador en el botón
    const toggleBtn = document.querySelector(`#post-card-${postId} .comment-toggle-btn`);
    if (toggleBtn) {
        const feedC = _allComments.filter(c => c.postId === postId).length;
        const storedC = JSON.parse(localStorage.getItem(`eduquest_comments_${postId}`))?.length || 0;
        toggleBtn.innerHTML = `💬 Comentar (${feedC + storedC})`;
    }
}

function togglePinComment(postId, commentId) {
    const currentPinned = localStorage.getItem(`eduquest_pinned_${postId}`);

    if (currentPinned === commentId) {
        // Desfijar
        localStorage.removeItem(`eduquest_pinned_${postId}`);
        updatePostPinInStorage(postId, null);
    } else {
        // Fijar este comentario
        localStorage.setItem(`eduquest_pinned_${postId}`, commentId);
        updatePostPinInStorage(postId, commentId);

        // Toast de confirmación
        if (window.app?.showToast) {
            window.app.showToast('📌 ¡Respuesta fijada como la más útil!', 'success');
        }
    }

    // Actualizar indicador en la cabecera del post
    const header = document.querySelector(`#post-card-${postId} .author-info h4`);
    if (header) {
        const existing = header.querySelector('.pin-badge');
        const newPinnedId = localStorage.getItem(`eduquest_pinned_${postId}`);
        if (newPinnedId && !existing) {
            header.insertAdjacentHTML('beforeend', '<span class="pin-badge">📌 Respuesta fijada</span>');
        } else if (!newPinnedId && existing) {
            existing.remove();
        }
    }

    renderComments(postId);
}

function updatePostPinInStorage(postId, pinnedCommentId) {
    const customPosts = JSON.parse(localStorage.getItem('eduquest_custom_posts')) || [];
    const idx = customPosts.findIndex(p => p.id === postId);
    if (idx !== -1) {
        customPosts[idx].pinnedCommentId = pinnedCommentId;
        localStorage.setItem('eduquest_custom_posts', JSON.stringify(customPosts));
    }
}

function autoResizeTextarea(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

/* ========================================================
   PUBLICAR NUEVA DUDA
   ======================================================== */
function addNewPost() {
    const input = document.getElementById('post-input');
    if (!input) return;

    const content = input.value.trim();
    if (!content) {
        input.style.borderColor = '#E24B4A';
        input.focus();
        setTimeout(() => { input.style.borderColor = ''; }, 2000);
        if (window.app?.showToast) window.app.showToast('⚠️ Por favor escribe el contenido de tu duda.', 'error');
        return;
    }

    const session = (typeof Storage !== 'undefined') ? Storage.getSession() : null;
    if (!session) return;

    let userName = 'Yo';
    let userAvatar = '🚀';
    let userTarget = 'UNI';

    if (typeof UserManager !== 'undefined') {
        const user = UserManager.getUserById(session.userId);
        if (user) {
            userName = user.name;
            userAvatar = user.profile?.avatar || '🚀';
            userTarget = user.profile?.target || 'UNI';
        }
    }

    // Determinar etiqueta
    // Se respeta la etiqueta seleccionada por el usuario. Si no eligió ninguna, por defecto '#Duda'
    const tag = _selectedTag || '#Duda';

    const newPost = {
        id: 'post_custom_' + Date.now(),
        authorId: session.userId,
        authorName: userName,
        authorAvatar: userAvatar,
        authorTarget: `Meta: ${userTarget}`,
        tag: tag,
        content: content,
        imageUrl: _selectedImageData || null,
        upvotes: 0,
        commentsCount: 0,
        pinnedCommentId: null,
        createdAt: new Date().toISOString()
    };

    // Guardar en localStorage
    const customPosts = JSON.parse(localStorage.getItem('eduquest_custom_posts')) || [];
    customPosts.unshift(newPost);
    localStorage.setItem('eduquest_custom_posts', JSON.stringify(customPosts));

    // Resetear estado del módulo
    input.value = '';
    _selectedImageData = null;
    _selectedImageMime = null;
    _selectedTag = null;

    // Cerrar panels
    const uploadZone = document.getElementById('image-upload-zone');
    const previewCont = document.getElementById('image-preview-container');
    const similarPanel = document.getElementById('similar-posts-panel');
    const attachBtn = document.getElementById('btn-attach-image');
    if (uploadZone) uploadZone.classList.remove('visible');
    if (previewCont) previewCont.classList.remove('visible');
    if (similarPanel) similarPanel.classList.remove('visible');
    if (attachBtn) attachBtn.classList.remove('active');

    // Resetear etiqueta
    const tagLabel = document.getElementById('selected-tag-label');
    if (tagLabel) tagLabel.textContent = 'Agregar etiqueta';

    // Ocultar error de imagen si había
    hideImageError();

    // Recargar feed
    loadFeedPosts();

    // Gamification
    if (typeof UserManager !== 'undefined') {
        const user = UserManager.getUserById(session.userId);
        if (user) UserManager.addXp(user.id, 50);
    }

    if (window.GamificationManager) {
        GamificationManager.updateDailyChallengeProgress('create_post', 1);
        if (session?.userId) GamificationManager.checkAndAwardBadge(session.userId, 'badge_curious');
    }

    if (window.UserBindingManager) UserBindingManager.bindAll();

    if (window.app?.showToast) window.app.showToast('✅ ¡Duda publicada! La comunidad te ayudará pronto.', 'success');
}

/* ========================================================
   ELIMINAR POST / COMENTARIO
   ======================================================== */
function deletePost(postId) {
    if (!confirm('¿Estás seguro de que deseas eliminar esta publicación?')) return;

    // Remover de _allPosts en memoria
    _allPosts = _allPosts.filter(p => p.id !== postId);

    // Remover de localStorage si es custom
    let customPosts = JSON.parse(localStorage.getItem('eduquest_custom_posts')) || [];
    const initialLen = customPosts.length;
    customPosts = customPosts.filter(p => p.id !== postId);

    if (customPosts.length < initialLen) {
        localStorage.setItem('eduquest_custom_posts', JSON.stringify(customPosts));
    }

    // Limpiar localStorage relacionado
    localStorage.removeItem(`eduquest_comments_${postId}`);
    localStorage.removeItem(`eduquest_pinned_${postId}`);

    // Quitar del DOM
    const card = document.getElementById(`post-card-${postId}`);
    if (card) {
        card.style.opacity = '0';
        setTimeout(() => card.remove(), 250);
    }

    if (window.app?.showToast) window.app.showToast('🗑️ Publicación eliminada', 'success');
}

function deleteComment(postId, commentId) {
    if (!confirm('¿Seguro que deseas eliminar esta respuesta?')) return;

    // Remover de memoria
    _allComments = _allComments.filter(c => c.id !== commentId);

    // Remover de localStorage
    let storedComments = JSON.parse(localStorage.getItem(`eduquest_comments_${postId}`)) || [];
    storedComments = storedComments.filter(c => c.id !== commentId);
    localStorage.setItem(`eduquest_comments_${postId}`, JSON.stringify(storedComments));

    // Si estaba fijado, desfijar
    if (localStorage.getItem(`eduquest_pinned_${postId}`) === commentId) {
        localStorage.removeItem(`eduquest_pinned_${postId}`);
        updatePostPinInStorage(postId, null);
    }

    // Volver a renderizar
    renderComments(postId);

    // Actualizar contador
    const toggleBtn = document.querySelector(`#post-card-${postId} .comment-toggle-btn`);
    if (toggleBtn) {
        const feedC = _allComments.filter(c => c.postId === postId).length;
        const storedC = JSON.parse(localStorage.getItem(`eduquest_comments_${postId}`))?.length || 0;
        toggleBtn.innerHTML = `💬 Comentar (${feedC + storedC})`;
    }
}

/* ========================================================
   MANEJO DE IMAGEN
   ======================================================== */
function toggleImageUpload() {
    const zone = document.getElementById('image-upload-zone');
    const attachBtn = document.getElementById('btn-attach-image');
    const preview = document.getElementById('image-preview-container');

    if (!zone) return;

    // Si ya hay preview, no mostrar zona (ya está subida la imagen)
    if (preview && preview.classList.contains('visible')) {
        removeSelectedImage();
        return;
    }

    const isVisible = zone.classList.toggle('visible');
    if (attachBtn) attachBtn.classList.toggle('active', isVisible);
}

function handleImageSelect(input) {
    if (!input.files || input.files.length === 0) return;
    processImageFile(input.files[0]);
    // Resetear el input para permitir volver a seleccionar el mismo archivo
    input.value = '';
}

function handleImageDrop(event) {
    event.preventDefault();
    const zone = document.getElementById('image-upload-zone');
    if (zone) zone.classList.remove('dragover');

    const files = event.dataTransfer.files;
    if (!files || files.length === 0) return;
    processImageFile(files[0]);
}

function processImageFile(file) {
    hideImageError();

    // --- ESCENARIO DE ERROR ---
    // Validar tipo de archivo
    if (!VALID_IMAGE_TYPES.includes(file.type)) {
        showImageError('Sube un formato de imagen válido (PNG, JPG, JPEG, GIF, WEBP)');
        return;
    }

    // Validar tamaño
    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
        showImageError(`El archivo es demasiado grande. Máximo ${MAX_IMAGE_SIZE_MB} MB.`);
        return;
    }

    // Leer y mostrar preview
    const reader = new FileReader();
    reader.onload = (e) => {
        _selectedImageData = e.target.result;
        _selectedImageMime = file.type;

        const previewImg = document.getElementById('image-preview-img');
        const previewCont = document.getElementById('image-preview-container');
        const uploadZone = document.getElementById('image-upload-zone');
        const attachBtn = document.getElementById('btn-attach-image');

        if (previewImg) previewImg.src = _selectedImageData;
        if (previewCont) previewCont.classList.add('visible');
        if (uploadZone) uploadZone.classList.remove('visible');
        if (attachBtn) {
            attachBtn.classList.add('active');
            attachBtn.innerHTML = '✅ Imagen lista';
        }

        // Auto-seleccionar etiqueta #Duda
        if (!_selectedTag) selectTag('#Duda', '❓');
    };

    reader.onerror = () => {
        showImageError('No se pudo leer el archivo. Puede estar dañado.');
    };

    reader.readAsDataURL(file);
}

function removeSelectedImage() {
    _selectedImageData = null;
    _selectedImageMime = null;

    const previewCont = document.getElementById('image-preview-container');
    const previewImg = document.getElementById('image-preview-img');
    const uploadZone = document.getElementById('image-upload-zone');
    const attachBtn = document.getElementById('btn-attach-image');

    if (previewCont) previewCont.classList.remove('visible');
    if (previewImg) previewImg.src = '';
    if (uploadZone) uploadZone.classList.remove('visible');
    if (attachBtn) {
        attachBtn.classList.remove('active');
        attachBtn.innerHTML = '📷 Adjuntar imagen';
    }
}

function showImageError(message) {
    const banner = document.getElementById('image-error-banner');
    const errorTxt = document.getElementById('image-error-text');

    if (banner) {
        if (errorTxt) errorTxt.textContent = message;
        // Reiniciar animación
        banner.classList.remove('visible');
        void banner.offsetWidth;
        banner.classList.add('visible');

        // Auto-ocultar después de 5s
        setTimeout(() => hideImageError(), 5000);
    }
}

function hideImageError() {
    const banner = document.getElementById('image-error-banner');
    if (banner) banner.classList.remove('visible');
}

/* ========================================================
   LIGHTBOX DE IMAGEN
   ======================================================== */
function openImageLightbox(src) {
    const overlay = document.getElementById('image-lightbox');
    const img = document.getElementById('lightbox-img');
    if (!overlay || !img) return;
    img.src = src;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeImageLightbox() {
    const overlay = document.getElementById('image-lightbox');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
}

// Cerrar lightbox con ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeImageLightbox();
});

/* ========================================================
   SELECTOR DE ETIQUETA
   ======================================================== */
function toggleTagDropdown() {
    const dropdown = document.getElementById('tag-dropdown');
    if (dropdown) dropdown.classList.toggle('open');
}

function selectTag(tagName, tagIcon) {
    _selectedTag = tagName;
    const label = document.getElementById('selected-tag-label');
    if (label) label.textContent = `${tagIcon} ${tagName}`;

    const dropdown = document.getElementById('tag-dropdown');
    if (dropdown) dropdown.classList.remove('open');

    const tagBtn = document.getElementById('btn-tag-selector');
    if (tagBtn) tagBtn.classList.add('active');
}

/* ========================================================
   BÚSQUEDA DE PUBLICACIONES SIMILARES (ESCENARIO ALTERNATIVO)
   ======================================================== */
function initPostInputListener() {
    const input = document.getElementById('post-input');
    if (!input) return;

    input.addEventListener('input', () => {
        clearTimeout(_similarSearchTimer);
        const query = input.value.trim();

        if (query.length < 10) {
            const panel = document.getElementById('similar-posts-panel');
            if (panel) panel.classList.remove('visible');
            return;
        }

        // Debounce: esperar 600ms después de que el usuario pare de escribir
        _similarSearchTimer = setTimeout(() => {
            searchSimilarPosts(query);
        }, 600);
    });
}

function searchSimilarPosts(query) {
    if (!_allPosts || _allPosts.length === 0) return;

    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    if (keywords.length === 0) return;

    const matches = _allPosts
        .filter(post => {
            const text = (post.content + ' ' + post.tag).toLowerCase();
            return keywords.some(kw => text.includes(kw));
        })
        .slice(0, 3); // máximo 3 sugerencias

    const panel = document.getElementById('similar-posts-panel');
    const list = document.getElementById('similar-posts-list');

    if (!panel || !list) return;

    if (matches.length === 0) {
        panel.classList.remove('visible');
        return;
    }

    list.innerHTML = matches.map(post => `
        <div class="similar-post-item" onclick="scrollToPost('${post.id}')">
            <span class="similar-post-tag-mini">${post.tag || 'General'}</span>
            <div class="similar-post-text">
                <strong>${(post.authorName || 'Usuario')}</strong>:
                ${post.content.length > 100 ? post.content.substring(0, 100) + '…' : post.content}
            </div>
            <div class="similar-upvotes">🔼 ${post.upvotes || 0}</div>
        </div>
    `).join('');

    panel.classList.add('visible');
}

function scrollToPost(postId) {
    // Cerrar el panel
    const panel = document.getElementById('similar-posts-panel');
    if (panel) panel.classList.remove('visible');

    // Buscar la tarjeta en el DOM
    const card = document.getElementById(`post-card-${postId}`);
    if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.style.boxShadow = '0 0 0 3px rgba(127, 119, 221, 0.4)';
        setTimeout(() => { card.style.boxShadow = ''; }, 2000);
    }
}

/* ========================================================
   UPVOTE
   ======================================================== */
function toggleUpvote(button, currentUpvotes) {
    if (button.classList.contains('active')) {
        button.classList.remove('active');
        button.innerHTML = `🔼 Útil (${currentUpvotes})`;
    } else {
        button.classList.add('active');
        button.innerHTML = `🔥 ¡Apoyado! (${currentUpvotes + 1})`;
    }
}

/* ========================================================
   UTILIDADES
   ======================================================== */
function formatTime(isoString) {
    try {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Ahora mismo';
        if (diffMins < 60) return `Hace ${diffMins} min`;
        if (diffHours < 24) return `Hace ${diffHours} h`;
        if (diffDays < 7) return `Hace ${diffDays} días`;
        return date.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
    } catch (e) {
        return 'Reciente';
    }
}

/* ========================================================
   EXPORTS GLOBALES
   ======================================================== */
window.addNewPost = addNewPost;
window.toggleUpvote = toggleUpvote;
window.toggleImageUpload = toggleImageUpload;
window.handleImageSelect = handleImageSelect;
window.handleImageDrop = handleImageDrop;
window.removeSelectedImage = removeSelectedImage;
window.toggleTagDropdown = toggleTagDropdown;
window.selectTag = selectTag;
window.toggleComments = toggleComments;
window.submitComment = submitComment;
window.togglePinComment = togglePinComment;
window.deletePost = deletePost;
window.deleteComment = deleteComment;
window.scrollToPost = scrollToPost;
window.openImageLightbox = openImageLightbox;
window.closeImageLightbox = closeImageLightbox;
window.autoResizeTextarea = autoResizeTextarea;