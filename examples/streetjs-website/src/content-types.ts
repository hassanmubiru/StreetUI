/**
 * StreetJS website — content model.
 *
 * Every entry is derived from facts recorded while inspecting the StreetJS
 * v1.2.8 type declarations. Nothing here is invented: if a capability was not
 * inspected it is either absent or explicitly labelled "not inspected".
 */

export interface CodeSample {
  readonly label: string;
  readonly language?: string;
  readonly code: string;
}

/** A block of page body. */
export type Block =
  | { readonly kind: 'p'; readonly text: string }
  | { readonly kind: 'h'; readonly text: string }
  | { readonly kind: 'list'; readonly items: readonly string[] }
  | { readonly kind: 'code'; readonly sample: CodeSample }
  | { readonly kind: 'warn'; readonly text: string };

export interface DocPage {
  readonly slug: string;
  readonly group: string;
  readonly title: string;
  readonly summary: string;
  readonly blocks: readonly Block[];
}

export interface GuidePage {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly level: 'Beginner' | 'Intermediate';
  readonly blocks: readonly Block[];
}

export interface ApiEntry {
  readonly name: string;
  readonly signature: string;
  readonly note: string;
}

export interface ApiGroup {
  readonly id: string;
  readonly importPath: string;
  readonly title: string;
  readonly summary: string;
  readonly entries: readonly ApiEntry[];
}

export interface ExampleItem {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly sample: CodeSample;
}

export interface PluginItem {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly status: string;
}

export interface ChangelogEntry {
  readonly version: string;
  readonly summary: string;
  readonly items: readonly string[];
}

export interface BlogPost {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly tag: string;
  readonly blocks: readonly Block[];
}

export type SearchKind = 'Docs' | 'Guide' | 'API' | 'Example' | 'Plugin' | 'Blog' | 'Changelog' | 'Page';

export interface SearchDoc {
  readonly title: string;
  readonly kind: SearchKind;
  readonly href: string;
  readonly summary: string;
  readonly keywords: string;
}

export interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly id: string;
  readonly exact?: boolean;
}
