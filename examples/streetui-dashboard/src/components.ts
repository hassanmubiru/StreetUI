/**
 * Reusable, typed components for the dashboard example. These use the public
 * `component()` primitive: setup runs once, props stay reactive, cleanup is
 * owned by the component.
 */
import { component, derived, type Signal, type ContainerDSL } from 'streetui';
import { style, cx } from 'streetui';

const cardClass = style({ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' });

export interface PageHeaderProps {
  readonly title: Signal<string>;
  readonly subtitle: Signal<string>;
}
export const PageHeader = component<PageHeaderProps>((props) => (scope: ContainerDSL) => {
  scope.section('page-header', (s) => {
    s.heading(props.title, { level: 2, class: style({ margin: 0, fontSize: '24px' }) });
    s.text(props.subtitle, { class: style({ color: 'var(--muted)', marginTop: '4px' }) });
  }, { class: style({ marginBottom: '20px' }) });
}, { name: 'PageHeader' });

export interface EmptyStateProps {
  readonly title: Signal<string>;
  readonly hint: Signal<string>;
}
export const EmptyState = component<EmptyStateProps>((props) => (scope: ContainerDSL) => {
  scope.section('empty', (s) => {
    s.text(props.title, { class: style({ fontWeight: 600 }) });
    s.text(props.hint, { class: style({ color: 'var(--muted)', marginTop: '4px' }) });
  }, { class: cx(cardClass, style({ textAlign: 'center', color: 'var(--muted)' })) });
}, { name: 'EmptyState' });
