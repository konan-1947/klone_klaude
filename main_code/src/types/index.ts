import { Browser, Page } from 'puppeteer';
import { Protocol } from 'puppeteer';

export interface StoredSession {
    cookies: Protocol.Network.Cookie[];
    savedAt: number;
    expiresAt: number;
    userEmail?: string;
}

export interface BrowserState {
    browser: Browser | null;
    page: Page | null;
    isAuthenticated: boolean;
}

export interface ResponseInfo {
    text: string;
    hasFooter: boolean;
    textLength: number;
}
