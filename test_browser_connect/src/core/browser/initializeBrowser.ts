import puppeteer from 'puppeteer';
import { BrowserState } from '../../types';
import { BROWSER_CONFIG } from '../../utils/constants';

export const initializeBrowser = async (): Promise<BrowserState> => {
    const browser = await puppeteer.launch({
        headless: false,
        args: BROWSER_CONFIG.ARGS
    });

    const page = await browser.newPage();
    await page.setViewport(BROWSER_CONFIG.VIEWPORT);

    return {
        browser,
        page,
        isAuthenticated: false
    };
};
