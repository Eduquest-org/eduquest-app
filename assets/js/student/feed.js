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
        // Obtenemos los posts desde nuestra nueva función RPC
        const { data: enrichedPosts, error } = await supabase.rpc('get_forum_feed', { limit_val: 50, offset_val: 0 });
        
        if (error) {
            console.error("Error cargando feed desde Supabase:", error);
            return;
        }

        container.innerHTML = '';

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

    postCard.innerHTML = `
        <div class="card-header">
            <div class="author-avatar">${post.authorAvatar || '👤'}</div>
            <div class="author-info">
                <h4>${post.authorName || post.author || 'Usuario'}
                    ${post.authorTarget ? `<span class="user-target">${post.authorTarget}</span>` : ''}
                    ${post.authorRole === 'teacher' ? '<span class="user-target teacher-badge">Docente</span>' : ''}
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
            const isCommentAuthor = _currentUserId && comment.author_id === _currentUserId;
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
            
            const authorName = comment.profiles?.name || 'Usuario';
            const authorAvatar = comment.profiles?.avatar_url || '👤';

            commentEl.innerHTML = `
                ${actionsHtml}
                <div class="comment-avatar">${authorAvatar}</div>
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

    // Determinar etiqueta
    const tag = _selectedTag || '#Duda';

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