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
            // Minimize cửa sổ browser sau khi restore session
            try {
                const target = page.target();
                const session = await target.createCDPSession();
                const { windowId } = await session.send('Browser.getWindowForTarget');
                await session.send('Browser.setWindowBounds', {
                    windowId,
                    bounds: {
                        windowState: 'minimized'
                    }
                });
                await session.detach();
            } catch (err) {
                logger.debug('Could not minimize window');
            }
            return;
        } else {
            logger.info('Session expired, clearing...');
            await cookieManager.clearCookies();
        }
    }

    await performManualLogin(page, cookieManager);

    // Minimize cửa sổ browser sau khi login xong
    try {
        const target = page.target();
        const session = await target.createCDPSession();
        const { windowId } = await session.send('Browser.getWindowForTarget');
        await session.send('Browser.setWindowBounds', {
            windowId,
            bounds: {
                windowState: 'minimized'
            }
        });
        await session.detach();
    } catch (err) {
        logger.debug('Could not minimize window');
    }
};
