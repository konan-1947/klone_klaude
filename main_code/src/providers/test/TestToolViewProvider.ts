import * as vscode from 'vscode';
import { ToolManager } from '../../core/tools';
import { IgnoreManager } from '../../core/ignore/IgnoreManager';

export class TestToolViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'ai-agent-test-tool';

    private view?: vscode.WebviewView;
    private toolManager?: ToolManager;
    private ignoreManager?: IgnoreManager;

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly context: vscode.ExtensionContext
    ) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this.view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri]
        };

        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'readFile':
                    await this.handleReadFile(data.path);
                    break;
            }
        });
    }

    private async handleReadFile(filePath: string) {
        try {
            // Initialize ToolManager if not exists
            if (!this.toolManager) {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (!workspaceFolders) {
                    this.sendMessage({
                        type: 'result',
                        success: false,
                        error: 'No workspace folder open'
                    });
                    return;
                }

                const workspacePath = workspaceFolders[0].uri.fsPath;

                this.ignoreManager = new IgnoreManager(workspacePath);
                await this.ignoreManager.initialize();

                this.toolManager = new ToolManager(workspacePath, this.ignoreManager);
            }

            // Execute read_file tool
            const result = await this.toolManager.execute('read_file', { path: filePath });

            // Send result to webview
            this.sendMessage({
                type: 'result',
                ...result
            });

        } catch (error: any) {
            this.sendMessage({
                type: 'result',
                success: false,
                error: error.message || 'Unknown error'
            });
        }
    }

    private sendMessage(message: any) {
        this.view?.webview.postMessage(message);
    }

    private getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Read File Tool</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: var(--vscode-font-family);
            padding: 16px;
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
        }
        
        h2 {
            font-size: 16px;
            margin-bottom: 16px;
            color: var(--vscode-foreground);
        }
        
        .input-group {
            margin-bottom: 16px;
        }
        
        label {
            display: block;
            margin-bottom: 8px;
            font-size: 13px;
            color: var(--vscode-descriptionForeground);
        }
        
        input {
            width: 100%;
            padding: 8px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            font-family: var(--vscode-font-family);
            font-size: 13px;
        }
        
        input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        
        button {
            width: 100%;
            padding: 8px 16px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-size: 13px;
            font-family: var(--vscode-font-family);
        }
        
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        button:active {
            opacity: 0.8;
        }
        
        .output {
            margin-top: 24px;
            padding: 12px;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 2px;
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
            white-space: pre-wrap;
            word-break: break-word;
            max-height: 400px;
            overflow-y: auto;
        }
        
        .output.success {
            border-color: var(--vscode-testing-iconPassed);
        }
        
        .output.error {
            border-color: var(--vscode-testing-iconFailed);
            color: var(--vscode-errorForeground);
        }
        
        .metadata {
            margin-top: 8px;
            padding: 8px;
            background: var(--vscode-textBlockQuote-background);
            border-left: 3px solid var(--vscode-textBlockQuote-border);
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }
        
        .hidden {
            display: none;
        }
    </style>
</head>
<body>
    <h2>Test Read File Tool</h2>
    
    <div class="input-group">
        <label for="filePath">File Path (relative hoặc absolute):</label>
        <input 
            type="text" 
            id="filePath" 
            placeholder="Ví dụ: package.json hoặc src/extension.ts"
            autocomplete="off"
        />
    </div>
    
    <button onclick="readFile()">Read File</button>
    
    <div id="output" class="hidden"></div>
    
    <script>
        const vscode = acquireVsCodeApi();
        const filePathInput = document.getElementById('filePath');
        const outputDiv = document.getElementById('output');
        
        // Handle Enter key
        filePathInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                readFile();
            }
        });
        
        function readFile() {
            const path = filePathInput.value.trim();
            if (!path) {
                showOutput('error', 'Vui lòng nhập path của file');
                return;
            }
            
            // Clear previous output
            outputDiv.className = 'output';
            outputDiv.innerHTML = '<div style="color: var(--vscode-descriptionForeground)">Đang đọc file...</div>';
            outputDiv.classList.remove('hidden');
            
            // Send request to extension
            vscode.postMessage({
                type: 'readFile',
                path: path
            });
        }
        
        function showOutput(type, content, metadata) {
            outputDiv.classList.remove('hidden');
            outputDiv.className = 'output ' + type;
            
            if (type === 'success') {
                let html = '<strong>✓ File đọc thành công:</strong><br><br>';
                html += '<div style="color: var(--vscode-editor-foreground)">' + escapeHtml(content) + '</div>';
                
                if (metadata) {
                    html += '<div class="metadata">';
                    html += '<strong>Metadata:</strong><br>';
                    html += 'Size: ' + metadata.size + ' bytes<br>';
                    html += 'Lines: ' + metadata.lines + '<br>';
                    html += 'Encoding: ' + metadata.encoding;
                    html += '</div>';
                }
                
                outputDiv.innerHTML = html;
            } else {
                outputDiv.innerHTML = '<strong>✗ Lỗi:</strong><br><br>' + escapeHtml(content);
            }
        }
        
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        // Listen for messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            if (message.type === 'result') {
                if (message.success) {
                    showOutput('success', message.data, message.metadata);
                } else {
                    showOutput('error', message.error);
                }
            }
        });
    </script>
</body>
</html>`;
    }

    public dispose() {
        if (this.ignoreManager) {
            this.ignoreManager.dispose();
        }
    }
}
