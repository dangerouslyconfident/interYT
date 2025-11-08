/**
 * Settings page for interYT Chrome Extension
 * Handles secure API key storage using chrome.storage.local
 */

document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('api-key');
    const keyDisplay = document.getElementById('key-display');
    const saveButton = document.getElementById('save-button');
    const clearButton = document.getElementById('clear-button');
    const successMessage = document.getElementById('success-message');
    const errorMessage = document.getElementById('error-message');

    // Load existing API key on page load
    loadApiKey();

    // Save API key
    saveButton.addEventListener('click', saveApiKey);

    // Clear API key
    clearButton.addEventListener('click', clearApiKey);

    // Update key display when typing
    apiKeyInput.addEventListener('input', updateKeyDisplay);

    /**
     * Load API key from storage and display masked version
     */
    function loadApiKey() {
        chrome.storage.local.get(['geminiApiKey'], (result) => {
            if (result.geminiApiKey) {
                apiKeyInput.value = result.geminiApiKey;
                updateKeyDisplay();
            }
        });
    }

    /**
     * Save API key to chrome.storage.local
     */
    function saveApiKey() {
        const apiKey = apiKeyInput.value.trim();

        if (!apiKey) {
            showError('Please enter an API key');
            return;
        }

        // Basic validation - Gemini API keys typically start with "AI"
        if (!apiKey.startsWith('AI')) {
            showError('Invalid API key format. Gemini API keys typically start with "AI"');
            return;
        }

        // Save to storage
        chrome.storage.local.set({ geminiApiKey: apiKey }, () => {
            if (chrome.runtime.lastError) {
                showError('Failed to save API key: ' + chrome.runtime.lastError.message);
            } else {
                showSuccess('API key saved successfully!');
                updateKeyDisplay();
            }
        });
    }

    /**
     * Clear API key from storage
     */
    function clearApiKey() {
        if (!confirm('Are you sure you want to clear your API key?')) {
            return;
        }

        chrome.storage.local.remove('geminiApiKey', () => {
            if (chrome.runtime.lastError) {
                showError('Failed to clear API key: ' + chrome.runtime.lastError.message);
            } else {
                apiKeyInput.value = '';
                keyDisplay.textContent = '';
                showSuccess('API key cleared successfully!');
            }
        });
    }

    /**
     * Update the masked key display
     */
    function updateKeyDisplay() {
        const key = apiKeyInput.value;
        if (key.length > 8) {
            const masked = key.substring(0, 4) + '•'.repeat(key.length - 8) + key.substring(key.length - 4);
            keyDisplay.textContent = `Current key: ${masked}`;
        } else if (key.length > 0) {
            keyDisplay.textContent = `Current key: ${'•'.repeat(key.length)}`;
        } else {
            keyDisplay.textContent = '';
        }
    }

    /**
     * Show success message
     */
    function showSuccess(message) {
        hideMessages();
        successMessage.textContent = '✓ ' + message;
        successMessage.style.display = 'block';
        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 3000);
    }

    /**
     * Show error message
     */
    function showError(message) {
        hideMessages();
        errorMessage.textContent = '✗ ' + message;
        errorMessage.style.display = 'block';
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    }

    /**
     * Hide all messages
     */
    function hideMessages() {
        successMessage.style.display = 'none';
        errorMessage.style.display = 'none';
    }
});
