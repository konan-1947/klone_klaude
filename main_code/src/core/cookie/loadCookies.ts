import * as fs from 'fs';
import { Protocol } from 'puppeteer';
import { StoredSession } from '../../types';
import { clearCookies } from './clearCookies';

export const loadCookies = async (storagePath: string): Promise<Protocol.Network.Cookie[] | null> => {
    try {
        const data = await fs.promises.readFile(storagePath, 'utf8');
        const session: StoredSession = JSON.parse(data);

        if (Date.now() > session.expiresAt) {
            await clearCookies(storagePath);
            return null;
        }

        return session.cookies;
    } catch (error) {
        return null;
    }
};
