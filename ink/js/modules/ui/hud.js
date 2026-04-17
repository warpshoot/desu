/**
 * hud.js — 状態通知HUD
 * 保存状態などの「プロフェッショナルな信頼性」を視覚化する軽量コンポーネント。
 */

let _msgEl = null;
let _msgTimeout = null;

export function initHUD() {
    if (_msgEl) return;
    
    // Message HUD (for Undo, Redo, Modes, etc.)
    _msgEl = document.createElement('div');
    _msgEl.id = 'message-hud';
    _msgEl.className = 'message-hud';
    document.body.appendChild(_msgEl);

    // Initial styles
    const style = document.createElement('style');
    style.textContent = `
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
