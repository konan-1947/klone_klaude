import { Page } from 'puppeteer';
import * as vscode from 'vscode';
import { delay } from '../../utils/delay';
import { logger } from '../../utils/logger';
import { TIMEOUTS, RETRY_COUNTS } from '../../utils/constants';
import { extractResponseText, getResponseInfo } from './extractResponseText';

export const waitForResponse = async (page: Page, context: vscode.ExtensionContext): Promise<string> => {
    logger.info('Waiting for response to complete...');

    const maxAttempts = RETRY_COUNTS.MAX_RESPONSE_ATTEMPTS;
    let previousText = '';
    let stableCount = 0;

    for (let i = 0; i < maxAttempts; i++) {
        await delay(TIMEOUTS.RESPONSE_CHECK_INTERVAL);

        const currentInfo = await getResponseInfo(page);

        logger.debug(`Attempt ${i + 1}: len=${currentInfo.textLength}, footer=${currentInfo.hasFooter}, stable=${stableCount}`);

        if (currentInfo.text === previousText && currentInfo.text.length > 0) {
            stableCount++;

            if (currentInfo.hasFooter && stableCount >= RETRY_COUNTS.STABLE_COUNT_REQUIRED) {
                logger.info('Response complete!');
                break;
            }
        } else {
            stableCount = 0;
            previousText = currentInfo.text;
        }
    }

    const responseText = await extractResponseText(page);

    logger.debug('Extracted:', responseText.substring(0, 300));

    if (!responseText || responseText.length === 0) {
        throw new Error('Could not extract response text');
    }

    return responseText;
};
