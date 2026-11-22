#!/usr/bin/env python3
# S9 flow view smoke: plays a fresh mid-flight run for Murali Garments (scenario A accounts) and checks that every
# number on GET /api/sc/flow/style/:code reconciles with the underlying records (job detail, stock, movements,
# disputes), that an order's flow matches its order page, that staff are refused and other businesses see nothing.
# LOCAL dev server only (SC_ENABLED=1, MONGODB_DB=nexconn_sc_dev). Re-runnable: each run uses its own style and lots.
import json, urllib.request, uuid, sys, random, string, datetime
B = 'http://localhost:8787'  # local dev server only; never production
RUN = ''.join(random.choice(string.ascii_uppercase + string.digits) for _ in range(4))

def call(method, path, body=None, tok=None):
    req = urllib.request.Request(B + path, method=method, data=json.dumps(body).encode() if body is not None else None, headers={'content-type': 'application/json', **({'authorization': 'Bearer ' + tok} if tok else {})})
    try:
        with urllib.request.urlopen(req) as r: return r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')
cid = lambda: str(uuid.uuid4())
ok = True
def check(label, cond, extra=''):
    global ok
    ok = ok and bool(cond)
    print(('PASS ' if cond else 'FAIL ') + label + (f'  [{extra}]' if extra and not cond else ''))
def need(s, r, what):
    if s not in (200, 201): print(f'STOP {what}: {s} {r}'); sys.exit(1)
    return r
def login(phone):
    s, v = call('POST', '/api/auth/verify', {'phone': phone, 'otp': '123456'}); need(s, v, f'login {phone}')
    s, me = call('GET', '/api/me', tok=v['token']); u = me.get('user', me)
    return {'tok': v['token'], 'id': u['business_id']}

F, P, S1, S2, B1, B3, R = (login(p) for p in ('9000001001', '9000001005', '9000001006', '9000001007', '9000001008', '9000001010', '9000000004'))
biz = lambda x: {'k': 'b', 'id': x['id']}
def spec(mt, attrs, who):
    s, r = call('POST', '/api/sc/specs/resolve', {'material_type_id': mt, 'attrs': attrs}, who['tok']); need(s, r, f'spec {mt}'); return r['spec']['id']
def share(mv, who): call('POST', f'/api/sc/movements/{mv}/share-now', {}, who['tok'])
def confirm(mv, who, figures=None):
    s, m = call('GET', f'/api/sc/movements/{mv}', tok=who['tok']); need(s, m, 'open movement')
    return call('POST', f'/api/sc/movements/{mv}/confirm', {'lines': [{'line_id': l['line_id'], **((figures or {}).get(l['label'], {}))} for l in m['lines']]}, who['tok'])
def sender_ok(mv, who):
    s, m = call('GET', f'/api/sc/movements/{mv}', tok=who['tok'])
    call('POST', f'/api/sc/movements/{mv}/sender-figure', {'lines': [{'line_id': l['line_id']} for l in m['lines']]}, who['tok'])

today = datetime.date.fromisoformat(call('GET', '/api/sc/flow', tok=P['tok'])[1]['today'])
STYLE, LOT, PK = f'FL{RUN}', f'FN{RUN}', f'FP{RUN}'
print(f'run {RUN}: style {STYLE}')

# ── A mid-flight run ───────────────────────────────────────────────────────────────────────────
navy = spec('mt_knit_fabric', {'state': 'finished', 'structure': 'single jersey', 'gsm': 180, 'colour': 'navy'}, F)
s, t = call('POST', '/api/sc/movements/trade', {'kind': 'sell', 'party': biz(P), 'lines': [{'spec_id': navy, 'qty': 120, 'unit': 'kg', 'lot': LOT}], 'client_id': cid(), 'allow_untracked': True, 'untracked_reason': 'flow smoke opening stock'}, F['tok']); need(s, t, 'F sells fabric')
fabric_mv = t['movement']['id']; share(fabric_mv, F); confirm(fabric_mv, P)
kit = {z: spec('mt_kit', {'style': STYLE, 'colour': 'navy', 'size': z}, P) for z in ('S', 'M', 'L')}
gar = {z: spec('mt_garment', {'style': STYLE, 'colour': 'navy', 'size': z}, P) for z in ('S', 'M', 'L')}
pk = {z: spec('mt_packed_garment', {'style': STYLE, 'colour': 'navy', 'size': z, 'pack': 'single'}, P) for z in ('S', 'M')}
s, cut = call('POST', '/api/sc/made', {'process_key': 'cutting', 'inputs': [{'spec_id': navy, 'qty': 120, 'unit': 'kg', 'lot': LOT}], 'outputs': [{'spec_id': kit[z], 'qty': q, 'unit': 'pcs', 'lot': LOT} for z, q in (('S', 200), ('M', 200), ('L', 100))], 'waste': {'qty': 8, 'unit': 'kg'}, 'client_id': cid()}, P['tok']); need(s, cut, 'cut')
s, m1 = call('POST', '/api/sc/movements/send', {'to': biz(S1), 'process_key': 'stitching', 'lines': [{'spec_id': kit[z], 'qty': 200, 'unit': 'pcs', 'lot': LOT} for z in ('S', 'M')], 'client_id': cid()}, P['tok']); need(s, m1, 'send S1')
j1 = m1['job']['id']; share(m1['movement']['id'], P); confirm(m1['movement']['id'], S1)
past = lambda n: (today - datetime.timedelta(days=n)).isoformat()
s, m2 = call('POST', '/api/sc/movements/send', {'to': biz(S2), 'process_key': 'stitching', 'lines': [{'spec_id': kit['L'], 'qty': 100, 'unit': 'pcs', 'lot': LOT}], 'business_date': past(12), 'expected_at': past(5), 'client_id': cid()}, P['tok']); need(s, m2, 'send S2 (late)')
j2 = m2['job']['id']; share(m2['movement']['id'], P); confirm(m2['movement']['id'], S2)
s, r = call('POST', f'/api/sc/jobs/{j1}/return', {'lines': [{'spec_id': gar['S'], 'qty': 190, 'unit': 'pcs'}, {'spec_id': gar['S'], 'qty': 10, 'unit': 'pcs', 'grade': 'reject'}, {'spec_id': gar['M'], 'qty': 50, 'unit': 'pcs'}], 'last': False, 'client_id': cid()}, P['tok']); need(s, r, 'S1 part back')
share(r['movement']['id'], P); sender_ok(r['movement']['id'], S1)
s, pack = call('POST', '/api/sc/made', {'process_key': 'packing', 'inputs': [{'spec_id': gar['S'], 'qty': 150, 'unit': 'pcs'}, {'spec_id': gar['M'], 'qty': 50, 'unit': 'pcs'}], 'outputs': [{'spec_id': pk['S'], 'qty': 150, 'unit': 'pcs', 'lot': PK}, {'spec_id': pk['M'], 'qty': 50, 'unit': 'pcs', 'lot': PK}], 'client_id': cid()}, P['tok']); need(s, pack, 'pack')
s, d1 = call('POST', '/api/sc/movements/trade', {'kind': 'sell', 'party': biz(B1), 'lines': [{'spec_id': pk['S'], 'qty': 100, 'unit': 'pcs', 'lot': PK}, {'spec_id': pk['M'], 'qty': 20, 'unit': 'pcs', 'lot': PK}], 'client_id': cid()}, P['tok']); need(s, d1, 'sell B1')
share(d1['movement']['id'], P)
s, c1 = confirm(d1['movement']['id'], B1, {f'Navy {STYLE} S single · Packed goods': {'qty': 98, 'unit': 'pcs'}})
s, d3 = call('POST', '/api/sc/movements/trade', {'kind': 'sell', 'party': biz(B3), 'lines': [{'spec_id': pk['S'], 'qty': 30, 'unit': 'pcs', 'lot': PK}], 'client_id': cid()}, P['tok']); need(s, d3, 'sell B3')
share(d3['movement']['id'], P)  # Delhi has not confirmed: on the way

# ── The flow ───────────────────────────────────────────────────────────────────────────────────
s, idx = call('GET', '/api/sc/flow', tok=P['tok'])
check('the index lists the new style with 1 late job', s == 200 and any(r['code'] == STYLE and r['late'] == 1 and r['open'] == 2 for r in idx['runs']), [r for r in idx.get('runs', []) if r['code'] == STYLE])
s, f = call('GET', f'/api/sc/flow/style/{STYLE}', tok=P['tok'])
check('the flow opens for the owner', s == 200, s)
st = {x['key']: x for x in f['stages']}
check('stages in order: cutting → stitching → packing', [x['key'] for x in f['stages']] == ['cutting', 'stitching', 'packing'], [x['key'] for x in f['stages']])
mat = f['material']
check('material: 120 kg navy from Velan, lot matches, confirmed', len(mat) == 1 and mat[0]['qty'] == 120000 and mat[0]['lot'] == LOT and mat[0]['confirmed'] and mat[0]['movement_id'] == fabric_mv, mat)
cr = st['cutting']['rows'][0]
check('cutting (in-house): 120 kg in → 500 pcs made · 8 kg waste', cr['in_house'] and cr['sent'] == 120000 and cr['good'] == 500 and cr['out_dim'] == 'count' and cr['waste'] == 8000 and st['cutting']['outputs'] == [{'dim': 'count', 'qty': 500}], cr)

# Each external job row against the job page.
rows = {r['id']: r for r in st['stitching']['rows']}
for jid, exp in ((j1, (400, 240, 10, 150, 'in_progress')), (j2, (100, 0, 0, 100, 'late'))):
    r = rows[jid]
    s, det = call('GET', f'/api/sc/jobs/{jid}/detail', tok=P['tok'])
    seg_out = sum(x['qty'] for x in det['segments'] if x['kind'] == 'output')
    check(f"{r['name']}: flow row = job page (sent {det['issued']}, back {seg_out}, still there {det['pending']})", r['sent'] == det['issued'] and r['good'] + r['reject'] == seg_out and r['at_unit'] == det['pending'], (r, det['issued'], seg_out, det['pending']))
    check(f"{r['name']}: {exp[0]} sent · {exp[1]} back · {exp[2]} rejects · {exp[3]} still there · {exp[4]}", (r['sent'], r['good'], r['reject'], r['at_unit'], r['status']) == exp, (r['sent'], r['good'], r['reject'], r['at_unit'], r['status']))
check('the late job shows its days late and expected date', rows[j2]['late']['status'] == 'late' and rows[j2]['late']['days'] > 0 and rows[j2]['expected_at'] == past(5), rows[j2]['late'])
tot = st['stitching']['totals'][0]
check('stitching reconciles: 500 sent = 240 back + 10 rejects + 250 still there + 0 other', (tot['sent'], tot['good'], tot['reject'], tot['at_unit'], tot['loss']) == (500, 240, 10, 250, 0) and tot['sent'] == tot['good'] + tot['reject'] + tot['at_unit'] + tot['loss'], tot)
check('stitching stage is late (1 late, 2 open), sizes by unit', st['stitching']['status'] == 'late' and st['stitching']['late'] == 1 and st['stitching']['open'] == 2 and rows[j1]['sizes'] == [{'size': 'S', 'qty': 200}, {'size': 'M', 'qty': 200}], (st['stitching']['status'], rows[j1]['sizes']))
pt = st['packing']['totals'][0]
check('packing (in-house): 200 in = 200 packed', (pt['sent'], pt['good'], pt['at_unit']) == (200, 200, 0), pt)

# Buyers against the movements and the dispute.
def mov_sum(mv, who):
    m = call('GET', f'/api/sc/movements/{mv}', tok=who['tok'])[1]
    sent = sum(max([a['qty'] for a in l['sent'] if a['by'] == P['id']] or [0]) for l in m['lines'])
    recv = [max([a['qty'] for a in l['received'] if a['by'] and a['by'] != P['id']] or [0]) for l in m['lines'] if any(a['by'] and a['by'] != P['id'] for a in l['received'])]
    return sent, (sum(recv) if recv else None)
bu = {b['name']: b for b in f['buyers']}
k = next(b for b in f['buyers'] if b['party']['id'] == B1['id']); dl = next(b for b in f['buyers'] if b['party']['id'] == B3['id'])
ks, kr = mov_sum(d1['movement']['id'], P); ds, dr = mov_sum(d3['movement']['id'], P)
disp = [x for x in f['disputes'] if x['movement_id'] == d1['movement']['id']]
s, dl_list = call('GET', '/api/sc/disputes', tok=P['tok'])
check('Kolkata: 120 sent · 118 received (98 S + 20 M, its own count) · 2 pcs difference open', (k['sent'], k['received'], k['on_the_way'], k['disputed']) == (120, 118, 0, 2) and (ks, kr) == (120, 118), (k, ks, kr))
check('the difference is the open dispute on that dispatch', len(disp) == 1 and disp[0]['difference'] == 2 and disp[0]['id'] in {x['id'] for x in dl_list.get('disputes', [])}, disp)
check('Delhi: 30 sent, all on the way, waiting', (dl['sent'], dl['received'], dl['on_the_way'], dl['waiting']) == (30, 0, 30, True) and ds == 30 and dr is None, dl)
check('both buyers are counted as waiting (difference / on the way)', f['counts']['waiting'] == 2 and f['counts']['late'] == 1 and f['counts']['disputes'] == 1, f['counts'])

# Where everything is now, against stock.
stock = call('GET', '/api/sc/stock', tok=P['tok'])[1]['rows']
style_specs = set(kit.values()) | set(gar.values()) | set(pk.values())
st_good = sum(r['qty'] for r in stock if r['spec'] and r['spec']['id'] in style_specs and not r['with'] and r['grade'] not in ('reject', 'scrap'))
st_rej = sum(r['qty'] for r in stock if r['spec'] and r['spec']['id'] in style_specs and not r['with'] and r['grade'] in ('reject', 'scrap'))
now = f['now']
n = lambda kind, **kw: sum(x['qty'] for x in now if x['kind'] == kind and x['dim'] == 'count' and all(x.get(a) == v for a, v in kw.items()))
check(f'in your unit = stock list: {st_good} good + {st_rej} rejects (40 garments + 50 packed + 10 rejects)', n('in_stock', reject=False) == st_good == 90 and n('in_stock', reject=True) == st_rej == 10, (n('in_stock', reject=False), st_good, n('in_stock', reject=True), st_rej))
check('at units = Σ still there on the job pages (150 Priya + 100 Bharathi, late flagged)', n('at_unit') == 250 and any(x['kind'] == 'at_unit' and x['late'] and x['qty'] == 100 for x in now), now)
check('with buyers 118, on the way 30, 2 sent but not received (the open difference)', n('with_buyer') == 118 and n('on_the_way') == 30 and n('not_received') == 2, now)
total = n('at_unit') + n('in_stock') + n('with_buyer') + n('on_the_way') + n('not_received') + st['stitching']['totals'][0]['loss']
check('every one of the 500 cut pieces is accounted for (units + stock + buyers + on the way + not received + loss)', total == 500, total)
check('still to come back: the late job first, then the open one', [c['job_id'] for c in f['coming']] == [j2, j1] and [c['qty'] for c in f['coming']] == [100, 150], f['coming'])

# ── An order's flow matches its order page ─────────────────────────────────────────────────────
ri = call('GET', '/api/sc/flow', tok=R['tok'])[1]
if ri.get('orders'):
    o = ri['orders'][0]
    s, of = call('GET', f"/api/sc/flow/order/{o['id']}", tok=R['tok'])
    s2, og = call('GET', f"/api/sc/orders/{o['id']}/goods", tok=R['tok'])
    keys = ('ordered', 'sent', 'received', 'on_the_way', 'returned', 'done')
    check(f"order {o['code']}: flow order card = order page ({', '.join(f'{x} {og['progress'][x]}' for x in keys)})", s == 200 and s2 == 200 and all(of['order']['progress'][x] == og['progress'][x] for x in keys), (of.get('order'), og.get('progress')))
else:
    print('SKIP no order with goods for Ravi')

# ── Owner only; nobody else sees the run ───────────────────────────────────────────────────────
kphone = '96' + ''.join(random.choice(string.digits) for _ in range(8))
s, a = call('POST', '/api/sc/staff', {'name': f'Flow smoke {RUN}', 'phone': kphone}, P['tok']); need(s, a, 'add staff')
K = call('POST', '/api/auth/verify', {'phone': kphone, 'otp': '123456'})[1]['token']
codes = [call('GET', p, tok=K)[0] for p in ('/api/sc/flow', f'/api/sc/flow/style/{STYLE}', f"/api/sc/flow/order/{(ri.get('orders') or [{'id': 'x'}])[0]['id']}")]
check('staff are refused (403) on the index, a style and an order', codes == [403, 403, 403], codes)
call('DELETE', f"/api/sc/staff/{a['staff']['id']}", tok=P['tok'])
check("Priya (a stitcher in the run) can't open Murali's flow", call('GET', f'/api/sc/flow/style/{STYLE}', tok=S1['tok'])[0] == 404)
s, kf = call('GET', f'/api/sc/flow/style/{STYLE}', tok=B1['tok'])
check("Kolkata (a buyer) sees only its own 118 pcs of the style: none of Murali's jobs, buyers or material", s == 404 or (not kf['stages'] and not kf['buyers'] and not kf['material'] and not kf['coming'] and [(x['kind'], x['qty']) for x in kf['now']] == [('in_stock', 118)]), kf if s == 200 else s)
check("Murali can't open someone else's order flow", call('GET', f"/api/sc/flow/order/{(ri.get('orders') or [{'id': 'x'}])[0]['id']}", tok=P['tok'])[0] == 404)
print('\nALL PASS' if ok else '\nSOME FAILED')
sys.exit(0 if ok else 1)
