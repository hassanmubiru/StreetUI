/** Build manifest read/written by `streetui build` and `streetui preview`. */

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface BuildManifest {
  readonly schemaVersion: 1;
  readonly framework: 'streetui';
  /** Absolute-from-server-root URLs. */
  readonly entry: { readonly js: string; readonly css?: string };
  /** Module id → served JS path. */
  readonly modules: Readonly<Record<string, string>>;
  /** Source asset path → hashed output path. */
  readonly assets: Readonly<Record<string, string>>;
  readonly dynamicImports: Readonly<Record<string, string>>;
}

export async function writeManifest(clientDir: string, manifest: BuildManifest): Promise<void> {
  await writeFile(join(clientDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

export async function readManifest(clientDir: string): Promise<BuildManifest | undefined> {
  try {
    return JSON.parse(await readFile(join(clientDir, 'manifest.json'), 'utf8')) as BuildManifest;
  } catch {
    return undefined;
  }
}