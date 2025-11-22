import { Page } from 'puppeteer';
import { SELECTORS } from '../../utils/constants';
import { logger } from '../../utils/logger';

export const clickSendButton = async (page: Page): Promise<void> => {
    for (const btnSelector of SELECTORS.BUTTON) {
        try {
            const button = await page.$(btnSelector);
            if (button) {
                await button.click();
                logger.info(`Clicked button: ${btnSelector}`);
                return;
            }
        } catch {
            logger.debug(`Button ${btnSelector} not found`);
        }
    }

    await page.keyboard.press('Enter');
    logger.info('Pressed Enter as fallback');
};
