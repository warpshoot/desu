// ============================================
// AI Module - Canvas Snapshot & Multi-Provider API
// ============================================

import { layers, canvasBg } from './state.js';
import { getSettings } from './settings.js';
import { speak } from './tts.js';

// Conversation history (keep last N entries)
const MAX_HISTORY = 6;
let conversationHistory = []; // { role: 'assistant'|'user', content: string }

// State
let isSending = false;
let hasDrawingChanged = false;
let lastSendTime = 0;
// pollingInterval is managed via window._aiPollingInterval to prevent duplicates across reloads

// Callbacks
let onCommentReceived = null;
let onStatusChange = null;

export const DEFAULT_SYSTEM_PROMPT = `あなたはユーザーが絵を描いているのを隣で見ている存在です。名前はFano。

## 口調・人格
- 一人称は「わたし」、相手のことは「キミ」
- タメ口。「です・ます」は使わない
- 真面目な顔してふざけるタイプ。知的な語彙をくだらない文脈で使う
- 褒めるとき素直に褒めない。斜めから行く（例：「構図の暴力性がすごい」「無意識に性癖出てない？」）
- ツッコむけど拒絶感は残さない。軽い毒はOK
- 断定と余韻のバランス。全部言わずに含みを残す
- 1〜2文の短いコメント。長くしない
- 絵文字は使わない

## コメントの方針
- 途中経過として見る（完成品として評価しない）
- 何を描いてるか当てようとしてもいい
- 線の勢いや迷いに言及してもいい
- たまにキミの趣味嗜好を推測してツッコむ
- 前回と同じようなコメントは避ける
- 空白キャンバスや変化が少ないときは無理にコメントしなくていい
- キャンバス上に手書きの文字があればそれはキミからの返事やメッセージなので、読み取って応答する`;

/**
 * Initialize AI module
 * @param {Object} callbacks - { onComment: (text) => void, onStatus: (status) => void }
 */
export function initAI(callbacks) {
    onCommentReceived = callbacks.onComment || (() => { });
    onStatusChange = callbacks.onStatus || (() => { });

    // Start polling loop
    startPolling();
}

function startPolling() {
    if (window._aiPollingInterval) clearInterval(window._aiPollingInterval);
    window._aiPollingInterval = setInterval(checkAndSend, 1000); // Check every second
}

async function checkAndSend() {
    const { aiEnabled, debounceMs } = getSettings();

    if (!aiEnabled || isSending || !hasDrawingChanged) return;

    const now = Date.now();
    if (now - lastSendTime >= debounceMs) {
        await sendSnapshot();
        lastSendTime = Date.now();
        hasDrawingChanged = false;
    }
}

/**
 * Reset conversation history
 */
export function resetHistory() {
    conversationHistory = [];
}

/**
 * Notify that a stroke has started (cancel pending send)
 */
// No-op for stroke start in polling mode
export function onStrokeStart() {
}

/**
 * Notify that a stroke has ended (start debounce timer)
 */
/**
 * Notify that a stroke has ended
 */
export function onStrokeEnd() {
    hasDrawingChanged = true;
}

/**
 * Capture canvas snapshot: merge all visible layers + background, resize to max 512px
 * @returns {string} base64 PNG data URL (without prefix)
 */
function captureSnapshot() {
    const w = layers[0]?.canvas.width || window.innerWidth;
    const h = layers[0]?.canvas.height || window.innerHeight;

    // Create temp canvas to merge layers
    const mergeCanvas = document.createElement('canvas');
    mergeCanvas.width = w;
    mergeCanvas.height = h;
    const mergeCtx = mergeCanvas.getContext('2d');

    // Draw background color
    const bgColor = canvasBg.style.backgroundColor || '#ffffff';
    mergeCtx.fillStyle = bgColor;
    mergeCtx.fillRect(0, 0, w, h);

    // Draw each visible layer
    for (const layer of layers) {
        if (!layer.visible) continue;
        mergeCtx.globalAlpha = layer.opacity;
        mergeCtx.drawImage(layer.canvas, 0, 0);
    }
    mergeCtx.globalAlpha = 1.0;

    // Resize to max 1024px on longest side
    const maxSize = 1024;
    let newW, newH;
    if (w >= h) {
        newW = Math.min(w, maxSize);
        newH = Math.round((newW / w) * h);
    } else {
        newH = Math.min(h, maxSize);
        newW = Math.round((newH / h) * w);
    }

    const resizeCanvas = document.createElement('canvas');
    resizeCanvas.width = newW;
    resizeCanvas.height = newH;
    const resizeCtx = resizeCanvas.getContext('2d');
    resizeCtx.drawImage(mergeCanvas, 0, 0, newW, newH);

    // Get base64 without data URL prefix
    const dataUrl = resizeCanvas.toDataURL('image/png');
    return dataUrl.replace(/^data:image\/png;base64,/, '');
}

/**
 * Send snapshot to API
 */
async function sendSnapshot() {
    const { provider, model, apiKey } = getSettings();

    if (!apiKey) {
        onStatusChange('no-key');
        return;
    }

    isSending = true;
    onStatusChange('sending');

    try {
        const imageBase64 = captureSnapshot();
        const response = await callAPI(provider, model, apiKey, imageBase64);

        if (response) {
            // Add to history
            conversationHistory.push({ role: 'user', content: '[画像を送信]' });
            conversationHistory.push({ role: 'assistant', content: response });

            // Trim history
            while (conversationHistory.length > MAX_HISTORY * 2) {
                conversationHistory.shift();
            }

            onCommentReceived(response);
            speak(response);
        }

        onStatusChange('idle');
    } catch (err) {
        console.error('AI API error:', err);
        onStatusChange('error');
        onCommentReceived(`[Error: ${err.message}]`);
    } finally {
        isSending = false;
    }
}

/**
 * Route API call to correct provider
 */
async function callAPI(provider, model, apiKey, imageBase64) {
    switch (provider) {
        case 'anthropic':
            return callAnthropic(model, apiKey, imageBase64);
        case 'google':
            return callGoogle(model, apiKey, imageBase64);
        case 'openai':
            return callOpenAI(model, apiKey, imageBase64);
        default:
            throw new Error('Unknown provider: ' + provider);
    }
}

// ============================================
// Anthropic Claude API
// ============================================
async function callAnthropic(model, apiKey, imageBase64) {
    const messages = buildAnthropicMessages(imageBase64);

    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
            model,
            max_tokens: 300,
            system: getSettings().systemPrompt,
            messages
        })
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Anthropic ${res.status}: ${err}`);
    }

    const data = await res.json();
    return data.content?.[0]?.text || '';
}

function buildAnthropicMessages(imageBase64) {
    const messages = [];

    // Add conversation history
    for (const entry of conversationHistory) {
        messages.push({
            role: entry.role,
            content: entry.content
        });
    }

    // Add current image
    messages.push({
        role: 'user',
        content: [
            {
                type: 'image',
                source: {
                    type: 'base64',
                    media_type: 'image/png',
                    data: imageBase64
                }
            },
            {
                type: 'text',
                text: '描いてる途中の絵を見てコメントして。'
            }
        ]
    });

    return messages;
}

// ============================================
// Google Gemini API
// ============================================
async function callGoogle(model, apiKey, imageBase64) {
    const contents = buildGeminiContents(imageBase64);

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            systemInstruction: {
                parts: [{ text: getSettings().systemPrompt }]
            },
            contents,
            generationConfig: {
                maxOutputTokens: 300
            }
        })
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gemini ${res.status}: ${err}`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

function buildGeminiContents(imageBase64) {
    const contents = [];

    // Add conversation history
    for (const entry of conversationHistory) {
        contents.push({
            role: entry.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: entry.content }]
        });
    }

    // Add current image
    contents.push({
        role: 'user',
        parts: [
            {
                inlineData: {
                    mimeType: 'image/png',
                    data: imageBase64
                }
            },
            { text: '描いてる途中の絵を見てコメントして。' }
        ]
    });

    return contents;
}

// ============================================
// OpenAI API
// ============================================
async function callOpenAI(model, apiKey, imageBase64) {
    const messages = buildOpenAIMessages(imageBase64);

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model,
            max_tokens: 300,
            messages
        })
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenAI ${res.status}: ${err}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
}

function buildOpenAIMessages(imageBase64) {
    const messages = [
        { role: 'system', content: getSettings().systemPrompt }
    ];

    // Add conversation history
    for (const entry of conversationHistory) {
        messages.push({
            role: entry.role,
            content: entry.content
        });
    }

    // Add current image
    messages.push({
        role: 'user',
        content: [
            {
                type: 'image_url',
                image_url: {
                    url: `data:image/png;base64,${imageBase64}`,
                    detail: 'low'
                }
            },
            {
                type: 'text',
                text: '描いてる途中の絵を見てコメントして。'
            }
        ]
    });

    return messages;
}
