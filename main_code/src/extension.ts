import * as vscode from 'vscode';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { ChatViewProvider } from './providers/chat/ChatViewProvider';
import { CookieManager } from './core/cookie/CookieManager';
import { ToolManager } from './core/tools';
import { IgnoreManager } from './core/ignore/IgnoreManager';
import { TestToolViewProvider } from './providers/test/TestToolViewProvider';

// Load environment variables from .env file
// Use __dirname to get the correct path in compiled extension
dotenv.config({ path: path.join(__dirname, '..', '.env') });

let chatProvider: ChatViewProvider;

export function activate(context: vscode.ExtensionContext) {
    console.log('Extension "Browser AI Studio Connect" is now active!');

    const cookieManager = new CookieManager(context);

    chatProvider = new ChatViewProvider(context.extensionUri, context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, chatProvider)
    );

    // Register Test Tool View
    const testToolProvider = new TestToolViewProvider(context.extensionUri, context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(TestToolViewProvider.viewType, testToolProvider)
    );

    const initCommand = vscode.commands.registerCommand('ai-agent.initialize', async () => {
        const hasSession = await cookieManager.hasValidSession();
        const userEmail = await cookieManager.getUserEmail();

        if (hasSession) {
            vscode.window.showInformationMessage(
                `Đã có session: ${userEmail || 'Unknown user'}`
            );
        } else {
            vscode.window.showInformationMessage(
                'Chưa có session. Vui lòng khởi tạo browser từ panel Chat.'
            );
        }
    });

    const logoutCommand = vscode.commands.registerCommand('ai-agent.logout', async () => {
        const hasSession = await cookieManager.hasValidSession();

        if (!hasSession) {
            vscode.window.showInformationMessage('Chưa có session nào để đăng xuất');
            return;
        }

        const userEmail = await cookieManager.getUserEmail();
        const confirm = await vscode.window.showWarningMessage(
            `Bạn có chắc muốn đăng xuất khỏi account: ${userEmail || 'Unknown'}?`,
            { modal: true },
            'Đăng xuất',
            'Hủy'
        );

        if (confirm === 'Đăng xuất') {
            await chatProvider.logout();
        }
    });

    context.subscriptions.push(initCommand);
    context.subscriptions.push(logoutCommand);
    context.subscriptions.push(chatProvider);
}

export function deactivate() { }
