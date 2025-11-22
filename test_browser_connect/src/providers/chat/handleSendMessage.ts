import * as vscode from 'vscode';
import { AIStudioBrowser } from '../../core/browser/AIStudioBrowser';

export const handleSendMessage = async (
    view: vscode.WebviewView | undefined,
    aiStudioBrowser: AIStudioBrowser | null,
    isInitialized: boolean,
    message: string
): Promise<void> => {
    if (!aiStudioBrowser || !isInitialized) {
        view?.webview.postMessage({
            type: 'systemMessage',
            message: '⚠️ Browser chưa được khởi tạo. Nhấn "Initialize Browser" trước.'
        });
        return;
    }

    try {
        view?.webview.postMessage({
            type: 'systemMessage',
            message: '⏳ Đang gửi prompt...'
        });

        const response = await aiStudioBrowser.sendPrompt(message);

        view?.webview.postMessage({
            type: 'receiveMessage',
            message: response
        });
    } catch (error: any) {
        view?.webview.postMessage({
            type: 'systemMessage',
            message: `❌ Lỗi: ${error.message}`
        });
    }
};
