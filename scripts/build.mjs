import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await copyFile('index.html', 'dist/index.html');
await copyFile('public/rowoon-center-logo-footer.png', 'dist/rowoon-center-logo-footer.png');
