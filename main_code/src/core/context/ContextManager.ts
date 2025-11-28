/**
 * Context Manager - Manage conversation history
 */

import { PTKMessage } from '../ptk/types';

export class ContextManager {
    private conversations: Map<string, PTKMessage[]>;

    constructor() {
        this.conversations = new Map();
    }

    /**
     * Create a new conversation
     */
    createConversation(id: string): void {
        if (!this.conversations.has(id)) {
            this.conversations.set(id, []);
        }
    }

    /**
     * Add a message to conversation
     */
    addMessage(conversationId: string, message: PTKMessage): void {
        const messages = this.conversations.get(conversationId) || [];
        messages.push(message);
        this.conversations.set(conversationId, messages);
    }

    /**
     * Add multiple messages to conversation
     */
    addMessages(conversationId: string, messages: PTKMessage[]): void {
        const existing = this.conversations.get(conversationId) || [];
        existing.push(...messages);
        this.conversations.set(conversationId, existing);
    }

    /**
     * Get all messages from a conversation
     */
    getMessages(conversationId: string): PTKMessage[] {
        return this.conversations.get(conversationId) || [];
    }

    /**
     * Get last N messages from a conversation
     */
    getLastMessages(conversationId: string, count: number): PTKMessage[] {
        const messages = this.conversations.get(conversationId) || [];
        return messages.slice(-count);
    }

    /**
     * Clear a conversation
     */
    clearConversation(conversationId: string): void {
        this.conversations.delete(conversationId);
    }

    /**
     * Check if conversation exists
     */
    hasConversation(conversationId: string): boolean {
        return this.conversations.has(conversationId);
    }

    /**
     * Get conversation count
     */
    getConversationCount(): number {
        return this.conversations.size;
    }
}
