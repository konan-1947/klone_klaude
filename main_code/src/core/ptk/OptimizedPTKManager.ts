/**
 * Optimized PTK Manager - Single AI Studio call with Gemini preprocessing
 */

import { IPTKManager } from './IPTKManager';
import { PTKExecuteOptions, PTKExecuteResult, PTKToolCall } from './types';
import { ContextBuilder } from '../context/ContextBuilder';
import { BatchFileReader } from '../tools/BatchFileReader';
import { LLMManager } from '../llm/LLMManager';
import { LogEmitter } from '../logging';

export class OptimizedPTKManager implements IPTKManager {
    private logEmitter?: LogEmitter;

    constructor(
        private contextBuilder: ContextBuilder,
        private geminiManager: LLMManager,      // LLM Manager với Gemini provider
        private aiStudioManager: LLMManager,  // LLM Manager với AI Studio provider
        private batchReader: BatchFileReader,
        logEmitter?: LogEmitter
    ) {
        this.logEmitter = logEmitter;
    }

    async orchestrateToolCalling(
        prompt: string,
        options: PTKExecuteOptions = {}
    ): Promise<PTKExecuteResult> {
        const startTime = Date.now();
        const toolCalls: PTKToolCall[] = [];

        this.logEmitter?.emit('info', 'ptk', 'Optimized PTK: Bắt đầu orchestration');

        try {
            // Step 1: Build workspace context
            this.logEmitter?.emit('info', 'file', 'Đang build workspace context...');
            const context = await this.contextBuilder.buildContext({
                maxDepth: 3,
                includeIgnored: false
            });
            this.logEmitter?.emit('info', 'file', `Context built: ${context.summary.split('\n')[0]}`);

            const treeView = this.contextBuilder.formatTree(context.tree);

            // Step 2: Gemini preprocessing - chọn files cần đọc
            this.logEmitter?.emit('info', 'llm', 'Gửi prompt tới Gemini để chọn files...');
            const geminiPrompt = this.buildGeminiPrompt(prompt, context.summary, treeView);
            const geminiResponse = await this.geminiManager.call(geminiPrompt, {
                temperature: 0.1
            });

            const filesToRead = this.parseFileList(geminiResponse);
            this.logEmitter?.emit('info', 'llm', `Gemini chọn ${filesToRead.length} files: ${filesToRead.join(', ')}`);

            // Record tool calls
            filesToRead.forEach(path => {
                toolCalls.push({
                    tool: 'read_file',
                    args: { path },
                    reasoning: 'Selected by Gemini preprocessing'
                });
            });

            // Step 3: Read files locally (batch)
            this.logEmitter?.emit('info', 'file', `Đọc ${filesToRead.length} files...`);
            const fileContents = await this.batchReader.readFiles(filesToRead);
            this.logEmitter?.emit('info', 'file', `Đã đọc ${fileContents.filter(f => f.success).length}/${filesToRead.length} files thành công`);

            // Check if any file failed
            const failedFiles = fileContents.filter(f => !f.success);
            if (failedFiles.length > 0) {
                return {
                    success: false,
                    content: '',
                    error: `Failed to read files: ${failedFiles.map(f => f.path).join(', ')}`,
                    iterations: 1,
                    messages: [],
                    toolCalls,
                    totalToolCalls: filesToRead.length,
                    duration: Date.now() - startTime
                };
            }

            // Step 4: Single AI Studio call với upload mode
            this.logEmitter?.emit('info', 'llm', 'Gửi prompt tới AI Studio (upload mode)...');
            const answer = await this.aiStudioManager.call(prompt, {
                model: options.model,
                temperature: options.temperature || 0.7,
                mode: 'upload',
                fileContents: fileContents,
                workspaceSummary: context.summary
            });
            this.logEmitter?.emit('info', 'llm', 'Nhận response từ AI Studio');

            // Success!
            this.logEmitter?.emit('info', 'ptk', `Optimized PTK hoàn thành (${filesToRead.length} files read, 1 AI Studio call)`);
            return {
                success: true,
                content: answer,
                iterations: 1,  // Only 1 AI Studio call!
                messages: [],
                toolCalls,
                totalToolCalls: filesToRead.length,
                duration: Date.now() - startTime
            };

        } catch (error: any) {
            this.logEmitter?.emit('error', 'ptk', `Optimized PTK error: ${error.message}`);
            return {
                success: false,
                content: '',
                error: error.message || 'Unknown error occurred',
                iterations: 1,
                messages: [],
                toolCalls,
                totalToolCalls: toolCalls.length,
                duration: Date.now() - startTime
            };
        }
    }

    /**
     * Build prompt for Gemini (file selection)
     */
    private buildGeminiPrompt(userPrompt: string, summary: string, tree: string): string {
        return `You are a file selector AI. Analyze the user's question and workspace structure to determine which files need to be read.

Workspace Summary:
${summary}

Workspace Structure:
${tree}

User Question:
${userPrompt}

Task: Return a JSON array of file paths that need to be read to answer the question.

Output format (JSON only, no explanation):
{
  "files": ["path/to/file1.ts", "path/to/file2.json"]
}

Rules:
- Only return files that DIRECTLY help answer the question
- Use relative paths from workspace root
- Maximum 5 files
- If no files needed, return empty array
- NO markdown, ONLY JSON`;
    }

    /**
     * Parse file list from Groq response
     */
    private parseFileList(response: string): string[] {
        try {
            // Remove markdown code blocks if present
            const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const parsed = JSON.parse(cleaned);
            return parsed.files || [];
        } catch (error) {
            console.error('Failed to parse Groq response:', response);
            return [];
        }
    }

    /**
     * Build final prompt for AI Studio
     */
    private buildAIStudioPrompt(
        userPrompt: string,
        summary: string,
        fileContents: string
    ): string {
        return `You are a helpful AI assistant with access to the user's workspace.

Workspace Summary:
${summary}

Relevant Files:
${fileContents}

User Question:
${userPrompt}

Task: Answer the user's question based on the provided workspace context and file contents. Be concise and accurate.`;
    }
}
