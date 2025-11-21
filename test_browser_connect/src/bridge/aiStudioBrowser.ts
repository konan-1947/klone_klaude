import puppeteer, { Browser, Page } from 'puppeteer';
import { CookieManager } from './cookieManager';

export class AIStudioBrowser {
    private browser: Browser | null = null;
    private page: Page | null = null;
    private isAuthenticated: boolean = false;

    constructor(private cookieManager: CookieManager) { }

    async initialize(): Promise<void> {
        console.log('Initializing browser...');

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

        console.log('Browser initialized');

        await this.ensureAuthenticated();
    }

    async ensureAuthenticated(): Promise<void> {
        if (!this.page) {
            throw new Error('Browser not initialized');
        }

        console.log('Checking authentication...');

        const savedCookies = await this.cookieManager.loadCookies();

        if (savedCookies && savedCookies.length > 0) {
            console.log('Found saved cookies, attempting to restore session...');

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
                console.log('Saved cookies expired, clearing...');
                await this.cookieManager.clearCookies();
            }
        }

        await this.performManualLogin();
    }

    private async checkLoginStatus(): Promise<boolean> {
        if (!this.page) return false;

        try {
            await this.page.waitForTimeout(2000);

            const isLoggedIn = await this.page.evaluate(() => {
                const sel1 = '[data-user-email]';
                const sel2 = '[aria-label*=Account]';
                const sel3 = '.user-profile';

                // @ts-ignore
                const userProfile = document.querySelector(sel1) ||
                    // @ts-ignore
                    document.querySelector(sel2) ||
                    // @ts-ignore
                    document.querySelector(sel3);

                // @ts-ignore
                const currentUrl = window.location.href;
                const notOnLoginPage = !currentUrl.includes('/login') && !currentUrl.includes('/signin');

                return userProfile !== null && notOnLoginPage;
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

        console.log('Waiting for user to login...');

        const loginSuccess = await this.waitForLogin();

        if (!loginSuccess) {
            throw new Error('Login timeout or failed');
        }

        const cookies = await this.page.cookies();
        const userEmail = await this.getUserEmail();
        await this.cookieManager.saveCookies(cookies, userEmail);

        this.isAuthenticated = true;

        console.log('Login successful!');
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

            await this.page.waitForTimeout(checkInterval);
        }

        return false;
    }

    private async getUserEmail(): Promise<string | undefined> {
        if (!this.page) return undefined;

        try {
            const email = await this.page.evaluate(() => {
                // @ts-ignore
                const emailElement = document.querySelector('[data-user-email]');
                if (emailElement && emailElement.textContent) {
                    return emailElement.textContent.trim();
                }

                const sel = '[aria-label*=Account]';
                // @ts-ignore
                const profileButton = document.querySelector(sel);
                if (profileButton) {
                    const ariaLabel = profileButton.getAttribute('aria-label');
                    if (ariaLabel) {
                        const match = ariaLabel.match(/[\w.-]+@[\w.-]+\.\w+/);
                        return match ? match[0] : undefined;
                    }
                }
                return undefined;
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

        console.log('Sending prompt:', prompt);

        await this.page.goto('https://aistudio.google.com/app/prompts/new', {
            waitUntil: 'networkidle2'
        });

        await this.page.waitForSelector('textarea, [contenteditable="true"]', {
            timeout: 10000
        });

        const inputSelector = 'textarea, [contenteditable="true"]';
        await this.page.type(inputSelector, prompt);

        try {
            const submitButton = await this.page.$('button[type="submit"], button:has-text("Run")');
            if (submitButton) {
                await submitButton.click();
            } else {
                await this.page.keyboard.press('Enter');
            }
        } catch {
            await this.page.keyboard.press('Enter');
        }

        const response = await this.waitForResponse();

        console.log('Response received');

        return response;
    }

    private async waitForResponse(): Promise<string> {
        if (!this.page) {
            throw new Error('Page not initialized');
        }

        await this.page.waitForTimeout(5000);

        const responseText = await this.page.evaluate(() => {
            const selectors = [
                '[data-response]',
                '.response-container',
                '[role="article"]',
                '.model-response'
            ];

            for (const selector of selectors) {
                // @ts-ignore
                const element = document.querySelector(selector);
                if (element && element.textContent) {
                    return element.textContent.trim();
                }
            }

            // @ts-ignore
            const main = document.querySelector('main');
            return main?.textContent?.trim() || 'No response found';
        });

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
        console.log('Browser closed');
    }
}
