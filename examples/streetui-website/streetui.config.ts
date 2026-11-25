import { defineConfig } from 'streetui';

// Serve the real website entry through StreetUI's own dev toolchain.
export default defineConfig({
  clientEntry: 'src/browser-entry.ts',
});
