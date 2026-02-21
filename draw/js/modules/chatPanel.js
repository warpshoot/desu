// ============================================
// Chat Panel Module - Draggable & Resizable
// ============================================

import { getSettings, toggleAutoMonitoring } from './settings.js';
import { sendUserMessage } from './ai.js';

let panelEl, messagesEl, headerEl, inputEl, sendBtn, pauseBtn, footerEl, micBtn;
let isDragging = false;
let isRecording = false;
let recognition = null;
let startX, startY, initialLeft, initialTop;

/**
 * Initialize the chat panel UI
 */
export function initChatPanel() {
    panelEl = document.getElementById('ai-chat-panel');
    messagesEl = document.getElementById('ai-chat-messages');
    headerEl = document.getElementById('ai-chat-header');
    inputEl = document.getElementById('ai-chat-input');
    sendBtn = document.getElementById('ai-chat-send');
    pauseBtn = document.getElementById('ai-pause-btn');
    footerEl = document.getElementById('ai-chat-footer');
    micBtn = document.getElementById('ai-chat-mic');

    if (!panelEl || !headerEl) return;

    // Init Speech Recognition
    initSpeechRecognition();

    // Load persisted position/size
    try {
        const pos = JSON.parse(localStorage.getItem('drawai_chat_pos') || '{}');
        if (pos.left !== undefined) {
            panelEl.style.left = pos.left + 'px';
            panelEl.style.right = 'auto';
        }
        if (pos.top !== undefined) {
            panelEl.style.top = pos.top + 'px';
            panelEl.style.bottom = 'auto';
        }
        if (pos.width !== undefined) panelEl.style.width = pos.width + 'px';
        if (pos.height !== undefined) panelEl.style.height = pos.height + 'px';
    } catch (e) {
        console.warn('Failed to load chat panel position:', e);
    }

    // Dragging logic
    headerEl.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) return; // Don't drag when clicking buttons
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = panelEl.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        headerEl.setPointerCapture(e.pointerId);
        e.stopPropagation();
    });

    headerEl.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        panelEl.style.left = (initialLeft + dx) + 'px';
        panelEl.style.top = (initialTop + dy) + 'px';
        panelEl.style.right = 'auto';
        panelEl.style.bottom = 'auto';
    });

    headerEl.addEventListener('pointerup', () => {
        if (isDragging) {
            isDragging = false;
            savePos();
        }
    });

    // Pause toggle
    if (pauseBtn) {
        pauseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleAutoMonitoring();
        });
        updatePauseBtn(getSettings().autoMonitoring);
    }


    if (sendBtn) {
        sendBtn.addEventListener('click', handleSend);
    }
    if (inputEl) {
        inputEl.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter' && !e.isComposing) {
                handleSend();
            }
        });
        inputEl.addEventListener('pointerdown', (e) => e.stopPropagation());
    }

    if (micBtn) {
        micBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleRecording();
        });
    }

    // Save size when resized
    if (window.ResizeObserver) {
        const resizeObserver = new ResizeObserver(() => {
            savePos();
        });
        resizeObserver.observe(panelEl);
    }

    // Prevent canvas interaction when clicking chat panel
    panelEl.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
    });
}

// Message Input
async function handleSend() {
    if (!inputEl) return;
    let text = inputEl.value.trim();
    const isManualLook = !text;

    if (isManualLook) {
        text = '今の絵を見てコメントして'; // Default prompt for empty send
    }

    // Clear input and add user bubble
    inputEl.value = '';
    addUserMessage(isManualLook ? '[キャンバスを送信]' : text);

    // Send to AI (now always includes snapshot)
    await sendUserMessage(text);
}

function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        if (micBtn) micBtn.style.display = 'none';
        return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        isRecording = true;
        if (micBtn) micBtn.classList.add('recording');
    };

    recognition.onend = () => {
        isRecording = false;
        if (micBtn) micBtn.classList.remove('recording');
    };

    recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        if (text) {
            inputEl.value = text;
            handleSend();
        }
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        isRecording = false;
        if (micBtn) micBtn.classList.remove('recording');
    };
}

function toggleRecording() {
    if (!recognition) return;
    if (isRecording) {
        recognition.stop();
    } else {
        recognition.start();
    }
}

export function updatePauseBtn(enabled) {
    if (!pauseBtn) return;
    const statusEl = document.getElementById('ai-chat-status');
    if (enabled) {
        pauseBtn.textContent = '● LIVE';
        pauseBtn.style.color = '#4cd137';
        pauseBtn.classList.add('active');
        panelEl.classList.add('monitoring');
        if (statusEl) statusEl.style.display = 'inline';
    } else {
        pauseBtn.textContent = 'MANUAL';
        pauseBtn.style.color = '#999';
        pauseBtn.classList.remove('active');
        panelEl.classList.remove('monitoring');
        if (statusEl) statusEl.style.display = 'none';
    }
}

function savePos() {
    if (!panelEl) return;
    const rect = panelEl.getBoundingClientRect();
    localStorage.setItem('drawai_chat_pos', JSON.stringify({
        left: rect.left,
        top: rect.top,
        width: Math.round(rect.width),
        height: Math.round(rect.height)
    }));
}

/**
 * Add an assistant message bubble
 */
export function addMessage(text) {
    appendBubble(text, 'ai-bubble');
}

/**
 * Add a user message bubble
 */
function addUserMessage(text) {
    appendBubble(text, 'user-bubble');
}

/**
 * Clear all chat message bubbles from logic and UI
 */
export function clearMessages() {
    if (!messagesEl) return;
    messagesEl.innerHTML = '';
}

function appendBubble(text, className) {
    if (!messagesEl) return;

    const bubble = document.createElement('div');
    bubble.className = className;
    bubble.textContent = text;
    messagesEl.appendChild(bubble);

    while (messagesEl.children.length > 50) {
        messagesEl.removeChild(messagesEl.firstChild);
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
}
