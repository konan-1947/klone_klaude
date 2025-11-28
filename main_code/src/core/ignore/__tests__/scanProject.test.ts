import { IgnoreManager } from '../IgnoreManager';
import { IgnoreCategory, ScanResult } from '../types';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('IgnoreManager - Auto-Detection (Day 2)', () => {
    let tempDir: string;
    let manager: IgnoreManager;

    beforeEach(async () => {
        tempDir = path.join(os.tmpdir(), `ignore-manager-test-${Date.now()}`);
        await fs.mkdir(tempDir, { recursive: true });
        manager = new IgnoreManager(tempDir);
    });

    afterEach(async () => {
        await manager.dispose();
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    describe('scanProject', () => {
        it('should detect node_modules folder', async () => {
            await fs.mkdir(path.join(tempDir, 'node_modules'));

            const result = await manager.scanProject();

            const deps = result.categories.get('dependencies' as IgnoreCategory);
            expect(deps).toContain('node_modules/');
        });

        it('should detect environment files', async () => {
            await fs.writeFile(path.join(tempDir, '.env'), '');
            await fs.writeFile(path.join(tempDir, '.env.local'), '');

            const result = await manager.scanProject();

            const env = result.categories.get('environment' as IgnoreCategory);
            expect(env).toContain('.env');
            expect(env).toContain('.env.local');
            expect(env).toContain('.env.*');
        });

        it('should detect build folders', async () => {
            await fs.mkdir(path.join(tempDir, 'dist'));
            await fs.mkdir(path.join(tempDir, 'build'));

            const result = await manager.scanProject();

            const build = result.categories.get('build' as IgnoreCategory);
            expect(build).toContain('dist/');
            expect(build).toContain('build/');
        });
    });

    describe('categorizePatterns', () => {
        it('should correctly categorize patterns', () => {
            const patterns = [
                'node_modules/',
                '.env',
                'dist/',
                '.git/',
                '.cache/',
                '.vscode/'
            ];

            const categories = manager.categorizePatterns(patterns);

            expect(categories.get('dependencies' as IgnoreCategory)).toContain('node_modules/');
            expect(categories.get('environment' as IgnoreCategory)).toContain('.env');
            expect(categories.get('build' as IgnoreCategory)).toContain('dist/');
            expect(categories.get('vcs' as IgnoreCategory)).toContain('.git/');
            expect(categories.get('cache' as IgnoreCategory)).toContain('.cache/');
            expect(categories.get('ide' as IgnoreCategory)).toContain('.vscode/');
        });
    });
});
