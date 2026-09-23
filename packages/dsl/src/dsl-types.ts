/**
 * StreetUI DSL type system.
 * All builder callbacks and option shapes live here.
 */

import type { Signal, ReadonlySignal } from '@streetui/state';

// A bound value can be a literal or a reactive signal
export type Bindable<T> = T | ReadonlySignal<T> | Signal<T>;

export interface TextOptions {
  readonly class?: string;
  readonly id?: string;
}

export interface HeadingOptions extends TextOptions {
  readonly level?: 1 | 2 | 3 | 4 | 5 | 6;
}

export interface ButtonOptions {
  readonly class?: string;
  readonly id?: string;
  readonly disabled?: Bindable<boolean>;
  readonly onClick?: () => void;
}

export interface InputOptions {
  readonly class?: string;
  readonly id?: string;
  readonly type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search';
  readonly placeholder?: string;
  readonly value?: Bindable<string>;
  readonly disabled?: Bindable<boolean>;
  readonly onInput?: (value: string) => void;
  readonly onChange?: (value: string) => void;
}

export interface LinkOptions {
  readonly class?: string;
  readonly id?: string;
  readonly href: string;
  readonly external?: boolean;
  readonly onClick?: () => void;
}

export interface ImageOptions {
  readonly class?: string;
  readonly id?: string;
  readonly src: string;
  readonly alt: string;
  readonly width?: number;
  readonly height?: number;
}

export interface ContainerOptions {
  readonly class?: string;
  readonly id?: string;
  readonly key?: string;
}

export interface SectionOptions extends ContainerOptions {}
export interface FormOptions extends ContainerOptions {
  readonly onSubmit?: (e: Event) => void;
}
export interface ListOptions extends ContainerOptions {}

// Builder callback types
export type SectionBuilder = (section: SectionDSL) => void;
export type ContainerBuilder = (container: ContainerDSL) => void;
export type PageBuilder = (page: PageDSL) => void;
export type FormBuilder = (form: FormDSL) => void;
export type ListBuilder = (list: ListDSL) => void;

// ── Interfaces for each DSL scope ─────────────────────────────────────────────

export interface ContentDSL {
  heading(text: Bindable<string>, options?: HeadingOptions): void;
  text(content: Bindable<string>, options?: TextOptions): void;
  button(label: Bindable<string>, options?: ButtonOptions): void;
  input(options?: InputOptions): void;
  image(options: ImageOptions): void;
  link(label: Bindable<string>, options: LinkOptions): void;
}

export interface ContainerDSL extends ContentDSL {
  section(key: string, builder: SectionBuilder, options?: SectionOptions): void;
  container(key: string, builder: ContainerBuilder, options?: ContainerOptions): void;
  list(key: string, builder: ListBuilder, options?: ListOptions): void;
  /**
   * Reactive list driven by a Signal<T[]>.
   * When the signal value changes, the list is reconciled against the new items.
   * The renderItem callback receives each item and a ContentDSL to build children.
   */
  listOf<T>(
    key: string,
    items: Signal<T[]> | ReadonlySignal<T[]>,
    renderItem: (item: T, index: number, content: ContentDSL) => void,
    options?: ListOptions,
  ): void;
  form(key: string, builder: FormBuilder, options?: FormOptions): void;
}

export interface SectionDSL extends ContainerDSL {}
export interface FormDSL extends ContainerDSL {}

export interface ListDSL extends ContentDSL {
  item(key: string, builder: ContainerBuilder, options?: ContainerOptions): void;
}

export interface PageDSL extends ContainerDSL {}

export interface AppDSL {
  page(key: string, builder: PageBuilder): void;
}
