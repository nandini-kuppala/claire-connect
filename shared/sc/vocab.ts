// v1 user vocabulary ↔ the model's internal purposes (02 §3.4.1, 03 S3 table).

export type V1Action = 'send_for_work' | 'return_from_work' | 'forward' | 'move' | 'buy_sell' | 'sample';

export type Purpose =
  | 'job_work_out' | 'job_work_return' | 'subcontract_out' | 'subcontract_return' | 'hop' | 'transfer'
  | 'purchase' | 'sale' | 'sale_in_place' | 'purchase_return' | 'sales_return' | 'sold_from_premises' | 'direct_delivery'
  | 'consignment_out' | 'consignment_return' | 'consignment_sale' | 'sample' | 'returnable_sample';

export interface ActionFlags {
  rework_of?: string;
  instructed_by_owner?: boolean;
  from_child_job?: boolean;
  in_place?: boolean;
  return?: 'credit' | 'replace';
  direction?: 'buy' | 'sell';
  from_job_worker_premises?: boolean;
  direct_to_job_worker?: boolean;
  returnable?: boolean;
}

/** Maps a v1 action + flags to the internal purpose the posting rules use. */
export function purposeOf(action: V1Action, f: ActionFlags = {}): Purpose {
  switch (action) {
    case 'send_for_work':
      return 'job_work_out';
    case 'return_from_work':
      return f.from_child_job ? 'subcontract_return' : 'job_work_return';
    case 'forward':
      return f.instructed_by_owner ? 'hop' : 'subcontract_out';
    case 'move':
      return 'transfer';
    case 'sample':
      return f.returnable ? 'returnable_sample' : 'sample';
    case 'buy_sell': {
      if (f.return) return f.direction === 'buy' ? 'purchase_return' : 'sales_return';
      if (f.in_place) return 'sale_in_place';
      if (f.from_job_worker_premises) return 'sold_from_premises';
      if (f.direct_to_job_worker) return 'direct_delivery';
      return f.direction === 'buy' ? 'purchase' : 'sale';
    }
  }
}

/** Purposes whose receipt changes ownership (title passes). */
export const TITLE_PASSES: ReadonlySet<Purpose> = new Set(['purchase', 'sale', 'sale_in_place', 'sold_from_premises', 'direct_delivery', 'sample', 'consignment_sale']);

/** Purposes that move goods into a job worker's custody for work. */
export const JOB_WORK_OUT: ReadonlySet<Purpose> = new Set(['job_work_out', 'subcontract_out', 'hop']);

/** The 4 v1 dispute outcomes (+ transporter for transit claims, 03 S8). */
export const OUTCOMES = ['accept_mine', 'accept_theirs', 'split', 'credit', 'transporter'] as const;
export type Outcome = (typeof OUTCOMES)[number];
