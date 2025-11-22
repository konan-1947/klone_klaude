import { Page } from 'puppeteer';
import * as vscode from 'vscode';
import { delay } from '../../utils/delay';
import { logger } from '../../utils/logger';
import { URLS, TIMEOUTS } from '../../utils/constants';
import { getDebugScreenshotPath } from '../../utils/paths';
import { findInputElement } from './findInputElement';
import { clickSendButton } from './clickSendButton';
import { waitForResponse } from './waitForResponse';

export const sendPrompt = async (
    page: Page,
    prompt: string,
    context: vscode.ExtensionContext
): Promise<string> => {
    try {
        logger.info('Navigating to AI Studio new chat...');
        await page.goto(URLS.AI_STUDIO_NEW_CHAT, {
            waitUntil: 'networkidle2',
            timeout: TIMEOUTS.PAGE_LOAD
        });

        await delay(TIMEOUTS.ANGULAR_RENDER_DELAY);

        const currentUrl = page.url();
        logger.info('Current URL:', currentUrl);

        const screenshotPath = getDebugScreenshotPath(context, 'debug-page.png');
        await page.screenshot({ path: screenshotPath });
        logger.info('Screenshot saved to:', screenshotPath);

        const inputSelector = await findInputElement(page);

        await page.click(inputSelector);
        await delay(TIMEOUTS.INPUT_FOCUS_DELAY);

        await page.type(inputSelector, prompt, { delay: TIMEOUTS.TYPE_DELAY });
        await delay(TIMEOUTS.AFTER_TYPE_DELAY);

        await clickSendButton(page);

        const response = await waitForResponse(page, context);
        return response;

    } catch (error: any) {
        throw new Error(`Send prompt failed: ${error.message}`);
    }
};
