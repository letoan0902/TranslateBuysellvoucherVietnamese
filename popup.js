document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('apiKeyInput');
    const saveBtn = document.getElementById('saveBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const status = document.getElementById('status');

    // Load API key hiện tại
    chrome.storage.local.get(['groq_api_key'], (result) => {
        if (result.groq_api_key) {
            apiKeyInput.value = result.groq_api_key;
        }
    });

    // Lưu API key
    saveBtn.addEventListener('click', () => {
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            showStatus('Vui lòng nhập API key!', 'error');
            return;
        }

        chrome.storage.local.set({ groq_api_key: apiKey }, () => {
            showStatus('Đã lưu API key thành công!', 'success');
            setTimeout(() => {
                window.close();
            }, 1000);
        });
    });

    // Hủy
    cancelBtn.addEventListener('click', () => {
        window.close();
    });

    // Enter để lưu
    apiKeyInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveBtn.click();
        }
    });

    function showStatus(message, type) {
        status.textContent = message;
        status.className = `status ${type}`;
        status.style.display = 'block';
        setTimeout(() => {
            status.style.display = 'none';
        }, 3000);
    }
});

