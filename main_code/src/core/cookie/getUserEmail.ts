import * as fs from 'fs';
import { StoredSession } from '../../types';

export const getUserEmail = async (storagePath: string): Promise<string | null> => {
    try {
        const data = await fs.promises.readFile(storagePath, 'utf8');
        const session: StoredSession = JSON.parse(data);
        return session.userEmail || null;
    } catch {
        return null;
    }
};
