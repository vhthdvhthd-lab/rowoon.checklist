import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await copyFile('index.html', 'dist/index.html');
await copyFile('public/rowoon-center-logo-footer.png', 'dist/rowoon-center-logo-footer.png');
await copyFile('public/attendance-export.js', 'dist/attendance-export.js');
await copyFile('node_modules/exceljs/dist/exceljs.min.js', 'dist/exceljs.min.js');
