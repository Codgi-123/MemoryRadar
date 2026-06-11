import clsx from 'clsx'
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

export type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'gray'

const toneClasses: Record<Tone, string> = {
  blue: 'bg-accent-soft text-accent',
  green: 'bg-success-soft text-success',
  orange: 'bg-orange-soft text-orange',
  red: 'bg-danger-soft text-danger',
  purple: 'bg-purple-soft text-purple',
  gray: 'bg-line-soft text-subtle',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger'; size?: 'sm' | 'md' }) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-sm border font-sans font-medium transition disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'px-3 py-1.5 text-[0.8rem]' : 'px-4 py-2.5 text-[0.875rem]',
        variant === 'primary' && 'border-accent bg-accent text-white hover:border-accent-hover hover:bg-accent-hover',
        variant === 'secondary' && 'border-line bg-surface text-muted hover:bg-line-soft hover:text-text',
        variant === 'danger' && 'border-danger bg-danger text-white hover:border-red-700 hover:bg-red-700',
        className
      )}
      {...props}
    />
  )
}

export function Badge({ tone = 'gray', className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={clsx('inline-flex items-center rounded-full px-2.5 py-[3px] text-[0.75rem] font-medium', toneClasses[tone], className)}
      {...props}
    />
  )
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx('rounded border border-line bg-surface p-6 shadow-sm transition hover:shadow-md', className)}
      {...props}
    />
  )
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className={clsx('mb-8', actions && 'flex items-start justify-between gap-3')}>
      <div>
        <h1 className="text-[1.75rem] font-bold leading-tight tracking-normal text-text max-md:text-[1.4rem]">{title}</h1>
        {description && <p className="mt-1.5 text-[0.9rem] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap justify-end gap-2">{actions}</div>}
    </div>
  )
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        'w-full rounded-sm border border-line bg-surface px-3.5 py-2.5 font-sans text-[0.875rem] text-text outline-none transition placeholder:text-subtle focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)]',
        className
      )}
      {...props}
    />
  )
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={clsx(
        'w-full rounded-sm border border-line bg-surface px-3.5 py-2.5 font-sans text-[0.875rem] text-text outline-none transition focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)]',
        className
      )}
      {...props}
    />
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-[18px]">
      <label className="mb-1.5 block text-[0.82rem] font-medium text-text">{label}</label>
      {children}
    </div>
  )
}

export function Modal({
  title,
  children,
  actions,
  onClose,
  className,
}: {
  title?: string
  children: ReactNode
  actions?: ReactNode
  onClose: () => void
  className?: string
}) {
  return (
    <div className="fixed inset-0 z-[1000] flex animate-[fadeIn_150ms_ease] items-center justify-center bg-slate-900/40 backdrop-blur" onClick={onClose}>
      <div className={clsx('max-h-[85vh] w-[90%] max-w-[480px] animate-[slideUp_200ms_ease] overflow-y-auto rounded-lg bg-surface p-7 shadow-lg', className)} onClick={event => event.stopPropagation()}>
        {title && <h2 className="mb-5 text-[1.125rem] font-bold text-text">{title}</h2>}
        {children}
        {actions && <div className="mt-6 flex justify-end gap-2.5 border-t border-line-soft pt-4">{actions}</div>}
      </div>
    </div>
  )
}

export function EmptyState({ title, description, children }: { title?: string; description?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-[60px] text-center text-[0.9rem] text-muted">
      {children}
      {title && <h3 className="font-semibold text-text">{title}</h3>}
      {description && <p>{description}</p>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-sm bg-line', className)} />
}

export function Table({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('overflow-x-auto rounded border border-line bg-surface', className)} {...props} />
}
