/**
 * hud.js — 状態通知HUD
 * 保存状態などの「プロフェッショナルな信頼性」を視覚化する軽量コンポーネント。
 */

let _hudEl = null;
let _msgEl = null;
let _msgTimeout = null;

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

    // Message HUD (for Undo, Redo, Modes, etc.)
    _msgEl = document.createElement('div');
    _msgEl.id = 'message-hud';
    _msgEl.className = 'message-hud';
    document.body.appendChild(_msgEl);

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

        .message-hud {
            position: fixed;
            top: 60px;
            left: 50%;
            transform: translateX(-50%) translateY(-20px);
            z-index: 10001;
            background: rgba(0, 0, 0, 0.85);
            color: #fff;
            padding: 8px 18px;
            border-radius: 25px;
            font-size: 13px;
            font-weight: 500;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s, transform 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .message-hud.visible {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
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

/**
 * 画面中央上部に一時的なメッセージを表示する。
 * (Undo, Redo, モード切替などのフィードバック用)
 */
export function showHUD(text) {
    if (!_msgEl) return;
    
    _msgEl.textContent = text;
    _msgEl.classList.add('visible');

    if (_msgTimeout) clearTimeout(_msgTimeout);
    _msgTimeout = setTimeout(() => {
        _msgEl.classList.remove('visible');
        _msgTimeout = null;
    }, 1500);
}
