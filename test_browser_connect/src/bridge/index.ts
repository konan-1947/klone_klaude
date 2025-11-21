import { BrowserBridge } from './browserBridge';
import { CookieManager } from './cookieManager';
import * as path from 'path';

async function main() {
    console.log('Starting Browser Bridge...');

    // Create cookie manager with storage path
    const storagePath = path.join(process.cwd(), '.ai-studio-storage');
    const cookieManager = new CookieManager(storagePath);

    // Create and start bridge
    const bridge = new BrowserBridge(cookieManager);

    try {
        await bridge.start(3000);
        console.log('Browser Bridge started successfully on port 3000');
    } catch (error) {
        console.error('Failed to start Browser Bridge:', error);
        process.exit(1);
    }

    // Handle shutdown
    process.on('SIGINT', async () => {
        console.log('Shutting down Browser Bridge...');
        await bridge.stop();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        console.log('Shutting down Browser Bridge...');
        await bridge.stop();
        process.exit(0);
    });
}

main().catch(console.error);
