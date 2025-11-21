import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Protocol } from 'puppeteer';

interface StoredSession {
    cookies: Protocol.Network.Cookie[];
    savedAt: number;
    expiresAt: number;
    userEmail?: string;
}

export class CookieManager {
    private storagePath: string;

    constructor(context: vscode.ExtensionContext) {
        this.storagePath = path.join(
            context.globalStorageUri.fsPath,
            'ai-studio-session.json'
        );
    }

    async saveCookies(
        cookies: Protocol.Network.Cookie[],
        userEmail?: string
    ): Promise<void> {
        const session: StoredSession = {
            cookies,
            savedAt: Date.now(),
            expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
            userEmail
        };

        await fs.promises.mkdir(path.dirname(this.storagePath), { recursive: true });
        await fs.promises.writeFile(
            this.storagePath,
            JSON.stringify(session, null, 2)
        );
    }

    async loadCookies(): Promise<Protocol.Network.Cookie[] | null> {
        try {
            const data = await fs.promises.readFile(this.storagePath, 'utf8');
            const session: StoredSession = JSON.parse(data);

            if (Date.now() > session.expiresAt) {
                await this.clearCookies();
                return null;
            }

            return session.cookies;
        } catch (error) {
            return null;
        }
    }

    async clearCookies(): Promise<void> {
        try {
            await fs.promises.unlink(this.storagePath);
        } catch {
            // File không tồn tại
        }
    }

    async hasValidSession(): Promise<boolean> {
        const cookies = await this.loadCookies();
        return cookies !== null && cookies.length > 0;
    }

    async getUserEmail(): Promise<string | null> {
        try {
            const data = await fs.promises.readFile(this.storagePath, 'utf8');
            const session: StoredSession = JSON.parse(data);
            return session.userEmail || null;
        } catch {
            return null;
        }
    }
}
