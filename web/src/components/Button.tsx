import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { LoaderCircle, type LucideIcon } from '../icons';
import clsx from 'clsx';

export type ButtonVariant = 'primary' | 'secondary' | 'tint' | 'ghost' | 'danger' | 'success' | 'accent';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
  block?: boolean;
  children?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover active:bg-primary-press disabled:bg-primary-soft disabled:text-white/80',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-sunken active:bg-sunken disabled:text-faint',
  tint: 'bg-primary-tint text-primary hover:bg-primary-soft active:bg-primary-soft disabled:text-faint',
  ghost: 'bg-transparent text-primary hover:bg-primary-tint active:bg-primary-soft disabled:text-faint',
  danger: 'bg-surface text-danger border border-danger/30 hover:bg-danger-tint active:bg-danger-tint disabled:text-faint',
  success: 'bg-success text-white hover:brightness-95 active:brightness-90 disabled:bg-success-tint',
  accent: 'bg-accent text-ink hover:brightness-95 active:brightness-90 disabled:bg-accent-tint disabled:text-faint',
};

// Every size keeps a ≥44px touch target.
const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-11 px-3.5 py-1.5 text-[13px] gap-1.5 rounded-full',
  md: 'min-h-11 px-4.5 py-2 text-[15px] gap-2 rounded-full',
  lg: 'min-h-13 px-6 py-2.5 text-[16px] gap-2 rounded-full',
};

export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  block = false,
  className,
  children,
  disabled,
  type = 'button',
  ref,
  ...rest
}: ButtonProps) {
  const iconSize = size === 'sm' ? 16 : 18;
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        'inline-flex select-none items-center justify-center font-semibold leading-tight transition-[background-color,color,filter,transform] active:scale-[0.98]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <LoaderCircle size={iconSize} className="shrink-0 animate-spin" aria-hidden />
      ) : Icon ? (
        <Icon size={iconSize} className="shrink-0" aria-hidden />
      ) : null}
      {/* Labels wrap rather than truncate: Tamil and Hindi labels are often longer than English. */}
      {children != null && <span className="min-w-0 text-center break-words">{children}</span>}
      {IconRight && !loading && <IconRight size={iconSize} className="shrink-0" aria-hidden />}
    </button>
  );
}

export default Button;
