/**
 * TypeScript transformation for StreetUI's toolchain.
 *
 * Uses the TypeScript compiler API directly: no bundler, no second compiler.
 * `transpileModule` performs a single-file, type-checking-free transform, which
 * is exactly what the dev server and production builder need. Type checking
 * remains the responsibility of `tsc --noEmit`.
 */

import { readFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import * as ts from 'typescript';
import type { BuildProblem } from '../../diagnostics.js';
import type { ModuleKind } from '../resolve/resolver.js';

export interface SpecifierRef {
  readonly text: string;
  readonly dynamic: boolean;
}

export interface ResolveTarget {
  readonly url: string;
  readonly kind: ModuleKind;
  readonly id: string;
}

export interface TransformOptions {
  readonly fileName: string;
  readonly moduleId: string;
  readonly mode: 'development' | 'production';
  /** Resolve a specifier to a URL (and kind) for this module. */
  readonly resolve: (specifier: string) => ResolveTarget | undefined;
  /** Resolve a specifier to a canonical module id (for hot boundaries). */
  readonly resolveId?: (specifier: string) => string | undefined;
  /** Public build-time environment values. */
  readonly env?: Readonly<Record<string, string>>;
}

export interface TransformResult {
  readonly code: string;
  readonly sourceMap?: string;
  readonly diagnostics: readonly BuildProblem[];
  readonly dependencies: readonly string[];
  readonly usesHot: boolean;
}

/** Collect every static and dynamic module specifier in a source file. */
export function collectSpecifiers(source: string, fileName: string): SpecifierRef[] {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const refs: SpecifierRef[] = [];
  const push = (text: string, dynamic: boolean): void => {
    if (!refs.some((ref) => ref.text === text && ref.dynamic === dynamic)) refs.push({ text, dynamic });
  };

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      push(node.moduleSpecifier.text, false);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined && ts.isStringLiteral(node.moduleSpecifier)) {
      push(node.moduleSpecifier.text, false);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] !== undefined &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      push(node.arguments[0].text, true);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return refs;
}

export function usesHotApi(source: string): boolean {
  return /import\s*\.\s*meta\s*\.\s*hot/.test(source);
}

function defaultBinding(node: ts.ImportDeclaration): string | undefined {
  const clause = node.importClause;
  if (clause?.name === undefined) return undefined;
  return clause.name.text;
}

function findSpecifier(node: ts.Node): ts.StringLiteral | undefined {
  if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) return node.moduleSpecifier;
  if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined && ts.isStringLiteral(node.moduleSpecifier)) {
    return node.moduleSpecifier;
  }
  if (
    ts.isCallExpression(node) &&
    node.expression.kind === ts.SyntaxKind.ImportKeyword &&
    node.arguments[0] !== undefined &&
    ts.isStringLiteral(node.arguments[0])
  ) {
    return node.arguments[0];
  }
  return undefined;
}

function isImportMetaHot(node: ts.Node): boolean {
  return (
    ts.isPropertyAccessExpression(node) &&
    ts.isMetaProperty(node.expression) &&
    node.expression.keywordToken === ts.SyntaxKind.ImportKeyword &&
    node.name.text === 'hot'
  );
}

function isHotAcceptCall(node: ts.Node): node is ts.CallExpression {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === 'accept' &&
    isImportMetaHot(node.expression.expression) &&
    node.arguments[0] !== undefined &&
    ts.isStringLiteral(node.arguments[0])
  );
}

function envObjectLiteral(env: Readonly<Record<string, string>>): ts.Expression {
  const entries = Object.entries(env);
  if (entries.length === 0) return ts.factory.createObjectLiteralExpression();
  return ts.factory.createObjectLiteralExpression(
    entries.map(([key, value]) =>
      ts.factory.createPropertyAssignment(
        ts.factory.createStringLiteral(key),
        ts.factory.createStringLiteral(value),
      ),
    ),
  );
}

function isProcessEnvAccess(node: ts.Node): node is ts.PropertyAccessExpression {
  return (
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'process' &&
    node.name.text === 'env'
  );
}

function isProcessEnvMember(node: ts.Node): node is ts.PropertyAccessExpression {
  return (
    ts.isPropertyAccessExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === 'process' &&
    node.expression.name.text === 'env' &&
    ts.isIdentifier(node.name)
  );
}

export function toBuildProblems(
  diagnostics: readonly ts.Diagnostic[],
  source: string,
  fileName: string,
): BuildProblem[] {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const lines = source.split(/\r?\n/);
  const problems: BuildProblem[] = [];
  for (const diagnostic of diagnostics) {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    if (diagnostic.start === undefined) {
      problems.push({ message });
      continue;
    }
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(diagnostic.start);
    problems.push({
      message,
      file: fileName,
      line: line + 1,
      column: character + 1,
      lineText: lines[line] ?? '',
    });
  }
  return problems;
}

const COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  isolatedModules: true,
  sourceMap: true,
  inlineSources: true,
  useDefineForClassFields: true,
  esModuleInterop: true,
  forceConsistentCasingInFileNames: true,
  skipLibCheck: true,
  removeComments: false,
};

/**
 * Transform one TypeScript/JavaScript module.
 *
 * - Rewrites every resolvable import/export/dynamic-import specifier.
 * - Replaces `import.meta.hot` with a per-module hot context.
 * - Inlines `process.env.NODE_ENV` and public env vars.
 * - In production, removes CSS imports and replaces asset imports with strings.
 */
export function transformModule(source: string, options: TransformOptions): TransformResult {
  const { fileName, moduleId, mode, resolve } = options;
  const env = options.env ?? {};
  const specifiers = collectSpecifiers(source, fileName);
  const dependencies = specifiers.map((ref) => ref.text);
  const hot = usesHotApi(source);
  const assetDeclarations: string[] = [];

  const resolved = new Map<string, ResolveTarget | undefined>();
  for (const ref of specifiers) {
    if (!resolved.has(ref.text)) resolved.set(ref.text, resolve(ref.text));
  }

  const transformer = (context: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
    const factory = context.factory;

    const visitor = (node: ts.Node): ts.Node | undefined => {
      if (isImportMetaHot(node)) return factory.createIdentifier('__streetui_hot');

      if (isHotAcceptCall(node) && node.arguments[0] !== undefined && ts.isStringLiteral(node.arguments[0])) {
        const id = options.resolveId?.(node.arguments[0].text);
        const callee = factory.createPropertyAccessExpression(factory.createIdentifier('__streetui_hot'), 'accept');
        if (id !== undefined) {
          return factory.updateCallExpression(node, callee, node.typeArguments, [
            factory.createStringLiteral(id),
            ...node.arguments.slice(1),
          ]);
        }
        // No canonical id (production, or unresolved dep): keep the specifier.
        return factory.updateCallExpression(node, callee, node.typeArguments, node.arguments);
      }

      if (isProcessEnvMember(node)) {
        const name = node.name.text;
        if (name === 'NODE_ENV') {
          return factory.createStringLiteral(mode === 'production' ? 'production' : 'development');
        }
        if (name.startsWith('STREETUI_PUBLIC_') && env[name] !== undefined) {
          return factory.createStringLiteral(env[name] as string);
        }
        return factory.createIdentifier('undefined');
      }

      if (isProcessEnvAccess(node)) return envObjectLiteral(env);

      const specifier = findSpecifier(node);
      if (specifier !== undefined) {
        const target = resolved.get(specifier.text);
        if (target !== undefined) {
          if (mode === 'production' && (target.kind === 'css' || target.kind === 'asset')) {
            if (target.kind === 'asset' && ts.isImportDeclaration(node)) {
              const binding = defaultBinding(node);
              if (binding !== undefined) assetDeclarations.push(`const ${binding} = ${JSON.stringify(target.url)};`);
            }
            return undefined;
          }

          const replacement = factory.createStringLiteral(target.url);
          if (ts.isImportDeclaration(node)) {
            return factory.updateImportDeclaration(
              node,
              node.modifiers,
              node.importClause,
              replacement,
              node.assertClause,
            );
          }
          if (ts.isExportDeclaration(node)) {
            return factory.updateExportDeclaration(
              node,
              node.modifiers,
              node.isTypeOnly,
              node.exportClause,
              replacement,
              node.assertClause,
            );
          }
          if (ts.isCallExpression(node) && node.arguments[0] !== undefined) {
            return factory.updateCallExpression(
              node,
              node.expression,
              node.typeArguments,
              [replacement, ...node.arguments.slice(1)],
            );
          }
        }
      }

      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const first = node.arguments[0];
        if (first !== undefined && ts.isStringLiteral(first)) {
          const target = resolved.get(first.text);
          if (target !== undefined) {
            return factory.updateCallExpression(node, node.expression, node.typeArguments, [
              factory.createStringLiteral(target.url),
              ...node.arguments.slice(1),
            ]);
          }
        }
      }

      return ts.visitEachChild(node, visitor, context);
    };

    return (transformed) => ts.visitNode(transformed, visitor) as ts.SourceFile;
  };

  const result = ts.transpileModule(source, {
    compilerOptions: COMPILER_OPTIONS,
    fileName,
    reportDiagnostics: true,
    transformers: { before: [transformer] },
  });

  let code = result.outputText;
  if (hot) {
    const header =
      mode === 'development'
        ? `import { createHotContext as __streetui_createHotContext } from "/@streetui/client/hmr-runtime.js";\n` +
          `const __streetui_hot = __streetui_createHotContext(${JSON.stringify(moduleId)});\n`
        : `const __streetui_hot = { accept() {}, dispose() {} };\n`;
    code = `${header}${assetDeclarations.join('\n')}${assetDeclarations.length > 0 ? '\n' : ''}${code}`;
  } else if (assetDeclarations.length > 0) {
    code = `${assetDeclarations.join('\n')}\n${code}`;
  }

  return {
    code,
    ...(result.sourceMapText !== undefined ? { sourceMap: result.sourceMapText } : {}),
    diagnostics: toBuildProblems(result.diagnostics ?? [], source, fileName),
    dependencies,
    usesHot: hot,
  };
}

/** Read + transform a file from disk. */
export function transformFile(fileName: string, options: Omit<TransformOptions, 'fileName'>): TransformResult {
  return transformModule(readFileSync(fileName, 'utf8'), { ...options, fileName });
}

/** Build the inline source-map comment appended to transformed dev modules. */
export function inlineSourceMap(map: string): string {
  const encoded = Buffer.from(map, 'utf8').toString('base64');
  return `\n//# sourceMappingURL=data:application/json;base64,${encoded}`;
}

/** Build the external source-map comment for production output. */
export function externalSourceMap(outputFile: string): string {
  return `\n//# sourceMappingURL=${basename(outputFile)}.map`;
}

/** Replace the extension of a path (used for `.ts` → `.js` output names). */
export function withExtension(file: string, extension: string): string {
  const ext = extname(file);
  if (ext.length === 0) return `${file}${extension}`;
  return `${file.slice(0, -ext.length)}${extension}`;
}

/** The project-relative output path for a server module. */
export function serverOutputPath(root: string, file: string, entryFile: string): string {
  if (file === entryFile) return 'server.js';
  const relative = file.slice(root.length).replace(/^[/\\]/, '');
  return withExtension(relative, '.js').split('\\').join('/');
}

/** Relative import specifier from one output file to another. */
export function relativeOutputSpecifier(fromFile: string, toFile: string): string {
  const fromDir = dirname(resolve(fromFile));
  let relativePath = relative(fromDir, resolve(toFile));
  if (relativePath === '') relativePath = '.';
  else if (!relativePath.startsWith('.')) relativePath = `./${relativePath}`;
  return relativePath.split(sep).join('/');
}

/** Join two output paths. */
export function joinOutput(...parts: string[]): string {
  return join(...parts);
}