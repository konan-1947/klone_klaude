import * as vscode from 'vscode';
import { AIStudioClient } from './aiStudioClient';
import { BrowserBridgeManager } from './browserBridgeManager';

export class AIStudioViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly client: AIStudioClient,
        private readonly bridgeManager: BrowserBridgeManager
    ) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        console.log('resolveWebviewView called!');
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri]
        };

        console.log('Setting webview HTML...');
        webviewView.webview.html = this.getHtmlContent();
        console.log('Webview HTML set');
    }

    public async handleLogin() {
        vscode.window.showInformationMessage('Login clicked!');
    }

    public async handleLogout() {
        vscode.window.showInformationMessage('Logout clicked!');
    }

    public async handleSendPrompt() {
        vscode.window.showInformationMessage('Send prompt clicked!');
    }

    private getHtmlContent(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Studio</title>
    <style>
        body {
            padding: 20px;
            color: var(--vscode-foreground);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
        }
        
        h1 {
            color: #4CAF50;
            font-size: 24px;
            margin-bottom: 20px;
        }
        
        .info {
            background-color: var(--vscode-editor-background);
            padding: 15px;
            border-radius: 5px;
            border: 1px solid var(--vscode-panel-border);
        }
    </style>
</head>
<body>
    <h1>Hello World!</h1>
    <div class="info">
        <p>AI Studio Connector is working!</p>
        <p>This is a simple webview test.</p>
    </div>
</body>
</html>`;
    }
}
