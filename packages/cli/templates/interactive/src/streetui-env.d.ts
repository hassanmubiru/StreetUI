/**
 * StreetUI toolchain module declarations for the starter template.
 *
 * The dev server and production builder handle CSS, images, fonts, and other
 * static assets. These declarations make `tsc --noEmit` understand those
 * imports; they are type-only and have no runtime effect.
 */

declare module '*.css';
declare module '*.svg' {
  const src: string;
  export default src;
}
declare module '*.png' {
  const src: string;
  export default src;
}
declare module '*.jpg' {
  const src: string;
  export default src;
}
declare module '*.jpeg' {
  const src: string;
  export default src;
}
declare module '*.gif' {
  const src: string;
  export default src;
}
declare module '*.webp' {
  const src: string;
  export default src;
}
declare module '*.woff' {
  const src: string;
  export default src;
}
declare module '*.woff2' {
  const src: string;
  export default src;
}

interface ImportMeta {
  readonly hot?: {
    accept(callback: (module: unknown) => void): void;
    accept(dependency: string, callback: (module: unknown) => void): void;
    dispose(callback: () => void): void;
  };
}
