import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, '..');
const uiDir = join(pkgRoot, 'dist', 'ui');
mkdirSync(uiDir, { recursive: true });
copyFileSync(join(pkgRoot, 'ui', 'index.html'), join(uiDir, 'index.html'));
console.log('playground: copied ui/index.html → dist/ui/index.html');
