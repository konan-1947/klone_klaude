import * as vscode from 'vscode';
import { AIStudioBrowser } from '../../core/browser/AIStudioBrowser';
import { convertHtmlToMarkdown } from '../../utils/htmlToMarkdown';

export const handleSendMessage = async (
    view: vscode.WebviewView | undefined,
    aiStudioBrowser: AIStudioBrowser | null,
    isInitialized: boolean,
    message: string
): Promise<void> => {
    if (!aiStudioBrowser || !isInitialized) {
        view?.webview.postMessage({
            type: 'error',
            message: 'Browser chưa được khởi tạo. Nhấn "Initialize" trước.'
        });
        return;
    }

    try {
        const htmlResponse = await aiStudioBrowser.sendPrompt(message);
        const markdownResponse = convertHtmlToMarkdown(htmlResponse);

        view?.webview.postMessage({
            type: 'receiveMessage',
            message: markdownResponse
        });
    } catch (error: any) {
        view?.webview.postMessage({
            type: 'error',
            message: `Lỗi: ${error.message}`
        });
    }
};
