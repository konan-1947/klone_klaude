import { Page } from 'puppeteer';
import { URLS, TIMEOUTS } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { CookieManager } from '../cookie/CookieManager';
import { checkLoginStatus } from './checkLoginStatus';
import { performManualLogin } from './performManualLogin';

export const ensureAuthenticated = async (
    page: Page,
    cookieManager: CookieManager
): Promise<void> => {
    const savedCookies = await cookieManager.loadCookies();

    if (savedCookies && savedCookies.length > 0) {
        logger.info('Restoring saved session...');
        await page.setCookie(...savedCookies);
        await page.goto(URLS.AI_STUDIO_BASE, {
            waitUntil: 'networkidle2',
            timeout: TIMEOUTS.PAGE_LOAD
        });

        const isValid = await checkLoginStatus(page);

        if (isValid) {
            logger.info('Session restored successfully');
            return;
        } else {
            logger.info('Session expired, clearing...');
            await cookieManager.clearCookies();
        }
    }

    await performManualLogin(page, cookieManager);
};
