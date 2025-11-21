import puppeteer, { Browser, Page } from 'puppeteer';
import * as vscode from 'vscode';
import { CookieManager } from './cookieManager';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class AIStudioBrowser {
    private browser: Browser | null = null;
    private page: Page | null = null;
    private cookieManager: CookieManager;
    private isAuthenticated: boolean = false;

    constructor(cookieManager: CookieManager) {
        this.cookieManager = cookieManager;
    }

    async initialize(): Promise<void> {
        this.browser = await puppeteer.launch({
            headless: false,
            args: [
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-blink-features=AutomationControlled',
                '--window-size=1280,720'
            ]
        });

        this.page = await this.browser.newPage();
        await this.page.setViewport({ width: 1280, height: 720 });
        await this.ensureAuthenticated();
    }

    async ensureAuthenticated(): Promise<void> {
        if (!this.page) {
            throw new Error('Browser not initialized');
        }

        const savedCookies = await this.cookieManager.loadCookies();

        if (savedCookies && savedCookies.length > 0) {
            console.log('Restoring saved session...');
            await this.page.setCookie(...savedCookies);
            await this.page.goto('https://aistudio.google.com', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            const isValid = await this.checkLoginStatus();

            if (isValid) {
                console.log('Session restored successfully');
                this.isAuthenticated = true;
                return;
            } else {
                console.log('Session expired, clearing...');
                await this.cookieManager.clearCookies();
            }
        }

        await this.performManualLogin();
    }

    private async checkLoginStatus(): Promise<boolean> {
        if (!this.page) return false;

        try {
            await delay(2000);

            // @ts-ignore - Code chạy trong browser context
            const isLoggedIn = await this.page.evaluate(() => {
                const userProfile = document.querySelector('[data-user-email]') ||
                    document.querySelector('[aria-label*="Account"]') ||
                    document.querySelector('.user-profile');

                const notOnLoginPage = !window.location.href.includes('/login') &&
                    !window.location.href.includes('/signin');

                const hasAIStudioUI = document.querySelector('[data-prompt-input]') ||
                    document.querySelector('.prompt-editor') ||
                    document.querySelector('textarea[placeholder*="prompt"]');

                return (userProfile !== null || hasAIStudioUI !== null) && notOnLoginPage;
            });

            return isLoggedIn;
        } catch (error) {
            console.error('Error checking login status:', error);
            return false;
        }
    }

    private async performManualLogin(): Promise<void> {
        if (!this.page) {
            throw new Error('Browser not initialized');
        }

        console.log('Starting manual login flow...');

        await this.page.goto('https://aistudio.google.com', {
            waitUntil: 'networkidle2'
        });

        vscode.window.showInformationMessage(
            '🔐 Vui lòng đăng nhập AI Studio trong browser',
            'Đã đăng nhập'
        );

        const loginSuccess = await this.waitForLogin();

        if (!loginSuccess) {
            throw new Error('Login timeout');
        }

        const cookies = await this.page.cookies();
        const userEmail = await this.getUserEmail();
        await this.cookieManager.saveCookies(cookies, userEmail);

        this.isAuthenticated = true;

        vscode.window.showInformationMessage('✅ Đăng nhập thành công!');
    }

    private async waitForLogin(): Promise<boolean> {
        if (!this.page) return false;

        const maxWaitTime = 5 * 60 * 1000;
        const checkInterval = 2000;
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTime) {
            const isLoggedIn = await this.checkLoginStatus();

            if (isLoggedIn) {
                return true;
            }

            await delay(checkInterval);
        }

        return false;
    }

    private async getUserEmail(): Promise<string | undefined> {
        if (!this.page) return undefined;

        try {
            // @ts-ignore - Code chạy trong browser context
            const email = await this.page.evaluate(() => {
                const emailElement = document.querySelector('[data-user-email]');
                if (emailElement) {
                    return emailElement.textContent?.trim();
                }

                const profileButton = document.querySelector('[aria-label*="Account"]');
                return profileButton?.getAttribute('aria-label')?.match(/[\w.-]+@[\w.-]+\.\w+/)?.[0];
            });

            return email || undefined;
        } catch {
            return undefined;
        }
    }

    async sendPrompt(prompt: string): Promise<string> {
        if (!this.page || !this.isAuthenticated) {
            throw new Error('Not authenticated');
        }

        try {
            // Navigate và wait cho page load xong
            console.log('Navigating to AI Studio new chat...');
            await this.page.goto('https://aistudio.google.com/app/prompts/new_chat', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            // Wait thêm để Angular app render
            await delay(5000);

            // Check current URL
            const currentUrl = this.page.url();
            console.log('Current URL:', currentUrl);

            // Take screenshot for debugging
            const screenshotPath = 'd:/desktop_data/Code_Dao/convert_ide_to_chatbot/test_browser_connect/debug-page.png';
            await this.page.screenshot({ path: screenshotPath });
            console.log('Screenshot saved to:', screenshotPath);

            // Debug: Log page info
            const pageInfo = await this.page.evaluate(() => {
                return {
                    title: document.title,
                    url: window.location.href,
                    bodyText: document.body?.innerText?.substring(0, 500),
                    hasAngularApp: !!document.querySelector('[ng-version]'),
                    allInputTypes: Array.from(document.querySelectorAll('input')).map(i => i.type),
                    allTags: Array.from(new Set(Array.from(document.querySelectorAll('*')).map(el => el.tagName))).slice(0, 50)
                };
            });
            console.log('Page Info:', JSON.stringify(pageInfo, null, 2));

            // Debug: Log ra các elements có thể
            const debugInfo = await this.page.evaluate(() => {
                const textareas = document.querySelectorAll('textarea');
                const editables = document.querySelectorAll('[contenteditable="true"]');
                const inputs = document.querySelectorAll('input[type="text"]');
                const divs = document.querySelectorAll('div[role="textbox"]');

                return {
                    textareaCount: textareas.length,
                    editableCount: editables.length,
                    inputCount: inputs.length,
                    textboxDivCount: divs.length,
                    textareaSelectors: Array.from(textareas).map(el => ({
                        tag: el.tagName,
                        class: el.className,
                        id: el.id,
                        placeholder: el.placeholder
                    })),
                    editableSelectors: Array.from(editables).map(el => ({
                        tag: el.tagName,
                        class: el.className,
                        id: el.id
                    }))
                };
            });

            console.log('DEBUG - Page elements:', JSON.stringify(debugInfo, null, 2));

            // Try multiple selectors
            const selectors = [
                'textarea',
                '[contenteditable="true"]',
                'div[role="textbox"]',
                'input[type="text"]',
                '.ql-editor',
                '[data-placeholder]',
                'div.editor',
                'rich-textarea',
                '[aria-label*="prompt"]',
                '[aria-label*="input"]'
            ];

            let inputFound = false;
            let inputSelector = '';

            for (const selector of selectors) {
                try {
                    await this.page.waitForSelector(selector, {
                        visible: true,
                        timeout: 3000
                    });
                    inputSelector = selector;
                    inputFound = true;
                    console.log(`Found input using selector: ${selector}`);
                    break;
                } catch {
                    console.log(`Selector ${selector} not found`);
                }
            }

            if (!inputFound) {
                throw new Error(`Could not find input element. Current URL: ${currentUrl}. Check debug-page.png for screenshot. Debug info: ${JSON.stringify(debugInfo)}`);
            }

            // Click để focus
            await this.page.click(inputSelector);
            await delay(500);

            // Type prompt
            await this.page.type(inputSelector, prompt, { delay: 50 });
            await delay(1000);

            // Try to find and click send button
            const buttonSelectors = [
                'button[type="submit"]',
                'button[aria-label*="Run"]',
                'button[aria-label*="Send"]',
                'button:has-text("Run")',
                'button:has-text("Send")',
                '[role="button"][aria-label*="Send"]'
            ];

            let buttonClicked = false;
            for (const btnSelector of buttonSelectors) {
                try {
                    const button = await this.page.$(btnSelector);
                    if (button) {
                        await button.click();
                        buttonClicked = true;
                        console.log(`Clicked button: ${btnSelector}`);
                        break;
                    }
                } catch {
                    console.log(`Button ${btnSelector} not found`);
                }
            }

            if (!buttonClicked) {
                // Fallback: press Enter
                await this.page.keyboard.press('Enter');
                console.log('Pressed Enter as fallback');
            }

            const response = await this.waitForResponse();
            return response;

        } catch (error: any) {
            throw new Error(`Send prompt failed: ${error.message}`);
        }
    }

    private async waitForResponse(): Promise<string> {
        if (!this.page) {
            throw new Error('Page not initialized');
        }

        console.log('Waiting for response to complete...');

        const maxAttempts = 90;
        let previousText = '';
        let stableCount = 0;

        for (let i = 0; i < maxAttempts; i++) {
            await delay(1000);

            const currentInfo = await this.page.evaluate(() => {
                const containers = document.querySelectorAll('.chat-turn-container');
                if (containers.length > 0) {
                    const lastContainer = containers[containers.length - 1];

                    // Get text (bỏ qua thinking)
                    const turnContent = lastContainer.querySelector('.turn-content');
                    let text = '';
                    if (turnContent) {
                        const clone = turnContent.cloneNode(true) as HTMLElement;
                        const thinkingSections = clone.querySelectorAll('[class*="thinking"], [class*="thought"]');
                        thinkingSections.forEach(el => el.remove());
                        const buttons = clone.querySelectorAll('button');
                        buttons.forEach(el => el.remove());
                        text = clone.textContent?.trim() || '';
                    }

                    // Check footer
                    const footer = lastContainer.querySelector('.turn-footer');
                    let hasFooter = false;
                    if (footer) {
                        const hasLike = footer.querySelector('button');
                        hasFooter = !!hasLike;
                    }

                    return { text, hasFooter, textLength: text.length };
                }
                return { text: '', hasFooter: false, textLength: 0 };
            });

            console.log(`Attempt ${i + 1}: len=${currentInfo.textLength}, footer=${currentInfo.hasFooter}, stable=${stableCount}`);

            // Text ổn định?
            if (currentInfo.text === previousText && currentInfo.text.length > 0) {
                stableCount++;

                // Text ổn định VÀ có footer → xong
                if (currentInfo.hasFooter && stableCount >= 2) {
                    console.log('Response complete!');
                    break;
                }
            } else {
                stableCount = 0;
                previousText = currentInfo.text;
            }
        }

        // Screenshot
        const screenshotPath = 'd:/desktop_data/Code_Dao/convert_ide_to_chatbot/test_browser_connect/debug-response.png';
        await this.page.screenshot({ path: screenshotPath });
        console.log('Screenshot saved');

        // Extract final response
        const responseText = await this.page.evaluate(() => {
            const containers = document.querySelectorAll('.chat-turn-container');
            if (containers.length > 0) {
                const lastContainer = containers[containers.length - 1];
                const turnContent = lastContainer.querySelector('.turn-content');
                if (turnContent) {
                    const clone = turnContent.cloneNode(true) as HTMLElement;
                    const thinkingSections = clone.querySelectorAll('[class*="thinking"], [class*="thought"]');
                    thinkingSections.forEach(el => el.remove());
                    const buttons = clone.querySelectorAll('button');
                    buttons.forEach(el => el.remove());
                    return clone.textContent?.trim() || '';
                }
            }
            return '';
        });

        console.log('Extracted:', responseText.substring(0, 300));

        if (!responseText || responseText.length === 0) {
            throw new Error('Could not extract response text');
        }

        return responseText;
    }

    async close(): Promise<void> {
        if (this.page) {
            await this.page.close();
            this.page = null;
        }

        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }

        this.isAuthenticated = false;
    }
}
