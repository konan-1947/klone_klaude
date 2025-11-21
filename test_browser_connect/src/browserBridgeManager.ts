import * as vscode from 'vscode';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';

export class BrowserBridgeManager {
    private bridgeProcess: ChildProcess | null = null;
    private isRunningFlag: boolean = false;

    constructor(private readonly context: vscode.ExtensionContext) { }

    async start(): Promise<void> {
        if (this.isRunningFlag) {
            console.log('Browser Bridge already running');
            return;
        }

        const bridgePath = path.join(
            this.context.extensionPath,
            'out',
            'bridge',
            'index.js'
        );

        console.log('Starting Browser Bridge at:', bridgePath);

        this.bridgeProcess = spawn('node', [bridgePath], {
            cwd: this.context.extensionPath,
            stdio: 'pipe'
        });

        this.bridgeProcess.stdout?.on('data', (data) => {
            console.log('[Bridge]', data.toString());
        });

        this.bridgeProcess.stderr?.on('data', (data) => {
            console.error('[Bridge Error]', data.toString());
        });

        this.bridgeProcess.on('close', (code) => {
            console.log(`Bridge process exited with code ${code}`);
            this.isRunningFlag = false;
            this.bridgeProcess = null;
        });

        this.isRunningFlag = true;
    }

    async isRunning(): Promise<boolean> {
        return this.isRunningFlag;
    }

    dispose(): void {
        if (this.bridgeProcess) {
            this.bridgeProcess.kill();
            this.bridgeProcess = null;
            this.isRunningFlag = false;
        }
    }
}
