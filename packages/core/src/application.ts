/**
 * Top-level Application primitive.
 * Owns lifecycle, identity, and the root of the application graph.
 */

import { type ApplicationId, generateApplicationId } from './identity.js';
import { Lifecycle, CleanupRegistry } from './lifecycle.js';
import { Environment, environment as defaultEnvironment } from './environment.js';
import { DiagnosticCollector } from './diagnostics.js';

export interface ApplicationOptions {
  readonly name: string;
  readonly version?: string;
  readonly environment?: Environment;
}

export class Application {
  readonly id: ApplicationId;
  readonly name: string;
  readonly version: string;
  readonly lifecycle: Lifecycle;
  readonly cleanup: CleanupRegistry;
  readonly diagnostics: DiagnosticCollector;
  readonly environment: Environment;

  constructor(options: ApplicationOptions) {
    this.name = options.name;
    this.version = options.version ?? '0.0.1';
    this.id = generateApplicationId(options.name);
    this.lifecycle = new Lifecycle();
    this.cleanup = new CleanupRegistry();
    this.diagnostics = new DiagnosticCollector();
    this.environment = options.environment ?? defaultEnvironment;
  }

  async mount(): Promise<void> {
    if (this.lifecycle.phase !== 'created') {
      throw new Error(`Application "${this.name}" is already mounted (phase: ${this.lifecycle.phase})`);
    }
    await this.lifecycle.transition('mounted');
    await this.lifecycle.transition('active');
  }

  async unmount(): Promise<void> {
    if (!this.lifecycle.isMounted) {
      return;
    }
    await this.lifecycle.transition('unmounting');
    this.cleanup.run();
    await this.lifecycle.transition('destroyed');
  }

  onMount(fn: () => void | Promise<void>): void {
    this.lifecycle.onMount(fn);
  }

  onUnmount(fn: () => void | Promise<void>): void {
    this.lifecycle.onUnmount(fn);
  }
}

/** Factory convenience wrapper. */
export function createApplication(options: ApplicationOptions): Application {
  return new Application(options);
}
