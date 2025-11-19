import * as vscode from 'vscode';
import { DiffManager } from './diffManager';
import { DiffCodeLensProvider } from './codeLensProvider';
import { DiffLine } from './diffComputer';

let diffManager: DiffManager;
let codeLensProvider: DiffCodeLensProvider;

export function activate(context: vscode.ExtensionContext) {
    console.log('Inline Diff Demo extension is now active!');

    // Initialize managers
    diffManager = new DiffManager();
    codeLensProvider = new DiffCodeLensProvider();

    // Register CodeLens provider
    const codeLensDisposable = vscode.languages.registerCodeLensProvider(
        { scheme: 'file' },
        codeLensProvider
    );

    // Command: Show Diff
    const showDiffCommand = vscode.commands.registerCommand('inline-diff.showDiff', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor!');
            return;
        }

        // Lấy original content
        const originalContent = editor.document.getText();

        // Simulate AI suggestion (trong thực tế sẽ gọi AI API)
        const modifiedContent = simulateAISuggestion(originalContent);

        if (originalContent === modifiedContent) {
            vscode.window.showInformationMessage('No changes suggested by AI');
            return;
        }

        // Show diff
        const diffResult = await diffManager.showDiff(editor, originalContent, modifiedContent);

        // Update CodeLens
        codeLensProvider.updateDiff(diffResult.allLines);

        vscode.window.showInformationMessage(
            `📊 Diff: +${diffResult.additions.length} additions, -${diffResult.deletions.length} deletions`
        );
    });

    // Command: Accept All
    const acceptAllCommand = vscode.commands.registerCommand('inline-diff.acceptAll', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        await diffManager.acceptAll(editor);
        codeLensProvider.clear();
    });

    // Command: Reject All
    const rejectAllCommand = vscode.commands.registerCommand('inline-diff.rejectAll', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        await diffManager.rejectAll(editor);
        codeLensProvider.clear();
    });

    // Command: Clear Diff
    const clearDiffCommand = vscode.commands.registerCommand('inline-diff.clearDiff', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        diffManager.clear(editor);
        codeLensProvider.clear();
        vscode.window.showInformationMessage('🧹 Diff view cleared');
    });

    // Command: Accept Line
    const acceptLineCommand = vscode.commands.registerCommand(
        'inline-diff.acceptLine',
        async (line: DiffLine) => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }

            await diffManager.acceptLine(editor, line);
        }
    );

    // Command: Reject Line
    const rejectLineCommand = vscode.commands.registerCommand(
        'inline-diff.rejectLine',
        async (line: DiffLine) => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }

            await diffManager.rejectLine(editor, line);
        }
    );

    // Command: Restore Line
    const restoreLineCommand = vscode.commands.registerCommand(
        'inline-diff.restoreLine',
        async (line: DiffLine) => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }

            await diffManager.restoreLine(editor, line);
        }
    );

    // Command: Confirm Delete
    const confirmDeleteCommand = vscode.commands.registerCommand(
        'inline-diff.confirmDelete',
        async (line: DiffLine) => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }

            await diffManager.confirmDelete(editor, line);
        }
    );

    // Add to subscriptions
    context.subscriptions.push(
        codeLensDisposable,
        showDiffCommand,
        acceptAllCommand,
        rejectAllCommand,
        clearDiffCommand,
        acceptLineCommand,
        rejectLineCommand,
        restoreLineCommand,
        confirmDeleteCommand,
        diffManager
    );
}

/**
 * Simulate AI suggestion (mock function)
 * Trong thực tế, đây sẽ gọi AI API hoặc chatbot automation
 */
function simulateAISuggestion(originalContent: string): string {
    // Detect language và tạo suggestion phù hợp

    // Example 1: JavaScript/TypeScript function
    if (originalContent.includes('function') || originalContent.includes('const')) {
        return originalContent
            .replace(/console\.log\(/g, 'console.info(')
            .replace(/var /g, 'const ')
            + '\n\n// AI Suggestion: Added error handling\ntry {\n  // Your code here\n} catch (error) {\n  console.error(error);\n}';
    }

    // Example 2: Python
    if (originalContent.includes('def ') || originalContent.includes('print(')) {
        return originalContent
            .replace(/print\(/g, 'print(f"Debug: ", ')
            + '\n\n# AI Suggestion: Added type hints\ndef example(param: str) -> None:\n    pass';
    }

    // Example 3: Generic improvement
    const lines = originalContent.split('\n');
    const modifiedLines = lines.map(line => {
        // Thêm comments cho các dòng code
        if (line.trim() && !line.trim().startsWith('//') && !line.trim().startsWith('#')) {
            return line + ' // AI: Consider adding error handling';
        }
        return line;
    });

    // Thêm một số dòng mới
    modifiedLines.splice(2, 0, '// AI Suggestion: Added logging');
    modifiedLines.splice(5, 1); // Xóa một dòng

    return modifiedLines.join('\n');
}

export function deactivate() {
    if (diffManager) {
        diffManager.dispose();
    }
    if (codeLensProvider) {
        codeLensProvider.dispose();
    }
}
