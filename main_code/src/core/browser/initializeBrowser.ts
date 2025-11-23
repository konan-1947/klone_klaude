import puppeteer from 'puppeteer';
import { BrowserState } from '../../types';
import { BROWSER_CONFIG } from '../../utils/constants';

export const initializeBrowser = async (): Promise<BrowserState> => {
    const browser = await puppeteer.launch({
        headless: false, // Hiện browser để user đăng nhập
        args: [
            ...BROWSER_CONFIG.ARGS,
            '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage'
        ]
    });

    const page = await browser.newPage();

    // Đợi page sẵn sàng
    await page.goto('about:blank');

    // Ẩn dấu hiệu automation
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
        });
    });

    await page.setViewport(BROWSER_CONFIG.VIEWPORT);

    return {
        browser,
        page,
        isAuthenticated: false
    };
};
