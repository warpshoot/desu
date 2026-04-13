/**
 * hud.js - Heads-up Display for shortcut notifications
 */

let hudEl = null;
let hudTimeout = null;

/**
 * Initialize HUD element if it doesn't exist
 */
export function initHUD() {
    if (hudEl) return;
    hudEl = document.createElement('div');
    hudEl.id = 'hud-container';
    document.body.appendChild(hudEl);
}

/**
 * Show a notification on the screen
 * @param {string} text - Message to display
 */
export function showHUD(text) {
    if (!hudEl) initHUD();

    hudEl.textContent = text;
    
    // Reset state to trigger animation from scratch if already visible
    hudEl.classList.remove('visible');
    void hudEl.offsetWidth; // Force reflow
    
    hudEl.classList.add('visible');

    if (hudTimeout) clearTimeout(hudTimeout);
    hudTimeout = setTimeout(() => {
        hudEl.classList.remove('visible');
    }, 1000);
}
