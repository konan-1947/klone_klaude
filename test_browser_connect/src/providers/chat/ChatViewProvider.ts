import * as vscode from 'vscode';
import { AIStudioBrowser } from '../../core/browser/AIStudioBrowser';
import { CookieManager } from '../../core/cookie/CookieManager';
import { getHtmlForWebview } from './getHtmlForWebview';
import { checkAuthStatus } from './checkAuthStatus';
import { initializeBrowserForChat } from './initializeBrowserForChat';
import { handleSendMessage } from './handleSendMessage';

export class ChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'browser-connect-chat';
    private _view?: vscode.WebviewView;
    private aiStudioBrowser: AIStudioBrowser | null = null;
    private cookieManager: CookieManager;
    private isInitialized: boolean = false;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private context: vscode.ExtensionContext
    ) {
        this.cookieManager = new CookieManager(context);
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = getHtmlForWebview(webviewView.webview, this._extensionUri);

        webviewView.webview.onDidReceiveMessage(async data => {
            switch (data.type) {
                case 'initialize':
                    const result = await initializeBrowserForChat(
                        this._view,
                        this.aiStudioBrowser,
                        this.isInitialized,
                        this.cookieManager,
                        this.context
                    );
                    this.aiStudioBrowser = result.browser;
                    this.isInitialized = result.initialized;
                    break;
                case 'sendMessage':
                    await handleSendMessage(
                        this._view,
                        this.aiStudioBrowser,
                        this.isInitialized,
                        data.message
                    );
                    break;
            }
        });

        checkAuthStatus(this._view, this.cookieManager);
    }

    public dispose() {
        if (this.aiStudioBrowser) {
            this.aiStudioBrowser.close();
        }
    }
}
