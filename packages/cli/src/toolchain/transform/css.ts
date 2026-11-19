/**
 * CSS and asset module shims used by the dev server.
 *
 * CSS imported from JavaScript becomes a tiny JS module that reuses one
 * `<style>` element per source module. Re-importing it after an HMR update
 * replaces the text in place, so CSS edits do not require a reload.
 */

import { createHash } from 'node:crypto';

function keyFor(id: string): string {
  return createHash('sha256').update(id).digest('hex').slice(0, 12);
}

export function cssToDevModule(css: string, id: string): string {
  const key = keyFor(id);
  return [
    `const __streetuiCss = ${JSON.stringify(css)};`,
    `const __streetuiKey = ${JSON.stringify(key)};`,
    `let __streetuiStyle = document.querySelector('style[data-streetui-css="' + __streetuiKey + '"]');`,
    `if (!__streetuiStyle) {`,
    `  __streetuiStyle = document.createElement('style');`,
    `  __streetuiStyle.setAttribute('data-streetui-css', __streetuiKey);`,
    `  document.head.appendChild(__streetuiStyle);`,
    `}`,
    `__streetuiStyle.textContent = __streetuiCss;`,
    `export {};`,
  ].join('\n');
}

export function assetToDevModule(url: string): string {
  return `export default ${JSON.stringify(url)};\n`;
}

/** A stable CSS URL used for HMR cache-busting. */
export function cssUrl(url: string, version: number): string {
  return `${url}?streetui=js&t=${version}`;
}

/** A stable asset URL module. */
export function assetUrl(url: string): string {
  return `${url}?streetui=url`;
}