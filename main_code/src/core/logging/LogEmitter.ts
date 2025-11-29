export type LogLevel = 'info' | 'warning' | 'error';
export type LogCategory = 'ptk' | 'tool' | 'llm' | 'file' | 'system';

export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    category: LogCategory;
    message: string;
}

export type LogListener = (log: LogEntry) => void;

export class LogEmitter {
    private listeners: LogListener[] = [];

    emit(level: LogLevel, category: LogCategory, message: string): void {
        const timestamp = this.formatTimestamp();
        const logEntry: LogEntry = {
            timestamp,
            level,
            category,
            message
        };

        this.listeners.forEach(listener => {
            try {
                listener(logEntry);
            } catch (error) {
                console.error('Error in log listener:', error);
            }
        });
    }

    on(listener: LogListener): void {
        this.listeners.push(listener);
    }

    off(listener: LogListener): void {
        const index = this.listeners.indexOf(listener);
        if (index > -1) {
            this.listeners.splice(index, 1);
        }
    }

    clear(): void {
        this.listeners = [];
    }

    private formatTimestamp(): string {
        const now = new Date();
        return now.toTimeString().split(' ')[0];
    }
}
