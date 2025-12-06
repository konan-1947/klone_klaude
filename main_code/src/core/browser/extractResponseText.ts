import { Page } from 'puppeteer';
import { ResponseInfo } from '../../types';
import { SELECTORS } from '../../utils/constants';

export const extractResponseText = async (page: Page): Promise<string> => {
    const responseText = await page.evaluate((selectors) => {
        const containers = document.querySelectorAll(selectors.CHAT_CONTAINER);
        if (containers.length > 0) {
            const lastContainer = containers[containers.length - 1];
            const turnContent = lastContainer.querySelector(selectors.TURN_CONTENT);
            if (turnContent) {
                const clone = turnContent.cloneNode(true) as HTMLElement;
                const thinkingSections = clone.querySelectorAll('[class*="thinking"], [class*="thought"]');
                thinkingSections.forEach(el => el.remove());
                const buttons = clone.querySelectorAll('button');
                buttons.forEach(el => el.remove());
                return clone.innerHTML?.trim() || '';
            }
        }
        return '';
    }, SELECTORS);

    return responseText;
};

export const getResponseInfo = async (page: Page): Promise<ResponseInfo> => {
    return await page.evaluate((selectors) => {
        const containers = document.querySelectorAll(selectors.CHAT_CONTAINER);
        if (containers.length > 0) {
            const lastContainer = containers[containers.length - 1];

            const turnContent = lastContainer.querySelector(selectors.TURN_CONTENT);
            let text = '';
            if (turnContent) {
                const clone = turnContent.cloneNode(true) as HTMLElement;
                const thinkingSections = clone.querySelectorAll('[class*="thinking"], [class*="thought"]');
                thinkingSections.forEach(el => el.remove());
                const buttons = clone.querySelectorAll('button');
                buttons.forEach(el => el.remove());
                text = clone.textContent?.trim() || '';
            }

            const footer = lastContainer.querySelector(selectors.TURN_FOOTER);
            let hasFooter = false;
            if (footer) {
                const hasLike = footer.querySelector('button');
                hasFooter = !!hasLike;
            }

            return { text, hasFooter, textLength: text.length };
        }
        return { text: '', hasFooter: false, textLength: 0 };
    }, SELECTORS);
};
