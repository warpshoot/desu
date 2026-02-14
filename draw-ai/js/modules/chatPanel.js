// ============================================
// Chat Panel Module
// ============================================

import { speak } from './tts.js';
import { getSettings, toggleAIEnabled } from './settings.js';

let panelEl, messagesEl, toggleBtn, collapsedEl, powerBtn;
let isCollapsed = false;

/**
 * Initialize the chat panel UI
 */
export function initChatPanel() {
    panelEl = document.getElementById('ai-chat-panel');
    messagesEl = document.getElementById('ai-chat-messages');
    toggleBtn = document.getElementById('ai-chat-toggle');
    collapsedEl = document.getElementById('ai-chat-collapsed');
    powerBtn = document.getElementById('ai-power-toggle');

    if (!panelEl || !toggleBtn || !collapsedEl) return;

    // Toggle collapse
    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        collapse();
    });

    // Expand from collapsed icon
    collapsedEl.addEventListener('click', (e) => {
        e.stopPropagation();
        expand();
    });

    // AI Power toggle
    if (powerBtn) {
        powerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const newState = toggleAIEnabled();
            updatePowerBtnState(newState);
        });
        // Init state
        updatePowerBtnState(getSettings().aiEnabled);
    }

    // Prevent canvas interaction when clicking chat panel
    panelEl.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
    });

    // Load collapsed state
    isCollapsed = localStorage.getItem('drawai_chat_collapsed') === 'true';
    if (isCollapsed) {
        panelEl.classList.add('hidden');
        collapsedEl.classList.remove('hidden');
    }
}

function collapse() {
    isCollapsed = true;
    panelEl.classList.add('hidden');
    collapsedEl.classList.remove('hidden');
    localStorage.setItem('drawai_chat_collapsed', 'true');
}

function expand() {
    isCollapsed = false;
    panelEl.classList.remove('hidden');
    collapsedEl.classList.add('hidden');
    localStorage.setItem('drawai_chat_collapsed', 'false');
    // Scroll to bottom
    if (messagesEl) {
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }
}

function updatePowerBtnState(enabled) {
    if (!powerBtn) return;
    if (enabled) {
        powerBtn.textContent = '●';
        powerBtn.style.color = '#4cd137'; // Green
        panelEl.classList.add('monitoring');
    } else {
        powerBtn.textContent = '○';
        powerBtn.style.color = '#999'; // Gray
        panelEl.classList.remove('monitoring');
    }
}

/**
 * Add a message bubble to the chat panel
 * @param {string} text
 */
export function addMessage(text) {
    if (!messagesEl) return;

    const bubble = document.createElement('div');
    bubble.className = 'ai-bubble';
    bubble.textContent = text;
    messagesEl.appendChild(bubble);

    // Remove old messages if too many (keep last 20)
    while (messagesEl.children.length > 20) {
        messagesEl.removeChild(messagesEl.firstChild);
    }

    // Scroll to bottom
    messagesEl.scrollTop = messagesEl.scrollHeight;

    // Flash collapsed icon if panel is collapsed
    if (isCollapsed && collapsedEl) {
        collapsedEl.classList.add('has-new');
        setTimeout(() => collapsedEl.classList.remove('has-new'), 2000);
    }
}
