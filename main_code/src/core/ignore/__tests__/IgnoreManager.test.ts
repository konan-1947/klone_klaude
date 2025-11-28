import { IgnoreManager } from '../IgnoreManager';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('IgnoreManager - Base Implementation', () => {
    let tempDir: string;
    let manager: IgnoreManager;

    beforeEach(async () => {
        // Create temporary directory
        tempDir = path.join(os.tmpdir(), `ignore-manager-test-${Date.now()}`);
        await fs.mkdir(tempDir, { recursive: true });

        manager = new IgnoreManager(tempDir);
    });

    afterEach(async () => {
        // Cleanup
        await manager.dispose();
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    describe('initialize', () => {
        it('should initialize without .aiignore file', async () => {
            await manager.initialize();
            expect(manager.aiIgnoreContent).toBeUndefined();
        });

        it('should load existing .aiignore file', async () => {
            const aiignorePath = path.join(tempDir, '.aiignore');
            await fs.writeFile(aiignorePath, 'node_modules/\n.env');

            await manager.initialize();

            expect(manager.aiIgnoreContent).toContain('node_modules/');
            expect(manager.aiIgnoreContent).toContain('.env');
        });
    });

    describe('validateAccess', () => {
        it('should allow all files when no .aiignore exists', async () => {
            await manager.initialize();

            expect(manager.validateAccess('src/index.ts')).toBe(true);
            expect(manager.validateAccess('node_modules/lib.js')).toBe(true);
        });

        it('should block files matching patterns', async () => {
            const aiignorePath = path.join(tempDir, '.aiignore');
            await fs.writeFile(aiignorePath, 'node_modules/\n*.log');

            await manager.initialize();

            expect(manager.validateAccess('node_modules/lib.js')).toBe(false);
            expect(manager.validateAccess('debug.log')).toBe(false);
            expect(manager.validateAccess('src/index.ts')).toBe(true);
        });

        it('should handle whitelist patterns', async () => {
            const aiignorePath = path.join(tempDir, '.aiignore');
            await fs.writeFile(aiignorePath, '*.js\n!important.js');

            await manager.initialize();

            expect(manager.validateAccess('test.js')).toBe(false);
            expect(manager.validateAccess('important.js')).toBe(true);
        });
    });

    describe('filterPaths', () => {
        it('should filter out ignored paths', async () => {
            const aiignorePath = path.join(tempDir, '.aiignore');
            await fs.writeFile(aiignorePath, 'node_modules/\n*.log');

            await manager.initialize();

            const paths = [
                'src/index.ts',
                'node_modules/lib.js',
                'debug.log',
                'package.json'
            ];

            const filtered = manager.filterPaths(paths);

            expect(filtered).toEqual(['src/index.ts', 'package.json']);
        });
    });

    describe('validateCommand', () => {
        it('should allow commands when no .aiignore exists', async () => {
            await manager.initialize();

            const blocked = manager.validateCommand('cat node_modules/lib.js');
            expect(blocked).toBeUndefined();
        });

        it('should block commands reading ignored files', async () => {
            const aiignorePath = path.join(tempDir, '.aiignore');
            await fs.writeFile(aiignorePath, 'node_modules/');

            await manager.initialize();

            const blocked = manager.validateCommand('cat node_modules/lib.js');
            expect(blocked).toBe('node_modules/lib.js');
        });

        it('should allow commands reading allowed files', async () => {
            const aiignorePath = path.join(tempDir, '.aiignore');
            await fs.writeFile(aiignorePath, 'node_modules/');

            await manager.initialize();

            const blocked = manager.validateCommand('cat src/index.ts');
            expect(blocked).toBeUndefined();
        });
    });

    describe('!include directive', () => {
        it('should include patterns from other files', async () => {
            const gitignorePath = path.join(tempDir, '.gitignore');
            await fs.writeFile(gitignorePath, 'dist/\nbuild/');

            const aiignorePath = path.join(tempDir, '.aiignore');
            await fs.writeFile(aiignorePath, 'node_modules/\n!include .gitignore');

            await manager.initialize();

            expect(manager.validateAccess('node_modules/lib.js')).toBe(false);
            expect(manager.validateAccess('dist/bundle.js')).toBe(false);
            expect(manager.validateAccess('build/output.js')).toBe(false);
        });
    });

    describe('file watcher', () => {
        it('should reload patterns when .aiignore changes', async () => {
            const aiignorePath = path.join(tempDir, '.aiignore');
            await fs.writeFile(aiignorePath, 'node_modules/');

            await manager.initialize();

            expect(manager.validateAccess('node_modules/lib.js')).toBe(false);
            expect(manager.validateAccess('dist/bundle.js')).toBe(true);

            // Update .aiignore
            await fs.writeFile(aiignorePath, 'node_modules/\ndist/');

            // Wait for file watcher
            await new Promise(resolve => setTimeout(resolve, 300));

            expect(manager.validateAccess('dist/bundle.js')).toBe(false);
        });
    });
});
