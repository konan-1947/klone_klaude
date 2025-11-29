import * as vscode from 'vscode';
import { Browser, Page } from 'puppeteer';
import { CookieManager } from '../cookie/CookieManager';
import { logger } from '../../utils/logger';
import { initializeBrowser } from './initializeBrowser';
import { ensureAuthenticated } from './ensureAuthenticated';
import { sendPrompt as sendPromptFunc } from './sendPrompt';
import { sendPromptWithFile as sendPromptWithFileFunc } from './sendPromptWithFile';
import { closeBrowser } from './closeBrowser';
import { FileContent } from '../tools/BatchFileReader';

export class AIStudioBrowser {
    private browser: Browser | null = null;
    private page: Page | null = null;
    private cookieManager: CookieManager;
    private isAuthenticated: boolean = false;
    private context: vscode.ExtensionContext;
    private onDisconnect?: () => void;

    constructor(
        cookieManager: CookieManager,
        context: vscode.ExtensionContext,
        onDisconnect?: () => void
    ) {
        this.cookieManager = cookieManager;
        this.context = context;
        this.onDisconnect = onDisconnect;
    }

    async initialize(): Promise<void> {
        const state = await initializeBrowser();
        this.browser = state.browser;
        this.page = state.page;
        this.isAuthenticated = state.isAuthenticated;

        if (!this.page) {
            throw new Error('Browser not initialized');
        }

        // Listen for browser disconnect
        this.browser?.on('disconnected', () => {
            logger.info('Browser disconnected');
            this.browser = null;
            this.page = null;
            this.isAuthenticated = false;
            // Thông báo cho ChatViewProvider để reset UI
            if (this.onDisconnect) {
                this.onDisconnect();
            }
        });

        logger.info('Starting authentication...');
        await ensureAuthenticated(this.page, this.cookieManager);
        this.isAuthenticated = true;
        logger.info('Authentication completed, isAuthenticated:', this.isAuthenticated);
    }

    async sendPrompt(prompt: string): Promise<string> {
        if (!this.page || !this.isAuthenticated) {
            throw new Error('Not authenticated');
        }

        try {
            return await sendPromptFunc(this.page, prompt, this.context);
        } catch (error: any) {
            // Kiểm tra nếu là lỗi do browser bị đóng
            if (error.message.includes('Target closed') ||
                error.message.includes('Session closed') ||
                error.message.includes('Requesting main frame too early')) {
                this.browser = null;
                this.page = null;
                this.isAuthenticated = false;
                throw new Error('Browser đã bị đóng. Vui lòng khởi tạo lại.');
            }
            throw error;
        }
    }

    async sendPromptWithFile(
        prompt: string,
        fileContents: FileContent[],
        workspaceSummary: string
    ): Promise<string> {
        if (!this.page || !this.isAuthenticated) {
            throw new Error('Not authenticated');
        }

        try {
            return await sendPromptWithFileFunc(
                this.page,
                prompt,
                fileContents,
                workspaceSummary,
                this.context
            );
        } catch (error: any) {
            // Kiểm tra nếu là lỗi do browser bị đóng
            if (error.message.includes('Target closed') ||
                error.message.includes('Session closed') ||
                error.message.includes('Requesting main frame too early')) {
                this.browser = null;
                this.page = null;
                this.isAuthenticated = false;
                throw new Error('Browser đã bị đóng. Vui lòng khởi tạo lại.');
            }
            throw error;
        }
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
