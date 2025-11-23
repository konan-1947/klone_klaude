import { Page } from 'puppeteer';
import { SELECTORS } from '../../utils/constants';
import { logger } from '../../utils/logger';

export const findInputElement = async (page: Page): Promise<string> => {
    for (const selector of SELECTORS.INPUT) {
        try {
            await page.waitForSelector(selector, {
                visible: true,
                timeout: 3000
            });
            logger.info(`Found input using selector: ${selector}`);
            return selector;
        } catch {
            logger.debug(`Selector ${selector} not found`);
        }
    }

    throw new Error('Could not find input element');
};
