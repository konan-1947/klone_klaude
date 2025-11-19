import * as vscode from 'vscode';

/**
 * Decoration types cho inline diff
 */
export class DiffDecorations {
    // Decoration cho dòng THÊM MỚI (xanh)
    public readonly additionDecoration: vscode.TextEditorDecorationType;

    // Decoration cho dòng XÓA (đỏ với strikethrough)
    public readonly deletionDecoration: vscode.TextEditorDecorationType;

    // Decoration cho dòng SỬA (vàng)
    public readonly modificationDecoration: vscode.TextEditorDecorationType;

    constructor() {
        this.additionDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(0, 255, 0, 0.15)',
            isWholeLine: true,
            overviewRulerColor: 'rgba(0, 255, 0, 0.8)',
            overviewRulerLane: vscode.OverviewRulerLane.Left,
            before: {
                contentText: '+ ',
                color: '#00ff00',
                fontWeight: 'bold',
                margin: '0 8px 0 0'
            }
        });

        this.deletionDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(255, 0, 0, 0.15)',
            isWholeLine: true,
            textDecoration: 'line-through',
            opacity: '0.6',
            overviewRulerColor: 'rgba(255, 0, 0, 0.8)',
            overviewRulerLane: vscode.OverviewRulerLane.Left,
            before: {
                contentText: '- ',
                color: '#ff0000',
                fontWeight: 'bold',
                margin: '0 8px 0 0'
            }
        });

        this.modificationDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(255, 255, 0, 0.12)',
            isWholeLine: true,
            overviewRulerColor: 'rgba(255, 255, 0, 0.8)',
            overviewRulerLane: vscode.OverviewRulerLane.Left,
            before: {
                contentText: '~ ',
                color: '#ffff00',
                fontWeight: 'bold',
                margin: '0 8px 0 0'
            }
        });
    }

    /**
     * Dispose tất cả decorations
     */
    dispose() {
        this.additionDecoration.dispose();
        this.deletionDecoration.dispose();
        this.modificationDecoration.dispose();
    }
}
