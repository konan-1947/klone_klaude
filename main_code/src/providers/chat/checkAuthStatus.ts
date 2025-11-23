import * as vscode from 'vscode';
import { CookieManager } from '../../core/cookie/CookieManager';

export const checkAuthStatus = async (
    view: vscode.WebviewView | undefined,
    cookieManager: CookieManager,
    isInitialized: boolean = false
): Promise<void> => {
    const hasSession = await cookieManager.hasValidSession();
    const userEmail = await cookieManager.getUserEmail();

    if (view) {
        view.webview.postMessage({
            type: 'authStatus',
            authenticated: hasSession && isInitialized,
            userEmail: userEmail
        });
    }
};
