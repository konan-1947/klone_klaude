import { Page } from 'puppeteer';
import { logger } from '../../utils/logger';
import { SELECTORS, TIMEOUTS } from '../../utils/constants';
import { delay } from '../../utils/delay';
import * as fs from 'fs';

export const uploadFile = async (
    page: Page,
    filePath: string
): Promise<void> => {
    logger.info(`Uploading file via drag & drop: ${filePath}`);

    // Tìm prompt input area để drop file vào
    logger.info('Looking for prompt input area...');

    let inputSelector = null;
    for (const sel of SELECTORS.INPUT) {
        const el = await page.$(sel);
        if (el) {
            inputSelector = sel;
            logger.info(`Found input: ${sel}`);
            break;
        }
    }

    if (!inputSelector) {
        throw new Error('Prompt input not found');
    }

    // Read file as buffer
    const fileBuffer = await fs.promises.readFile(filePath);
    const fileName = filePath.split(/[/\\]/).pop() || 'file.txt';

    logger.info(`Simulating drag & drop for: ${fileName}`);

    // Simulate drag & drop event
    await page.evaluate(
        (selector, buffer, name) => {
            const input = document.querySelector(selector);
            if (!input) {
                throw new Error('Input element not found');
            }

            // Create File object
            const uint8Array = new Uint8Array(buffer);
            const blob = new Blob([uint8Array], { type: 'text/plain' });
            const file = new File([blob], name, { type: 'text/plain' });

            // Create DataTransfer
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);

            // Dispatch drop event
            const dropEvent = new DragEvent('drop', {
                bubbles: true,
                cancelable: true,
                dataTransfer: dataTransfer
            });

            input.dispatchEvent(dropEvent);

            // Also try paste event as fallback
            const pasteEvent = new ClipboardEvent('paste', {
                bubbles: true,
                cancelable: true,
                clipboardData: dataTransfer as any
            });

            input.dispatchEvent(pasteEvent);
        },
        inputSelector,
        Array.from(fileBuffer),
        fileName
    );

    logger.info('File drop/paste event dispatched');
    await delay(TIMEOUTS.FILE_UPLOAD_DELAY);

    logger.info('File upload completed!');
};
