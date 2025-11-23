export const TIMEOUTS = {
    PAGE_LOAD: 30000,
    ANGULAR_RENDER_DELAY: 5000,
    CHECK_LOGIN_DELAY: 2000,
    RESPONSE_CHECK_INTERVAL: 1000,
    INPUT_FOCUS_DELAY: 500,
    TYPE_DELAY: 50,
    AFTER_TYPE_DELAY: 1000,
    MAX_LOGIN_WAIT: 5 * 60 * 1000,
    LOGIN_CHECK_INTERVAL: 2000,
} as const;

export const RETRY_COUNTS = {
    MAX_RESPONSE_ATTEMPTS: 90,
    STABLE_COUNT_REQUIRED: 2,
} as const;

export const URLS = {
    AI_STUDIO_BASE: 'https://aistudio.google.com',
    AI_STUDIO_NEW_CHAT: 'https://aistudio.google.com/app/prompts/new_chat',
} as const;

export const SELECTORS = {
    INPUT: [
        'textarea',
        '[contenteditable="true"]',
        'div[role="textbox"]',
        'input[type="text"]',
        '.ql-editor',
        '[data-placeholder]',
        'div.editor',
        'rich-textarea',
        '[aria-label*="prompt"]',
        '[aria-label*="input"]',
    ],
    BUTTON: [
        'button[type="submit"]',
        'button[aria-label*="Run"]',
        'button[aria-label*="Send"]',
        'button:has-text("Run")',
        'button:has-text("Send")',
        '[role="button"][aria-label*="Send"]',
    ],
    USER_PROFILE: [
        '[data-user-email]',
        '[aria-label*="Account"]',
        '.user-profile',
    ],
    AI_STUDIO_UI: [
        '[data-prompt-input]',
        '.prompt-editor',
        'textarea[placeholder*="prompt"]',
    ],
    CHAT_CONTAINER: '.chat-turn-container',
    TURN_CONTENT: '.turn-content',
    TURN_FOOTER: '.turn-footer',
} as const;

export const SESSION_CONFIG = {
    EXPIRY_DAYS: 30,
    FILE_NAME: 'ai-studio-session.json',
} as const;

export const BROWSER_CONFIG = {
    ARGS: [
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1280,720',
    ],
    VIEWPORT: {
        width: 1280,
        height: 720,
    },
} as const;
