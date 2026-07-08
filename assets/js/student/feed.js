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
let _cachedPosts = []; // caché de posts mapeados para filtrado
let _allComments = [];   // caché de todos los comentarios
let _similarSearchTimer = null; // debounce para búsqueda de similares
let _currentUserId = null; // id del usuario en sesión
let _feedFilterDebounce = null; // debounce para filtro de texto

// Filtros activos del foro
let _activeFilters = {
    course: 'todos',
    type: 'todos',
    author: 'todos',
    otros: 'todos',
    search: ''
};

// Formatos de imagen válidos
const VALID_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
const MAX_IMAGE_SIZE_MB = 5;

/* ========================================================
   INICIALIZACIÓN
   ======================================================== */
document.addEventListener('DOMContentLoaded', () => {
    loadFeedPosts();
    initPostInputListener();
    loadCustomTags();

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
        const { data: enrichedPosts, error } = await supabase.rpc('get_forum_feed', { limit_val: 50, offset_val: 0 });
        
        if (error) {
            console.error("Error cargando feed desde Supabase:", error);
            return;
        }

        // Guardar userId del usuario en sesión ANTES de renderizar
        const user = window.CurrentUserService ? CurrentUserService.getProfile() : null;
        _currentUserId = user?.id || null;

        if (!enrichedPosts || enrichedPosts.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--sub);"><p>Aún no hay publicaciones en el foro. ¡Sé el primero en preguntar algo!</p></div>';
            return;
        }

        // Renderizar usando los datos de Supabase y renderPostCard
        enrichedPosts.forEach(post => {
            // Mapeamos de Supabase snake_case a camelCase para renderPostCard
            const mappedPost = {
                id: post.id,
                authorId: post.author_id,
                authorAvatar: post.author_avatar,
                authorName: post.author_name,
                authorTarget: post.author_badge || post.author_target,
                authorRole: post.author_role,
                tag: post.tag,
                content: post.content,
                imageUrl: post.image_url,
                upvotes: post.upvotes,
                timeText: post.created_at ? formatTime(post.created_at) : 'Reciente',
                commentsCount: parseInt(post.comments_count) || 0,
                isLikedByMe: post.is_liked_by_me || false
            };
            renderPostCard(mappedPost, container);
        });

    } catch (error) {
        console.error('Error cargando el feed:', error);
        const container = document.getElementById('feed-container');
        if (container) container.innerHTML = '<p style="color:#9ca3af;padding:24px;text-align:center;">No se pudo cargar el feed. Intenta recargar la página.</p>';
    }
}

function renderPostCard(post, container) {
    const rawTags = post.tag || 'General';
    const isAnnouncement = post.authorRole === 'teacher' ||
        rawTags.toLowerCase().includes('anuncio') || rawTags.toLowerCase().includes('comunicado');

    const postCard = document.createElement('div');
    postCard.className = isAnnouncement ? 'feed-card is-announcement' : 'feed-card';
    postCard.id = `post-card-${post.id}`;

    const tagHtml = rawTags.split(',').map(t => {
        const cleaned = t.trim();
        const lower = cleaned.toLowerCase();
        const isDuda = lower.includes('duda');
        const isAnn = lower.includes('anuncio') || lower.includes('comunicado');
        const tagClass = isAnn ? 'post-tag announcement-tag' : (isDuda ? 'post-tag duda-tag' : 'post-tag');
        return `<span class="${tagClass}">${cleaned}</span>`;
    }).join(' ');

    const announcementBanner = isAnnouncement
        ? '<div class="announcement-banner">📢 Anuncio del docente</div>'
        : '';

    // Imagen adjunta
    const imageHtml = post.imageUrl ? `
        <div class="card-image" onclick="openImageLightbox('${post.imageUrl.replace(/'/g, "\\'")}')">
            <span class="card-image-badge">📷 Imagen adjunta</span>
            <img src="${post.imageUrl}" alt="Imagen del ejercicio" loading="lazy">
        </div>` : '';

    // Ahora recibimos la cantidad de comentarios desde Supabase directamente
    const commentCount = post.commentsCount || 0;
    const pinnedId = post.pinnedCommentId || null;

    // Indicador de respuesta fijada
    const pinnedBadge = pinnedId ? `<span class="pin-badge">📌 Respuesta fijada</span>` : '';

    // Botón de eliminar post (solo si es su post)
    const canDeletePost = _currentUserId && post.authorId === _currentUserId;
    const deletePostBtn = canDeletePost ? `<button class="delete-post-btn" onclick="deletePost('${post.id}')" title="Eliminar publicación">🗑️</button>` : '';

    const upvoteActive = post.isLikedByMe ? 'active' : '';
    const upvoteText = post.isLikedByMe ? `🔥 ¡Apoyado! (${post.upvotes || 0})` : `🔼 Útil (${post.upvotes || 0})`;

    const { emoji: postEmoji, color: postColor } = window.parseAvatar ? window.parseAvatar(post.authorAvatar) : { emoji: post.authorAvatar || '👤', color: 'var(--indigo)' };

    postCard.innerHTML = `
        ${announcementBanner}
        <div class="card-header">
            <div class="author-avatar" style="background-color: ${postColor};">${postEmoji}</div>
            <div class="author-info">
                <h4>${post.authorName || post.author || 'Usuario'}
                    ${post.authorTarget ? `<span class="user-target">${post.authorTarget}</span>` : ''}
                    ${post.authorRole === 'teacher' ? '<span class="user-target teacher-badge">Docente</span>' : ''}
                    ${pinnedBadge}
                </h4>
                <span class="post-time">${post.timeText || 'Reciente'}</span>
            </div>
            ${deletePostBtn}
            <div class="post-tags-container" style="display: flex; gap: 6px; flex-wrap: wrap; margin-left: 8px;">
                ${tagHtml}
            </div>
        </div>
        <div class="card-body">
            <p>${post.content}</p>
            ${imageHtml}
        </div>
        <div class="card-footer">
            <button class="action-btn upvote-btn ${upvoteActive}" id="upvote-btn-${post.id}" onclick="toggleUpvote(this, ${post.upvotes || 0})">
                ${upvoteText}
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

async function renderComments(postId, pinnedId) {
    const section = document.getElementById(`comments-${postId}`);
    if (!section) return;

    // Obtener comentarios de Supabase
    const { data: allComments, error } = await supabase
        .from('forum_comments')
        .select('*, profiles(name, avatar_url)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error("Error cargando comentarios:", error);
        return;
    }

    // Determinar pin guardado localmente (o desde la DB si se agregara lógica más avanzada)
    const savedPinnedId = localStorage.getItem(`eduquest_pinned_${postId}`) || pinnedId;

    section.innerHTML = '';

    if (!allComments || allComments.length === 0) {
        section.innerHTML = '<p style="font-size:13px;color:#9ca3af;text-align:center;padding:8px 0 16px;">Sé el primero en responder esta duda 👇</p>';
    } else {
        // Ordenar: pinned primero
        const sorted = [...allComments].sort((a, b) => {
            if (a.id === savedPinnedId || a.is_pinned) return -1;
            if (b.id === savedPinnedId || b.is_pinned) return 1;
            return 0;
        });

        sorted.forEach(comment => {
            const isPinned = comment.id === savedPinnedId || comment.is_pinned;
            const commentEl = document.createElement('div');
            commentEl.className = `comment-item${isPinned ? ' pinned-comment' : ''}`;
            commentEl.id = `comment-item-${comment.id}`;

                    // Acciones: fijar y eliminar
            // ✔ FIX: Solo el autor del POST puede fijar respuestas en sus publicaciones
            const isCommentAuthor = _currentUserId && comment.author_id === _currentUserId;
            const isPostAuthor = _currentUserId && _cachedPosts.some(p => p.id === postId && p.authorId === _currentUserId);
            const canPin = isPostAuthor; // Solo el dueño del post puede fijar
            const canDeleteComment = isCommentAuthor; // Solo el autor del comentario puede borrarlo

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
            
            const authorName = comment.profiles?.name || 'Usuario';
            const authorAvatar = comment.profiles?.avatar_url || '👤';
            const { emoji: commentEmoji, color: commentColor } = window.parseAvatar ? window.parseAvatar(authorAvatar) : { emoji: authorAvatar, color: 'var(--indigo)' };

            commentEl.innerHTML = `
                ${actionsHtml}
                <div class="comment-avatar" style="background-color: ${commentColor};">${commentEmoji}</div>
                <div class="comment-body">
                    <div class="comment-author-row">
                        <span class="comment-author">${authorName}</span>
                        ${isPinned ? '<span class="pin-badge">📌 Respuesta más útil</span>' : ''}
                        <span class="comment-time">${comment.created_at ? formatTime(comment.created_at) : 'Reciente'}</span>
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

async function submitComment(postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    if (!input) return;

    const content = input.value.trim();
    if (!content) return;

    const user = window.CurrentUserService ? CurrentUserService.getProfile() : null;
    if (!user) {
        if (window.app?.showToast) window.app.showToast('⚠️ Debes iniciar sesión para comentar', 'warning');
        return;
    }

    // Insertar en Supabase
    const { error } = await supabase.from('forum_comments').insert({
        post_id: postId,
        author_id: user.id,
        content: content,
        is_pinned: false
    });

    if (error) {
        console.error("Error al publicar comentario:", error);
        if (window.app?.showToast) window.app.showToast('❌ Ocurrió un error al comentar.', 'error');
        return;
    }

    // Limpiar input y volver a renderizar
    input.value = '';
    input.style.height = 'auto';
    await renderComments(postId);

    // Actualizar contador en el botón
    const toggleBtn = document.querySelector(`#post-card-${postId} .comment-toggle-btn`);
    if (toggleBtn) {
        // Consultar la nueva cantidad total
        const { count } = await supabase.from('forum_comments').select('*', { count: 'exact', head: true }).eq('post_id', postId);
        toggleBtn.innerHTML = `💬 Comentar (${count || 0})`;
    }
}

async function togglePinComment(postId, commentId) {
    // 1. Obtener el comentario actual para saber su estado
    const { data: comment, error: fetchErr } = await supabase
        .from('forum_comments')
        .select('is_pinned')
        .eq('id', commentId)
        .single();

    if (fetchErr) return;

    const newPinnedStatus = !comment.is_pinned;

    // 2. Si vamos a fijar, primero desfijamos cualquier otro comentario de este post
    if (newPinnedStatus) {
        await supabase
            .from('forum_comments')
            .update({ is_pinned: false })
            .eq('post_id', postId);
    }

    // 3. Actualizamos el estado del comentario clickeado
    const { error: updateErr } = await supabase
        .from('forum_comments')
        .update({ is_pinned: newPinnedStatus })
        .eq('id', commentId);

    if (updateErr) {
        if (window.app?.showToast) window.app.showToast('❌ Error al fijar la respuesta', 'error');
        return;
    }

    if (window.app?.showToast) {
        window.app.showToast(newPinnedStatus ? '📌 ¡Respuesta fijada como la más útil!' : 'Respuesta desfijada', 'success');
    }

    // Actualizar indicador en la cabecera del post
    const header = document.querySelector(`#post-card-${postId} .author-info h4`);
    if (header) {
        const existing = header.querySelector('.pin-badge');
        if (newPinnedStatus && !existing) {
            header.insertAdjacentHTML('beforeend', '<span class="pin-badge">📌 Respuesta fijada</span>');
        } else if (!newPinnedStatus && existing) {
            existing.remove();
        }
    }

    await renderComments(postId);
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
async function addNewPost() {
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

    const user = window.CurrentUserService ? CurrentUserService.getProfile() : null;
    if (!user) return;

    // Determinar etiquetas concatenadas
    const tag = _selectedTags.length > 0 ? _selectedTags.map(t => t.name).join(', ') : '#Duda';

    // Insertar en Supabase
    const { error } = await supabase.from('forum_posts').insert({
        author_id: user.id,
        tag: tag,
        content: content,
        image_url: _selectedImageData || null,
        upvotes: 0
    });

    if (error) {
        console.error("Error al publicar la duda:", error);
        if (window.app?.showToast) window.app.showToast('❌ Ocurrió un error al publicar tu duda.', 'error');
        return;
    }

    // Resetear estado del módulo
    input.value = '';
    _selectedImageData = null;
    _selectedImageMime = null;
    _selectedTags = [];

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
    const container = document.getElementById('selected-tags-container');
    if (container) container.innerHTML = '';

    // Ocultar error de imagen si había
    hideImageError();

    // Recargar feed
    loadFeedPosts();

    // Gamification
    if (typeof UserManager !== 'undefined') {
        const user = CurrentUserService.getProfile();
        if (user) UserManager.addXp(user.id, 50);
    }

    if (window.GamificationManager) {
        GamificationManager.updateDailyChallengeProgress('create_post', 1);
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) GamificationManager.checkAndAwardBadge(session.user.id, 'badge_curious');
    }

    if (window.UserBindingManager) UserBindingManager.bindAll();

    if (window.app?.showToast) window.app.showToast('✅ ¡Duda publicada! La comunidad te ayudará pronto.', 'success');
}

/* ========================================================
   ELIMINAR POST / COMENTARIO
   ======================================================== */
async function deletePost(postId) {
    if (!confirm('¿Estás seguro de que deseas eliminar esta publicación?')) return;

    // Eliminar de Supabase
    const { error } = await supabase.from('forum_posts').delete().eq('id', postId);

    if (error) {
        console.error("Error al eliminar el post:", error);
        if (window.app?.showToast) window.app.showToast('❌ Ocurrió un error al eliminar.', 'error');
        return;
    }

    // Quitar del DOM con animación
    const card = document.getElementById(`post-card-${postId}`);
    if (card) {
        card.style.opacity = '0';
        setTimeout(() => card.remove(), 250);
    }

    if (window.app?.showToast) window.app.showToast('🗑️ Publicación eliminada', 'success');
}

async function deleteComment(postId, commentId) {
    if (!confirm('¿Seguro que deseas eliminar esta respuesta?')) return;

    // Remover de Supabase
    const { error } = await supabase.from('forum_comments').delete().eq('id', commentId);
    
    if (error) {
        if (window.app?.showToast) window.app.showToast('❌ Error al eliminar', 'error');
        return;
    }

    // Volver a renderizar
    await renderComments(postId);

    // Actualizar contador
    const toggleBtn = document.querySelector(`#post-card-${postId} .comment-toggle-btn`);
    if (toggleBtn) {
        const { count } = await supabase.from('forum_comments').select('*', { count: 'exact', head: true }).eq('post_id', postId);
        toggleBtn.innerHTML = `💬 Comentar (${count || 0})`;
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
/* ========================================================
   SELECTOR DE ETIQUETAS MÚLTIPLES Y GESTIÓN DE PERSONALIZADAS
   ======================================================== */
let _selectedTags = []; // Array de objetos { name, icon }

function toggleTagDropdown() {
    const dropdown = document.getElementById('tag-dropdown');
    if (dropdown) dropdown.classList.toggle('open');
}

function selectTag(tagName, tagIcon) {
    // Si ya está seleccionada, removerla (toggle)
    const index = _selectedTags.findIndex(t => t.name === tagName);
    if (index !== -1) {
        _selectedTags.splice(index, 1);
    } else {
        // Permitir un límite razonable de etiquetas, p. ej. 3
        if (_selectedTags.length >= 3) {
            if (window.app?.showToast) window.app.showToast('⚠️ Máximo 3 etiquetas por publicación', 'error');
            return;
        }
        _selectedTags.push({ name: tagName, icon: tagIcon });
    }

    renderSelectedTagsBadge();
    updateActiveTagOptionsVisuals();
}

function renderSelectedTagsBadge() {
    const container = document.getElementById('selected-tags-container');
    if (!container) return;

    container.innerHTML = '';

    if (_selectedTags.length === 0) {
        const tagBtn = document.getElementById('btn-tag-selector');
        if (tagBtn) tagBtn.classList.remove('active');
        return;
    }

    // Renderizar tags como pastillas ordenadas al lado del botón de selección
    _selectedTags.forEach(t => {
        const pill = document.createElement('span');
        pill.className = 'selected-tag-pill';
        pill.innerHTML = `
            ${t.icon} ${t.name}
            <span onclick="selectTag('${t.name.replace(/'/g, "\\'")}', '${t.icon}')" style="cursor: pointer; font-weight: bold; margin-left: 4px; color: var(--red);">✕</span>
        `;
        container.appendChild(pill);
    });

    const tagBtn = document.getElementById('btn-tag-selector');
    if (tagBtn) tagBtn.classList.add('active');
}

function updateActiveTagOptionsVisuals() {
    document.querySelectorAll('#tag-dropdown .tag-option').forEach(opt => {
        // Encontrar si este option está en la lista de seleccionados
        const optText = opt.textContent || '';
        const isSelected = _selectedTags.some(t => optText.includes(t.name));
        opt.classList.toggle('selected-tag-option', isSelected);
    });
}

function loadCustomTags() {
    const customTags = JSON.parse(localStorage.getItem('eduquest_custom_tags') || '[]');
    customTags.forEach(tag => {
        addTagOptionToDOM(tag.name, tag.icon);
        addFilterChipToDOM(tag.name, tag.icon);
    });
}

function createCustomTag() {
    const input = document.getElementById('custom-tag-input');
    if (!input) return;

    const tagName = input.value.trim();
    if (!tagName) {
        if (window.app?.showToast) window.app.showToast('⚠️ Escribe el nombre de la etiqueta', 'error');
        return;
    }

    const customTags = JSON.parse(localStorage.getItem('eduquest_custom_tags') || '[]');
    if (customTags.some(t => t.name.toLowerCase() === tagName.toLowerCase())) {
        if (window.app?.showToast) window.app.showToast('⚠️ Esa etiqueta ya existe', 'error');
        return;
    }

    const tagIcon = '🏷️';
    const newTag = { name: tagName, icon: tagIcon };
    customTags.push(newTag);
    localStorage.setItem('eduquest_custom_tags', JSON.stringify(customTags));

    addTagOptionToDOM(tagName, tagIcon);
    addFilterChipToDOM(tagName, tagIcon);

    selectTag(tagName, tagIcon);
    input.value = '';

    if (window.app?.showToast) window.app.showToast(`✨ Etiqueta "${tagName}" creada`, 'success');
}

function deleteCustomTag(name, event) {
    if (event) event.stopPropagation();

    if (!confirm(`¿Deseas eliminar la etiqueta "${name}"? Se quitará de tu lista y tus filtros.`)) return;

    // Remover de localStorage
    let customTags = JSON.parse(localStorage.getItem('eduquest_custom_tags') || '[]');
    customTags = customTags.filter(t => t.name !== name);
    localStorage.setItem('eduquest_custom_tags', JSON.stringify(customTags));

    // Deseleccionar si estaba seleccionada
    const index = _selectedTags.findIndex(t => t.name === name);
    if (index !== -1) {
        _selectedTags.splice(index, 1);
        renderSelectedTagsBadge();
    }

    // Remover del DOM (Selector dropdown - Categoría Otros)
    const options = document.querySelectorAll('#tag-options-otros .tag-option');
    options.forEach(opt => {
        if (opt.textContent.includes(name)) opt.remove();
    });

    // Ocultar encabezado Otros si no quedan etiquetas
    const otrosContainer = document.getElementById('tag-options-otros');
    const otrosHeader = document.getElementById('otros-header');
    if (otrosContainer && otrosHeader && otrosContainer.children.length === 0) {
        otrosHeader.style.display = 'none';
    }

    // Remover del DOM (Filtros de búsqueda - Grupo Otros)
    const chips = document.querySelectorAll('#filter-chips-otros .feed-filter-chip:not([data-val="todos"])');
    chips.forEach(chip => {
        if (chip.getAttribute('data-val') === name) chip.remove();
    });

    // Ocultar grupo Otros en filtros si no quedan chips custom
    const otrosGroup = document.getElementById('filter-group-otros');
    const otrosChipsContainer = document.getElementById('filter-chips-otros');
    if (otrosGroup && otrosChipsContainer) {
        const customChips = otrosChipsContainer.querySelectorAll('.feed-filter-chip:not([data-val="todos"])');
        if (customChips.length === 0) otrosGroup.style.display = 'none';
    }

    if (window.app?.showToast) window.app.showToast(`🗑️ Etiqueta "${name}" eliminada`, 'success');
}

function addTagOptionToDOM(name, icon) {
    const otrosContainer = document.getElementById('tag-options-otros');
    const otrosHeader = document.getElementById('otros-header');
    if (!otrosContainer) return;

    const opt = document.createElement('div');
    opt.className = 'tag-option';
    opt.setAttribute('onclick', `selectTag('${name.replace(/'/g, "\\'")}', '${icon}')`);
    
    opt.innerHTML = `
        <span style="flex:1;">${icon} ${name}</span>
        <span class="delete-tag-btn" onclick="deleteCustomTag('${name.replace(/'/g, "\\'")}', event)" style="cursor:pointer; padding: 2px 6px; border-radius: 4px; background: #fee2e2; color: var(--red); font-size: 11px; margin-left: 8px;">Eliminar</span>
    `;

    otrosContainer.appendChild(opt);

    // Mostrar el encabezado de la categoría
    if (otrosHeader) otrosHeader.style.display = '';
}

function addFilterChipToDOM(name, icon) {
    const otrosContainer = document.getElementById('filter-chips-otros');
    const otrosGroup = document.getElementById('filter-group-otros');
    if (!otrosContainer) return;

    if (otrosContainer.querySelector(`[data-val="${name}"]`)) return;

    const chip = document.createElement('button');
    chip.className = 'feed-filter-chip';
    chip.setAttribute('data-filter', 'otros');
    chip.setAttribute('data-val', name);
    chip.setAttribute('onclick', `setFeedFilter('otros', '${name.replace(/'/g, "\\'")}', this)`);
    chip.textContent = `${icon} ${name}`;

    otrosContainer.appendChild(chip);

    // Mostrar el grupo de filtros Otros
    if (otrosGroup) otrosGroup.style.display = '';
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
async function toggleUpvote(button, currentUpvotes) {
    const postId = button.id.replace('upvote-btn-', '');
    const isCurrentlyActive = button.classList.contains('active');
    
    // UI Update optimista
    if (isCurrentlyActive) {
        button.classList.remove('active');
        button.innerHTML = `🔼 Útil (${Math.max(0, currentUpvotes - 1)})`;
    } else {
        button.classList.add('active');
        button.innerHTML = `🔥 ¡Apoyado! (${currentUpvotes + 1})`;
    }

    // Llamar a la función RPC que maneja la lógica atómica y salta el RLS
    const { data: newUpvotes, error } = await supabase.rpc('toggle_forum_upvote', { p_post_id: postId });

    if (error) {
        console.error("Error al actualizar upvotes:", error);
        // Si hay error revertimos la UI optimista
        if (isCurrentlyActive) {
            button.classList.add('active');
            button.innerHTML = `🔥 ¡Apoyado! (${currentUpvotes})`;
        } else {
            button.classList.remove('active');
            button.innerHTML = `🔼 Útil (${currentUpvotes})`;
        }
        if (window.app?.showToast) window.app.showToast('❌ Error al registrar tu voto', 'error');
    } else if (newUpvotes !== null) {
        // Asegurar que el botón muestre el valor real devuelto por la base de datos
        if (button.classList.contains('active')) {
            button.innerHTML = `🔥 ¡Apoyado! (${newUpvotes})`;
        } else {
            button.innerHTML = `🔼 Útil (${newUpvotes})`;
        }
        
        // Actualizamos el onclick para que reciba el número correcto la próxima vez
        button.setAttribute('onclick', `toggleUpvote(this, ${newUpvotes})`);
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

/* ========================================================
   FILTROS DEL FORO COMUNITARIO
   ======================================================== */

/**
 * Renderiza solo los posts que coinciden con los filtros activos.
 */
function renderFilteredPosts() {
    const container = document.getElementById('feed-container');
    if (!container) return;

    container.innerHTML = '';

    const { course, type, author, search } = _activeFilters;
    const searchLower = search.toLowerCase().trim();

    const filtered = _cachedPosts.filter(post => {
        // Filtro por curso (tag)
        if (course !== 'todos') {
            const tagLower = (post.tag || '').toLowerCase();
            if (!tagLower.includes(course.toLowerCase())) return false;
        }

        // Filtro por tipo de publicación
        if (type !== 'todos') {
            const tagLower = (post.tag || '').toLowerCase();
            if (!tagLower.includes(type.toLowerCase())) return false;
        }

        // Filtro por tipo de autor
        if (author !== 'todos') {
            const role = post.authorRole || 'student';
            if (author === 'profesor' && role !== 'teacher') return false;
            if (author === 'estudiante' && role === 'teacher') return false;
        }

        // Filtro por etiquetas personalizadas (categoría Otros)
        const otros = _activeFilters.otros;
        if (otros !== 'todos') {
            const tagLower = (post.tag || '').toLowerCase();
            if (!tagLower.includes(otros.toLowerCase())) return false;
        }

        // Búsqueda de texto libre (contenido + tag)
        if (searchLower) {
            const contentLower = (post.content || '').toLowerCase();
            const tagLower = (post.tag || '').toLowerCase();
            const nameLower = (post.authorName || '').toLowerCase();
            if (!contentLower.includes(searchLower) && !tagLower.includes(searchLower) && !nameLower.includes(searchLower)) {
                return false;
            }
        }

        return true;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:48px 24px; color:var(--sub);">
                <div style="font-size:40px; margin-bottom:12px;">🔍</div>
                <p style="font-size:16px; font-weight:600; color:var(--text); margin-bottom:6px;">No se encontraron publicaciones</p>
                <p style="font-size:14px;">Intenta con otros filtros o términos de búsqueda.</p>
                <button onclick="resetFeedFilters()" style="margin-top:16px; padding:8px 20px; border:1px solid var(--border); border-radius:20px; background:#fff; font-size:13px; cursor:pointer; font-weight:600;">Limpiar filtros</button>
            </div>`;
        return;
    }

    filtered.forEach(post => renderPostCard(post, container));

    // Actualizar contador de filtros activos
    updateFiltersActiveCount();
}

/**
 * Establece un filtro específico y re-renderiza.
 */
window.setFeedFilter = function(filterType, value, btnEl) {
    _activeFilters[filterType] = value;

    // Actualizar estado visual de los chips del grupo
    if (btnEl) {
        const group = btnEl.closest('.feed-filter-chips');
        if (group) {
            group.querySelectorAll('.feed-filter-chip').forEach(chip => chip.classList.remove('active'));
            btnEl.classList.add('active');
        }
    }

    renderFilteredPosts();
};

/**
 * Debounce para el input de búsqueda de texto.
 */
window.debounceFeedFilter = function() {
    clearTimeout(_feedFilterDebounce);
    _feedFilterDebounce = setTimeout(() => {
        const input = document.getElementById('feed-search-input');
        _activeFilters.search = input ? input.value : '';
        renderFilteredPosts();
    }, 350);
};

/**
 * Alterna la visibilidad del panel de filtros expandidos.
 */
window.toggleFeedFiltersExpanded = function() {
    const panel = document.getElementById('feed-filters-expanded');
    const btn = document.getElementById('feed-filters-toggle');
    if (!panel) return;
    const isOpen = panel.classList.contains('open');
    panel.classList.toggle('open', !isOpen);
    if (btn) btn.classList.toggle('active', !isOpen);
};

/**
 * Resetea todos los filtros a "todos".
 */
window.resetFeedFilters = function() {
    _activeFilters = { course: 'todos', type: 'todos', author: 'todos', otros: 'todos', search: '' };

    // Reset chips visuales
    document.querySelectorAll('.feed-filter-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.val === 'todos');
    });

    // Reset búsqueda
    const searchInput = document.getElementById('feed-search-input');
    if (searchInput) searchInput.value = '';

    // Actualizar count
    const countEl = document.getElementById('filters-active-count');
    if (countEl) countEl.style.display = 'none';

    renderFilteredPosts();
};

/**
 * Muestra el conteo de filtros activos en el botón.
 */
function updateFiltersActiveCount() {
    const countEl = document.getElementById('filters-active-count');
    if (!countEl) return;

    let count = 0;
    if (_activeFilters.course !== 'todos') count++;
    if (_activeFilters.type !== 'todos') count++;
    if (_activeFilters.author !== 'todos') count++;
    if (_activeFilters.otros !== 'todos') count++;
    if (_activeFilters.search) count++;

    if (count > 0) {
        countEl.textContent = count;
        countEl.style.display = 'inline-flex';
    } else {
        countEl.style.display = 'none';
    }
}
window.setFeedFilter = setFeedFilter;
window.debounceFeedFilter = debounceFeedFilter;
window.toggleFeedFiltersExpanded = toggleFeedFiltersExpanded;
window.resetFeedFilters = resetFeedFilters;
window.createCustomTag = createCustomTag;
window.loadCustomTags = loadCustomTags;
window.deleteCustomTag = deleteCustomTag;