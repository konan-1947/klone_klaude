import * as vscode from 'vscode';
import { AIStudioViewProvider } from './viewProvider';
import { BrowserBridgeManager } from './browserBridgeManager';
import { AIStudioClient } from './aiStudioClient';

let bridgeManager: BrowserBridgeManager;
let client: AIStudioClient;

export async function activate(context: vscode.ExtensionContext) {
    console.log('=== AI Studio Connector ACTIVATION STARTED (DISABLED) ===');
    /*
    try {
        // Initialize managers
        console.log('Creating BrowserBridgeManager...');
        bridgeManager = new BrowserBridgeManager(context);
        console.log('BrowserBridgeManager created');

        console.log('Creating AIStudioClient...');
        client = new AIStudioClient();
        console.log('AIStudioClient created');

        // Create view provider
        console.log('Creating AIStudioViewProvider...');
        const viewProvider = new AIStudioViewProvider(context, client, bridgeManager);
        console.log('AIStudioViewProvider created');

        // Register view
        console.log('Registering webview view provider for aiStudioView...');
        const registration = vscode.window.registerWebviewViewProvider(
            'aiStudioView',
            viewProvider
        );
        context.subscriptions.push(registration);
        console.log('View provider registered successfully!');

        // Register commands
        context.subscriptions.push(
            vscode.commands.registerCommand('aiStudio.login', async () => {
                await viewProvider.handleLogin();
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('aiStudio.logout', async () => {
                await viewProvider.handleLogout();
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('aiStudio.sendPrompt', async () => {
                await viewProvider.handleSendPrompt();
            })
        );

        vscode.window.showInformationMessage('AI Studio Connector activated!');
    } catch (error) {
        console.error('=== ACTIVATION ERROR ===', error);
        vscode.window.showErrorMessage(`Failed to activate AI Studio Connector: ${error}`);
    }
    */
}

export function deactivate() {
    /*
    if (bridgeManager) {
        bridgeManager.dispose();
    }
    if (client) {
        client.disconnect();
    }
    */
}
