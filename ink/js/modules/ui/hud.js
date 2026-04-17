/**
 * hud.js — 状態通知HUD
 * 保存状態などの「プロフェッショナルな信頼性」を視覚化する軽量コンポーネント。
 */

let _hudEl = null;

export function initHUD() {
    if (_hudEl) return;
    
    _hudEl = document.createElement('div');
    _hudEl.id = 'status-hud';
    _hudEl.className = 'status-hud';
    _hudEl.innerHTML = `
        <span class="hud-dot"></span>
        <span class="hud-text">Synced</span>
    `;
    document.body.appendChild(_hudEl);

    // Initial styles
    const style = document.createElement('style');
    style.textContent = `
        .status-hud {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            background: rgba(0, 0, 0, 0.7);
            color: #fff;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-family: sans-serif;
            display: flex;
            align-items: center;
            gap: 6px;
            pointer-events: none;
            opacity: 0.4;
            transition: opacity 0.3s, transform 0.3s;
            backdrop-filter: blur(4px);
        }
        .status-hud.busy {
            opacity: 1;
            transform: scale(1.05);
        }
        .hud-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #4caf50;
        }
        .status-hud.busy .hud-dot {
            background: #ffc107;
            box-shadow: 0 0 5px #ffc107;
            animation: hud-pulse 1s infinite;
        }
        .status-hud.error .hud-dot {
            background: #f44336;
        }
        @keyframes hud-pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.5); opacity: 0.5; }
            100% { transform: scale(1); opacity: 1; }
        }
    `;
    document.head.appendChild(style);

    // Listen to storage events
    document.addEventListener('desu:save-start', () => {
        _hudEl.classList.add('busy');
        _hudEl.querySelector('.hud-text').textContent = 'Saving...';
    });

    document.addEventListener('desu:save-end', () => {
        _hudEl.classList.remove('busy');
        _hudEl.classList.remove('error');
        _hudEl.querySelector('.hud-text').textContent = 'Synced';
        // Fade out slightly after a delay
        setTimeout(() => {
            if (!_hudEl.classList.contains('busy')) {
                _hudEl.style.opacity = '0.4';
            }
        }, 2000);
    });

    document.addEventListener('desu:save-error', () => {
        _hudEl.classList.remove('busy');
        _hudEl.classList.add('error');
        _hudEl.querySelector('.hud-text').textContent = 'Disk Full?';
    });
}
