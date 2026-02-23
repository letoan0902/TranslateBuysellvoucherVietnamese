/**
 * Gemini API Module
 * Handles translation via Google Gemini API (AI Studio)
 */
window.TranslateAPI = (function () {
    'use strict';

    const CONFIG = {
        PRIMARY_MODEL: 'gemini-3-flash-preview',
        FALLBACK_MODEL: 'gemini-2.5-flash',
        API_BASE: 'https://generativelanguage.googleapis.com/v1beta/models',
        MAX_OUTPUT_TOKENS: 4096,
        TEMPERATURE: 0.3
    };

    let currentModel = CONFIG.PRIMARY_MODEL;

    // ========== API KEY MANAGEMENT ==========

    async function getApiKey() {
        return new Promise((resolve) => {
            try {
                if (typeof chrome === 'undefined' || !chrome.storage) {
                    console.warn('[AutoTranslate] Chrome storage API not available');
                    resolve('');
                    return;
                }
                chrome.storage.local.get(['gemini_api_key'], (result) => {
                    if (chrome.runtime.lastError) {
                        console.error('[AutoTranslate] Error getting API key:', chrome.runtime.lastError);
                        resolve('');
                        return;
                    }
                    resolve(result.gemini_api_key || '');
                });
            } catch (error) {
                console.error('[AutoTranslate] Error in getApiKey:', error);
                resolve('');
            }
        });
    }

    async function setApiKey(apiKey) {
        return new Promise((resolve) => {
            try {
                if (typeof chrome === 'undefined' || !chrome.storage) {
                    resolve();
                    return;
                }
                chrome.storage.local.set({ gemini_api_key: apiKey }, () => {
                    if (chrome.runtime.lastError) {
                        console.error('[AutoTranslate] Error setting API key:', chrome.runtime.lastError);
                    }
                    resolve();
                });
            } catch (error) {
                console.error('[AutoTranslate] Error in setApiKey:', error);
                resolve();
            }
        });
    }

    // ========== GEMINI API CALL ==========

    /**
     * Call Gemini generateContent API
     * @param {string} prompt - the prompt text
     * @param {string} systemInstruction - system instruction for the model
     * @returns {string} - the generated text
     */
    async function callGemini(prompt, systemInstruction) {
        const apiKey = await getApiKey();
        if (!apiKey) {
            window.TranslateUI.showNotification('Vui lòng cấu hình Gemini API key! Click icon extension để nhập.', 'error');
            return null;
        }

        const url = `${CONFIG.API_BASE}/${currentModel}:generateContent?key=${apiKey}`;

        const requestBody = {
            contents: [{
                parts: [{ text: prompt }]
            }],
            systemInstruction: {
                parts: [{ text: systemInstruction }]
            },
            generationConfig: {
                temperature: CONFIG.TEMPERATURE,
                maxOutputTokens: CONFIG.MAX_OUTPUT_TOKENS
            }
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMsg = errorData?.error?.message || `HTTP ${response.status}`;

                // If primary model fails, try fallback
                if (currentModel === CONFIG.PRIMARY_MODEL && response.status === 404) {
                    console.warn(`[AutoTranslate] Model ${CONFIG.PRIMARY_MODEL} not available, switching to ${CONFIG.FALLBACK_MODEL}`);
                    currentModel = CONFIG.FALLBACK_MODEL;
                    return callGemini(prompt, systemInstruction);
                }

                throw new Error(errorMsg);
            }

            const data = await response.json();

            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                return data.candidates[0].content.parts[0].text.trim();
            } else {
                throw new Error('Unexpected response format from Gemini');
            }
        } catch (error) {
            if (error.message.includes('Failed to fetch')) {
                throw new Error('Không thể kết nối Gemini API. Kiểm tra kết nối mạng.');
            }
            throw error;
        }
    }

    // ========== TRANSLATION FUNCTIONS ==========

    /**
     * Translate text with optional conversation context
     * @param {string} text - text to translate
     * @param {string} fromLang - source language
     * @param {string} toLang - target language
     * @param {string} context - conversation context (previous messages)
     * @returns {string|null} - translated text or null on error
     */
    async function translateText(text, fromLang, toLang, context = '') {
        let prompt = '';

        if (context) {
            prompt = `Translate the following ${fromLang} text to ${toLang}. Consider the conversation context below to provide the most accurate and natural translation. Only return the translated text, nothing else.

Conversation context:
${context}

Text to translate:
${text}`;
        } else {
            prompt = `Translate the following ${fromLang} text to ${toLang}. Provide a natural, fluent translation. Only return the translated text, nothing else:

${text}`;
        }

        const systemInstruction = `You are a professional translator. Translate ${fromLang} to ${toLang} accurately and naturally. You must ONLY output the translated text, with NO explanations, NO notes, and NO additional content.`;

        return callGemini(prompt, systemInstruction);
    }

    /**
     * Translate input text with full conversation context for seller messages
     * This is used when translating the user's input before sending
     * @param {string} text - text to translate
     * @param {string} fromLang - source language
     * @param {string} toLang - target language
     * @param {string} conversationContext - full conversation context
     * @param {string} platformName - platform name for context
     * @returns {string|null}
     */
    async function translateInputText(text, fromLang, toLang, conversationContext = '', platformName = 'marketplace') {
        const prompt = `[NHIỆM VỤ / TASK]
Dịch tin nhắn của Người bán (Seller) từ ${fromLang} sang ${toLang}.
Translate the Seller's message from ${fromLang} to ${toLang}.

[NGÔN NGỮ ĐẦU RA BẮT BUỘC / MANDATORY OUTPUT LANGUAGE]
⚠️ Ngôn ngữ đầu ra phải là: ${toLang}
⚠️ Output language MUST be: ${toLang}
Không được trả về ${fromLang}. Do NOT return ${fromLang}.

${conversationContext ? `[NGỮ CẢNH HỘI THOẠI / CONVERSATION CONTEXT]\n${conversationContext}\n` : ''}
[TIN NHẮN CẦN DỊCH / MESSAGE TO TRANSLATE]
${text}

[YÊU CẦU / REQUIREMENTS]
- Chỉ trả về bản dịch ${toLang}, không giải thích gì thêm
- Only return the ${toLang} translation, nothing else
- Giữ giọng điệu phù hợp giao tiếp mua bán trên ${platformName}
- Dịch tự nhiên, chính xác theo ngữ cảnh hội thoại`;

        const systemInstruction = `Bạn là dịch giả chuyên nghiệp. QUAN TRỌNG: Bạn PHẢI dịch sang ${toLang}. KHÔNG BAO GIỜ trả về ${fromLang}. Chỉ xuất bản dịch, không giải thích.
You are a professional translator. CRITICAL: You MUST translate to ${toLang}. NEVER return ${fromLang}. Output ONLY the translation, no explanations.`;

        return callGemini(prompt, systemInstruction);
    }

    return {
        CONFIG,
        getApiKey,
        setApiKey,
        translateText,
        translateInputText
    };
})();
