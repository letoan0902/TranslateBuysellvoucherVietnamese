/**
 * Auto Translate Extension — Entry Point
 * Detects the current platform and delegates to the appropriate adapter.
 * Supports: BuySellVouchers, Digiseller/Plati, Telegram Web A
 */
(function () {
    'use strict';

    // ========== EXTENSION CONTEXT VALIDATION ==========

    function isExtensionContextValid() {
        try {
            return !!(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id);
        } catch (e) {
            return false;
        }
    }

    // ========== DETECT PLATFORM ==========

    function detectPlatform() {
        const hostname = window.location.hostname;
        const url = window.location.href;

        if (hostname.includes('buysellvouchers.com')) {
            return 'buysellvouchers';
        }
        if (hostname.includes('digiseller.com') || hostname.includes('plati.market') || hostname.includes('plati.ru')) {
            return 'digiseller';
        }
        if (hostname.includes('web.telegram.org')) {
            return 'telegram';
        }
        return null;
    }

    function getAdapter(platform) {
        switch (platform) {
            case 'buysellvouchers':
                return window.AdapterBSV;
            case 'digiseller':
                return window.AdapterDigiseller;
            case 'telegram':
                return window.AdapterTelegram;
            default:
                return null;
        }
    }

    // ========== INITIALIZATION ==========

    let isProcessing = false;
    let observerInstance = null;
    let processTimeout = null;
    let lastProcessTime = 0;
    const PROCESS_DEBOUNCE = 500;
    const MIN_PROCESS_INTERVAL = 2000;
    const POLL_INTERVAL = 5000;

    async function init() {
        if (!isExtensionContextValid()) {
            console.warn('[AutoTranslate] Extension context invalidated, reload page may be required');
            return;
        }

        const platform = detectPlatform();
        if (!platform) {
            console.log('[AutoTranslate] Unknown platform, extension not activated');
            return;
        }

        const adapter = getAdapter(platform);
        if (!adapter) {
            console.error('[AutoTranslate] Adapter not found for platform:', platform);
            return;
        }

        console.log(`[AutoTranslate] Loaded on ${adapter.PLATFORM_NAME}`);

        try {
            const apiKey = await window.TranslateAPI.getApiKey();
            if (!apiKey) {
                window.TranslateUI.showNotification('Vui lòng cấu hình Gemini API key! Click vào icon extension để nhập.', 'error');
            }

            // Wait for page to be ready
            const startProcessing = () => {
                setTimeout(() => processPage(adapter), 1000);
                observePageChanges(adapter);
            };

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', startProcessing);
            } else {
                startProcessing();
            }
        } catch (error) {
            console.error('[AutoTranslate] Error initializing:', error);
            if (error.message && error.message.includes('Extension context invalidated')) {
                window.TranslateUI.showNotification('Extension đã được cập nhật. Vui lòng reload trang.', 'error');
            }
        }
    }

    async function processPage(adapter) {
        if (!isExtensionContextValid()) return;
        if (isProcessing) return;

        const now = Date.now();
        if (now - lastProcessTime < MIN_PROCESS_INTERVAL) return;

        try {
            const apiKey = await window.TranslateAPI.getApiKey();
            if (!apiKey) return;

            isProcessing = true;
            lastProcessTime = now;

            adapter.processPage();
        } catch (error) {
            console.error('[AutoTranslate] Error processing page:', error);
        } finally {
            isProcessing = false;
        }
    }

    function observePageChanges(adapter) {
        if (observerInstance) return;

        const config = adapter.getObserverConfig();

        observerInstance = new MutationObserver((mutations) => {
            let hasNewMessage = false;

            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1 && config.checkNewMessage(node)) {
                        hasNewMessage = true;
                    }
                });
            });

            if (!hasNewMessage) return;

            if (processTimeout) clearTimeout(processTimeout);
            processTimeout = setTimeout(() => processPage(adapter), PROCESS_DEBOUNCE);
        });

        observerInstance.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Polling fallback
        setInterval(() => {
            if (!isProcessing) processPage(adapter);
        }, POLL_INTERVAL);
    }

    // Start
    init();
})();
