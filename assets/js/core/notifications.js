import { supabase, getCurrentUser } from '../config/supabase.js';

class NotificationService {
    constructor() {
        this.notifications = [];
        this.unreadCount = 0;
        this.userId = null;
        this.channel = null;

        // Elementos del DOM (se bindean después)
        this.badgeEl = null;
        this.dropdownEl = null;
        this.listEl = null;
        this.bellBtnEl = null;
    }

    async _waitForElement(selector, maxRetries = 30) {
        let retries = 0;
        return new Promise((resolve) => {
            const check = () => {
                const el = document.querySelector(selector);
                if (el) return resolve(el);
                if (retries >= maxRetries) return resolve(null);
                retries++;
                setTimeout(check, 100);
            };
            check();
        });
    }

    async init() {
        const user = await getCurrentUser();
        if (!user) return;
        this.userId = user.id;

        const uiBound = await this._bindUI();
        if (!uiBound) return;

        await this.fetchNotifications();
        this.subscribeToRealtime();
        
        // Cerrar dropdown si se hace click afuera
        document.addEventListener('click', (e) => {
            if (this.dropdownEl && this.bellBtnEl) {
                if (!this.dropdownEl.contains(e.target) && !this.bellBtnEl.contains(e.target)) {
                    this.dropdownEl.classList.remove('show');
                }
            }
        });
    }

    async _bindUI() {
        // Esperar a que el componente cargue dinámicamente
        this.bellBtnEl = await this._waitForElement('.nav-icon-btn, .topbar-right .icon-btn');
        if (!this.bellBtnEl) return false;
        
        // Agregar contenedor envolvente si no existe para el dropdown
        if (!this.bellBtnEl.parentElement.classList.contains('notifications-wrapper')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'notifications-wrapper';
            this.bellBtnEl.parentNode.insertBefore(wrapper, this.bellBtnEl);
            wrapper.appendChild(this.bellBtnEl);
        }
        
        this.badgeEl = this.bellBtnEl.querySelector('.notification-badge, .dot');

        // Construir el HTML del dropdown
        this.dropdownEl = document.createElement('div');
        this.dropdownEl.className = 'notifications-dropdown';
        this.dropdownEl.innerHTML = `
            <div class="notifications-header">
                <h3>Notificaciones</h3>
                <button class="mark-all-read-btn">Marcar todo leído</button>
            </div>
            <ul class="notifications-list"></ul>
        `;
        this.bellBtnEl.parentElement.appendChild(this.dropdownEl);
        this.listEl = this.dropdownEl.querySelector('.notifications-list');

        // Event Listeners
        this.bellBtnEl.addEventListener('click', (e) => {
            e.preventDefault();
            this.dropdownEl.classList.toggle('show');
        });

        this.dropdownEl.querySelector('.mark-all-read-btn').addEventListener('click', () => {
            this.markAllAsRead();
        });
        
        return true;
    }

    async fetchNotifications() {
        if (!this.userId) return;

        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', this.userId)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            console.error('Error obteniendo notificaciones:', error);
            return;
        }

        this.notifications = data;
        this.updateUI();
    }

    subscribeToRealtime() {
        if (!this.userId) return;

        this.channel = supabase.channel('public:notifications')
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'notifications', 
                filter: `user_id=eq.${this.userId}` 
            }, (payload) => {
                this.notifications.unshift(payload.new);
                this.updateUI();
                this._playNotificationSound();
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${this.userId}`
            }, (payload) => {
                const idx = this.notifications.findIndex(n => n.id === payload.new.id);
                if (idx !== -1) {
                    this.notifications[idx] = payload.new;
                    this.updateUI();
                }
            })
            .subscribe();
    }

    async markAsRead(id) {
        // Optimistic update
        const notif = this.notifications.find(n => n.id === id);
        if (notif && !notif.is_read) {
            notif.is_read = true;
            this.updateUI();
            
            await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', id);
        }
    }

    async markAllAsRead() {
        const unreadIds = this.notifications.filter(n => !n.is_read).map(n => n.id);
        if (unreadIds.length === 0) return;

        // Optimistic update
        this.notifications.forEach(n => n.is_read = true);
        this.updateUI();

        await supabase
            .from('notifications')
            .update({ is_read: true })
            .in('id', unreadIds);
    }

    updateUI() {
        if (!this.listEl || !this.badgeEl) return;

        this.unreadCount = this.notifications.filter(n => !n.is_read).length;

        // Actualizar Badge
        if (this.unreadCount > 0) {
            this.badgeEl.textContent = this.unreadCount > 9 ? '9+' : this.unreadCount;
            this.badgeEl.classList.add('active');
        } else {
            this.badgeEl.textContent = '';
            this.badgeEl.classList.remove('active');
        }

        // Renderizar Lista
        if (this.notifications.length === 0) {
            this.listEl.innerHTML = `
                <div class="notifications-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                    </svg>
                    <span>No tienes notificaciones</span>
                </div>
            `;
            return;
        }

        this.listEl.innerHTML = '';
        this.notifications.forEach(n => {
            const li = document.createElement('li');
            li.className = `notification-item ${n.is_read ? '' : 'unread'}`;
            li.innerHTML = `
                <div class="notification-icon ${n.type || 'system'}">
                    ${this._getIconForType(n.type)}
                </div>
                <div class="notification-content">
                    <h4 class="notification-title">${n.title}</h4>
                    <p class="notification-message">${n.message}</p>
                    <span class="notification-time">${this._formatTime(n.created_at)}</span>
                </div>
            `;
            
            li.addEventListener('click', () => {
                this.markAsRead(n.id);
            });
            
            this.listEl.appendChild(li);
        });
    }

    _getIconForType(type) {
        switch(type) {
            case 'achievement': return '🏆';
            case 'alert': return '⚠️';
            case 'course': return '📚';
            default: return '🔔';
        }
    }

    _formatTime(isoString) {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'Hace un momento';
        if (diffMins < 60) return `Hace ${diffMins} m`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `Hace ${diffHours} h`;
        return date.toLocaleDateString();
    }

    _playNotificationSound() {
        // Opcional: Sonido sutil
        // const audio = new Audio('/assets/sounds/notification.mp3');
        // audio.play().catch(e => console.log('Autoplay bloqueado', e));
    }
}

export const notificationService = new NotificationService();

// Inicializar automáticamente cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => notificationService.init());
} else {
    notificationService.init();
}
