# Renderer contracts

These are the behavior guarantees that should remain true across renderer
changes. They are more important than any particular internal implementation.

## Node identity

- A keyed list reuses the DOM node associated with a key during reorder.
- A fine-grained signal update patches only subscribed output.
- Unrelated nodes are not recreated during a local update.

## Hydration

- Matching server nodes are adopted in place.
- A mismatch is repaired locally instead of forcing a global remount.
- Surplus server nodes are removed from the affected subtree.
- A successful hydration pass does not duplicate the server markup.

## Lifecycle and cleanup

- Unmount removes DOM event listeners and signal subscriptions.
- Route disposal runs route cleanup before the route subtree is removed.
- Resources created with owner cleanup are disposed when that owner leaves.
- Transitioned routes remain alive until their leave transition completes.

## Portals and overlays

- Portal content is removed with its owner.
- Dialog focus is trapped while open and restored when it closes when configured.
- Server rendering emits inert portal/overlay markup without browser-only focus work.

The renderer tests under `packages/renderer/src/` and the public integration tests
under `packages/testing/src/` are the executable evidence for these contracts.
