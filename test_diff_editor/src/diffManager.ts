import * as vscode from 'vscode';
import { DiffDecorations } from './decorations';
import { DiffLine, DiffResult, computeLineDiff } from './diffComputer';

/**
 * Quản lý inline diff state và decorations
 */
export class DiffManager {
    private decorations: DiffDecorations;
    private currentDiff: DiffResult | null = null;
    private originalContent: string = '';

    constructor() {
        this.decorations = new DiffDecorations();
    }

    /**
     * Hiển thị inline diff trong editor
     */
    async showDiff(editor: vscode.TextEditor, originalContent: string, modifiedContent: string) {
        this.originalContent = originalContent;

        // Compute diff
        const diffResult = computeLineDiff(originalContent, modifiedContent);
        this.currentDiff = diffResult;

        // Replace toàn bộ content với merged content (original + additions)
        await editor.edit(editBuilder => {
            const fullRange = new vscode.Range(
                0, 0,
                editor.document.lineCount, 0
            );

            // Tạo content mới với tất cả các dòng (bao gồm deletions để show strikethrough)
            const newContent = diffResult.allLines.map(line => line.content).join('\n');
            editBuilder.replace(fullRange, newContent);
        });

        // Apply decorations
        this.applyDecorations(editor, diffResult);

        return diffResult;
    }

    /**
     * Apply decorations cho các dòng diff
     */
    private applyDecorations(editor: vscode.TextEditor, diffResult: DiffResult) {
        const additionRanges: vscode.Range[] = [];
        const deletionRanges: vscode.Range[] = [];

        diffResult.allLines.forEach(line => {
            const range = new vscode.Range(line.lineNumber, 0, line.lineNumber + 1, 0);

            if (line.type === 'add') {
                additionRanges.push(range);
            } else if (line.type === 'delete') {
                deletionRanges.push(range);
            }
        });

        editor.setDecorations(this.decorations.additionDecoration, additionRanges);
        editor.setDecorations(this.decorations.deletionDecoration, deletionRanges);
    }

    /**
     * Accept tất cả changes
     */
    async acceptAll(editor: vscode.TextEditor) {
        if (!this.currentDiff) {
            return;
        }

        await editor.edit(editBuilder => {
            const fullRange = new vscode.Range(
                0, 0,
                editor.document.lineCount, 0
            );

            // Chỉ giữ lại additions và unchanged, loại bỏ deletions
            const acceptedContent = this.currentDiff!.allLines
                .filter(line => line.type !== 'delete')
                .map(line => line.content)
                .join('\n');

            editBuilder.replace(fullRange, acceptedContent);
        });

        this.clearDecorations(editor);
        this.currentDiff = null;

        vscode.window.showInformationMessage('✅ All changes accepted!');
    }

    /**
     * Reject tất cả changes
     */
    async rejectAll(editor: vscode.TextEditor) {
        if (!this.currentDiff) {
            return;
        }

        await editor.edit(editBuilder => {
            const fullRange = new vscode.Range(
                0, 0,
                editor.document.lineCount, 0
            );

            // Restore về original content
            editBuilder.replace(fullRange, this.originalContent);
        });

        this.clearDecorations(editor);
        this.currentDiff = null;

        vscode.window.showInformationMessage('❌ All changes rejected!');
    }

    /**
     * Accept một dòng cụ thể
     */
    async acceptLine(editor: vscode.TextEditor, line: DiffLine) {
        if (!this.currentDiff) {
            return;
        }

        // Chỉ cần clear decoration của dòng này
        const range = new vscode.Range(line.lineNumber, 0, line.lineNumber + 1, 0);

        // Update current diff để remove line này khỏi additions
        this.currentDiff.additions = this.currentDiff.additions.filter(l => l.lineNumber !== line.lineNumber);

        // Re-apply decorations
        this.applyDecorations(editor, this.currentDiff);

        vscode.window.showInformationMessage(`✅ Line ${line.lineNumber + 1} accepted`);
    }

    /**
     * Reject một dòng cụ thể (xóa dòng addition)
     */
    async rejectLine(editor: vscode.TextEditor, line: DiffLine) {
        await editor.edit(editBuilder => {
            const range = new vscode.Range(line.lineNumber, 0, line.lineNumber + 1, 0);
            editBuilder.delete(range);
        });

        if (this.currentDiff) {
            // Update line numbers
            this.currentDiff.allLines = this.currentDiff.allLines
                .filter(l => l.lineNumber !== line.lineNumber)
                .map(l => {
                    if (l.lineNumber > line.lineNumber) {
                        return { ...l, lineNumber: l.lineNumber - 1 };
                    }
                    return l;
                });

            this.applyDecorations(editor, this.currentDiff);
        }

        vscode.window.showInformationMessage(`❌ Line ${line.lineNumber + 1} rejected`);
    }

    /**
     * Restore một dòng deletion
     */
    async restoreLine(editor: vscode.TextEditor, line: DiffLine) {
        if (!this.currentDiff) {
            return;
        }

        // Chỉ clear decoration (giữ lại dòng)
        this.currentDiff.deletions = this.currentDiff.deletions.filter(l => l.lineNumber !== line.lineNumber);
        this.applyDecorations(editor, this.currentDiff);

        vscode.window.showInformationMessage(`↩️ Line ${line.lineNumber + 1} restored`);
    }

    /**
     * Confirm delete một dòng
     */
    async confirmDelete(editor: vscode.TextEditor, line: DiffLine) {
        await editor.edit(editBuilder => {
            const range = new vscode.Range(line.lineNumber, 0, line.lineNumber + 1, 0);
            editBuilder.delete(range);
        });

        if (this.currentDiff) {
            this.currentDiff.allLines = this.currentDiff.allLines
                .filter(l => l.lineNumber !== line.lineNumber)
                .map(l => {
                    if (l.lineNumber > line.lineNumber) {
                        return { ...l, lineNumber: l.lineNumber - 1 };
                    }
                    return l;
                });

            this.applyDecorations(editor, this.currentDiff);
        }

        vscode.window.showInformationMessage(`✅ Line ${line.lineNumber + 1} deleted`);
    }

    /**
     * Clear tất cả decorations
     */
    clearDecorations(editor: vscode.TextEditor) {
        editor.setDecorations(this.decorations.additionDecoration, []);
        editor.setDecorations(this.decorations.deletionDecoration, []);
        editor.setDecorations(this.decorations.modificationDecoration, []);
    }

    /**
     * Clear diff state
     */
    clear(editor: vscode.TextEditor) {
        this.clearDecorations(editor);
        this.currentDiff = null;
        this.originalContent = '';
    }

    dispose() {
        this.decorations.dispose();
    }
}
