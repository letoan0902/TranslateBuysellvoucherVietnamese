/**
 * Language Detection Module
 * Detects Vietnamese, Russian, and English text
 */
window.TranslateLanguage = (function () {
    'use strict';

    const VIETNAMESE_REGEX = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ]/;
    const RUSSIAN_REGEX = /[а-яА-ЯёЁ]/;

    /**
     * Detect the language of the given text
     * Priority: Vietnamese > Russian > English (default)
     * @param {string} text
     * @returns {'Vietnamese'|'Russian'|'English'}
     */
    function detectLanguage(text) {
        if (!text || text.trim().length === 0) return 'English';

        if (VIETNAMESE_REGEX.test(text)) {
            return 'Vietnamese';
        }
        if (RUSSIAN_REGEX.test(text)) {
            return 'Russian';
        }
        return 'English';
    }

    /**
     * Get the target language for translation.
     * For hover (message) translate:
     *   Russian/English → Vietnamese
     *   Vietnamese → English (default)
     * For input translate: detect customer's language from context
     * @param {string} sourceLang - detected language of the source text
     * @param {string} [conversationContext] - optional context to detect customer language
     * @returns {string}
     */
    function getTargetLanguage(sourceLang, conversationContext) {
        // If source is Vietnamese AND we have context, find the customer's language
        if (sourceLang === 'Vietnamese' && conversationContext) {
            const customerLang = detectContextLanguage(conversationContext);
            if (customerLang && customerLang !== 'Vietnamese') {
                return customerLang;
            }
        }

        switch (sourceLang) {
            case 'Vietnamese':
                return 'English';
            case 'Russian':
                return 'Vietnamese';
            case 'English':
                return 'Vietnamese';
            default:
                return 'Vietnamese';
        }
    }

    /**
     * Detect the dominant language of the OTHER party from conversation context.
     * Looks at messages from Customer/Buyer/Contact lines in the context.
     * Falls back to scanning the entire context for dominant non-Vietnamese language.
     * @param {string} context - conversation context string
     * @returns {string|null} - detected language or null
     */
    function detectContextLanguage(context) {
        if (!context) return null;

        // Split on real newlines AND literal \n (different adapters may format differently)
        const lines = context.split(/\n|\\n/);
        const otherPartyTexts = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // Match lines like "Customer: ...", "Buyer (Customer): ...", "Contact: ..."
            const match = trimmed.match(/^(?:Customer|Buyer|Contact)(?:\s*\([^)]*\))?\s*:\s*(.+)$/i);
            if (match && match[1]) {
                otherPartyTexts.push(match[1].trim());
            }
        }

        // If we found Other Party messages, analyze their language
        if (otherPartyTexts.length > 0) {
            let russianCount = 0;
            let englishCount = 0;

            for (const text of otherPartyTexts.slice(-5)) {
                if (RUSSIAN_REGEX.test(text)) {
                    russianCount++;
                } else if (!VIETNAMESE_REGEX.test(text)) {
                    englishCount++;
                }
            }

            if (russianCount > englishCount) return 'Russian';
            if (englishCount > 0) return 'English';
        }

        // Fallback: scan the entire context for Russian or English
        // Exclude lines that start with "You" or "You (Seller)" to focus on the other party
        const allNonOwnTexts = [];
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            // Skip own messages and header lines
            if (/^(?:You|Seller|Conversation context)/i.test(trimmed)) continue;
            allNonOwnTexts.push(trimmed);
        }

        if (allNonOwnTexts.length > 0) {
            const combined = allNonOwnTexts.join(' ');
            if (RUSSIAN_REGEX.test(combined)) return 'Russian';
            if (!VIETNAMESE_REGEX.test(combined)) return 'English';
        }

        return null;
    }

    return {
        detectLanguage,
        getTargetLanguage,
        detectContextLanguage,
        VIETNAMESE_REGEX,
        RUSSIAN_REGEX
    };
})();
