import TurndownService from 'turndown';

const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
});

// Custom rules cho code blocks với syntax highlighting
turndownService.addRule('fencedCodeBlock', {
    filter: (node) => {
        return (
            node.nodeName === 'PRE' &&
            node.firstChild !== null &&
            node.firstChild.nodeName === 'CODE'
        );
    },
    replacement: (content, node) => {
        const codeElement = node.firstChild as HTMLElement;
        const language = codeElement.className.replace(/^language-/, '') || '';
        return '\n```' + language + '\n' + content + '\n```\n';
    },
});

export const convertHtmlToMarkdown = (html: string): string => {
    return turndownService.turndown(html);
};
