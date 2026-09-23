/**
 * The full application UI, identical on server and browser. Uses every system:
 *   - signals        the counter
 *   - i18n           reactive translated title/greeting/labels + locale switch
 *   - context        ThemeContext consumed during build
 *   - forms          a validated sign-up form (name + email)
 *   - resource       a server-seedable user, shown when loaded
 */
import { type PageDSL } from '@streetui/dsl';
import { derived } from '@streetui/state';
import { ThemeContext, type AppDeps } from './deps.js';

export function buildApp(page: PageDSL, deps: AppDeps): void {
  const { count, i18n, form, user } = deps;
  const theme = ThemeContext.consume();

  const countLabel = derived(() => {
    // Reactive over both the counter and the active locale.
    i18n.locale.get();
    return i18n.translate('count', { count: count.get() });
  });
  const greeting = i18n.t('greeting', { name: 'world' });
  const loadedLabel = derived(() => {
    i18n.locale.get();
    const u = user.data.get();
    return u ? i18n.translate('loaded', { name: u.name }) : '';
  });

  page.heading(i18n.t('title'), { id: 'title' });
  page.text(`theme:${theme.name}`, { id: 'theme' });

  page.section('counter', (s) => {
    s.text(countLabel, { id: 'count' });
    s.button('+', { id: 'inc', onClick: () => count.set(count.peek() + 1) });
    s.button('lang', { id: 'lang', onClick: () => i18n.setLocale(i18n.locale.peek() === 'en' ? 'fr' : 'en') });
  });

  page.section('greeter', (s) => {
    s.text(greeting, { id: 'greeting' });
  });

  page.section('signup', (s) => {
    const name = form.field('name');
    const emailField = form.field('email');
    s.input({ id: 'name-input', bind: name.value, placeholder: 'name' });
    s.when(derived(() => name.touched.get() && !name.valid.get()), (b) =>
      b.text(derived(() => name.error.get() ?? ''), { id: 'name-error' }),
    );
    s.input({ id: 'email-input', bind: emailField.value, placeholder: 'email' });
    s.button(i18n.t('signup'), { id: 'submit', onClick: () => void form.submit() });
  });

  page.section('user', (s) => {
    s.when(derived(() => user.data.get() !== undefined), (b) =>
      b.text(loadedLabel, { id: 'user-loaded' }),
    );
  });
}
