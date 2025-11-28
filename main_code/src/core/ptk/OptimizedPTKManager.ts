/**
 * Optimized PTK Manager - Single AI Studio call with Groq preprocessing
 */

import { IPTKManager } from './IPTKManager';
import { PTKExecuteOptions, PTKExecuteResult, PTKToolCall } from './types';
import { ContextBuilder } from '../context/ContextBuilder';
import { BatchFileReader } from '../tools/BatchFileReader';
import { LLMManager } from '../llm/LLMManager';

export class OptimizedPTKManager implements IPTKManager {
    constructor(
        private contextBuilder: ContextBuilder,
        private groqManager: LLMManager,      // LLM Manager với Groq provider
        private aiStudioManager: LLMManager,  // LLM Manager với AI Studio provider
        private batchReader: BatchFileReader
    ) { }

    async orchestrateToolCalling(
        prompt: string,
        options: PTKExecuteOptions = {}
    ): Promise<PTKExecuteResult> {
        const startTime = Date.now();
        const toolCalls: PTKToolCall[] = [];

        try {
            // Step 1: Build workspace context
            const context = await this.contextBuilder.buildContext({
                maxDepth: 3,
                includeIgnored: false
            });

            const treeView = this.contextBuilder.formatTree(context.tree);

            // Step 2: Groq preprocessing - chọn files cần đọc
            const groqPrompt = this.buildGroqPrompt(prompt, context.summary, treeView);
            const groqResponse = await this.groqManager.call(groqPrompt, {
                temperature: 0.1
            });

            const filesToRead = this.parseFileList(groqResponse);

            // Record tool calls
            filesToRead.forEach(path => {
                toolCalls.push({
                    tool: 'read_file',
                    args: { path },
                    reasoning: 'Selected by Groq preprocessing'
                });
            });

            // Step 3: Read files locally (batch)
            const fileContents = await this.batchReader.readFiles(filesToRead);

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

            // Step 4: Single AI Studio call với full context
            const aiStudioPrompt = this.buildAIStudioPrompt(
                prompt,
                context.summary,
                this.batchReader.formatForPrompt(fileContents)
            );

            const answer = await this.aiStudioManager.call(aiStudioPrompt, {
                model: options.model,
                temperature: options.temperature || 0.7
            });

            // Success!
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
     * Build prompt for Groq (file selection)
     */
    private buildGroqPrompt(userPrompt: string, summary: string, tree: string): string {
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
