import * as vscode from 'vscode';
import { AIStudioBrowser } from '../../core/browser/AIStudioBrowser';
import { CookieManager } from '../../core/cookie/CookieManager';
import { getHtmlForWebview } from './getHtmlForWebview';
import { checkAuthStatus } from './checkAuthStatus';
import { initializeBrowserForChat } from './initializeBrowserForChat';
import { handleLogout } from './handleLogout';
import { IPTKManager, PTKManagerFactory, PTKMode } from '../../core/ptk';
import { LLMManager, AIStudioLLMProvider, GeminiLLMProvider } from '../../core/llm';
import { IgnoreManager } from '../../core/ignore/IgnoreManager';

export class ChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'ai-agent-chat';
    private _view?: vscode.WebviewView;
    private aiStudioBrowser: AIStudioBrowser | null = null;
    private cookieManager: CookieManager;
    private isInitialized: boolean = false;
    private ptkManager?: IPTKManager;

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
                    await this.initializePTK();
                    checkAuthStatus(this._view, this.cookieManager, this.isInitialized);
                    break;
                case 'sendMessage':
                    await this.handleMessage(data.message);
                    break;
                case 'logout':
                    await this.logout();
                    break;
            }
        });

        checkAuthStatus(this._view, this.cookieManager, this.isInitialized);
    }

    private async handleMessage(message: string): Promise<void> {
        if (!this.ptkManager || !this.isInitialized) {
            this._view?.webview.postMessage({
                type: 'error',
                message: 'Browser chưa được khởi tạo. Nhấn "Initialize" trước.'
            });
            return;
        }

        try {
            this._view?.webview.postMessage({ type: 'processing', message: 'Đang xử lý...' });

            const result = await this.ptkManager.orchestrateToolCalling(message, {
                tools: ['read_file'],
                maxIterations: 10,
                maxToolCalls: 20
            });

            if (result.success) {
                this._view?.webview.postMessage({
                    type: 'receiveMessage',
                    message: result.content,
                    metadata: { iterations: result.iterations, toolCalls: result.toolCalls.length, duration: result.duration }
                });
            } else {
                this._view?.webview.postMessage({ type: 'error', message: `Error: ${result.error}` });
            }
        } catch (error: any) {
            this._view?.webview.postMessage({ type: 'error', message: `Lỗi: ${error.message}` });
        }
    }

    private async initializePTK(): Promise<void> {
        if (this.ptkManager) return;

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || !this.aiStudioBrowser) return;

        const workspacePath = workspaceFolders[0].uri.fsPath;
        const ignoreManager = new IgnoreManager(workspacePath);
        await ignoreManager.initialize();

        const aiStudioManager = new LLMManager();
        const aiStudioProvider = new AIStudioLLMProvider(this.aiStudioBrowser);
        aiStudioManager.registerProvider('ai-studio', aiStudioProvider);

        let geminiManager: LLMManager | undefined;
        const geminiApiKey = process.env.GEMINI_API_KEY;
        if (geminiApiKey) {
            geminiManager = new LLMManager();
            geminiManager.registerProvider('gemini', new GeminiLLMProvider({ apiKey: geminiApiKey }));
            geminiManager.setProvider('gemini'); // ✅ Set active provider
        }

        const mode = (process.env.PTK_MODE || 'optimized') === 'standard' ? PTKMode.STANDARD : PTKMode.OPTIMIZED;

        this.ptkManager = PTKManagerFactory.create({
            mode,
            workspacePath,
            ignoreManager,
            llmManager: aiStudioManager,
            geminiManager
        });
    }

    public async logout(): Promise<void> {
        const result = await handleLogout(this._view, this.aiStudioBrowser, this.cookieManager);
        this.aiStudioBrowser = result.browser;
        this.isInitialized = result.initialized;
    }

    public dispose() {
        if (this.aiStudioBrowser) {
            this.aiStudioBrowser.close();
        }
    }
}
