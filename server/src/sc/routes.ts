// /api/sc routes (04 §7). Every handler runs behind requireAuth + requireSc; ctx comes only from the token.
import { Router } from 'express';
import { col } from '../db/index.js';
import { h, requireAuth } from '../util.js';
import { requireSc, type ScRequest } from './flag.js';
import { positions } from './repo.js';
import setup from './setup.js';
import records from './records.js';
import views from './views.js';
import { todayIST } from '../../../shared/sc/dates.js';
import { jobSummaries, toConfirmFor } from './views.js';
import disputes from './disputes.js';
import work from './work.js';
import jobs from './jobs.js';
import trade from './trade.js';
import adjust from './adjust.js';

const router = Router();
router.use('/sc', requireAuth, requireSc);
router.use(setup);
router.use(records);
router.use(views);
router.use(disputes);
router.use(work);
router.use(jobs);
router.use(trade);
router.use(adjust);

/** Action chips and the Goods badge (03 §4.2). Late/confirm/dispute counts arrive with slices 1–2. */
router.get(
  '/sc/home',
  h(async (req: ScRequest, res) => {
    const [disputes, jobs] = await Promise.all([
      col('sc_discrepancies').countDocuments({ parties: req.ctx.businessId, state: { $in: ['open', 'proposed', 'countered'] } } as any),
      jobSummaries(req.ctx),
    ]);
    const late = jobs.filter((j) => j.late.status === 'late' && j.pending > 0).length;
    const toConfirm = (await toConfirmFor(req.ctx)).length;
    res.json({ today: todayIST(), chips: { late, toConfirm, disputes }, badge: disputes + toConfirm, role: req.ctx.role });
  }),
);

/** Goods tabs: out (mine, elsewhere) · in (at my places) · coming (expected receipts; slice 1). */
router.get(
  '/sc/goods',
  h(async (req: ScRequest, res) => {
    const tab = req.query.tab === 'in' ? 'in' : req.query.tab === 'coming' ? 'coming' : 'out';
    const rows = tab === 'coming' ? [] : await positions(req.ctx, { tab });
    res.json({ tab, rows });
  }),
);

/** Built-in and own material/process templates (for pickers). */
router.get(
  '/sc/templates',
  h(async (req: ScRequest, res) => {
    const scope = { owner_business_id: { $in: [null, req.ctx.businessId] } } as any;
    const [materials, processes] = await Promise.all([col('sc_material_types').find(scope).sort({ owner_business_id: 1, order: 1 }).toArray(), col('sc_process_types').find(scope).sort({ owner_business_id: 1, order: 1 }).toArray()]);
    res.json({ materials, processes });
  }),
);

export default router;
