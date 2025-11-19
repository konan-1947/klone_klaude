import * as vscode from 'vscode';
import { DiffLine } from './diffComputer';

/**
 * CodeLens Provider để hiển thị Accept/Reject buttons
 */
export class DiffCodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

    private diffLines: DiffLine[] = [];
    private enabled = false;

    /**
     * Update diff lines và trigger refresh
     */
    updateDiff(diffLines: DiffLine[]) {
        this.diffLines = diffLines;
        this.enabled = true;
        this._onDidChangeCodeLenses.fire();
    }

    /**
     * Clear diff và hide CodeLens
     */
    clear() {
        this.diffLines = [];
        this.enabled = false;
        this._onDidChangeCodeLenses.fire();
    }

    provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
        if (!this.enabled || this.diffLines.length === 0) {
            return [];
        }

        const lenses: vscode.CodeLens[] = [];

        // Accept All / Reject All ở đầu file
        const topRange = new vscode.Range(0, 0, 0, 0);

        lenses.push(
            new vscode.CodeLens(topRange, {
                title: "✅ Accept All Changes",
                command: "inline-diff.acceptAll",
                tooltip: "Accept all AI suggestions"
            })
        );

        lenses.push(
            new vscode.CodeLens(topRange, {
                title: "❌ Reject All Changes",
                command: "inline-diff.rejectAll",
                tooltip: "Reject all AI suggestions"
            })
        );

        lenses.push(
            new vscode.CodeLens(topRange, {
                title: "🧹 Clear Diff View",
                command: "inline-diff.clearDiff",
                tooltip: "Clear inline diff decorations"
            })
        );

        // CodeLens cho từng dòng thay đổi
        this.diffLines.forEach(line => {
            if (line.type === 'unchanged') {
                return; // Skip unchanged lines
            }

            const range = new vscode.Range(line.lineNumber, 0, line.lineNumber, 0);

            if (line.type === 'add') {
                lenses.push(
                    new vscode.CodeLens(range, {
                        title: "✅ Keep",
                        command: "inline-diff.acceptLine",
                        arguments: [line],
                        tooltip: "Keep this line"
                    })
                );

                lenses.push(
                    new vscode.CodeLens(range, {
                        title: "❌ Remove",
                        command: "inline-diff.rejectLine",
                        arguments: [line],
                        tooltip: "Remove this line"
                    })
                );
            } else if (line.type === 'delete') {
                lenses.push(
                    new vscode.CodeLens(range, {
                        title: "↩️ Restore",
                        command: "inline-diff.restoreLine",
                        arguments: [line],
                        tooltip: "Restore this deleted line"
                    })
                );

                lenses.push(
                    new vscode.CodeLens(range, {
                        title: "✅ Confirm Delete",
                        command: "inline-diff.confirmDelete",
                        arguments: [line],
                        tooltip: "Confirm deletion of this line"
                    })
                );
            }
        });

        return lenses;
    }

    dispose() {
        this._onDidChangeCodeLenses.dispose();
    }
}
