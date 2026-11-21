// /api/sc routes (04 §7). Every handler runs behind requireAuth + requireSc; ctx comes only from the token.
import { Router } from 'express';
import { col } from '../db/index.js';
import { h, requireAuth } from '../util.js';
import { requireSc, type ScRequest } from './flag.js';
import { positions } from './repo.js';
import setup from './setup.js';
import { todayIST } from '../../../shared/sc/dates.js';

const router = Router();
router.use('/sc', requireAuth, requireSc);
router.use(setup);

/** Action chips and the Goods badge (03 §4.2). Late/confirm/dispute counts arrive with slices 1–2. */
router.get(
  '/sc/home',
  h(async (req: ScRequest, res) => {
    const disputes = await col('sc_discrepancies').countDocuments({ parties: req.ctx.businessId, state: { $in: ['open', 'proposed', 'countered'] } } as any);
    res.json({ today: todayIST(), chips: { late: 0, toConfirm: 0, disputes }, badge: disputes, role: req.ctx.role });
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
