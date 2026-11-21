// Status pill: text + colour + icon, never colour alone (ui-principles §2).
import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, Clock } from '../../icons';
import { RecS } from './Record.strings';

export interface Late { status: 'on_time' | 'due_today' | 'late'; days: number; reason: string | null }

export function Status({ late, className }: { late: Late; className?: string }) {
  const s = RecS.use();
  const Icon = late.status === 'late' ? AlertTriangle : late.status === 'due_today' ? Clock : CheckCircle2;
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] font-semibold', late.status === 'late' ? 'bg-danger-tint text-danger' : late.status === 'due_today' ? 'bg-accent-tint text-accent-ink' : 'bg-sunken text-ink-2', className)}>
      <Icon size={14} aria-hidden />
      {late.status === 'late' ? s('late', { n: late.days }) : late.status === 'due_today' ? s('due_today') : s('on_time')}
    </span>
  );
}
