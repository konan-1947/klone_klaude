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

    constructor(storageDir: string) {
        this.storagePath = path.join(storageDir, 'ai-studio-session.json');
    }

    async saveCookies(
        cookies: Protocol.Network.Cookie[],
        userEmail?: string
    ): Promise<void> {
        const session: StoredSession = {
            cookies,
            savedAt: Date.now(),
            expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
            userEmail
        };

        await fs.promises.mkdir(path.dirname(this.storagePath), { recursive: true });
        await fs.promises.writeFile(
            this.storagePath,
            JSON.stringify(session, null, 2)
        );

        console.log('Cookies saved successfully');
    }

    async loadCookies(): Promise<Protocol.Network.Cookie[] | null> {
        try {
            const data = await fs.promises.readFile(this.storagePath, 'utf8');
            const session: StoredSession = JSON.parse(data);

            // Check expiration
            if (Date.now() > session.expiresAt) {
                console.log('Cookies expired, clearing...');
                await this.clearCookies();
                return null;
            }

            console.log('Cookies loaded successfully');
            return session.cookies;
        } catch (error) {
            console.log('No saved cookies found');
            return null;
        }
    }

    async clearCookies(): Promise<void> {
        try {
            await fs.promises.unlink(this.storagePath);
            console.log('Cookies cleared');
        } catch {
            // File không tồn tại, ignore
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
