import * as vscode from 'vscode';
import { ChatViewProvider } from './providers/chat/ChatViewProvider';
import { CookieManager } from './core/cookie/CookieManager';

export function activate(context: vscode.ExtensionContext) {
    console.log('Extension "Browser AI Studio Connect" is now active!');

    const cookieManager = new CookieManager(context);

    const chatProvider = new ChatViewProvider(context.extensionUri, context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, chatProvider)
    );

    const initCommand = vscode.commands.registerCommand('browser-connect.initialize', async () => {
        const hasSession = await cookieManager.hasValidSession();
        const userEmail = await cookieManager.getUserEmail();

        if (hasSession) {
            vscode.window.showInformationMessage(
                `✅ Đã có session: ${userEmail || 'Unknown user'}`
            );
        } else {
            vscode.window.showInformationMessage(
                '📝 Chưa có session. Vui lòng khởi tạo browser từ panel Chat.'
            );
        }
    });

    context.subscriptions.push(initCommand);
    context.subscriptions.push(chatProvider);
}

export function deactivate() { }
