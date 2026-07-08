// ==========================================================================
// assets/js/teacher/teacher-feed.js
// Feed del docente: publicar anuncios y revisar dudas de alumnos
// ==========================================================================

import { supabase } from '../config/supabase.js';

const TAG_CLASS_MAP = {
  física: 'physics',
  physics: 'physics',
  álgebra: 'algebra',
  algebra: 'algebra',
  matemáticas: 'algebra',
  anuncio: 'announcement',
};

// Estado del módulo
let _annImageFile = null;      // archivo seleccionado para el anuncio
let _annImagePreviewUrl = null; // object URL para la vista previa
let _currentUserId = null;     // id del docente en sesión

// Paginación del feed completo
let _allPosts = [];     // orden original devuelto por Supabase
let _feedPage = 1;
const POSTS_PER_PAGE = 5;

const VALID_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
const MAX_IMAGE_SIZE_MB = 5;

function cacheCurrentUser() {
  const user = window.CurrentUserService?.getProfile();
  _currentUserId = user?.id || null;
  return user;
}

function isAnnouncement(post) {
  const tag = (post.tag || '').toLowerCase();
  return post.author_role === 'teacher' || tag.includes('anuncio') || tag.includes('comunicado');
}

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
  } catch {
    return 'Reciente';
  }
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length > 1
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name[0].toUpperCase();
}

function getTagClass(tag, authorRole) {
  if (authorRole === 'teacher') return 'announcement';
  const key = (tag || '').toLowerCase().replace('#', '').trim();
  for (const [needle, cls] of Object.entries(TAG_CLASS_MAP)) {
    if (key.includes(needle)) return cls;
  }
  return 'physics';
}

function renderAvatar(post) {
  const avatar = post.author_avatar;
  if (avatar && (avatar.startsWith('http') || avatar.startsWith('/'))) {
    return `<div class="feed-avatar feed-avatar-img"><img src="${escapeAttr(avatar)}" alt=""></div>`;
  }
  if (avatar && avatar.length <= 3 && !avatar.startsWith('http')) {
    return `<div class="feed-avatar feed-avatar-emoji">${escapeHtml(avatar)}</div>`;
  }
  const bg = post.author_role === 'teacher' ? 'var(--amber-dark)' : 'var(--brand)';
  return `<div class="feed-avatar" style="background:${bg};">${getInitials(post.author_name)}</div>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/'/g, '&#39;');
}

function isStudentDoubt(post) {
  const tag = (post.tag || '').toLowerCase();
  return post.author_role === 'student' && tag !== 'anuncio' && tag !== 'comunicado';
}

function renderFeedCard(post) {
  const announcement = isAnnouncement(post);
  const isTeacher = post.author_role === 'teacher';
  const tagClass = announcement ? 'announcement' : getTagClass(post.tag, post.author_role);
  const tagLabel = announcement ? '📢 Anuncio' : (post.tag || 'General');
  const commentsCount = parseInt(post.comments_count, 10) || 0;
  const badge = post.author_badge
    ? `<span class="feed-badge ${isTeacher ? 'feed-badge-docente' : 'feed-badge-meta'}">${escapeHtml(post.author_badge)}</span>`
    : '';

  const imageHtml = post.image_url
    ? `<div class="feed-image" data-lightbox="${escapeAttr(post.image_url)}"><img src="${escapeAttr(post.image_url)}" alt="Imagen del anuncio" loading="lazy"></div>`
    : '';

  const bannerHtml = announcement
    ? '<div class="announcement-banner">📢 Anuncio para los alumnos</div>'
    : '';

  const tagHtml = announcement
    ? ''
    : `<span class="tag ${tagClass}">${escapeHtml(tagLabel)}</span>`;

  return `
    <article class="feed-card ${isTeacher ? 'is-teacher' : ''} ${announcement ? 'is-announcement' : ''}" data-post-id="${escapeAttr(post.id)}">
      ${bannerHtml}
      <div class="feed-top">
        ${renderAvatar(post)}
        <div class="feed-meta">
          <div class="feed-name">${escapeHtml(post.author_name || 'Usuario')} ${badge}</div>
          <div class="feed-time">${formatTime(post.created_at)}</div>
        </div>
        ${tagHtml}
        <button class="feed-delete-btn" data-delete="${escapeAttr(post.id)}" title="Eliminar publicación" aria-label="Eliminar publicación">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
        </button>
      </div>
      <p class="feed-text">${escapeHtml(post.content)}</p>
      ${imageHtml}
      <div class="feed-footer">
        <div class="feed-stats">
          <span class="stat-pill">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 1 1 17 0Z"/></svg>
            ${commentsCount} comentario${commentsCount === 1 ? '' : 's'}
          </span>
        </div>
        <div class="feed-footer-actions">
          <button class="btn-outline-amber btn-sm" data-view-comments="${escapeAttr(post.id)}">
            Ver comentarios
          </button>
          ${isTeacher ? '' : `<button class="btn-outline-amber" data-respond="${escapeAttr(post.id)}">Responder</button>`}
        </div>
      </div>
      <div class="feed-reply-box" id="reply-box-${escapeAttr(post.id)}" hidden>
        <textarea class="feed-reply-input" rows="2" placeholder="Escribe tu respuesta..."></textarea>
        <div class="feed-reply-actions">
          <button class="btn btn-ghost-sm" data-cancel-reply="${escapeAttr(post.id)}">Cancelar</button>
          <button class="btn btn-amber btn-sm" data-submit-reply="${escapeAttr(post.id)}">Enviar respuesta</button>
        </div>
      </div>
      <div class="feed-comments-section" id="comments-${escapeAttr(post.id)}" hidden></div>
    </article>
  `;
}

async function loadTeacherFeed() {
  const container = document.getElementById('teacher-feed-container');
  const pendingEl = document.getElementById('pendingDoubtsCount');
  if (!container) return;

  container.innerHTML = '<p class="feed-empty">Cargando dudas...</p>';

  try {
    const { data: posts, error } = await supabase.rpc('get_forum_feed', {
      limit_val: 50,
      offset_val: 0,
    });

    if (error) {
      console.error('[teacher-feed] Error cargando feed:', error);
      container.innerHTML = '<p class="feed-empty">No se pudo cargar el tablón.</p>';
      return;
    }

    const all = posts || [];

    // Contador de dudas de alumnos sin responder
    const pending = all.filter(isStudentDoubt).filter((p) => (parseInt(p.comments_count, 10) || 0) === 0);
    if (pendingEl) {
      const n = pending.length;
      pendingEl.textContent = n === 0
        ? 'Sin dudas pendientes'
        : `${n} esperando respuesta`;
    }

    if (all.length === 0) {
      container.innerHTML = '<p class="feed-empty">Aún no hay publicaciones en el foro.</p>';
      return;
    }

    // Guardar orden original y resetear paginación general del feed
    _allPosts = all;
    _feedPage = 1;
    renderFeedPage();
  } catch (err) {
    console.error('[teacher-feed] Error inesperado:', err);
    container.innerHTML = '<p class="feed-empty">Error al cargar el feed.</p>';
  }
}

function renderFeedPage() {
  const container = document.getElementById('teacher-feed-container');
  if (!container) return;

  const start = (_feedPage - 1) * POSTS_PER_PAGE;
  const visible = _allPosts.slice(start, start + POSTS_PER_PAGE);

  container.innerHTML = visible.map(renderFeedCard).join('');
  wireReplyButtons();
  wireDeleteButtons();
  wireLightbox();
  wireCommentToggles();
  renderFeedPagination();
}

function renderFeedPagination() {
  const container = document.getElementById('teacher-feed-container');
  if (!container) return;

  const totalPages = Math.ceil(_allPosts.length / POSTS_PER_PAGE);
  if (totalPages <= 1) return;

  const nav = document.createElement('nav');
  nav.className = 'feed-pagination';
  nav.setAttribute('aria-label', 'Paginación del feed');

  let buttons = '';
  for (let i = 1; i <= totalPages; i++) {
    const activeClass = i === _feedPage ? 'active' : '';
    buttons += `<button class="feed-page-btn ${activeClass}" data-page="${i}">${i}</button>`;
  }

  nav.innerHTML = `
    <button class="feed-page-btn" data-page="prev" ${_feedPage === 1 ? 'disabled' : ''}>‹ Anterior</button>
    <div class="feed-page-numbers">${buttons}</div>
    <button class="feed-page-btn" data-page="next" ${_feedPage === totalPages ? 'disabled' : ''}>Siguiente ›</button>
  `;

  container.appendChild(nav);

  nav.querySelectorAll('.feed-page-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page;
      const total = Math.ceil(_allPosts.length / POSTS_PER_PAGE);
      if (page === 'prev' && _feedPage > 1) {
        _feedPage--;
      } else if (page === 'next' && _feedPage < total) {
        _feedPage++;
      } else if (!isNaN(parseInt(page, 10))) {
        _feedPage = parseInt(page, 10);
      }
      renderFeedPage();
      container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function wireReplyButtons() {
  document.querySelectorAll('[data-respond]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const postId = btn.getAttribute('data-respond');
      const box = document.getElementById(`reply-box-${postId}`);
      if (box) {
        box.hidden = false;
        box.querySelector('textarea')?.focus();
      }
    });
  });

  document.querySelectorAll('[data-cancel-reply]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const postId = btn.getAttribute('data-cancel-reply');
      const box = document.getElementById(`reply-box-${postId}`);
      if (box) {
        box.hidden = true;
        const input = box.querySelector('textarea');
        if (input) input.value = '';
      }
    });
  });

  document.querySelectorAll('[data-submit-reply]').forEach((btn) => {
    btn.addEventListener('click', () => submitReply(btn.getAttribute('data-submit-reply')));
  });
}

function wireDeleteButtons() {
  document.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', () => deletePost(btn.getAttribute('data-delete')));
  });
}

function wireLightbox() {
  document.querySelectorAll('.feed-image[data-lightbox]').forEach((el) => {
    el.addEventListener('click', () => openLightbox(el.getAttribute('data-lightbox')));
  });
}

function wireCommentToggles() {
  document.querySelectorAll('[data-view-comments]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const postId = btn.getAttribute('data-view-comments');
      toggleComments(postId);
    });
  });
}

function toggleComments(postId) {
  const section = document.getElementById(`comments-${postId}`);
  if (!section) return;
  section.hidden = !section.hidden;
  if (!section.hidden && !section.dataset.loaded) {
    renderComments(postId);
    section.dataset.loaded = 'true';
  }
}

async function renderComments(postId) {
  const section = document.getElementById(`comments-${postId}`);
  if (!section) return;

  section.innerHTML = '<p class="feed-empty" style="padding:12px 0;">Cargando comentarios...</p>';

  const { data: allComments, error } = await supabase
    .from('forum_comments')
    .select('*, profiles(name, avatar_url, role)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[teacher-feed] Error cargando comentarios:', error);
    section.innerHTML = '<p class="feed-empty" style="padding:12px 0;">No se pudieron cargar los comentarios.</p>';
    return;
  }

  section.innerHTML = '';

  if (!allComments || allComments.length === 0) {
    section.innerHTML = '<p class="feed-empty" style="padding:12px 0;">Aún no hay respuestas. Sé el primero en responder.</p>';
  } else {
    const sorted = [...allComments].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return 0;
    });

    sorted.forEach((comment) => {
      const el = document.createElement('div');
      el.className = `comment-item${comment.is_pinned ? ' pinned-comment' : ''}`;
      el.id = `comment-${comment.id}`;

      const authorName = comment.profiles?.name || 'Usuario';
      const authorAvatar = comment.profiles?.avatar_url || '👤';
      const avatarHtml = renderCommentAvatar(authorAvatar, comment.profiles?.role);

      const pinBtn = `<button class="pin-btn ${comment.is_pinned ? 'active' : ''}" data-pin="${escapeAttr(comment.id)}">${comment.is_pinned ? '📌 Fijado' : '📌 Fijar'}</button>`;
      const delBtn = `<button class="delete-action-btn" data-del-comment="${escapeAttr(comment.id)}" title="Eliminar respuesta">🗑️</button>`;

      el.innerHTML = `
        <div class="comment-actions-group">${pinBtn}${delBtn}</div>
        ${avatarHtml}
        <div class="comment-body">
          <div class="comment-author-row">
            <span class="comment-author">${escapeHtml(authorName)}</span>
            ${comment.is_pinned ? '<span class="pin-badge">📌 Respuesta más útil</span>' : ''}
            <span class="comment-time">${comment.created_at ? formatTime(comment.created_at) : 'Reciente'}</span>
          </div>
          <p class="comment-text">${escapeHtml(comment.content)}</p>
        </div>
      `;

      el.querySelector('[data-pin]')?.addEventListener('click', () => togglePinComment(postId, comment.id));
      el.querySelector('[data-del-comment]')?.addEventListener('click', () => deleteComment(postId, comment.id));

      section.appendChild(el);
    });
  }

  const inputRow = document.createElement('div');
  inputRow.className = 'comment-input-row';
  inputRow.innerHTML = `
    <textarea class="comment-input" id="comment-input-${escapeAttr(postId)}" rows="1" placeholder="Escribe tu respuesta o solución..."></textarea>
    <button class="comment-submit-btn" data-submit-comment="${escapeAttr(postId)}">Responder</button>
  `;
  section.appendChild(inputRow);

  const submitBtn = inputRow.querySelector('[data-submit-comment]');
  submitBtn?.addEventListener('click', () => submitComment(postId));

  const textarea = inputRow.querySelector('textarea');
  textarea?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitComment(postId);
    }
  });
  textarea?.addEventListener('input', () => autoResizeTextarea(textarea));
}

function renderCommentAvatar(avatar, role) {
  let inner;
  const bg = role === 'teacher' ? 'var(--amber-dark)' : 'var(--brand)';

  if (avatar && (avatar.startsWith('http') || avatar.startsWith('/'))) {
    return `<div class="comment-avatar feed-avatar-img"><img src="${escapeAttr(avatar)}" alt=""></div>`;
  }

  if (avatar && avatar.length <= 3 && !avatar.startsWith('http')) {
    inner = escapeHtml(avatar);
  } else {
    inner = getInitials(avatar);
  }

  return `<div class="comment-avatar" style="background:${bg};">${inner}</div>`;
}

async function submitComment(postId) {
  const input = document.getElementById(`comment-input-${postId}`);
  if (!input) return;

  const content = input.value.trim();
  if (!content) {
    input.focus();
    return;
  }

  const user = window.CurrentUserService?.getProfile();
  if (!user?.id) return;

  const { error } = await supabase.from('forum_comments').insert({
    post_id: postId,
    author_id: user.id,
    content,
    is_pinned: false,
  });

  if (error) {
    console.error('[teacher-feed] Error al comentar:', error);
    if (window.app?.showToast) window.app.showToast('No se pudo enviar la respuesta.', 'error');
    return;
  }

  input.value = '';
  await renderComments(postId);
  updateCommentsCount(postId);
  if (window.app?.showToast) window.app.showToast('Respuesta publicada.', 'success');
}

async function deleteComment(postId, commentId) {
  if (!confirm('¿Eliminar esta respuesta?')) return;

  const { error } = await supabase.from('forum_comments').delete().eq('id', commentId);
  if (error) {
    console.error('[teacher-feed] Error al eliminar comentario:', error);
    if (window.app?.showToast) window.app.showToast('No se pudo eliminar la respuesta.', 'error');
    return;
  }

  await renderComments(postId);
  updateCommentsCount(postId);
}

async function togglePinComment(postId, commentId) {
  const { data: comment, error: fetchErr } = await supabase
    .from('forum_comments')
    .select('is_pinned')
    .eq('id', commentId)
    .single();

  if (fetchErr || !comment) return;

  const newStatus = !comment.is_pinned;

  if (newStatus) {
    await supabase.from('forum_comments').update({ is_pinned: false }).eq('post_id', postId);
  }

  const { error } = await supabase
    .from('forum_comments')
    .update({ is_pinned: newStatus })
    .eq('id', commentId);

  if (error) {
    console.error('[teacher-feed] Error al fijar comentario:', error);
    if (window.app?.showToast) window.app.showToast('No se pudo fijar la respuesta.', 'error');
    return;
  }

  await renderComments(postId);
  if (window.app?.showToast) {
    window.app.showToast(newStatus ? '📌 Respuesta fijada como la más útil.' : 'Respuesta desfijada.', 'success');
  }
}

async function updateCommentsCount(postId) {
  const { count } = await supabase
    .from('forum_comments')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId);

  const statPill = document.querySelector(`[data-post-id="${CSS.escape(postId)}"] .stat-pill`);
  if (statPill && statPill.childNodes.length) {
    const textNode = statPill.childNodes[statPill.childNodes.length - 1];
    textNode.textContent = ` ${count || 0} comentario${(count || 0) === 1 ? '' : 's'}`;
  }
}

function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
}

function openLightbox(src) {
  if (!src) return;
  let overlay = document.getElementById('teacher-image-lightbox');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'teacher-image-lightbox';
    overlay.className = 'teacher-lightbox';
    overlay.innerHTML = '<button class="teacher-lightbox-close" aria-label="Cerrar">✕</button><img alt="Imagen del anuncio">';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', closeLightbox);
  }
  overlay.querySelector('img').src = src;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  const overlay = document.getElementById('teacher-image-lightbox');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

// El docente puede eliminar cualquier publicación del feed; la UI se actualiza al instante.
async function deletePost(postId) {
  if (!postId) return;
  if (!confirm('¿Eliminar esta publicación del foro? Esta acción no se puede deshacer.')) return;

  const card = document.querySelector(`[data-post-id="${CSS.escape(postId)}"]`);
  // Actualización optimista: quitar del DOM de inmediato
  if (card) {
    card.style.transition = 'opacity .2s ease, transform .2s ease';
    card.style.opacity = '0';
    card.style.transform = 'scale(.98)';
  }

  // Intentar vía RPC (permite al docente borrar posts de cualquier alumno).
  let ok = false;
  const { error: rpcError } = await supabase.rpc('delete_forum_post', { p_post_id: postId });
  if (!rpcError) {
    ok = true;
  } else {
    // Fallback: borrado directo. Primero eliminamos dependencias para evitar FK errors.
    console.warn('[teacher-feed] RPC falló, intentando borrado directo:', rpcError);
    await supabase.from('forum_comments').delete().eq('post_id', postId);
    await supabase.from('forum_likes').delete().eq('post_id', postId);
    const { error } = await supabase.from('forum_posts').delete().eq('id', postId);
    ok = !error;
    if (error) console.error('[teacher-feed] Error al eliminar:', rpcError, error);
  }

  if (!ok) {
    // Revertir la UI si falló
    if (card) {
      card.style.opacity = '1';
      card.style.transform = 'none';
    }
    if (window.app?.showToast) window.app.showToast('No se pudo eliminar la publicación.', 'error');
    return;
  }

  if (card) setTimeout(() => card.remove(), 200);
  if (window.app?.showToast) window.app.showToast('Publicación eliminada.', 'success');
}

async function submitReply(postId) {
  if (!postId) return;

  const box = document.getElementById(`reply-box-${postId}`);
  const input = box?.querySelector('textarea');
  const content = input?.value.trim();
  if (!content) {
    input?.focus();
    return;
  }

  const user = window.CurrentUserService?.getProfile();
  if (!user?.id) return;

  btnDisable(box, true);

  const { error } = await supabase.from('forum_comments').insert({
    post_id: postId,
    author_id: user.id,
    content,
    is_pinned: false,
  });

  btnDisable(box, false);

  if (error) {
    console.error('[teacher-feed] Error al responder:', error);
    if (window.app?.showToast) window.app.showToast('No se pudo enviar la respuesta.', 'error');
    return;
  }

  if (input) input.value = '';
  if (box) box.hidden = true;
  if (window.app?.showToast) window.app.showToast('Respuesta publicada.', 'success');
  await loadTeacherFeed();
}

function btnDisable(box, disabled) {
  box?.querySelectorAll('button').forEach((b) => { b.disabled = disabled; });
}

function sanitizeFileName(name) {
  return String(name || 'imagen')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9.]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 80);
}

async function publishAnnouncement() {
  const input = document.getElementById('teacher-announcement-input');
  const btn = document.getElementById('btn-publish-announcement');
  if (!input) return;

  const content = input.value.trim();
  if (!content) {
    input.style.borderColor = '#E24B4A';
    input.focus();
    setTimeout(() => { input.style.borderColor = ''; }, 2000);
    return;
  }

  const user = cacheCurrentUser();
  if (!user?.id) return;

  if (btn) btn.disabled = true;

  let imageUrl = null;
  if (_annImageFile) {
    const fileName = `${Date.now()}_${sanitizeFileName(_annImageFile.name)}`;
    const path = `${user.id}/${fileName}`;
    const { error: uploadError } = await supabase.storage
      .from('forum-images')
      .upload(path, _annImageFile, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('[teacher-feed] Error subiendo imagen:', uploadError);
      if (window.app?.showToast) window.app.showToast('No se pudo subir la imagen.', 'error');
      if (btn) btn.disabled = false;
      return;
    }

    const { data: publicUrlData } = supabase.storage.from('forum-images').getPublicUrl(path);
    imageUrl = publicUrlData?.publicUrl || null;
  }

  const { error } = await supabase.from('forum_posts').insert({
    author_id: user.id,
    tag: 'Anuncio',
    content,
    image_url: imageUrl,
    upvotes: 0,
  }).select('id, created_at').single();

  if (btn) btn.disabled = false;

  if (error) {
    console.error('[teacher-feed] Error al publicar:', error);
    if (window.app?.showToast) window.app.showToast('No se pudo publicar el anuncio.', 'error');
    return;
  }

  // Refrescar el feed para respetar la paginación y contadores
  await loadTeacherFeed();

  input.value = '';
  removeAnnImage();
  if (window.app?.showToast) window.app.showToast('Anuncio publicado.', 'success');
}

/* ===== Imagen del anuncio ===== */
function handleAnnImageSelect(inputEl) {
  const file = inputEl.files && inputEl.files[0];
  inputEl.value = '';
  if (!file) return;

  if (!VALID_IMAGE_TYPES.includes(file.type)) {
    if (window.app?.showToast) window.app.showToast('Formato no válido (PNG, JPG, GIF, WEBP).', 'error');
    return;
  }
  if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
    if (window.app?.showToast) window.app.showToast(`La imagen supera los ${MAX_IMAGE_SIZE_MB} MB.`, 'error');
    return;
  }

  removeAnnImage();
  _annImageFile = file;
  _annImagePreviewUrl = URL.createObjectURL(file);
  const preview = document.getElementById('announcement-image-preview');
  const img = document.getElementById('announcement-image-preview-img');
  if (img) img.src = _annImagePreviewUrl;
  if (preview) preview.hidden = false;
}

function removeAnnImage() {
  if (_annImagePreviewUrl) {
    URL.revokeObjectURL(_annImagePreviewUrl);
  }
  _annImageFile = null;
  _annImagePreviewUrl = null;
  const preview = document.getElementById('announcement-image-preview');
  const img = document.getElementById('announcement-image-preview-img');
  if (img) img.src = '';
  if (preview) preview.hidden = true;
}

function initTeacherFeed() {
  const container = document.getElementById('teacher-feed-container');
  if (!container) return;

  const publishBtn = document.getElementById('btn-publish-announcement');
  const input = document.getElementById('teacher-announcement-input');
  const resourceBtn = document.getElementById('btn-announcement-resource');
  const imageInput = document.getElementById('announcement-image-input');
  const removeImgBtn = document.getElementById('announcement-image-remove');

  publishBtn?.addEventListener('click', publishAnnouncement);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') publishAnnouncement();
  });
  resourceBtn?.addEventListener('click', () => imageInput?.click());
  imageInput?.addEventListener('change', () => handleAnnImageSelect(imageInput));
  removeImgBtn?.addEventListener('click', removeAnnImage);
}

// Carga el feed lo antes posible (no espera al perfil del usuario) para que las dudas aparezcan rápido.
document.addEventListener('DOMContentLoaded', () => {
  initTeacherFeed();
  loadTeacherFeed();
});

// Cuando el perfil esté listo, refresca los bindings y cachea el usuario.
document.addEventListener('DOMContentLoaded', async () => {
  if (window.CurrentUserService && !CurrentUserService.getProfile()) {
    await CurrentUserService.init();
  }
  cacheCurrentUser();
  if (window.UserBindingManager) UserBindingManager.bindAll();
});
