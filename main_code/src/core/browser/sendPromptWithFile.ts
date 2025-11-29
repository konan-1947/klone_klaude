import { Page } from 'puppeteer';
import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { FileContent } from '../tools/BatchFileReader';
import { delay } from '../../utils/delay';
import { logger } from '../../utils/logger';
import { URLS, TIMEOUTS } from '../../utils/constants';
import { buildContextFile } from './buildContextFile';
import { uploadFile } from './uploadFile';
import { findInputElement } from './findInputElement';
import { clickSendButton } from './clickSendButton';
import { waitForResponse } from './waitForResponse';

/**
 * Send prompt with file upload instead of typing
 * Much faster than page.type() for large content
 */
export const sendPromptWithFile = async (
    page: Page,
    prompt: string,
    fileContents: FileContent[],
    workspaceSummary: string,
    context: vscode.ExtensionContext
): Promise<string> => {
    let tempFilePath: string | null = null;

    try {
        logger.info('Starting sendPromptWithFile...');

        // Step 1: Build context file content
        const contextContent = buildContextFile(fileContents, workspaceSummary);
        logger.info(`Context file size: ${contextContent.length} bytes`);

        // Step 2: Save to temp file
        const tempDir = os.tmpdir();
        tempFilePath = path.join(tempDir, `ai-context-${Date.now()}.txt`);
        await fs.promises.writeFile(tempFilePath, contextContent, 'utf-8');
        logger.info(`Temp file created: ${tempFilePath}`);

        // Step 3: Navigate to AI Studio
        logger.info('Navigating to AI Studio new chat...');
        await page.goto(URLS.AI_STUDIO_NEW_CHAT, {
            waitUntil: 'networkidle2',
            timeout: TIMEOUTS.PAGE_LOAD
        });

        await delay(TIMEOUTS.ANGULAR_RENDER_DELAY);

        // Step 4: Upload file
        await uploadFile(page, tempFilePath);

        // Step 5: Type short prompt
        const inputSelector = await findInputElement(page);
        await page.click(inputSelector);
        await delay(TIMEOUTS.INPUT_FOCUS_DELAY);

        // Build final prompt
        const finalPrompt = `${prompt}\n\nRefer to the uploaded context file for codebase details.`;

        // Use fast input method (page.evaluate instead of page.type)
        await page.evaluate((selector, text) => {
            const element = document.querySelector(selector) as any;
            if (element) {
                element.value = text;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }, inputSelector, finalPrompt);

        await delay(TIMEOUTS.AFTER_TYPE_DELAY);

        // Step 6: Click send
        await clickSendButton(page);

        // Step 7: Wait for response
        const response = await waitForResponse(page, context);

        logger.info('Response received successfully');
        return response;

    } catch (error: any) {
        logger.error('sendPromptWithFile failed:', error);
        throw new Error(`Send prompt with file failed: ${error.message}`);
    } finally {
        // Step 8: Cleanup temp file
        if (tempFilePath) {
            try {
                await fs.promises.unlink(tempFilePath);
                logger.info('Temp file cleaned up');
            } catch (error) {
                logger.warn('Failed to cleanup temp file:', error);
            }
        }
    }
};
