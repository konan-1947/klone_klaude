import { Page } from 'puppeteer';
import { delay } from '../../utils/delay';
import { TIMEOUTS } from '../../utils/constants';
import { checkLoginStatus } from './checkLoginStatus';

export const waitForLogin = async (page: Page): Promise<boolean> => {
    const maxWaitTime = TIMEOUTS.MAX_LOGIN_WAIT;
    const checkInterval = TIMEOUTS.LOGIN_CHECK_INTERVAL;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
        const isLoggedIn = await checkLoginStatus(page);

        if (isLoggedIn) {
            return true;
        }

        await delay(checkInterval);
    }

    return false;
};
