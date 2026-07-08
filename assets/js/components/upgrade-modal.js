/**
 * upgrade-modal.js
 * Inyecta y controla el modal de Planes/Upgrade para Estudiantes y Docentes.
 */

const UpgradeModal = {
    init() {
        this.injectModalHtml();
        this.bindEvents();
    },

    injectModalHtml() {
        if (document.getElementById('global-upgrade-modal')) return;

        const modalHtml = `
        <div id="global-upgrade-modal" class="upgrade-modal-overlay">
            <div class="upgrade-modal-container">
                <div class="upgrade-modal-close" onclick="UpgradeModal.close()">&times;</div>
                <div class="upgrade-modal-header">
                    <div class="upgrade-subtitle">PLANES</div>
                    <h2 id="upgrade-modal-title">Precios para estudiantes</h2>
                    <p id="upgrade-modal-desc">Empieza gratis y sube cuando estés listo para acelerar tu preparación.</p>
                </div>
                
                <div class="upgrade-cards-wrapper">
                    <!-- Tarjeta Gratuita -->
                    <div class="upgrade-card free-plan">
                        <div class="plan-name">Plan Gratuito</div>
                        <div class="plan-price"><span class="price-big">$0</span><span class="price-sub">/mes</span></div>
                        <ul class="plan-features">
                            <li class="included">✓ 5 prácticas al mes</li>
                            <li class="included">✓ Diagnóstico inicial</li>
                            <li class="included">✓ Ruta de estudio básica</li>
                            <li class="included">✓ Acceso a la comunidad</li>
                            <li class="excluded">✗ Rankings competitivos</li>
                            <li class="excluded">✗ Tutor virtual 1:1</li>
                        </ul>
                        <button class="plan-btn btn-outline" onclick="UpgradeModal.close()">Seleccionar gratis</button>
                    </div>

                    <!-- Tarjeta Pro / Empresarial -->
                    <div class="upgrade-card pro-plan">
                        <div class="plan-header-top">
                            <div id="upgrade-pro-name" class="plan-name text-white">Premium Pro</div>
                            <div class="popular-badge">MÁS POPULAR</div>
                        </div>
                        <div id="upgrade-pro-price-container" class="plan-price text-white">
                            <span class="price-big">$19</span><span class="price-sub">/mes</span>
                        </div>
                        <div id="upgrade-teacher-contact" style="display:none;" class="plan-price text-white">
                            <span class="price-big" style="font-size: 24px;">Precios a medida</span>
                        </div>
                        
                        <ul class="plan-features text-white">
                            <li class="included">✓ Prácticas ilimitadas</li>
                            <li class="included">✓ Ruta de estudio avanzada</li>
                            <li class="included">✓ Analytics de errores</li>
                            <li class="included">✓ Tutor virtual 1:1</li>
                            <li class="included">✓ Rankings competitivos</li>
                            <li class="included">✓ Círculos de estudio</li>
                        </ul>
                        <button id="upgrade-pro-btn" class="plan-btn btn-green">Iniciar 7 días gratis</button>
                    </div>
                </div>
            </div>
        </div>

        <style>
            .upgrade-modal-overlay {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.6);
                z-index: 99999;
                display: none;
                align-items: center;
                justify-content: center;
                backdrop-filter: blur(4px);
                font-family: 'Inter', sans-serif;
            }
            .upgrade-modal-overlay.active {
                display: flex;
            }
            .upgrade-modal-container {
                background: #F8F9FA;
                width: 900px;
                max-width: 95vw;
                border-radius: 16px;
                padding: 50px 40px;
                position: relative;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            }
            .upgrade-modal-close {
                position: absolute;
                top: 20px;
                right: 25px;
                font-size: 30px;
                color: #6B7280;
                cursor: pointer;
                transition: color 0.2s;
            }
            .upgrade-modal-close:hover {
                color: #111827;
            }
            .upgrade-modal-header {
                text-align: center;
                margin-bottom: 40px;
            }
            .upgrade-subtitle {
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 2px;
                color: #6B7280;
                margin-bottom: 10px;
            }
            #upgrade-modal-title {
                font-size: 32px;
                font-weight: 800;
                color: #111827;
                margin: 0 0 12px 0;
            }
            #upgrade-modal-desc {
                font-size: 15px;
                color: #6B7280;
                margin: 0;
            }
            .upgrade-cards-wrapper {
                display: flex;
                gap: 20px;
                justify-content: center;
            }
            .upgrade-card {
                flex: 1;
                max-width: 380px;
                border-radius: 16px;
                padding: 40px;
                display: flex;
                flex-direction: column;
            }
            .free-plan {
                background: #FFFFFF;
                border: 1px solid #E5E7EB;
            }
            .pro-plan {
                background: #111827;
                border: 1px solid #1F2937;
                color: white;
            }
            .plan-header-top {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }
            .plan-name {
                font-size: 18px;
                font-weight: 700;
                color: #111827;
                margin-bottom: 8px;
            }
            .plan-name.text-white {
                color: #FFFFFF;
                margin-bottom: 0;
            }
            .popular-badge {
                background: #FFFFFF;
                color: #111827;
                font-size: 10px;
                font-weight: 800;
                padding: 4px 8px;
                border-radius: 12px;
                letter-spacing: 0.5px;
            }
            .plan-price {
                margin-bottom: 25px;
                color: #111827;
            }
            .plan-price.text-white {
                color: #FFFFFF;
                margin-bottom: 25px;
            }
            .price-big {
                font-size: 48px;
                font-weight: 800;
                line-height: 1;
            }
            .price-sub {
                font-size: 14px;
                color: #6B7280;
                margin-left: 4px;
                font-weight: 500;
            }
            .plan-features {
                list-style: none;
                padding: 0;
                margin: 0 0 35px 0;
                flex-grow: 1;
            }
            .plan-features li {
                font-size: 13px;
                margin-bottom: 15px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .plan-features li.included {
                color: #374151;
            }
            .plan-features li.excluded {
                color: #9CA3AF;
                text-decoration: line-through;
            }
            .plan-features.text-white li.included {
                color: #D1D5DB;
            }
            .plan-features.text-white li.excluded {
                color: #6B7280;
            }
            .plan-btn {
                width: 100%;
                padding: 14px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                border: none;
            }
            .btn-outline {
                background: white;
                border: 1px solid #D1D5DB;
                color: #374151;
            }
            .btn-outline:hover {
                background: #F3F4F6;
            }
            .btn-green {
                background: #10B981;
                color: white;
            }
            .btn-green:hover {
                background: #059669;
            }
        </style>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    bindEvents() {
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.upgrade-account-btn');
            if (btn) {
                this.open();
            }
        });
    },

    open() {
        const modal = document.getElementById('global-upgrade-modal');
        if (!modal) return;

        // Determinar rol
        const profile = window.CurrentUserService ? window.CurrentUserService.getProfile() : null;
        const role = profile ? profile.role : 'student';

        const titleEl = document.getElementById('upgrade-modal-title');
        const descEl = document.getElementById('upgrade-modal-desc');
        const proNameEl = document.getElementById('upgrade-pro-name');
        const proPriceContainer = document.getElementById('upgrade-pro-price-container');
        const teacherContactContainer = document.getElementById('upgrade-teacher-contact');
        const proBtn = document.getElementById('upgrade-pro-btn');

        if (role === 'teacher') {
            titleEl.textContent = 'Planes para Instituciones';
            descEl.textContent = 'Eleva el nivel educativo de tu colegio con herramientas avanzadas para tus docentes.';
            proNameEl.textContent = 'Plan Empresarial';
            proPriceContainer.style.display = 'none';
            teacherContactContainer.style.display = 'block';
            proBtn.textContent = 'Contactar a Ventas';
            proBtn.onclick = () => alert('El equipo de ventas ha sido notificado.');
        } else {
            titleEl.textContent = 'Precios para estudiantes';
            descEl.textContent = 'Empieza gratis y sube cuando estés listo para acelerar tu preparación.';
            proNameEl.textContent = 'Premium Pro';
            proPriceContainer.style.display = 'block';
            teacherContactContainer.style.display = 'none';
            proBtn.textContent = 'Iniciar 7 días gratis';
            proBtn.onclick = () => alert('Iniciando suscripción de prueba...');
        }

        modal.classList.add('active');
    },

    close() {
        const modal = document.getElementById('global-upgrade-modal');
        if (modal) modal.classList.remove('active');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    UpgradeModal.init();
});

// En caso de que se cargue dinámicamente o tarde
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    UpgradeModal.init();
}
