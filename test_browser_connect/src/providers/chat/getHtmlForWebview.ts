import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export const getHtmlForWebview = (webview: vscode.Webview, extensionUri: vscode.Uri): string => {
    const htmlPath = path.join(extensionUri.fsPath, 'src', 'views', 'chat.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    return html;
};
