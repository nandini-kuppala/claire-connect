import { ClipboardCheck } from '../icons';
import type { CardProps } from './types';
import { CardShell } from './ui';

/** Compact recap of what the user asked for (e.g. "1,000 track pants · ≤ ₹170 · Kolkata"). */
export function SummaryCard({ payload }: CardProps<'summary'>) {
  return (
    <CardShell className="flex items-start gap-3 px-4 py-3.5">
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
        <ClipboardCheck size={20} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-[1.4] font-semibold text-meta">{payload.title}</p>
        <ul className="mt-0.5 space-y-0.5">
          {payload.lines.map((line, i) => (
            <li key={i} className="text-[15px] leading-[1.45] font-semibold text-ink">
              {line}
            </li>
          ))}
        </ul>
      </div>
    </CardShell>
  );
}

export default SummaryCard;
