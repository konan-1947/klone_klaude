import * as vscode from 'vscode';
import { Browser, Page } from 'puppeteer';
import { CookieManager } from '../cookie/CookieManager';
import { initializeBrowser } from './initializeBrowser';
import { ensureAuthenticated } from './ensureAuthenticated';
import { sendPrompt as sendPromptFunc } from './sendPrompt';
import { closeBrowser } from './closeBrowser';

export class AIStudioBrowser {
    private browser: Browser | null = null;
    private page: Page | null = null;
    private cookieManager: CookieManager;
    private isAuthenticated: boolean = false;
    private context: vscode.ExtensionContext;

    constructor(cookieManager: CookieManager, context: vscode.ExtensionContext) {
        this.cookieManager = cookieManager;
        this.context = context;
    }

    async initialize(): Promise<void> {
        const state = await initializeBrowser();
        this.browser = state.browser;
        this.page = state.page;
        this.isAuthenticated = state.isAuthenticated;

        if (!this.page) {
            throw new Error('Browser not initialized');
        }

        await ensureAuthenticated(this.page, this.cookieManager);
        this.isAuthenticated = true;
    }

    async sendPrompt(prompt: string): Promise<string> {
        if (!this.page || !this.isAuthenticated) {
            throw new Error('Not authenticated');
        }

        return sendPromptFunc(this.page, prompt, this.context);
    }

    async close(): Promise<void> {
        await closeBrowser({
            browser: this.browser,
            page: this.page,
            isAuthenticated: this.isAuthenticated
        });

        this.browser = null;
        this.page = null;
        this.isAuthenticated = false;
    }
}
