// Supply-chain collections' indexes (04 §3). Created only when SC_ENABLED=1, so the flag-off boot is unchanged.
import { col } from '../db/index.js';

export async function ensureScIndexes() {
  await Promise.all([
    col('sc_holdings').createIndex({ viewer_business_ids: 1, qty_base: 1 }),
    col('sc_holdings').createIndex({ 'key.owner.id': 1, 'key.custodian.id': 1 }),
    col('sc_holdings').createIndex({ 'key.custodian.id': 1, 'key.owner.id': 1 }),
    col('sc_movements').createIndex({ party_business_ids: 1, business_date: -1 }),
    col('sc_movements').createIndex({ 'lines.job_id': 1 }),
    col('sc_movements').createIndex({ recorder_business_id: 1, client_id: 1 }, { unique: true, partialFilterExpression: { client_id: { $type: 'string' } } }),
    col('sc_jobs').createIndex({ party_business_ids: 1, status: 1, expected_at: 1 }),
    col('sc_jobs').createIndex({ parent_job_id: 1 }),
    col('sc_jobs').createIndex({ hop_from_job_id: 1 }, { sparse: true }),
    col('sc_jobs').createIndex({ rework_of: 1 }, { sparse: true }),
    col('sc_holdings').createIndex({ 'key.state.ref': 1, 'key.state.s': 1 }, { sparse: true }),
    col('sc_discrepancies').createIndex({ 'refs.job_id': 1, state: 1 }),
    col('sc_postings').createIndex({ event_id: 1 }),
    col('sc_postings').createIndex({ 'key.owner.id': 1, business_date: 1 }),
    col('sc_events').createIndex({ business_id: 1, recorded_at: -1 }),
    col('sc_events').createIndex({ 'ref.kind': 1, 'ref.id': 1 }),
    col('sc_events').createIndex({ business_id: 1, client_id: 1 }, { unique: true, partialFilterExpression: { client_id: { $type: 'string' } } }),
    col('sc_discrepancies').createIndex({ parties: 1, state: 1 }),
    col('sc_prices').createIndex({ 'record.kind': 1, 'record.id': 1 }),
    col('sc_prices').createIndex({ parties: 1 }),
    col('sc_aliases').createIndex({ business_id: 1, alias: 1 }, { unique: true }),
    col('sc_contacts').createIndex({ owner_business_id: 1, phones: 1 }),
    col('sc_contacts').createIndex({ phones: 1 }),
    col('sc_statement_links').createIndex({ token_hash: 1 }, { unique: true }),
    col('sc_notify').createIndex({ sent_at: 1, due_at: 1 }),
    col('sc_drafts').createIndex({ purge_at: 1 }, { expireAfterSeconds: 0 }),
  ]);
}
