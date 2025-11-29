import { Page } from 'puppeteer';
import { delay } from '../../utils/delay';
import { logger } from '../../utils/logger';

/**
 * Đợi đến khi text "Expand to view model thoughts" xuất hiện trên trang
 */
export const waitForModelThoughts = async (page: Page): Promise<void> => {
    logger.info('Waiting for "Expand to view model thoughts" to appear...');

    try {
        // Đợi tối đa 60 giây để text xuất hiện
        await page.waitForFunction(
            () => {
                return document.body.innerText.includes('Expand to view model thoughts');
            },
            { timeout: 60000 }
        );

        logger.info('"Expand to view model thoughts" appeared');

        // Đợi thêm 500ms để đảm bảo UI đã render xong
        await delay(500);
    } catch (error) {
        logger.warn('Timeout waiting for "Expand to view model thoughts"');
        // Không throw error, chỉ log warning
    }
};
