// ============================================
// TTS Module - Text-to-Speech Abstraction
// ============================================
// Thin abstraction layer for TTS. Currently uses Web Speech API.
// Can be swapped to OpenAI TTS, Google Cloud TTS, etc.

let enabled = false;
let currentUtterance = null;

/**
 * Initialize TTS settings from localStorage
 */
export function initTTS() {
    enabled = localStorage.getItem('drawai_tts_enabled') === 'true';
}

/**
 * Set TTS enabled/disabled
 */
export function setTTSEnabled(val) {
    enabled = val;
    localStorage.setItem('drawai_tts_enabled', val ? 'true' : 'false');
}

/**
 * Get TTS enabled state
 */
export function isTTSEnabled() {
    return enabled;
}

/**
 * Speak text aloud. Cancels any ongoing speech first.
 * @param {string} text
 */
export function speak(text) {
    if (!enabled) return;
    if (!('speechSynthesis' in window)) return;

    // Cancel ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 1.1;
    utterance.pitch = 1.0;

    // Try to pick a Japanese voice
    const voices = window.speechSynthesis.getVoices();
    const jaVoice = voices.find(v => v.lang.startsWith('ja'));
    if (jaVoice) {
        utterance.voice = jaVoice;
    }

    currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
}

/**
 * Stop current speech
 */
export function stopSpeaking() {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
    currentUtterance = null;
}
