import { IgnoreCategory } from './types';

/**
 * Known patterns for each category
 */
export const KNOWN_PATTERNS: Record<IgnoreCategory, string[]> = {
    dependencies: [
        'node_modules',
        'vendor',
        '.pnpm-store',
        'bower_components',
        'jspm_packages',
        'packages'
    ],
    environment: [
        '.env',
        'secrets',
        '*.key',
        '*.pem',
        '*.cert',
        'credentials'
    ],
    build: [
        'dist',
        'build',
        'out',
        'target',
        '.output',
        '*.min.js',
        '*.bundle.js',
        '*.min.css'
    ],
    cache: [
        '.cache',
        'tmp',
        'temp',
        '*.log',
        '.next',
        '.nuxt',
        '.parcel-cache',
        '.turbo',
        '.vercel'
    ],
    vcs: [
        '.git',
        '.svn',
        '.hg',
        '.bzr'
    ],
    ide: [
        '.vscode',
        '.idea',
        '*.swp',
        '*.swo',
        '.DS_Store',
        'Thumbs.db',
        '.project',
        '.settings'
    ],
    large: []
};

/**
 * File extensions typically in build outputs
 */
export const BUILD_EXTENSIONS = [
    '.min.js',
    '.min.css',
    '.bundle.js',
    '.chunk.js',
    '.map'
];

/**
 * Size threshold for large folders (in bytes)
 */
export const SIZE_THRESHOLD_MB = 10;
export const SIZE_THRESHOLD_BYTES = SIZE_THRESHOLD_MB * 1024 * 1024;

/**
 * Environment file patterns
 */
export const ENV_PATTERNS = [
    '.env',
    '.env.local',
    '.env.development',
    '.env.production',
    '.env.test',
    '.env.*'
];

/**
 * Dependency folder patterns by package manager
 */
export const DEPENDENCY_FOLDERS = {
    npm: 'node_modules',
    pnpm: '.pnpm-store',
    yarn: '.yarn',
    composer: 'vendor',
    maven: 'target',
    gradle: 'build'
};
