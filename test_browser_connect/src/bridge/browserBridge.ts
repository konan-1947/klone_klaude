import WebSocket, { WebSocketServer } from 'ws';
import { AIStudioBrowser } from './aiStudioBrowser';
import { CookieManager } from './cookieManager';

export class BrowserBridge {
    private wss: WebSocketServer | null = null;
    private client: WebSocket | null = null;
    private aiStudioBrowser: AIStudioBrowser | null = null;
    private isReady: boolean = false;

    constructor(private cookieManager: CookieManager) { }

    async start(port: number = 3000): Promise<void> {
        this.wss = new WebSocketServer({ port });

        console.log(`Browser Bridge started on ws://localhost:${port}`);

        this.wss.on('connection', (ws) => {
            console.log('Extension connected');
            this.client = ws;

            ws.on('message', async (message) => {
                await this.handleMessage(message.toString());
            });

            ws.on('close', () => {
                console.log('Extension disconnected');
                this.client = null;
            });

            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
            });

            // Send ready status
            this.sendToExtension({
                type: 'status',
                data: { ready: this.isReady }
            });
        });
    }

    async initializeBrowser(): Promise<void> {
        console.log('Initializing AI Studio Browser...');

        this.aiStudioBrowser = new AIStudioBrowser(this.cookieManager);
        await this.aiStudioBrowser.initialize();
        this.isReady = true;

        this.sendToExtension({
            type: 'status',
            data: { ready: true, message: 'Browser initialized' }
        });

        console.log('Browser ready');
    }

    private async handleMessage(message: string): Promise<void> {
        try {
            const { type, data, requestId } = JSON.parse(message);

            console.log(`Received message: ${type}`);

            switch (type) {
                case 'init':
                    await this.initializeBrowser();
                    this.sendToExtension({
                        type: 'response',
                        requestId,
                        data: { success: true }
                    });
                    break;

                case 'sendPrompt':
                    if (!this.aiStudioBrowser || !this.isReady) {
                        throw new Error('Browser not ready');
                    }

                    const response = await this.aiStudioBrowser.sendPrompt(data.prompt);

                    this.sendToExtension({
                        type: 'response',
                        requestId,
                        data: { response }
                    });
                    break;

                case 'checkAuth':
                    const hasSession = await this.cookieManager.hasValidSession();
                    const userEmail = await this.cookieManager.getUserEmail();

                    this.sendToExtension({
                        type: 'response',
                        requestId,
                        data: { authenticated: hasSession, userEmail }
                    });
                    break;

                case 'logout':
                    await this.cookieManager.clearCookies();
                    if (this.aiStudioBrowser) {
                        await this.aiStudioBrowser.close();
                        this.aiStudioBrowser = null;
                        this.isReady = false;
                    }

                    this.sendToExtension({
                        type: 'response',
                        requestId,
                        data: { success: true }
                    });
                    break;

                default:
                    throw new Error(`Unknown message type: ${type}`);
            }
        } catch (error: any) {
            console.error('Error handling message:', error);
            this.sendToExtension({
                type: 'error',
                data: { message: error.message }
            });
        }
    }

    private sendToExtension(message: any): void {
        if (this.client && this.client.readyState === WebSocket.OPEN) {
            this.client.send(JSON.stringify(message));
        }
    }

    async stop(): Promise<void> {
        if (this.aiStudioBrowser) {
            await this.aiStudioBrowser.close();
        }

        if (this.wss) {
            this.wss.close();
        }

        console.log('Browser Bridge stopped');
    }
}
