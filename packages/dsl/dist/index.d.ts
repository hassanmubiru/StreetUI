import { ReadonlySignal, Signal } from '@streetui/state';
import { ApplicationGraph, GraphNode } from '@streetui/graph';

/**
 * StreetUI DSL type system.
 * All builder callbacks and option shapes live here.
 */

type Bindable<T> = T | ReadonlySignal<T> | Signal<T>;
interface TextOptions {
    readonly class?: string;
    readonly id?: string;
}
interface HeadingOptions extends TextOptions {
    readonly level?: 1 | 2 | 3 | 4 | 5 | 6;
}
interface ButtonOptions {
    readonly class?: string;
    readonly id?: string;
    readonly disabled?: Bindable<boolean>;
    readonly onClick?: () => void;
}
interface InputOptions {
    readonly class?: string;
    readonly id?: string;
    readonly type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search';
    readonly placeholder?: string;
    readonly value?: Bindable<string>;
    readonly disabled?: Bindable<boolean>;
    readonly onInput?: (value: string) => void;
    readonly onChange?: (value: string) => void;
}
interface LinkOptions {
    readonly class?: string;
    readonly id?: string;
    readonly href: string;
    readonly external?: boolean;
    readonly onClick?: () => void;
}
interface ImageOptions {
    readonly class?: string;
    readonly id?: string;
    readonly src: string;
    readonly alt: string;
    readonly width?: number;
    readonly height?: number;
}
interface ContainerOptions {
    readonly class?: string;
    readonly id?: string;
    readonly key?: string;
}
interface SectionOptions extends ContainerOptions {
}
interface FormOptions extends ContainerOptions {
    readonly onSubmit?: (e: Event) => void;
}
interface ListOptions extends ContainerOptions {
}
type SectionBuilder = (section: SectionDSL) => void;
type ContainerBuilder = (container: ContainerDSL) => void;
type PageBuilder = (page: PageDSL) => void;
type FormBuilder = (form: FormDSL) => void;
type ListBuilder = (list: ListDSL) => void;
interface ContentDSL {
    heading(text: Bindable<string>, options?: HeadingOptions): void;
    text(content: Bindable<string>, options?: TextOptions): void;
    button(label: Bindable<string>, options?: ButtonOptions): void;
    input(options?: InputOptions): void;
    image(options: ImageOptions): void;
    link(label: Bindable<string>, options: LinkOptions): void;
}
interface ContainerDSL extends ContentDSL {
    section(key: string, builder: SectionBuilder, options?: SectionOptions): void;
    container(key: string, builder: ContainerBuilder, options?: ContainerOptions): void;
    list(key: string, builder: ListBuilder, options?: ListOptions): void;
    form(key: string, builder: FormBuilder, options?: FormOptions): void;
}
interface SectionDSL extends ContainerDSL {
}
interface FormDSL extends ContainerDSL {
}
interface ListDSL extends ContentDSL {
    item(key: string, builder: ContainerBuilder, options?: ContainerOptions): void;
}
interface PageDSL extends ContainerDSL {
}
interface AppDSL {
    page(key: string, builder: PageBuilder): void;
}

/**
 * DSL builder implementations.
 *
 * Each builder wraps a GraphNode and provides the fluent API
 * for constructing the Semantic Application Graph via the DSL.
 *
 * Builders do NOT render anything — they only build the graph.
 */

declare class ContentBuilderBase implements ContentDSL {
    protected readonly _node: GraphNode;
    protected readonly _graph: ApplicationGraph;
    constructor(_node: GraphNode, _graph: ApplicationGraph);
    heading(text: Bindable<string>, options?: HeadingOptions): void;
    text(content: Bindable<string>, options?: TextOptions): void;
    button(label: Bindable<string>, options?: ButtonOptions): void;
    input(options?: InputOptions): void;
    image(options: ImageOptions): void;
    link(label: Bindable<string>, options: LinkOptions): void;
}
declare class ContainerBuilderBase extends ContentBuilderBase implements ContainerDSL {
    section(key: string, builder: SectionBuilder, options?: SectionOptions): void;
    container(key: string, builder: ContainerBuilder, options?: ContainerOptions): void;
    list(key: string, builder: ListBuilder, options?: ListOptions): void;
    form(key: string, builder: FormBuilder, options?: FormOptions): void;
}
declare class SectionBuilderImpl extends ContainerBuilderBase implements SectionDSL {
}
declare class ContainerBuilderImpl extends ContainerBuilderBase implements ContainerDSL {
}
declare class FormBuilderImpl extends ContainerBuilderBase implements FormDSL {
}
declare class ListBuilderImpl extends ContentBuilderBase implements ListDSL {
    item(key: string, builder: ContainerBuilder, options?: ContainerOptions): void;
}
declare class PageBuilderImpl extends ContainerBuilderBase implements PageDSL {
}
declare class AppBuilder implements AppDSL {
    private readonly _graph;
    constructor(_graph: ApplicationGraph);
    page(key: string, builder: PageBuilder): void;
}

/**
 * StreetUI DSL entry point.
 *
 * Usage:
 *   import { streetui } from '@streetui/dsl';
 *
 *   const app = streetui.app({ name: 'My App' });
 *   app.page('home', page => {
 *     page.section('hero', section => {
 *       section.heading('Welcome');
 *       section.button('Click me', { onClick: () => {} });
 *     });
 *   });
 *
 *   const graph = app.build();
 */

interface AppOptions {
    readonly name: string;
    readonly version?: string;
}
declare class StreetApp {
    private readonly _graph;
    private readonly _builder;
    constructor(options: AppOptions);
    page(key: string, builder: Parameters<AppBuilder['page']>[1]): this;
    /** Compile to ApplicationGraph — validates and returns the graph. */
    build(): ApplicationGraph;
    /** Access graph before building (useful for inspection). */
    get graph(): ApplicationGraph;
}
interface StreetUI {
    app(options: AppOptions): StreetApp;
}
declare const streetui: StreetUI;

export { AppBuilder, type AppDSL, type AppOptions, type Bindable, type ButtonOptions, type ContainerBuilder, ContainerBuilderImpl, type ContainerDSL, type ContainerOptions, type ContentDSL, type FormBuilder, FormBuilderImpl, type FormDSL, type FormOptions, type HeadingOptions, type ImageOptions, type InputOptions, type LinkOptions, type ListBuilder, ListBuilderImpl, type ListDSL, type ListOptions, type PageBuilder, PageBuilderImpl, type PageDSL, type SectionBuilder, SectionBuilderImpl, type SectionDSL, type SectionOptions, StreetApp, type StreetUI, type TextOptions, streetui };
