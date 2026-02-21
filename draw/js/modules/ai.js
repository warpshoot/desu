// ============================================
// AI Module - Canvas Snapshot & Multi-Provider API
// ============================================

import { layers, canvasBg } from './state.js';
import { getSettings } from './settings.js';
import { speak } from './tts.js';

// Conversation history (keep last N entries)
let conversationHistory = []; // { role: 'assistant'|'user', content: string }

// State
let isSending = false;
let hasDrawingChanged = false;
let lastSendTime = 0;
// pollingInterval is managed via window._aiPollingInterval to prevent duplicates across reloads

// Callbacks
let onCommentReceived = null;
let onStatusChange = null;

export const DEFAULT_SYSTEM_PROMPT = `あなたはユーザーが絵を描いているのを隣で見ている存在です。

## 人格
- 一人称は「わたし」、相手のことは「あなた」
- カジュアル敬語（「すごいですね」「描くの早くないですか？」）
- 純粋で初心。悪意がない。ちょっと天然
- あなたが何を描こうとしてるのか本気で気になってる
- 絵の上手い下手には興味がない。「何を」「なぜ」描いてるかに興味がある

## リアクションの傾向
- モチーフや題材にまっすぐ反応する（「これ誰ですか？」「あ、動物だ」）
- 描く過程に素朴に驚く（「そこから描くんですね」「下描きなしでいくんですか？」）
- 自分のコメントが邪魔じゃないか少し気にしてる（「あ、集中してますよね、すみません」「黙って見てたほうがいいですか？」）
- でも気になると我慢できずに口を出す

## 禁止事項
- 技術的な指摘やアドバイスはしない
- 完成品として評価しない（途中経過として見る）
- 絵文字は使わない
- 1〜2文の短いコメント。長くしない`;

// システム側で強制する基本指示（ユーザー設定には表示しない）
const CORE_INSTRUCTIONS = `
## 基本挙動
- ユーザーが描いた絵や、送られてきたテキストメッセージに対して、指定された人格として反応してください
- 反応は【絶対に1〜2文】の短文に限定してください。3文以上は禁止です。
- 文字での説明や解説ではなく、ボソッとした「つぶやき」を意識してください
- 【重要】ユーザーからのチャット（テキスト入力）がある場合は、キャンバスの変化に関わらず必ず「会話」として応答してください。
- 逆に、自動的な監視（[画像を送信]のみの場合）で、空白キャンバスや変化が少ないときは「PASS」とだけ返してください
- 絵文字や記号（！や？）の多用は避けてください
- キャンバス上に手書きの文字があれば、それを最優先で読み取って応答してください`;

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
    const { aiEnabled, autoMonitoring, debounceMs } = getSettings();

    if (!aiEnabled || !autoMonitoring || isSending || !hasDrawingChanged) return;

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
    await sendMessage('[画像を送信]', true);
}

/**
 * Send user text message to API
 */
export async function sendUserMessage(text) {
    await sendMessage(text, true);
}

async function sendMessage(userText, includeSnapshot) {
    const { provider, model, apiKey, maxHistory } = getSettings();

    if (!apiKey) {
        onStatusChange('no-key');
        return;
    }

    isSending = true;
    onStatusChange('sending');

    try {
        const imageBase64 = includeSnapshot ? captureSnapshot() : null;
        const response = await callAPI(provider, model, apiKey, imageBase64, userText);

        // 手動メッセージ、または「PASS」以外の返答があれば処理
        const isManual = userText !== '[画像を送信]';
        // response.trim() が 'PASS' でも、手動チャットならそのまま表示する（AIが言葉で返せなかった場合も含む）
        if (response && (response.trim() !== 'PASS' || isManual)) {
            const finalResponse = response.trim();

            // Add to history
            conversationHistory.push({ role: 'user', content: userText });
            conversationHistory.push({ role: 'assistant', content: finalResponse });

            // Trim history
            while (conversationHistory.length > maxHistory * 2) {
                conversationHistory.shift();
            }

            onCommentReceived(finalResponse);
            speak(finalResponse);

            // 手動送信後は自動送信のタイマーをリセット
            lastSendTime = Date.now();
            hasDrawingChanged = false;
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
 * Force draw change flag (used by canvas module)
 */
export function markDrawingChanged() {
    hasDrawingChanged = true;
}

/**
 * Clear conversation history
 */
export function clearHistory() {
    conversationHistory = [];
}
/**
 * Route API call to correct provider
 */
async function callAPI(provider, model, apiKey, imageBase64, userText) {
    switch (provider) {
        case 'anthropic':
            return callAnthropic(model, apiKey, imageBase64, userText);
        case 'google':
            return callGoogle(model, apiKey, imageBase64, userText);
        case 'openai':
            return callOpenAI(model, apiKey, imageBase64, userText);
        default:
            throw new Error('Unknown provider: ' + provider);
    }
}

// ============================================
// Anthropic Claude API
// ============================================
async function callAnthropic(model, apiKey, imageBase64, userText) {
    const messages = buildAnthropicMessages(imageBase64, userText);

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
            system: CORE_INSTRUCTIONS + '\n\n' + getSettings().systemPrompt + '\n\nあなたの名前: ' + getSettings().displayName,
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

function buildAnthropicMessages(imageBase64, userText) {
    const messages = [];

    // Add conversation history
    for (const entry of conversationHistory) {
        messages.push({
            role: entry.role,
            content: entry.content
        });
    }

    // Current interaction
    const content = [];
    if (imageBase64) {
        content.push({
            type: 'image',
            source: {
                type: 'base64',
                media_type: 'image/png',
                data: imageBase64
            }
        });
    }

    let promptText = userText;
    const isAutoPoll = userText === '[画像を送信]';
    if (imageBase64 && isAutoPoll) {
        promptText = '描いてる途中の絵を見てコメントして。';
    }

    const lastAiMsg = conversationHistory.slice().reverse().find(c => c.role === 'assistant');
    if (lastAiMsg && isAutoPoll) {
        promptText += `\n(直前のあなたのコメント: "${lastAiMsg.content}")\n※これと似た内容や表現は絶対に避けてください。語彙を変えるか、思いつかなければ「PASS」してください。`;
    }

    content.push({ type: 'text', text: promptText });

    messages.push({
        role: 'user',
        content
    });

    return messages;
}

// ============================================
// Google Gemini API
// ============================================
async function callGoogle(model, apiKey, imageBase64, userText) {
    const contents = buildGeminiContents(imageBase64, userText);

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            systemInstruction: {
                parts: [{ text: CORE_INSTRUCTIONS + '\n\n' + getSettings().systemPrompt + '\n\nあなたの名前: ' + getSettings().displayName }]
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

function buildGeminiContents(imageBase64, userText) {
    const contents = [];

    // Add conversation history
    for (const entry of conversationHistory) {
        contents.push({
            role: entry.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: entry.content }]
        });
    }

    // Current interaction
    const parts = [];
    if (imageBase64) {
        parts.push({
            inlineData: {
                mimeType: 'image/png',
                data: imageBase64
            }
        });
    }

    let promptText = userText;
    const isAutoPoll = userText === '[画像を送信]';
    if (imageBase64 && isAutoPoll) {
        promptText = '描いてる途中の絵を見てコメントして。';
    }

    const lastAiMsg = conversationHistory.slice().reverse().find(c => c.role === 'assistant');
    if (lastAiMsg && isAutoPoll) {
        promptText += `\n(直前のあなたのコメント: "${lastAiMsg.content}")\n※これと似た内容や表現は絶対に避けてください。語彙を変えるか、思いつかなければ「PASS」してください。`;
    }

    parts.push({ text: promptText });

    contents.push({
        role: 'user',
        parts
    });

    return contents;
}

// ============================================
// OpenAI API
// ============================================
async function callOpenAI(model, apiKey, imageBase64, userText) {
    const messages = buildOpenAIMessages(imageBase64, userText);

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

async function buildOpenAIMessages(imageBase64, userText) {
    const messages = [
        { role: 'system', content: CORE_INSTRUCTIONS + '\n\n' + getSettings().systemPrompt + '\n\nあなたの名前: ' + getSettings().displayName }
    ];

    // Add conversation history
    for (const entry of conversationHistory) {
        messages.push({
            role: entry.role,
            content: entry.content
        });
    }

    // Current interaction
    const content = [];
    if (imageBase64) {
        content.push({
            type: 'image_url',
            image_url: {
                url: `data:image/png;base64,${imageBase64}`,
                detail: 'low'
            }
        });
    }

    let promptText = userText;
    const isAutoPoll = userText === '[画像を送信]';
    if (imageBase64 && isAutoPoll) {
        promptText = '描いてる途中の絵を見てコメントして。';
    }

    const lastAiMsg = conversationHistory.slice().reverse().find(c => c.role === 'assistant');
    if (lastAiMsg && isAutoPoll) {
        promptText += `\n(直前のあなたのコメント: "${lastAiMsg.content}")\n※これと似た内容や表現は絶対に避けてください。語彙を変えるか、思いつかなければ「PASS」してください。`;
    }

    content.push({ type: 'text', text: promptText });

    messages.push({
        role: 'user',
        content
    });

    return messages;
}
