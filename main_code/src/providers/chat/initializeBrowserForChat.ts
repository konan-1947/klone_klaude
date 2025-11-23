import * as vscode from 'vscode';
import { AIStudioBrowser } from '../../core/browser/AIStudioBrowser';
import { CookieManager } from '../../core/cookie/CookieManager';

export const initializeBrowserForChat = async (
    view: vscode.WebviewView | undefined,
    aiStudioBrowser: AIStudioBrowser | null,
    isInitialized: boolean,
    cookieManager: CookieManager,
    context: vscode.ExtensionContext
): Promise<{ browser: AIStudioBrowser; initialized: boolean }> => {
    if (isInitialized && aiStudioBrowser) {
        view?.webview.postMessage({
            type: 'systemMessage',
            message: 'Browser đã được khởi tạo'
        });
        return { browser: aiStudioBrowser, initialized: true };
    }

    try {
        view?.webview.postMessage({
            type: 'systemMessage',
            message: '🚀 Đang khởi tạo browser...'
        });

        const browser = new AIStudioBrowser(cookieManager, context, () => {
            // Callback khi browser bị đóng
            view?.webview.postMessage({
                type: 'systemMessage',
                message: '⚠️ Browser đã bị đóng'
            });
            view?.webview.postMessage({
                type: 'authStatus',
                authenticated: false,
                userEmail: null
            });
        });
        await browser.initialize();

        view?.webview.postMessage({
            type: 'systemMessage',
            message: '✅ Browser đã sẵn sàng!'
        });

        return { browser, initialized: true };
    } catch (error: any) {
        view?.webview.postMessage({
            type: 'systemMessage',
            message: `❌ Lỗi khởi tạo: ${error.message}`
        });
        throw error;
    }
};
