import * as fs from 'fs';

export const clearCookies = async (storagePath: string): Promise<void> => {
    try {
        await fs.promises.unlink(storagePath);
    } catch {
        // File không tồn tại
    }
};
