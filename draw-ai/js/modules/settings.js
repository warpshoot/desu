// ============================================
// Settings Module - API & App Configuration
// ============================================

import { setTTSEnabled, isTTSEnabled } from './tts.js';
import { DEFAULT_SYSTEM_PROMPT } from './ai.js';

const STORAGE_PREFIX = 'drawai_';

// Provider definitions with available models
const PROVIDERS = {
    anthropic: {
        name: 'Anthropic',
        models: [
            { id: 'claude-haiku-4-5-20251015', name: 'Claude 4.5 Haiku' },
            { id: 'claude-sonnet-4-5-20250929', name: 'Claude 4.5 Sonnet' },
            { id: 'claude-opus-4-5-20251101', name: 'Claude 4.5 Opus' },
            { id: 'claude-opus-4-6', name: 'Claude 4.6 Opus' },
        ],
        defaultModel: 'claude-haiku-4-5-20251015'
    },
    google: {
        name: 'Google',
        models: [
            { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
            { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
            { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
            { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash' },
            { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro' },
        ],
        defaultModel: 'gemini-2.5-flash-lite'
    },
    openai: {
        name: 'OpenAI',
        models: [
            { id: 'gpt-4o-mini', name: 'GPT-4o mini' },
            { id: 'gpt-4o', name: 'GPT-4o' },
            { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini' },
            { id: 'gpt-4.1', name: 'GPT-4.1' },
            { id: 'o4-mini', name: 'o4-mini' },
            { id: 'gpt-5-mini', name: 'GPT-5 mini' },
            { id: 'gpt-5.2', name: 'GPT-5.2' },
        ],
        defaultModel: 'gpt-4o-mini'
    }
};

// Current settings state
let settings = {
    provider: 'google',
    model: 'gemini-2.0-flash',
    apiKey: '',
    debounceMs: 30000,
    ttsEnabled: false,
    aiEnabled: false,
    systemPrompt: '',
    displayName: 'トモ'
};

/**
 * Load settings from localStorage
 */
export function loadSettings() {
    settings.provider = localStorage.getItem(STORAGE_PREFIX + 'provider') || 'google';
    settings.model = localStorage.getItem(STORAGE_PREFIX + 'model') || PROVIDERS[settings.provider]?.defaultModel || 'gemini-2.5-flash-lite';
    settings.apiKey = localStorage.getItem(STORAGE_PREFIX + 'apikey_' + settings.provider) || '';
    settings.debounceMs = parseInt(localStorage.getItem(STORAGE_PREFIX + 'debounce') || '30000', 10);
    settings.ttsEnabled = localStorage.getItem(STORAGE_PREFIX + 'tts_enabled') === 'true';
    settings.aiEnabled = localStorage.getItem(STORAGE_PREFIX + 'ai_enabled') === 'true'; // Default false
    settings.systemPrompt = localStorage.getItem(STORAGE_PREFIX + 'system_prompt') || DEFAULT_SYSTEM_PROMPT;
    settings.displayName = localStorage.getItem(STORAGE_PREFIX + 'display_name') || 'トモ';
    setTTSEnabled(settings.ttsEnabled);
}

/**
 * Save current settings to localStorage
 */
function saveSettings() {
    localStorage.setItem(STORAGE_PREFIX + 'provider', settings.provider);
    localStorage.setItem(STORAGE_PREFIX + 'model', settings.model);
    localStorage.setItem(STORAGE_PREFIX + 'apikey_' + settings.provider, settings.apiKey);
    localStorage.setItem(STORAGE_PREFIX + 'debounce', settings.debounceMs.toString());
    localStorage.setItem(STORAGE_PREFIX + 'tts_enabled', settings.ttsEnabled ? 'true' : 'false');
    localStorage.setItem(STORAGE_PREFIX + 'ai_enabled', settings.aiEnabled ? 'true' : 'false');
    localStorage.setItem(STORAGE_PREFIX + 'system_prompt', settings.systemPrompt);
    localStorage.setItem(STORAGE_PREFIX + 'display_name', settings.displayName);
}

/**
 * Toggle AI enabled state
 */
export function toggleAIEnabled() {
    settings.aiEnabled = !settings.aiEnabled;
    saveSettings();
    return settings.aiEnabled;
}

/**
 * Get current settings (read-only copy)
 */
export function getSettings() {
    return { ...settings };
}

/**
 * Get API key for a specific provider
 */
export function getApiKeyFor(provider) {
    return localStorage.getItem(STORAGE_PREFIX + 'apikey_' + provider) || '';
}

/**
 * Get provider definitions
 */
export function getProviders() {
    return PROVIDERS;
}

/**
 * Initialize settings modal UI
 */
export function initSettingsUI() {
    const modal = document.getElementById('settings-modal');
    const openBtn = document.getElementById('settingsBtn');
    const closeBtn = document.getElementById('settings-close-btn');
    const providerSelect = document.getElementById('settings-provider');
    const modelSelect = document.getElementById('settings-model');
    const apiKeyInput = document.getElementById('settings-apikey');
    const debounceInput = document.getElementById('settings-debounce');
    const ttsToggle = document.getElementById('settings-tts');
    const aiToggle = document.getElementById('settings-ai-enabled');
    const promptTextarea = document.getElementById('settings-prompt');
    const promptResetBtn = document.getElementById('settings-prompt-reset');
    const displayNameInput = document.getElementById('settings-display-name');

    if (!modal || !openBtn) return;

    // Open
    openBtn.addEventListener('click', () => {
        populateSettingsUI();
        modal.classList.remove('hidden');
    });

    // Close
    closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });

    // Provider change
    providerSelect.addEventListener('change', () => {
        // Save current API key for current provider before switching
        localStorage.setItem(STORAGE_PREFIX + 'apikey_' + settings.provider, apiKeyInput.value);

        settings.provider = providerSelect.value;
        settings.model = PROVIDERS[settings.provider].defaultModel;
        settings.apiKey = getApiKeyFor(settings.provider);
        populateModelSelect();
        apiKeyInput.value = settings.apiKey;
        saveSettings();
    });

    // Model change
    modelSelect.addEventListener('change', () => {
        settings.model = modelSelect.value;
        saveSettings();
    });

    // API key change
    apiKeyInput.addEventListener('input', () => {
        settings.apiKey = apiKeyInput.value.trim();
        saveSettings();
    });

    // Debounce change
    debounceInput.addEventListener('input', () => {
        const val = parseInt(debounceInput.value, 10);
        if (!isNaN(val) && val >= 1) {
            settings.debounceMs = val * 1000;
            saveSettings();
        }
    });

    // TTS toggle
    ttsToggle.addEventListener('change', () => {
        settings.ttsEnabled = ttsToggle.checked;
        setTTSEnabled(ttsToggle.checked);
        saveSettings();
    });

    // AI Global toggle
    if (aiToggle) {
        aiToggle.addEventListener('change', () => {
            settings.aiEnabled = aiToggle.checked;
            saveSettings();
        });
    }

    // System prompt
    if (promptTextarea) {
        promptTextarea.addEventListener('input', () => {
            settings.systemPrompt = promptTextarea.value;
            saveSettings();
        });
    }

    // Reset prompt to default
    if (promptResetBtn) {
        promptResetBtn.addEventListener('click', () => {
            settings.systemPrompt = DEFAULT_SYSTEM_PROMPT;
            if (promptTextarea) promptTextarea.value = DEFAULT_SYSTEM_PROMPT;
            saveSettings();
        });
    }

    // Display name
    if (displayNameInput) {
        displayNameInput.addEventListener('input', () => {
            settings.displayName = displayNameInput.value.trim() || 'トモ';
            const titleEl = document.getElementById('ai-chat-title');
            if (titleEl) titleEl.textContent = settings.displayName;
            saveSettings();
        });
    }
}

/**
 * Populate settings UI with current values
 */
function populateSettingsUI() {
    const providerSelect = document.getElementById('settings-provider');
    const modelSelect = document.getElementById('settings-model');
    const apiKeyInput = document.getElementById('settings-apikey');
    const debounceInput = document.getElementById('settings-debounce');
    const ttsToggle = document.getElementById('settings-tts');

    providerSelect.value = settings.provider;
    populateModelSelect();
    apiKeyInput.value = settings.apiKey;
    debounceInput.value = Math.round(settings.debounceMs / 1000);
    ttsToggle.checked = settings.ttsEnabled;
    const aiToggle = document.getElementById('settings-ai-enabled');
    if (aiToggle) aiToggle.checked = settings.aiEnabled;

    const promptTextarea = document.getElementById('settings-prompt');
    if (promptTextarea) {
        promptTextarea.value = settings.systemPrompt;
    }

    const displayNameInput = document.getElementById('settings-display-name');
    if (displayNameInput) {
        displayNameInput.value = settings.displayName;
    }
}

/**
 * Populate model select based on current provider
 */
function populateModelSelect() {
    const modelSelect = document.getElementById('settings-model');
    const provider = PROVIDERS[settings.provider];
    modelSelect.innerHTML = '';
    provider.models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.name;
        if (m.id === settings.model) opt.selected = true;
        modelSelect.appendChild(opt);
    });
}
