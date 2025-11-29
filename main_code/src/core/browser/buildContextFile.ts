import { FileContent } from '../tools/BatchFileReader';

/**
 * Build context file content from file contents and workspace summary
 * This file will be uploaded to AI Studio
 */
export const buildContextFile = (
    files: FileContent[],
    workspaceSummary: string
): string => {
    const sections: string[] = [];

    // Header
    sections.push('=== AI STUDIO CONTEXT FILE ===');
    sections.push(`Generated: ${new Date().toISOString()}`);
    sections.push('');

    // Workspace summary
    sections.push('=== WORKSPACE SUMMARY ===');
    sections.push(workspaceSummary);
    sections.push('');

    // File contents
    sections.push('=== FILE CONTENTS ===');
    sections.push('');

    for (const file of files) {
        if (file.success && file.content) {
            sections.push(`--- FILE: ${file.path} ---`);
            sections.push(file.content);
            sections.push('');
        }
    }

    // Footer
    sections.push('=== END OF CONTEXT ===');

    return sections.join('\n');
};
