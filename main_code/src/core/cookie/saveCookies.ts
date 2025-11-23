import * as fs from 'fs';
import * as path from 'path';
import { Protocol } from 'puppeteer';
import { StoredSession } from '../../types';
import { SESSION_CONFIG } from '../../utils/constants';

export const saveCookies = async (
    storagePath: string,
    cookies: Protocol.Network.Cookie[],
    userEmail?: string
): Promise<void> => {
    const session: StoredSession = {
        cookies,
        savedAt: Date.now(),
        expiresAt: Date.now() + SESSION_CONFIG.EXPIRY_DAYS * 24 * 60 * 60 * 1000,
        userEmail
    };

    await fs.promises.mkdir(path.dirname(storagePath), { recursive: true });
    await fs.promises.writeFile(
        storagePath,
        JSON.stringify(session, null, 2)
    );
};
