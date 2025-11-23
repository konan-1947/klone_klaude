import { Page } from 'puppeteer';
import * as vscode from 'vscode';
import { URLS, TIMEOUTS } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { waitForLogin } from './waitForLogin';
import { getUserEmailFromPage } from './getUserEmailFromPage';
import { CookieManager } from '../cookie/CookieManager';

export const performManualLogin = async (
    page: Page,
    cookieManager: CookieManager
): Promise<void> => {
    logger.info('Starting manual login flow...');

    await page.goto(URLS.AI_STUDIO_BASE, {
        waitUntil: 'networkidle2',
        timeout: TIMEOUTS.PAGE_LOAD
    });

    vscode.window.showInformationMessage(
        '🔐 Vui lòng đăng nhập AI Studio trong browser',
        'Đã đăng nhập'
    );

    const loginSuccess = await waitForLogin(page);

    if (!loginSuccess) {
        throw new Error('Login timeout');
    }

    const cookies = await page.cookies();
    const userEmail = await getUserEmailFromPage(page);
    await cookieManager.saveCookies(cookies, userEmail);

    vscode.window.showInformationMessage('✅ Đăng nhập thành công!');
};
