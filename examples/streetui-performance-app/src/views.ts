/**
 * Route page builders. Each is a pure function of `(page, deps[, ctx])` that
 * uses only the unified `streetui` DSL — headings, text, buttons, inputs,
 * reactive `listOf`, conditional `when`, and an `errorBoundary`. The same
 * builders run on the server and the client.
 */
import { derived, type PageDSL } from 'streetui';
import type { RouteContext } from 'streetui';
import type { AppDeps } from './deps.js';
import type { Role, SortKey } from './data.js';

// ── / overview ────────────────────────────────────────────────────────────
export function buildOverview(page: PageDSL, deps: AppDeps): void {
  const { i18n } = deps;
  page.section('overview', (s) => {
    s.heading(i18n.t('navHome'), { id: 'overview-heading', level: 2 });
    s.text(derived(() => i18n.translate('totalUsers', { count: deps.totalCount.get() })), { id: 'overview-total' });
    s.text(derived(() => i18n.translate('avgScore', { score: deps.avgScore.get() })), { id: 'overview-avg' });
    s.link(i18n.t('navUsers'), { href: '/users', id: 'overview-go-users' });
  }, { id: 'route-overview' });
}

// ── /dashboard: derived metrics + notifications ─────────────────────────────
export function buildDashboard(page: PageDSL, deps: AppDeps): void {
  const { i18n, notifications } = deps;
  page.section('dashboard', (s) => {
    s.heading(i18n.t('navDashboard'), { id: 'dashboard-heading', level: 2 });

    s.section('metrics', (m) => {
      m.text(derived(() => i18n.translate('totalUsers', { count: deps.totalCount.get() })), { id: 'metric-total' });
      m.text(derived(() => i18n.translate('activeUsers', { count: deps.activeCount.get() })), { id: 'metric-active' });
      m.text(derived(() => i18n.translate('avgScore', { score: deps.avgScore.get() })), { id: 'metric-avg' });
      m.text(derived(() => `toggled:${deps.toggledCount.get()}`), { id: 'metric-toggled' });
    }, { id: 'dashboard-metrics' });

    s.button('notify', { id: 'dashboard-notify', onClick: () => deps.notify('event') });
    s.text(derived(() => `notifications:${notifications.get().length}`), { id: 'notify-count' });
    s.listOf('notifications', notifications, (n, _i, c) => {
      c.text(`#${n.id} ${n.text}`, { class: 'notification' });
    }, { id: 'notify-list' });
  }, { id: 'route-dashboard' });
}

// ── /users: search + filter + sort + 10k-row table + 1,000 controls ─────────
const ROLE_OPTIONS: (Role | 'all')[] = ['all', 'admin', 'editor', 'viewer'];
const SORT_OPTIONS: SortKey[] = ['id', 'name', 'role', 'status', 'score', 'team'];

export function buildUsers(page: PageDSL, deps: AppDeps): void {
  const { i18n, query, roleFilter, sortKey, sortDir, visibleRows } = deps;

  page.section('users', (s) => {
    s.heading(derived(() => i18n.translate('usersHeading', { count: deps.totalCount.get() })), {
      id: 'users-heading',
      level: 2,
    });

    // search — two-way bound to the query signal
    s.section('users-toolbar', (t) => {
      t.input({ id: 'users-search', bind: query, type: 'search', placeholder: i18n.translate('searchPlaceholder') });

      // role filter buttons
      for (const role of ROLE_OPTIONS) {
        t.button(role, { id: `filter-${role}`, onClick: () => roleFilter.set(role) });
      }

      // sort controls
      for (const key of SORT_OPTIONS) {
        t.button(`sort:${key}`, { id: `sort-${key}`, onClick: () => sortKey.set(key) });
      }
      t.button('dir', {
        id: 'sort-dir',
        onClick: () => sortDir.set(sortDir.peek() === 'asc' ? 'desc' : 'asc'),
      });
    }, { id: 'users-toolbar' });

    // the 10,000-row reactive keyed table — reconciled on any view change
    s.listOf('rows', visibleRows, (row, _i, c) => {
      c.text(`${row.id}`, { class: 'cell cell-id' });
      c.text(row.name, { class: 'cell cell-name' });
      c.text(row.email, { class: 'cell cell-email' });
      c.text(row.role, { class: 'cell cell-role' });
      c.text(row.status, { class: 'cell cell-status' });
      c.text(`${row.score}`, { class: 'cell cell-score' });
      c.text(row.team, { class: 'cell cell-team' });
    }, { id: 'users-table' });
  }, { id: 'route-users' });
}

// ── 1,000 interactive controls — each bound to its own signal ───────────────
export function buildControls(page: PageDSL, deps: AppDeps): void {
  page.section('controls', (s) => {
    s.heading('Controls', { id: 'controls-heading', level: 2 });
    s.text(derived(() => `toggled:${deps.toggledCount.get()}`), { id: 'controls-count' });
    s.section('controls-grid', (g) => {
      for (let i = 0; i < deps.controlsCount; i++) {
        const sig = deps.toggles[i]!;
        // Each control's label reacts to ONLY its own signal — toggling one
        // control mutates exactly one text node (fine-grained proof, §12).
        g.button(derived(() => (sig.get() ? 'on' : 'off')), {
          id: `toggle-${i}`,
          onClick: () => sig.set(!sig.peek()),
        });
      }
    }, { id: 'controls-grid' });
  }, { id: 'route-controls' });
}

// ── /settings: validated form + locale + modal ─────────────────────────────
export function buildSettings(page: PageDSL, deps: AppDeps): void {
  const { i18n, settingsForm: form, modalOpen } = deps;

  page.section('settings', (s) => {
    s.heading(i18n.t('settingsHeading'), { id: 'settings-heading', level: 2 });

    const name = form.field('displayName');
    const contact = form.field('contactEmail');

    s.form('settings-form', (f) => {
      f.input({ id: 'displayName', bind: name.value, placeholder: 'display name' });
      f.when(derived(() => name.touched.get() && !name.valid.get()), (b) =>
        b.text(derived(() => name.error.get() ?? ''), { id: 'displayName-error' }),
      );
      f.input({ id: 'contactEmail', bind: contact.value, type: 'email', placeholder: 'email' });
      f.when(derived(() => contact.touched.get() && !contact.valid.get()), (b) =>
        b.text(derived(() => contact.error.get() ?? ''), { id: 'contactEmail-error' }),
      );
      f.button(i18n.t('save'), { id: 'settings-save', disabled: derived(() => !form.valid.get()), onClick: () => void form.submit() });
      f.button(i18n.t('reset'), { id: 'settings-reset', onClick: () => form.reset() });
    }, { id: 'settings-form' });

    // modal / dialog — mounted reactively via `when`
    s.button(i18n.t('openModal'), { id: 'open-modal', onClick: () => modalOpen.set(true) });
    s.when(modalOpen, (m) => {
      m.section('modal', (d) => {
        d.text('Are you sure?', { id: 'modal-body' });
        d.button(i18n.t('confirm'), { id: 'modal-confirm', onClick: () => { deps.notify('confirmed'); modalOpen.set(false); } });
        d.button(i18n.t('cancel'), { id: 'modal-cancel', onClick: () => modalOpen.set(false) });
      }, { id: 'modal' });
    });
  }, { id: 'route-settings' });
}

// ── /users/:id: resource-driven detail with error boundary + retry ──────────
export function buildUserDetail(page: PageDSL, deps: AppDeps, ctx: RouteContext): void {
  const { i18n, userDetail } = deps;
  const id = Number(ctx.params.id ?? '0');

  // Cancel in-flight work + drop watchers when navigating away.
  ctx.onCleanup(() => userDetail.dispose());

  page.section('user-detail', (s) => {
    s.heading(derived(() => i18n.translate('detailHeading', { id })), { id: 'detail-heading', level: 2 });
    s.errorBoundary('detail-boundary', (b) => {
      b.when(userDetail.loading, (l) => l.text(i18n.t('loading'), { id: 'detail-loading' }));
      b.when(derived(() => userDetail.data.get() !== undefined), (d) =>
        d.text(derived(() => userDetail.data.get()?.name ?? ''), { id: 'detail-name' }),
      );
    }, {
      source: userDetail.error,
      onRetry: () => void userDetail.refetch(),
      fallback: (fb, _err, retry) => {
        fb.text('Failed to load user.', { id: 'detail-error' });
        fb.button(i18n.t('retry'), { id: 'detail-retry', onClick: retry });
      },
    });
  }, { id: 'route-detail' });
}
