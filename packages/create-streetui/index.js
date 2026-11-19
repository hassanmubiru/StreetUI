#!/usr/bin/env node
/**
 * create-streetui — the `npm create streetui@latest` initializer.
 *
 * This is a tiny wrapper over the published `@streetui/cli`. It exists so that
 * `npm create streetui@latest <dir>` resolves `create-streetui` on the registry
 * and delegates to the real StreetUI scaffolder. It contains no framework logic.
 */

const { createProject, FRAMEWORK_VERSION } = require('@streetui/cli');
const path = require('node:path');

async function main() {
  const args = process.argv.slice(2);
  const target = args.find((a) => !a.startsWith('-') && a !== 'create');
  if (!target) {
    console.error('Usage: npm create streetui@latest <dir> [--template <name>]');
    console.error('Run "npx @streetui/cli create --help" to list templates.');
    process.exit(1);
  }
  const i = args.indexOf('--template');
  const template = i >= 0 ? args[i + 1] : undefined;

  const logger = {
    info: (m) => console.log(m),
    success: (m) => console.log(m),
    warn: (m) => console.warn(m),
    error: (m) => console.error(m),
    plain: (m) => console.log(m),
  };

  await createProject({
    targetDir: path.resolve(process.cwd(), target),
    ...(template ? { template } : {}),
    frameworkVersion: FRAMEWORK_VERSION,
    logger,
  });
}

main().catch((error) => {
  console.error(error && error.message ? error.message : error);
  process.exit(1);
});
