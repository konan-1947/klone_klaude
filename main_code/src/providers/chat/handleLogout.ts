import * as vscode from 'vscode';
import { AIStudioBrowser } from '../../core/browser/AIStudioBrowser';
import { CookieManager } from '../../core/cookie/CookieManager';

export const handleLogout = async (
    view: vscode.WebviewView | undefined,
    browser: AIStudioBrowser | null,
    cookieManager: CookieManager
): Promise<{ browser: null; initialized: false }> => {
    try {
        // 1. Đóng browser nếu đang mở
        if (browser) {
            await browser.close();
        }

        // 2. Xóa cookies đã lưu
        await cookieManager.clearCookies();

        // 3. Thông báo cho webview
        if (view) {
            view.webview.postMessage({
                type: 'logoutSuccess',
                message: 'Đã đăng xuất thành công'
            });
        }

        // 4. Hiển thị thông báo
        vscode.window.showInformationMessage('Đã đăng xuất khỏi AI Studio');

        return {
            browser: null,
            initialized: false
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`Lỗi khi đăng xuất: ${errorMessage}`);

        return {
            browser: null,
            initialized: false
        };
    }
};
