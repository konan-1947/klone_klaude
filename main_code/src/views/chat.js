const vscode = acquireVsCodeApi();
const chatContainer = document.getElementById('chat-container');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const initButton = document.getElementById('init-button');
const logoutButton = document.getElementById('logout-button');
const statusDiv = document.getElementById('status');
let loadingElement = null;

function addMessage(text, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;

    if (type === 'bot') {
        // Render markdown cho bot response
        messageDiv.innerHTML = marked.parse(text);
    } else {
        // User message giữ nguyên textContent
        messageDiv.textContent = text;
    }

    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function addLog(timestamp, level, category, message) {
    const logDiv = document.createElement('div');
    logDiv.className = `log-message log-${level}`;

    const timestampSpan = document.createElement('span');
    timestampSpan.className = 'log-timestamp';
    timestampSpan.textContent = `[${timestamp}]`;

    const categorySpan = document.createElement('span');
    categorySpan.className = 'log-category';
    categorySpan.textContent = `[${category.toUpperCase()}]`;

    const messageSpan = document.createElement('span');
    messageSpan.textContent = ` ${message}`;

    logDiv.appendChild(timestampSpan);
    logDiv.appendChild(categorySpan);
    logDiv.appendChild(messageSpan);

    // Insert log BEFORE thinking indicator if it exists, otherwise append
    if (loadingElement && loadingElement.parentNode === chatContainer) {
        chatContainer.insertBefore(logDiv, loadingElement);
    } else {
        chatContainer.appendChild(logDiv);
    }
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function showLoading() {
    if (loadingElement) {
        loadingElement.remove();
    }

    loadingElement = document.createElement('div');
    loadingElement.className = 'thinking-indicator';
    loadingElement.innerHTML = 'Thinking<span class="loading-dots"><span>.</span><span>.</span><span>.</span></span>';
    chatContainer.appendChild(loadingElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function hideLoading() {
    if (loadingElement) {
        loadingElement.remove();
        loadingElement = null;
    }
}

function sendMessage() {
    const message = messageInput.value.trim();
    if (message) {
        addMessage(message, 'user');
        vscode.postMessage({
            type: 'sendMessage',
            message: message
        });
        messageInput.value = '';
        showLoading();
    }
}

// Event listeners
initButton.addEventListener('click', () => {
    vscode.postMessage({ type: 'initialize' });
});

logoutButton.addEventListener('click', () => {
    vscode.postMessage({ type: 'logout' });
});

sendButton.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Message handler
window.addEventListener('message', event => {
    const message = event.data;

    switch (message.type) {
        case 'receiveMessage':
            hideLoading();
            addMessage(message.message, 'bot');
            break;
        case 'error':
            hideLoading();
            addMessage(message.message, 'bot');
            break;
        case 'log':
            addLog(
                message.timestamp || new Date().toTimeString().split(' ')[0],
                message.level || 'info',
                message.category || 'system',
                message.message
            );
            break;
        case 'authStatus':
            if (message.authenticated) {
                statusDiv.textContent = message.userEmail || 'Authenticated';
                initButton.classList.add('hidden');
                logoutButton.classList.remove('hidden');
            } else {
                statusDiv.textContent = 'Not initialized';
                initButton.classList.remove('hidden');
                logoutButton.classList.add('hidden');
            }
            break;
        case 'logoutSuccess':
            statusDiv.textContent = 'Not initialized';
            initButton.classList.remove('hidden');
            logoutButton.classList.add('hidden');
            chatContainer.innerHTML = '';
            break;
    }
});
