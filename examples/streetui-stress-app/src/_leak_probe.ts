// TEMPORARY leak probe (deleted after use). Simulates a client consumer that
// imports ONLY the styling authoring surface from the unified `streetui` barrel.
// If tree-shaking is correct, the browser bundle must contain NO server
// serializer, CLI, testing, or DevTools code.
import { style, cx, styleVariants, styleWithVars } from 'streetui';

const base = style({ color: 'var(--fg)', padding: 'var(--space-2)' });
const combined = cx(base, 'extra');
const button = styleVariants({
  base: { display: 'inline-flex' },
  variants: { intent: { primary: { color: 'white' }, ghost: { color: 'inherit' } } },
});
const withVars = styleWithVars({ color: 'var(--c)' }, { c: 'red' });

// Reference everything so nothing is dropped as unused *application* code.
globalThis.__probe = { base, combined, button: button({ intent: 'primary' }), withVars };
