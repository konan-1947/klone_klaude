import * as vscode from 'vscode';
import * as path from 'path';

export const getDebugScreenshotPath = (context: vscode.ExtensionContext, filename: string): string => {
    return path.join(context.globalStorageUri.fsPath, 'screenshots', filename);
};

export const getSessionStoragePath = (context: vscode.ExtensionContext): string => {
    return path.join(context.globalStorageUri.fsPath, 'ai-studio-session.json');
};
