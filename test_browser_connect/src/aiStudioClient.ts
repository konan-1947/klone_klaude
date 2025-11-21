import WebSocket from 'ws';

interface PendingRequest {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
}

export class AIStudioClient {
    private ws: WebSocket | null = null;
    private requestId: number = 0;
    private pendingRequests: Map<number, PendingRequest> = new Map();
    private connectionUrl: string = 'ws://localhost:3000';

    async connect(url?: string): Promise<void> {
        if (url) {
            this.connectionUrl = url;
        }

        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.connectionUrl);

            this.ws.on('open', () => {
                console.log('Connected to Browser Bridge');
                resolve();
            });

            this.ws.on('message', (data) => {
                this.handleMessage(data.toString());
            });

            this.ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                reject(error);
            });

            this.ws.on('close', () => {
                console.log('Disconnected from Browser Bridge');
                this.ws = null;
            });

            // Timeout after 10 seconds
            setTimeout(() => {
                if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                    reject(new Error('Connection timeout'));
                }
            }, 10000);
        });
    }

    async isConnected(): Promise<boolean> {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }

    private handleMessage(message: string): void {
        try {
            const { type, requestId, data } = JSON.parse(message);

            if (type === 'response' && requestId !== undefined) {
                const pending = this.pendingRequests.get(requestId);
                if (pending) {
                    pending.resolve(data);
                    this.pendingRequests.delete(requestId);
                }
            } else if (type === 'error') {
                const pending = this.pendingRequests.get(requestId);
                if (pending) {
                    pending.reject(new Error(data.message));
                    this.pendingRequests.delete(requestId);
                }
            } else if (type === 'status') {
                console.log('Browser status:', data);
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    }

    private async sendRequest(type: string, data: any): Promise<any> {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error('Not connected to Browser Bridge');
        }

        const requestId = ++this.requestId;

        return new Promise((resolve, reject) => {
            this.pendingRequests.set(requestId, { resolve, reject });

            this.ws!.send(JSON.stringify({
                type,
                requestId,
                data
            }));

            // Timeout after 2 minutes
            setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    reject(new Error('Request timeout'));
                }
            }, 120000);
        });
    }

    async initialize(): Promise<void> {
        await this.sendRequest('init', {});
    }

    async sendPrompt(prompt: string): Promise<string> {
        const result = await this.sendRequest('sendPrompt', { prompt });
        return result.response;
    }

    async checkAuth(): Promise<{ authenticated: boolean; userEmail?: string }> {
        return await this.sendRequest('checkAuth', {});
    }

    async logout(): Promise<void> {
        await this.sendRequest('logout', {});
    }

    disconnect(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.pendingRequests.clear();
    }
}
