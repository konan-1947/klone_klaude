import { loadCookies } from './loadCookies';

export const hasValidSession = async (storagePath: string): Promise<boolean> => {
    const cookies = await loadCookies(storagePath);
    return cookies !== null && cookies.length > 0;
};
