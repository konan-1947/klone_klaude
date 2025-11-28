/**
 * Read File Tool Definition for PTK
 */

import { PTKTool } from '../../ptk/types';

export const readFileTool: PTKTool = {
    name: 'read_file',
    description: 'Read contents of a text file from the file system',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Path to the file (relative or absolute)'
            }
        },
        required: ['path']
    },
    handler: async (args: { path: string }) => {
        // Handler will be injected by ToolRegistry
        // This is just a placeholder
        return null;
    }
};
