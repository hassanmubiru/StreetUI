/**
 * `streetui create` / `npm create streetui` (Phase 3). Scaffolds a real,
 * working StreetUI project from a shipped template. No network access, no
 * post-install magic — just a recursive copy with placeholder substitution.
 */

import { mkdir, readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import type { Logger } from './logger.js';
import { CliError } from './diagnostics.js';
import {
  templateDir,
  resolveTemplateName,
  materialisedName,
  applyTokens,
  isTextFile,
  type TemplateName,
  type TemplateTokens,
} from './templates.js';

export interface CreateOptions {
  /** Target directory (relative or absolute). */
  readonly targetDir: string;
  /** Template to use; defaults to the SSR starter. */
  readonly template?: string;
  /** StreetUI package version the generated project should depend on. */
  readonly frameworkVersion: string;
  readonly logger: Logger;
}

export interface CreateResult {
  readonly root: string;
  readonly template: TemplateName;
  readonly files: readonly string[];
}

/** True when a directory is absent or empty (safe to scaffold into). */
async function isEmptyDir(dir: string): Promise<boolean> {
  if (!existsSync(dir)) return true;
  const entries = await readdir(dir);
  return entries.filter((e) => e !== '.git').length === 0;
}

/** Recursively copy a template directory, transforming names and tokens. */
async function copyTree(
  srcDir: string,
  destDir: string,
  tokens: TemplateTokens,
  written: string[],
): Promise<void> {
  await mkdir(destDir, { recursive: true });
  const entries = await readdir(srcDir);
  for (const entry of entries) {
    const srcPath = join(srcDir, entry);
    const info = await stat(srcPath);
    const destName = materialisedName(entry);
    const destPath = join(destDir, destName);
    if (info.isDirectory()) {
      await copyTree(srcPath, destPath, tokens, written);
    } else if (isTextFile(entry)) {
      const raw = await readFile(srcPath, 'utf8');
      await writeFile(destPath, applyTokens(raw, tokens), 'utf8');
      written.push(destPath);
    } else {
      const raw = await readFile(srcPath);
      await writeFile(destPath, raw);
      written.push(destPath);
    }
  }
}

/**
 * Scaffold a new project. Validates the template and the (empty) target, copies
 * the tree, and returns the created root + file list. Throws `CliError` on any
 * user-facing problem.
 */
export async function createProject(options: CreateOptions): Promise<CreateResult> {
  const { logger } = options;

  let template: TemplateName;
  try {
    template = resolveTemplateName(options.template);
  } catch (err) {
    throw new CliError((err as Error).message, { suggestion: 'Pass a valid --template value.' });
  }

  const root = resolve(options.targetDir);
  const projectName = basename(root);

  if (!(await isEmptyDir(root))) {
    throw new CliError(`Target directory ${root} already exists and is not empty.`, {
      suggestion: 'Choose a new directory name or empty the existing one.',
    });
  }

  const src = templateDir(template);
  if (!existsSync(src)) {
    throw new CliError(`Template "${template}" is missing from the CLI installation (${src}).`, {
      suggestion: 'Reinstall @streetui/cli — the shipped templates appear to be absent.',
    });
  }

  const tokens: TemplateTokens = { projectName, frameworkVersion: options.frameworkVersion };
  const files: string[] = [];
  await copyTree(src, root, tokens, files);

  logger.success(`Created ${projectName} (${template} template) with ${files.length} files.`);
  logger.plain('');
  logger.info('Next steps:');
  logger.plain(`  cd ${options.targetDir}`);
  logger.plain('  npm install');
  logger.plain('  npm run dev');

  return { root, template, files };
}
