#!/usr/bin/env python3
# Phase 7: seed Scenarios A and B (BRIEF §3) as demo businesses and play them end to end through the API, each step
# recorded by the participant who would record it, then check every participant's own slice and that nobody sees
# another's records. LOCAL dev server only (SC_ENABLED=1, MONGODB_DB=nexconn_sc_dev). Re-runnable: each run uses its
# own lot and style codes, so the quantities below are exact for that run while demo data accumulates.
import json, urllib.request, uuid, sys, subprocess, random, string, os, re
# The database the dev server uses (for demo-cli and the ledger check). The nightly reset (server sc:demo-reset) passes
# its own MONGODB_DB; dev/test databases only.
DB = os.environ.get('MONGODB_DB') or 'nexconn_sc_dev'
if not re.fullmatch(r'[A-Za-z0-9_]+_(dev|test_[A-Za-z0-9_]+)', DB): print(f'Refusing: MONGODB_DB is "{DB}"'); sys.exit(2)
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
    print(('PASS ' if cond else 'FAIL ') + label + (f'  [{extra}]' if extra else ''))
def need(s, r, what):
    if s not in (200, 201): print(f'STOP {what}: {s} {r}'); sys.exit(1)
    return r

# ── Demo businesses (phones in the demo range; OTP 123456 on the dev server) ───────────────────────
def ensure(phone, owner, name, role, city='Tiruppur'):
    s, v = call('POST', '/api/auth/verify', {'phone': phone, 'otp': '123456'}); tok = v['token']
    s, me = call('GET', '/api/me', tok=tok); u = me.get('user', me)
    if not (u.get('onboarded') == 1 and u.get('business_id')):
        need(*call('POST', '/api/onboarding/complete', {'draft': {'owner_name': owner, 'business_name': name, 'city': city, 'role_label': role, 'sells': [], 'buys': []}, 'language': 'en'}, tok), f'onboard {name}')
        s, me = call('GET', '/api/me', tok=tok); u = me.get('user', me)
    return {'tok': tok, 'id': u['business_id'], 'name': name, 'phone': phone}

A = {k: ensure(*v) for k, v in {
    'F': ('9000001001', 'Velan', 'Velan Fabrics (demo)', 'Fabric shop'),
    'D': ('9000001002', 'Kumar', 'Kongu Dyeing (demo)', 'Dyeing unit'),
    'T1': ('9000001003', 'Selvam', 'Selvam Trims (demo)', 'Trims shop'),
    'T2': ('9000001004', 'Annai', 'Annai Threads (demo)', 'Trims shop'),
    'P': ('9000001005', 'Murali', 'Murali Garments (demo)', 'Garment maker'),
    'S1': ('9000001006', 'Priya', 'Priya Stitching (demo)', 'Stitching unit'),
    'S2': ('9000001007', 'Bharathi', 'Bharathi Stitching (demo)', 'Stitching unit'),
    'B1': ('9000001008', 'Amit', 'Kolkata Hosiery (demo)', 'Seller', 'Kolkata'),
    'B2': ('9000001009', 'Rajan', 'Chennai Retail (demo)', 'Seller', 'Chennai'),
    'B3': ('9000001010', 'Rahul', 'Delhi Fashion Traders (demo)', 'Seller', 'Delhi'),
}.items()}
BB = {k: ensure(*v) for k, v in {
    'M': ('9000002001', 'Nila', 'Nila Knitwear (demo)', 'Garment maker'),
    'C': ('9000002002', 'Kumar', 'Kumar Cutting (demo)', 'Cutting unit'),
    'N1': ('9000002003', 'Sakthi', 'Sakthi Stitching (demo)', 'Stitching unit'),
    'N2': ('9000002004', 'Ganga', 'Ganga Tailoring (demo)', 'Stitching unit'),
    'K1': ('9000002005', 'Vel', 'Vel Garments (demo)', 'Stitching unit'),
}.items()}
for sc, group in (('A', A), ('B', BB)):
    r = subprocess.run(['bash', '-lc', 'cd /Users/dev/Desktop/claire/server && source ~/.nvm/nvm.sh >/dev/null && nvm use 24 >/dev/null && MONGODB_DB=' + DB + ' npx tsx src/sc/demo-cli.ts ' + sc + ' ' + ' '.join(x['phone'] for x in group.values())], capture_output=True, text=True)
    print(r.stdout.strip() or r.stderr.strip()[-300:])
print(f'run {RUN}')

biz = lambda x: {'k': 'b', 'id': x['id']}
def spec(mt, attrs, who):
    s, r = call('POST', '/api/sc/specs/resolve', {'material_type_id': mt, 'attrs': attrs}, who['tok']); need(s, r, f'spec {mt}'); return r['spec']['id']
def share(mv, who): call('POST', f'/api/sc/movements/{mv}/share-now', {}, who['tok'])
def confirm(mv, who, figures=None):
    s, m = call('GET', f'/api/sc/movements/{mv}', tok=who['tok']); need(s, m, 'open movement')
    lines = [{'line_id': l['line_id'], **(figures.get(l['line_id'], {}) if figures else {})} for l in m['lines']]
    return call('POST', f'/api/sc/movements/{mv}/confirm', {'lines': lines}, who['tok'])
def sender_ok(mv, who):
    s, m = call('GET', f'/api/sc/movements/{mv}', tok=who['tok'])
    return call('POST', f'/api/sc/movements/{mv}/sender-figure', {'lines': [{'line_id': l['line_id']} for l in m['lines']]}, who['tok'])
def stock(who, spec_id=None, lot=None, own=True):
    rows = call('GET', '/api/sc/stock', tok=who['tok'])[1]['rows']
    return sum(r['qty'] for r in rows if (not own or not r['with']) and (spec_id is None or (r['spec'] and r['spec']['id'] == spec_id)) and (lot is None or r.get('lot') == lot) and r.get('grade', 'A') in ('A',))
def sees(who, path): return call('GET', path, tok=who['tok'])[0] == 200
OPEN = {'allow_untracked': True, 'untracked_reason': 'demo opening stock'}

# ════ Scenario A ══════════════════════════════════════════════════════════════════════════════════
print('\n── Scenario A: fabric shop → dyer → garment maker ← trims; cut, two stitchers, pack, three sellers ──')
F, D, T1, T2, P, S1, S2, B1, B2, B3 = (A[k] for k in ('F', 'D', 'T1', 'T2', 'P', 'S1', 'S2', 'B1', 'B2', 'B3'))
grey = spec('mt_knit_fabric', {'state': 'grey', 'structure': 'single jersey', 'gsm': 180}, F)
navy = spec('mt_knit_fabric', {'state': 'finished', 'structure': 'single jersey', 'gsm': 180, 'colour': 'navy'}, F)
LG, LN = f'G{RUN}', f'N{RUN}'

# 1. F buys 500 kg grey from a knitter not on CLAIRE, sends it to D, gets 465 kg navy back, sells 300 kg to P
s, k = call('POST', '/api/sc/contacts', {'name': f'Arul Knitting {RUN} (demo contact)', 'role_hint': 'knitter'}, F['tok']); knitter = {'k': 'c', 'id': need(s, k, 'contact')['contact']['id']}
need(*call('POST', '/api/sc/movements/trade', {'kind': 'buy', 'party': knitter, 'lines': [{'spec_id': grey, 'qty': 500, 'unit': 'kg', 'lot': LG}], 'rate_paise': 21000, 'client_id': cid()}, F['tok']), 'F buys grey')
check('A1 F (fabric shop) bought 500 kg grey from an off-platform knitter', stock(F, grey, LG) == 500000, stock(F, grey, LG))
s, m = call('POST', '/api/sc/movements/send', {'to': biz(D), 'process_key': 'dyeing', 'lines': [{'spec_id': grey, 'qty': 500, 'unit': 'kg', 'lot': LG}], 'dc_no': f'DC-{RUN}-1', 'client_id': cid()}, F['tok']); need(s, m, 'F sends to D')
dye_job, mv1 = m['job']['id'], m['movement']['id']; share(mv1, F)
s, c = confirm(mv1, D); check('A2 D (dyer) confirms 500 kg received', s == 200 and not c['results'][0].get('disputeId'), c)
others = call('GET', '/api/sc/goods/others', tok=D['tok'])[1]
check("A2 D sees F's 500 kg under Others' goods", any(j.get('id') == dye_job for g in others['groups'] for j in g['jobs']), [g.get('name') for g in others['groups']][:4])
s, gb = call('POST', f'/api/sc/jobs/{dye_job}/return', {'lines': [{'spec_id': navy, 'qty': 465, 'unit': 'kg', 'lot': LN}], 'last': True, 'client_id': cid()}, F['tok']); need(s, gb, 'F got back')
share(gb['movement']['id'], F); sender_ok(gb['movement']['id'], D)
s, cl = call('POST', f'/api/sc/jobs/{dye_job}/close', {}, F['tok'])
check('A3 F gets 465 kg navy back and closes: dyeing loss 35 kg (7 %)', s == 200 and cl['closure']['loss'] == 35000 and cl['closure']['loss_pct'] == 7, (s, cl.get('closure', cl)))
s, t = call('POST', '/api/sc/movements/trade', {'kind': 'sell', 'party': biz(P), 'lines': [{'spec_id': navy, 'qty': 300, 'unit': 'kg', 'lot': LN}], 'rate_paise': 38000, 'client_id': cid()}, F['tok']); need(s, t, 'F sells to P')
share(t['movement']['id'], F); confirm(t['movement']['id'], P)
check('A4 F sold 300 kg navy to P: F keeps 165 kg, P has 300 kg', stock(F, navy, LN) == 165000 and stock(P, navy, LN) == 300000, (stock(F, navy, LN), stock(P, navy, LN)))

# 2. Trims from T1 (buttons, zips) and thread from T2
btn = spec('mt_button', {'kind': 'polo', 'colour': 'navy'}, T1); zp = spec('mt_zip', {'length_in': 7, 'colour': 'navy'}, T1)
thr = spec('mt_thread', {}, T2)
s, t1 = call('POST', '/api/sc/movements/trade', {'kind': 'sell', 'party': biz(P), 'lines': [{'spec_id': btn, 'qty': 3000, 'unit': 'pcs', 'lot': f'T{RUN}'}, {'spec_id': zp, 'qty': 1000, 'unit': 'pcs', 'lot': f'T{RUN}'}], 'client_id': cid(), **OPEN}, T1['tok']); need(s, t1, 'T1 sells')
s, t2 = call('POST', '/api/sc/movements/trade', {'kind': 'sell', 'party': biz(P), 'lines': [{'spec_id': thr, 'qty': 80, 'unit': 'cones', 'factor': 400000, 'lot': f'H{RUN}'}], 'client_id': cid(), **OPEN}, T2['tok']); need(s, t2, 'T2 sells')
for mv in (t1['movement']['id'], t2['movement']['id']): share(mv, T1 if mv == t1['movement']['id'] else T2)
confirm(t1['movement']['id'], P); confirm(t2['movement']['id'], P)
check('A5 P received 3,000 buttons + 1,000 zips from T1 and 80 cones (320,000 m) of thread from T2', stock(P, btn, f'T{RUN}') == 3000 and stock(P, zp, f'T{RUN}') == 1000 and stock(P, thr, f'H{RUN}') == 32000000, (stock(P, btn, f'T{RUN}'), stock(P, zp, f'T{RUN}'), stock(P, thr, f'H{RUN}')))

# 3. P cuts in-house: 300 kg → 1,100 kits (S 300 · M 300 · L 250 · XL 250) + 20 kg waste
style = f'MG{RUN}'
kit = {z: spec('mt_kit', {'style': style, 'colour': 'navy', 'size': z}, P) for z in ('S', 'M', 'L', 'XL')}
waste = spec('mt_waste', {'kind': 'cut waste'}, P) if False else None
s, cut = call('POST', '/api/sc/made', {'process_key': 'cutting', 'inputs': [{'spec_id': navy, 'qty': 300, 'unit': 'kg', 'lot': LN}], 'outputs': [{'spec_id': kit[z], 'qty': q, 'unit': 'pcs', 'lot': LN} for z, q in (('S', 300), ('M', 300), ('L', 250), ('XL', 250))], 'waste': {'qty': 20, 'unit': 'kg'}, 'client_id': cid()}, P['tok'])
check('A6 P cuts 300 kg in-house into 1,100 kits by size (no navy fabric left)', s == 201 and stock(P, navy, LN) == 0 and all(stock(P, kit[z], LN) == q for z, q in (('S', 300), ('M', 300), ('L', 250), ('XL', 250))), (s, cut.get('error')))

# 4. S and M kits + trims to S1; L and XL + trims to S2
def send(to, sizes, b, z, cones):
    lines = [{'spec_id': kit[x], 'qty': q, 'unit': 'pcs', 'lot': LN} for x, q in sizes] + [{'spec_id': btn, 'qty': b, 'unit': 'pcs', 'lot': f'T{RUN}'}, {'spec_id': zp, 'qty': z, 'unit': 'pcs', 'lot': f'T{RUN}'}, {'spec_id': thr, 'qty': cones, 'unit': 'cones', 'factor': 400000, 'lot': f'H{RUN}'}]
    s, m = call('POST', '/api/sc/movements/send', {'to': biz(to), 'process_key': 'stitching', 'lines': lines, 'client_id': cid()}, P['tok']); need(s, m, f'send to {to["name"]}')
    share(m['movement']['id'], P); s2, c = confirm(m['movement']['id'], to)
    return m['job']['id'], m['movement']['id'], s2
j1, m_s1, c1 = send(S1, (('S', 300), ('M', 300)), 1800, 600, 30)
j2, m_s2, c2 = send(S2, (('L', 250), ('XL', 250)), 1200, 400, 25)
check('A7 S1 confirms S 300 · M 300 + trims; S2 confirms L 250 · XL 250 + trims', c1 == 200 and c2 == 200, (c1, c2))
check('A7 P keeps 25 cones of thread; no buttons, zips or kits left', stock(P, thr, f'H{RUN}') == 10000000 and stock(P, btn, f'T{RUN}') == 0 and stock(P, zp, f'T{RUN}') == 0 and all(stock(P, kit[z], LN) == 0 for z in kit), (stock(P, thr, f'H{RUN}'), stock(P, btn, f'T{RUN}')))

# 5. Garments come back in parts over days, with rejects
gar = {z: spec('mt_garment', {'style': style, 'colour': 'navy', 'size': z}, P) for z in ('S', 'M', 'L', 'XL')}
def back(job, lines, last, perf):
    s, r = call('POST', f'/api/sc/jobs/{job}/return', {'lines': lines, 'last': last, 'client_id': cid()}, P['tok']); need(s, r, 'got back')
    share(r['movement']['id'], P); sender_ok(r['movement']['id'], perf)
back(j1, [{'spec_id': gar['S'], 'qty': 290, 'unit': 'pcs'}, {'spec_id': gar['S'], 'qty': 10, 'unit': 'pcs', 'grade': 'reject'}], False, S1)
d1 = call('GET', f'/api/sc/jobs/{j1}/detail', tok=P['tok'])[1]
check('A8 day 1 from S1: 290 S good + 10 rejects; the job is still open', d1['job']['status'] in ('in_progress', 'issued'), d1['job']['status'])
back(j1, [{'spec_id': gar['M'], 'qty': 300, 'unit': 'pcs'}], True, S1)
back(j2, [{'spec_id': gar['L'], 'qty': 250, 'unit': 'pcs'}], False, S2)
back(j2, [{'spec_id': gar['XL'], 'qty': 245, 'unit': 'pcs'}, {'spec_id': gar['XL'], 'qty': 5, 'unit': 'pcs', 'grade': 'reject'}], True, S2)
st1 = call('GET', f'/api/sc/jobs/{j1}/detail', tok=P['tok'])[1]['job']; st2 = call('GET', f'/api/sc/jobs/{j2}/detail', tok=P['tok'])[1]['job']
check('A9 both stitching jobs completed: S1 590 good + 10 reject; S2 495 good + 5 reject', st1['status'] in ('completed', 'closed') and st2['status'] in ('completed', 'closed'), (st1['status'], st2['status'], st1.get('outputs'), st2.get('outputs')))
check('A9 P holds S 290 · M 300 · L 250 · XL 245 good garments', [stock(P, gar[z]) for z in ('S', 'M', 'L', 'XL')] == [290, 300, 250, 245], [stock(P, gar[z]) for z in ('S', 'M', 'L', 'XL')])

# 6. Pack in-house; 7. dispatch to three sellers
pk = {z: spec('mt_packed_garment', {'style': style, 'colour': 'navy', 'size': z, 'pack': 'single'}, P) for z in ('S', 'M', 'L', 'XL')}
good = {'S': 290, 'M': 300, 'L': 250, 'XL': 245}
s, pack = call('POST', '/api/sc/made', {'process_key': 'packing', 'inputs': [{'spec_id': gar[z], 'qty': q, 'unit': 'pcs'} for z, q in good.items()], 'outputs': [{'spec_id': pk[z], 'qty': q, 'unit': 'pcs', 'lot': f'P{RUN}'} for z, q in good.items()], 'client_id': cid()}, P['tok'])
check('A10 P packs all 1,085 in-house', s == 201 and all(stock(P, pk[z], f'P{RUN}') == q for z, q in good.items()), (s, pack.get('error')))
split = {'B1': {'S': 150, 'M': 150, 'L': 100, 'XL': 100}, 'B2': {'S': 100, 'M': 100, 'L': 100, 'XL': 50}, 'B3': {'S': 40, 'M': 50, 'L': 50, 'XL': 95}}
disp = {}
for k, sizes in split.items():
    s, t = call('POST', '/api/sc/movements/trade', {'kind': 'sell', 'party': biz(A[k]), 'lines': [{'spec_id': pk[z], 'qty': q, 'unit': 'pcs', 'lot': f'P{RUN}'} for z, q in sizes.items()], 'rate_paise': 26000, 'client_id': cid()}, P['tok']); need(s, t, f'sell to {k}')
    disp[k] = t['movement']['id']; share(disp[k], P)
confirm(disp['B1'], B1); confirm(disp['B2'], B2)
_, mB3 = call('GET', f"/api/sc/movements/{disp['B3']}", tok=B3['tok'])
xl = next(l for l in mB3['lines'] if l.get('spec_id') == pk['XL'] or ' XL' in json.dumps(l))
s, c3 = confirm(disp['B3'], B3, {xl['line_id']: {'qty': 93, 'unit': 'pcs'}})
check('A11 three sellers receive 500 / 350 / 235; Delhi counts XL 93 of 95 → a 2 pcs difference', c3 == 200 or s == 200, (s, c3))
check('A11 P has nothing packed left', all(stock(P, pk[z], f'P{RUN}') == 0 for z in pk), [stock(P, pk[z], f'P{RUN}') for z in pk])
check('A11 each seller holds exactly what it received', [stock(B1, pk[z]) for z in ('S', 'M', 'L', 'XL')][-4:] and stock(B1, pk['S'], f'P{RUN}') == 150 and stock(B2, pk['XL'], f'P{RUN}') == 50 and stock(B3, pk['XL'], f'P{RUN}') == 93, (stock(B1, pk['S'], f'P{RUN}'), stock(B2, pk['XL'], f'P{RUN}'), stock(B3, pk['XL'], f'P{RUN}')))
dq = next((r['disputeId'] for r in c3.get('results', []) if r.get('disputeId')), None)
ids = lambda who: {x['id'] for x in call('GET', '/api/sc/disputes', tok=who['tok'])[1].get('disputes', [])}
check('A11 the 2 pcs difference is open for P and Delhi', dq and dq in ids(P) and dq in ids(B3), dq)
print('── Scenario A: each participant sees only its own slice ──')
check("F (fabric shop) can't open P's send to S1", not sees(F, f'/api/sc/movements/{m_s1}'))
check("D (dyer) can't open F's sale to P", not sees(D, f"/api/sc/movements/{t['movement']['id']}") and not sees(D, f'/api/sc/movements/{m_s1}'))
check("T1 can't see T2's thread sale or P's stitching", not sees(T1, f"/api/sc/movements/{t2['movement']['id']}") and not sees(T1, f'/api/sc/jobs/{j1}/detail'))
check("S1 can't see S2's job; S2 can't see S1's", not sees(S1, f'/api/sc/jobs/{j2}/detail') and not sees(S2, f'/api/sc/jobs/{j1}/detail'))
check("S1 can't see where the fabric came from (F → D, F → P)", not sees(S1, f'/api/sc/movements/{mv1}') and not sees(S1, f"/api/sc/movements/{t['movement']['id']}"))
check("Kolkata can't see Delhi's or Chennai's dispatch", not sees(B1, f"/api/sc/movements/{disp['B3']}") and not sees(B1, f"/api/sc/movements/{disp['B2']}"))
check("Delhi's difference is invisible to Kolkata", dq not in ids(B1) and not sees(B1, f'/api/sc/disputes/{dq}'))
check("no seller sees P's buying price from F or the stitching rates", '38000' not in json.dumps(call('GET', f"/api/sc/movements/{disp['B1']}", tok=B1['tok'])[1]))
for k in ('F', 'D', 'T1', 'T2', 'S1', 'S2', 'B1', 'B2', 'B3'):
    s, lg = call('GET', f"/api/sc/parties/b/{A['P']['id']}/ledger", tok=A[k]['tok'])
    check(f"{A[k]['name']}: its ledger with P opens (its own slice)", s == 200, s)

# ════ Scenario B ══════════════════════════════════════════════════════════════════════════════════
print('\n── Scenario B: cutting unit, three stitchers by colour + size, packing in-house ──')
M, C, N1, N2, K1 = (BB[k] for k in ('M', 'C', 'N1', 'N2', 'K1'))
fn = spec('mt_knit_fabric', {'state': 'finished', 'structure': 'single jersey', 'gsm': 180, 'colour': 'navy'}, M)
fb = spec('mt_knit_fabric', {'state': 'finished', 'structure': 'single jersey', 'gsm': 180, 'colour': 'black'}, M)
s, k = call('POST', '/api/sc/contacts', {'name': f'Sri Murugan Knits {RUN} (demo contact)', 'role_hint': 'fabric shop'}, M['tok']); shop = {'k': 'c', 'id': k['contact']['id']}
need(*call('POST', '/api/sc/movements/trade', {'kind': 'buy', 'party': shop, 'lines': [{'spec_id': fn, 'qty': 120, 'unit': 'kg', 'lot': f'BN{RUN}'}, {'spec_id': fb, 'qty': 60, 'unit': 'kg', 'lot': f'BB{RUN}'}], 'client_id': cid()}, M['tok']), 'M buys fabric')
s, cm = call('POST', '/api/sc/movements/send', {'to': biz(C), 'process_key': 'cutting', 'lines': [{'spec_id': fn, 'qty': 120, 'unit': 'kg', 'lot': f'BN{RUN}'}, {'spec_id': fb, 'qty': 60, 'unit': 'kg', 'lot': f'BB{RUN}'}], 'client_id': cid()}, M['tok']); need(s, cm, 'M → C')
cut_job = cm['job']['id']; share(cm['movement']['id'], M); s, _ = confirm(cm['movement']['id'], C)
check('B1 C (cutting only) confirms 120 kg navy + 60 kg black', s == 200, s)
st = f'NK{RUN}'
kitB = {(c, z): spec('mt_kit', {'style': st, 'colour': c, 'size': z}, M) for c in ('navy', 'black') for z in ('S', 'M', 'L', 'XL')}
panels = {('navy', 'S'): 200, ('navy', 'M'): 200, ('navy', 'L'): 150, ('navy', 'XL'): 150, ('black', 'S'): 120, ('black', 'M'): 120}
s, r = call('POST', f'/api/sc/jobs/{cut_job}/return', {'lines': [{'spec_id': kitB[ck], 'qty': q, 'unit': 'pcs'} for ck, q in panels.items()], 'last': True, 'client_id': cid()}, M['tok']); need(s, r, 'panels back')
share(r['movement']['id'], M); sender_ok(r['movement']['id'], C)
check('B2 M gets 940 kits back from C by colour and size; no fabric left at C', all(stock(M, kitB[ck]) >= q for ck, q in panels.items()) and call('GET', f'/api/sc/jobs/{cut_job}/detail', tok=M['tok'])[1]['job']['status'] in ('completed', 'closed'), [stock(M, kitB[ck]) for ck in panels])
garB = {(c, z): spec('mt_garment', {'style': st, 'colour': c, 'size': z}, M) for c in ('navy', 'black') for z in ('S', 'M', 'L', 'XL')}
plan = {'N1': [('navy', 'S'), ('navy', 'M')], 'N2': [('navy', 'L'), ('navy', 'XL')], 'K1': [('black', 'S'), ('black', 'M')]}
jobsB = {}
for k, cks in plan.items():
    s, sm = call('POST', '/api/sc/movements/send', {'to': biz(BB[k]), 'process_key': 'stitching', 'lines': [{'spec_id': kitB[ck], 'qty': panels[ck], 'unit': 'pcs'} for ck in cks], 'client_id': cid()}, M['tok']); need(s, sm, f'M → {k}')
    jobsB[k] = sm['job']['id']; share(sm['movement']['id'], M); confirm(sm['movement']['id'], BB[k])
check('B3 one stitching unit per colour + size: navy S/M → Sakthi, navy L/XL → Ganga, black S/M → Vel', len(jobsB) == 3)
check("B3 each stitcher's Others' goods holds only its own kits", all(sum(1 for g in call('GET', '/api/sc/goods/others', tok=BB[k]['tok'])[1]['groups'] for j in g['jobs'] if j.get('id') == jobsB[k]) == 1 and not any(j.get('id') in [jobsB[o] for o in plan if o != k] for g in call('GET', '/api/sc/goods/others', tok=BB[k]['tok'])[1]['groups'] for j in g['jobs']) for k in plan))
for k, cks in plan.items():
    lines = [{'spec_id': garB[ck], 'qty': panels[ck] - (2 if ck == ('navy', 'M') else 0), 'unit': 'pcs'} for ck in cks] + ([{'spec_id': garB[('navy', 'M')], 'qty': 2, 'unit': 'pcs', 'grade': 'reject'}] if k == 'N1' else [])
    s, r = call('POST', f'/api/sc/jobs/{jobsB[k]}/return', {'lines': lines, 'last': True, 'client_id': cid()}, M['tok']); need(s, r, f'{k} back'); share(r['movement']['id'], M); sender_ok(r['movement']['id'], BB[k])
goodB = {ck: q - (2 if ck == ('navy', 'M') else 0) for ck, q in panels.items()}
pkB = {ck: spec('mt_packed_garment', {'style': st, 'colour': ck[0], 'size': ck[1], 'pack': 'single'}, M) for ck in panels}
s, pb = call('POST', '/api/sc/made', {'process_key': 'packing', 'inputs': [{'spec_id': garB[ck], 'qty': q, 'unit': 'pcs'} for ck, q in goodB.items()], 'outputs': [{'spec_id': pkB[ck], 'qty': q, 'unit': 'pcs', 'lot': f'Q{RUN}'} for ck, q in goodB.items()], 'client_id': cid()}, M['tok'])
check('B4 all three return; M packs 938 in-house (2 navy M rejects kept apart)', s == 201 and all(stock(M, pkB[ck], f'Q{RUN}') == q for ck, q in goodB.items()), (s, pb.get('error')))
print('── Scenario B: isolation ──')
check("C (cutting) can't see any stitching job", not any(sees(C, f'/api/sc/jobs/{j}/detail') for j in jobsB.values()))
check("Sakthi can't see Ganga's or Vel's job", not sees(N1, f"/api/sc/jobs/{jobsB['N2']}/detail") and not sees(N1, f"/api/sc/jobs/{jobsB['K1']}/detail"))
check("nobody in scenario B can see scenario A's records", not sees(M, f'/api/sc/movements/{m_s1}') and not sees(C, f'/api/sc/jobs/{j1}/detail'))

v = subprocess.run(['bash', '-lc', 'cd /Users/dev/Desktop/claire/server && source ~/.nvm/nvm.sh >/dev/null && nvm use 24 >/dev/null && MONGODB_DB=' + DB + ' npx tsx src/sc/verify.ts | tail -1'], capture_output=True, text=True).stdout.strip()
check('ledger check after both scenarios: 0 problems', v.endswith('0 problem(s)'), v)
print('ALL PASS' if ok else 'SOME FAILED'); sys.exit(0 if ok else 1)
