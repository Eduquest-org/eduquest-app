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
  const tagClass = getTagClass(post.tag, post.author_role);
  const isTeacher = post.author_role === 'teacher';
  const commentsCount = parseInt(post.comments_count, 10) || 0;
  const badge = post.author_badge
    ? `<span class="feed-badge ${isTeacher ? 'feed-badge-docente' : 'feed-badge-meta'}">${escapeHtml(post.author_badge)}</span>`
    : '';

  return `
    <article class="feed-card ${isTeacher ? 'is-teacher' : ''}" data-post-id="${escapeAttr(post.id)}">
      <div class="feed-top">
        ${renderAvatar(post)}
        <div class="feed-meta">
          <div class="feed-name">${escapeHtml(post.author_name || 'Usuario')} ${badge}</div>
          <div class="feed-time">${formatTime(post.created_at)}</div>
        </div>
        <span class="tag ${tagClass}">${escapeHtml(post.tag || 'General')}</span>
      </div>
      <p class="feed-text">${escapeHtml(post.content)}</p>
      <div class="feed-footer">
        <div class="feed-stats">
          <span class="stat-pill">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 1 1 17 0Z"/></svg>
            ${commentsCount} comentario${commentsCount === 1 ? '' : 's'}
          </span>
        </div>
        ${isTeacher ? '' : `<button class="btn-outline-amber" data-respond="${escapeAttr(post.id)}">Responder</button>`}
      </div>
      <div class="feed-reply-box" id="reply-box-${escapeAttr(post.id)}" hidden>
        <textarea class="feed-reply-input" rows="2" placeholder="Escribe tu respuesta..."></textarea>
        <div class="feed-reply-actions">
          <button class="btn btn-ghost-sm" data-cancel-reply="${escapeAttr(post.id)}">Cancelar</button>
          <button class="btn btn-amber btn-sm" data-submit-reply="${escapeAttr(post.id)}">Enviar respuesta</button>
        </div>
      </div>
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

    const doubts = (posts || []).filter(isStudentDoubt);
    const pending = doubts.filter((p) => (parseInt(p.comments_count, 10) || 0) === 0);

    if (pendingEl) {
      const n = pending.length;
      pendingEl.textContent = n === 0
        ? 'Sin dudas pendientes'
        : `${n} esperando respuesta`;
    }

    if (doubts.length === 0) {
      container.innerHTML = '<p class="feed-empty">No hay dudas de alumnos por ahora.</p>';
      return;
    }

    container.innerHTML = doubts.map(renderFeedCard).join('');
    wireReplyButtons();
  } catch (err) {
    console.error('[teacher-feed] Error inesperado:', err);
    container.innerHTML = '<p class="feed-empty">Error al cargar el feed.</p>';
  }
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

  const user = window.CurrentUserService?.getProfile();
  if (!user?.id) return;

  if (btn) btn.disabled = true;

  const { error } = await supabase.from('forum_posts').insert({
    author_id: user.id,
    tag: 'Anuncio',
    content,
    image_url: null,
    upvotes: 0,
  });

  if (btn) btn.disabled = false;

  if (error) {
    console.error('[teacher-feed] Error al publicar:', error);
    if (window.app?.showToast) window.app.showToast('No se pudo publicar el anuncio.', 'error');
    return;
  }

  input.value = '';
  if (window.app?.showToast) window.app.showToast('Anuncio publicado.', 'success');
  await loadTeacherFeed();
}

function initTeacherFeed() {
  const container = document.getElementById('teacher-feed-container');
  if (!container) return;

  const publishBtn = document.getElementById('btn-publish-announcement');
  const input = document.getElementById('teacher-announcement-input');

  publishBtn?.addEventListener('click', publishAnnouncement);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') publishAnnouncement();
  });

  loadTeacherFeed();
}

document.addEventListener('DOMContentLoaded', async () => {
  if (window.CurrentUserService && !CurrentUserService.getProfile()) {
    await CurrentUserService.init();
  }
  if (window.UserBindingManager) UserBindingManager.bindAll();
  initTeacherFeed();
});
