import { Page } from 'puppeteer';

export const getUserEmailFromPage = async (page: Page): Promise<string | undefined> => {
    try {
        const email = await page.evaluate(() => {
            const emailElement = document.querySelector('[data-user-email]');
            if (emailElement) {
                return emailElement.textContent?.trim();
            }

            const profileButton = document.querySelector('[aria-label*="Account"]');
            return profileButton?.getAttribute('aria-label')?.match(/[\w.-]+@[\w.-]+\.\w+/)?.[0];
        });

        return email || undefined;
    } catch {
        return undefined;
    }
};
