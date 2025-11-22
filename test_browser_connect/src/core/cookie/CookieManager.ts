import * as vscode from 'vscode';
import { Protocol } from 'puppeteer';
import { getSessionStoragePath } from '../../utils/paths';
import { saveCookies } from './saveCookies';
import { loadCookies } from './loadCookies';
import { clearCookies } from './clearCookies';
import { hasValidSession } from './hasValidSession';
import { getUserEmail } from './getUserEmail';

export class CookieManager {
    private storagePath: string;

    constructor(context: vscode.ExtensionContext) {
        this.storagePath = getSessionStoragePath(context);
    }

    async saveCookies(cookies: Protocol.Network.Cookie[], userEmail?: string): Promise<void> {
        return saveCookies(this.storagePath, cookies, userEmail);
    }

    async loadCookies(): Promise<Protocol.Network.Cookie[] | null> {
        return loadCookies(this.storagePath);
    }

    async clearCookies(): Promise<void> {
        return clearCookies(this.storagePath);
    }

    async hasValidSession(): Promise<boolean> {
        return hasValidSession(this.storagePath);
    }

    async getUserEmail(): Promise<string | null> {
        return getUserEmail(this.storagePath);
    }
}
