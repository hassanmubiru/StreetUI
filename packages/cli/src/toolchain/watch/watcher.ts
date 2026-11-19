/**
 * Recursive file watcher built on Node's `fs.watch`.
 *
 * `fs.watch` is not recursive on Linux, so we watch each directory individually
 * and add watchers for newly created directories. Events are debounced per path
 * so editors that write in multiple steps produce a single change.
 */

import { watch, type FSWatcher } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export interface Watcher {
  close(): void;
}

export interface WatchOptions {
  readonly root: string;
  readonly onChange: (file: string) => void;
  readonly ignored?: (file: string) => boolean;
  readonly debounceMs?: number;
}

const DEFAULT_IGNORED = [
  /(^|[/\\])node_modules([/\\]|$)/,
  /(^|[/\\])\.git([/\\]|$)/,
  /(^|[/\\])dist([/\\]|$)/,
  /(^|[/\\])\.turbo([/\\]|$)/,
  /(^|[/\\])\.cache([/\\]|$)/,
  /\.log$/,
];

export function watchRecursive(options: WatchOptions): Watcher {
  const watchers = new Map<string, FSWatcher>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const debounceMs = options.debounceMs ?? 60;
  const ignored = options.ignored ?? ((file: string) => DEFAULT_IGNORED.some((re) => re.test(file)));
  let closed = false;

  const emit = (file: string): void => {
    if (closed) return;
    const existing = timers.get(file);
    if (existing !== undefined) clearTimeout(existing);
    timers.set(
      file,
      setTimeout(() => {
        timers.delete(file);
        if (closed) return;
        try {
          if (statSync(file).isFile()) options.onChange(file);
        } catch {
          /* deleted before the timer fired */
        }
      }, debounceMs),
    );
  };

  const addDirectory = (dir: string): void => {
    if (closed || watchers.has(dir) || ignored(dir)) return;
    let watcher: FSWatcher;
    try {
      watcher = watch(dir, { persistent: true }, (_event, filename) => {
        const target = filename == null ? dir : join(dir, filename.toString());
        if (ignored(target)) return;
        try {
          if (statSync(target).isDirectory()) {
            addDirectory(target);
          } else {
            emit(target);
          }
        } catch {
          emit(target);
        }
      });
    } catch {
      return;
    }
    watcher.on('error', () => {
      watchers.delete(dir);
    });
    watchers.set(dir, watcher);

    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry);
      if (ignored(full)) continue;
      try {
        if (statSync(full).isDirectory()) addDirectory(full);
      } catch {
        /* ignore */
      }
    }
  };

  addDirectory(options.root);

  return {
    close() {
      closed = true;
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      for (const watcher of watchers.values()) watcher.close();
      watchers.clear();
    },
  };
}