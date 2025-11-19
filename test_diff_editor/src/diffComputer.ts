import * as diff from 'diff';

/**
 * Đại diện cho một dòng diff
 */
export interface DiffLine {
    type: 'add' | 'delete' | 'unchanged';
    lineNumber: number;
    content: string;
}

/**
 * Kết quả của việc compute diff
 */
export interface DiffResult {
    additions: DiffLine[];
    deletions: DiffLine[];
    unchanged: DiffLine[];
    allLines: DiffLine[];
}

/**
 * Compute line-by-line diff giữa original và modified content
 */
export function computeLineDiff(original: string, modified: string): DiffResult {
    const changes = diff.diffLines(original, modified);

    const additions: DiffLine[] = [];
    const deletions: DiffLine[] = [];
    const unchanged: DiffLine[] = [];
    const allLines: DiffLine[] = [];

    let lineNumber = 0;

    changes.forEach(change => {
        const lines = change.value.split('\n').filter(line => line.length > 0 || change.value.endsWith('\n'));

        if (change.added) {
            // Dòng THÊM MỚI
            lines.forEach(line => {
                if (line || lines.length === 1) {
                    const diffLine: DiffLine = {
                        type: 'add',
                        lineNumber: lineNumber++,
                        content: line
                    };
                    additions.push(diffLine);
                    allLines.push(diffLine);
                }
            });
        } else if (change.removed) {
            // Dòng XÓA
            lines.forEach(line => {
                if (line || lines.length === 1) {
                    const diffLine: DiffLine = {
                        type: 'delete',
                        lineNumber: lineNumber++,
                        content: line
                    };
                    deletions.push(diffLine);
                    allLines.push(diffLine);
                }
            });
        } else {
            // Dòng KHÔNG ĐỔI
            lines.forEach(line => {
                if (line || lines.length === 1) {
                    const diffLine: DiffLine = {
                        type: 'unchanged',
                        lineNumber: lineNumber++,
                        content: line
                    };
                    unchanged.push(diffLine);
                    allLines.push(diffLine);
                }
            });
        }
    });

    return { additions, deletions, unchanged, allLines };
}

/**
 * Tạo modified content từ original và diff result
 * (Merge original với additions, loại bỏ deletions)
 */
export function applyDiff(original: string, diffResult: DiffResult): string {
    return diffResult.allLines
        .filter(line => line.type !== 'delete')
        .map(line => line.content)
        .join('\n');
}
