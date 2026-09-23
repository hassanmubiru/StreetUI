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

import { ApplicationGraph } from '@streetui/graph';
import { AppBuilder } from './builders.js';

export interface AppOptions {
  readonly name: string;
  readonly version?: string;
}

export class StreetApp {
  private readonly _graph: ApplicationGraph;
  private readonly _builder: AppBuilder;

  constructor(options: AppOptions) {
    const graphOpts: { name: string; version?: string } = { name: options.name };
    if (options.version !== undefined) graphOpts.version = options.version;
    this._graph = new ApplicationGraph(graphOpts);
    this._builder = new AppBuilder(this._graph);
  }

  page(key: string, builder: Parameters<AppBuilder['page']>[1]): this {
    this._builder.page(key, builder);
    return this;
  }

  /** Compile to ApplicationGraph — validates and returns the graph. */
  build(): ApplicationGraph {
    const dc = this._graph.validate();
    dc.throwIfErrors();
    return this._graph;
  }

  /** Access graph before building (useful for inspection). */
  get graph(): ApplicationGraph {
    return this._graph;
  }
}

export interface StreetUI {
  app(options: AppOptions): StreetApp;
}

export const streetui: StreetUI = {
  app(options: AppOptions): StreetApp {
    return new StreetApp(options);
  },
};
