import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export const getHtmlForWebview = (webview: vscode.Webview, extensionUri: vscode.Uri): string => {
    const htmlPath = path.join(extensionUri.fsPath, 'src', 'views', 'chat.html');
    const cssPath = vscode.Uri.joinPath(extensionUri, 'src', 'views', 'chat.css');
    const jsPath = vscode.Uri.joinPath(extensionUri, 'src', 'views', 'chat.js');

    const cssUri = webview.asWebviewUri(cssPath);
    const jsUri = webview.asWebviewUri(jsPath);

    let html = fs.readFileSync(htmlPath, 'utf8');

    // Replace relative paths with webview URIs
    html = html.replace('href="chat.css"', `href="${cssUri}"`);
    html = html.replace('src="chat.js"', `src="${jsUri}"`);

    return html;
};
