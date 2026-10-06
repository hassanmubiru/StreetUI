import { signal } from 'streetui';

// Mobile menu state
export const isMobileMenuOpen = signal(false);

export function toggleMobileMenu() {
  isMobileMenuOpen.set(!isMobileMenuOpen.get());
}

export function closeMobileMenu() {
  isMobileMenuOpen.set(false);
}
