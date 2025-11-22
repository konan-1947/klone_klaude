import { Page } from 'puppeteer';
import { delay } from '../../utils/delay';
import { TIMEOUTS, SELECTORS } from '../../utils/constants';
import { logger } from '../../utils/logger';

export const checkLoginStatus = async (page: Page): Promise<boolean> => {
    try {
        await delay(TIMEOUTS.CHECK_LOGIN_DELAY);

        const isLoggedIn = await page.evaluate((selectors) => {
            const userProfile = document.querySelector(selectors.USER_PROFILE[0]) ||
                document.querySelector(selectors.USER_PROFILE[1]) ||
                document.querySelector(selectors.USER_PROFILE[2]);

            const notOnLoginPage = !window.location.href.includes('/login') &&
                !window.location.href.includes('/signin');

            const hasAIStudioUI = document.querySelector(selectors.AI_STUDIO_UI[0]) ||
                document.querySelector(selectors.AI_STUDIO_UI[1]) ||
                document.querySelector(selectors.AI_STUDIO_UI[2]);

            return (userProfile !== null || hasAIStudioUI !== null) && notOnLoginPage;
        }, SELECTORS);

        return isLoggedIn;
    } catch (error) {
        logger.error('Error checking login status:', error);
        return false;
    }
};
