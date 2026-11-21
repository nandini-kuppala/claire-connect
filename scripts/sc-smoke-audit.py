#!/usr/bin/env python3
# Phase 7 audit regressions: one check per defect the independent review found (each failed before its fix).
# LOCAL dev server only (SC_ENABLED=1, MONGODB_DB=nexconn_sc_dev; Ravi, Lakshmi, Sree flagged; Phase 7 demo businesses).
import json, urllib.request, urllib.parse, uuid, sys, random, subprocess, threading, time
B = 'http://localhost:8787'  # local dev server only; never production
PHONE_UA = 'Mozilla/5.0 (Linux; Android 12; worker phone)'
def call(method, path, body=None, tok=None):
    req = urllib.request.Request(B + path, method=method, data=json.dumps(body).encode() if body is not None else None, headers={'content-type': 'application/json', **({'authorization': 'Bearer ' + tok} if tok else {})})
    try:
        with urllib.request.urlopen(req) as r: return r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k): return None
opener = urllib.request.build_opener(NoRedirect)
def page(path, form):
    req = urllib.request.Request(B + path, method='POST', data=urllib.parse.urlencode(form).encode(), headers={'user-agent': PHONE_UA, 'content-type': 'application/x-www-form-urlencoded'})
    try:
        with opener.open(req) as r: return r.status
    except urllib.error.HTTPError as e: return e.code
def login(phone): return call('POST', '/api/auth/verify', {'phone': phone, 'otp': '123456'})[1]['token']
cid = lambda: str(uuid.uuid4())
ok = True
def check(label, cond, extra=''):
    global ok
    ok = ok and bool(cond)
    print(('PASS ' if cond else 'FAIL ') + label + (f'  [{extra}]' if extra else ''))
R, L, S = login('9000000004'), login('9000000002'), login('9000000003')
def spec(mt, attrs, tok=R): return call('POST', '/api/sc/specs/resolve', {'material_type_id': mt, 'attrs': attrs}, tok)[1]['spec']['id']
def me(tok): s, m = call('GET', '/api/me', tok=tok); return m.get('user', m)['business_id']
kit = spec('mt_kit', {'style': 'AUD-1', 'colour': 'navy', 'size': 'M'})
fab = spec('mt_knit_fabric', {'state': 'finished', 'structure': 'single jersey', 'gsm': 180, 'colour': 'navy'})

# 1. A payment can't be written into a stranger's books
vel = me(login('9000002005'))  # a demo business Ravi has never traded with
s, _ = call('POST', '/api/sc/settlements', {'party': {'k': 'b', 'id': vel}, 'direction': 'received', 'amount_paise': 12345600, 'mode': 'cash', 'client_id': cid()}, R)
check('1. Ravi cannot record a payment with a business he never traded with', s == 404, s)
s, _ = call('POST', '/api/sc/settlements', {'party': {'k': 'b', 'id': 'b_lakshmi'}, 'direction': 'paid', 'amount_paise': 100, 'mode': 'cash', 'client_id': cid()}, R)
check('1. …but still can with Lakshmi, whom he trades with', s == 201, s)

# 2. An undisclosed sub-contractor stays hidden from the owner (D2)
s, m = call('POST', '/api/sc/movements/send', {'to': {'k': 'b', 'id': 'b_sree'}, 'process_key': 'stitching', 'lines': [{'spec_id': spec('mt_kit', {'style': 'AUD-2', 'colour': 'navy', 'size': 'S'}, L), 'qty': 100, 'unit': 'pcs'}], 'client_id': cid(), 'allow_untracked': True, 'untracked_reason': 'audit'}, L)
pj = m['job']['id']; call('POST', f"/api/sc/movements/{m['movement']['id']}/share-now", {}, L)
_, mm = call('GET', f"/api/sc/movements/{m['movement']['id']}", tok=S); call('POST', f"/api/sc/movements/{m['movement']['id']}/confirm", {'lines': [{'line_id': mm['lines'][0]['line_id']}]}, S)
s, fw = call('POST', f'/api/sc/jobs/{pj}/forward', {'to': {'k': 'b', 'id': 'b_ravi'}, 'process_key': 'stitching', 'lines': [{'spec_id': spec('mt_kit', {'style': 'AUD-2', 'colour': 'navy', 'size': 'S'}, S), 'qty': 50, 'unit': 'pcs'}], 'client_id': cid()}, S)
cjid = fw.get('job', {}).get('id')
_, dS = call('GET', f'/api/sc/jobs/{cjid}/detail', tok=S)  # Sree opens the sub-contract she made
child = {'id': cjid, 'name': dS.get('job', {}).get('performerName'), 'disclosed': fw.get('job', {}).get('disclosed')}
_, dL = call('GET', f'/api/sc/jobs/{pj}/detail', tok=L)
lc = next((c for c in dL.get('children', []) if c['kind'] == 'sub'), None)
check('2. Sree (who sub-contracted, undisclosed) sees who it went to', s == 201 and child['disclosed'] is False and child['name'] == 'Ravi Knit Fashions', child)
check("2. Lakshmi (the owner) sees a sub-contract but not the sub-contractor's name", lc and lc.get('masked') and lc.get('name') is None and lc.get('id') is None, lc)
check("2. …and can't open the sub-contracted job", child and call('GET', f"/api/sc/jobs/{child['id']}/detail", tok=L)[0] == 404)

# 3. "I returned some" on a statement link is never converted between units
s, c = call('POST', '/api/sc/contacts', {'name': f'Audit Cutter {random.randint(100,999)}', 'phone': '98' + ''.join(random.choice('0123456789') for _ in range(8))}, R); ct = {'k': 'c', 'id': c['contact']['id']}
s, m = call('POST', '/api/sc/movements/send', {'to': ct, 'process_key': 'cutting', 'lines': [{'spec_id': fab, 'qty': 10, 'unit': 'kg'}], 'client_id': cid(), 'allow_untracked': True, 'untracked_reason': 'audit'}, R)
cj = m['job']['id']; call('POST', f"/api/sc/movements/{m['movement']['id']}/share-now", {}, R)
s, lk = call('POST', '/api/sc/links', {'party': ct}, R); token = lk['link']['url'].rsplit('/', 1)[1]
page(f'/api/l/{token}/propose', {'j': cj, 'qty': '2'})
pr = [x for x in call('GET', '/api/sc/links/proposals', tok=R)[1]['proposals'] if x['job_id'] == cj]
s, a = call('POST', f"/api/sc/links/proposals/{pr[0]['id']}/accept", {'spec_id': kit}, R) if pr else (0, {})
check('3. "2 kg came back" on a cutting job is not booked as 2,000 kits: the owner records it in Got back', s == 409 and a.get('code') == 'pick' and '2 kg' in a.get('error', ''), (s, a))
_, d = call('GET', f'/api/sc/jobs/{cj}/detail', tok=R)
check('3. …and nothing was booked', not d.get('grid'), d.get('grid'))

# 4. Approving one staff count at the same moment, several times, posts it once
kph = '96' + ''.join(random.choice('0123456789') for _ in range(8))
call('POST', '/api/sc/staff', {'name': 'Kavitha', 'phone': kph}, R); K = login(kph)
s, f = call('POST', '/api/sc/adjust', {'op': 'found', 'spec_id': kit, 'qty': 100, 'unit': 'pcs', 'lot': f'AUD{random.randint(1000,9999)}', 'reason': 'audit', 'client_id': cid()}, R)
row = next(r for r in call('GET', '/api/sc/stock', tok=R)[1]['rows'] if r['spec'] and r['spec']['id'] == kit and not r['with'] and r['qty'] == 100)
s, p = call('POST', '/api/sc/adjust', {'op': 'count', 'holding_id': row['id'], 'qty': 80, 'unit': 'pcs', 'client_id': cid()}, K)
codes = []
th = [threading.Thread(target=lambda: codes.append(call('POST', f"/api/sc/adjust/{p['adjustment']['id']}/approve", {}, R)[0])) for _ in range(4)]
[t.start() for t in th]; [t.join() for t in th]
after = next(r for r in call('GET', '/api/sc/stock', tok=R)[1]['rows'] if r['id'] == row['id'])['qty']
check('4. four approves at once: one succeeds, the book becomes the count (80), not 20', codes.count(200) == 1 and after == 80, (sorted(codes), after))
st = [x for x in call('GET', '/api/sc/staff', tok=R)[1]['staff'] if x['phone'] == kph]

# 6. Staff never see leftover rates
s, b = call('GET', '/api/sc/bills/b/b_lakshmi', tok=R)
lj = next((x['source']['id'] for x in b['items'] if x.get('note') == 'leftover_kept'), None)
if lj:
    _, dk = call('GET', f'/api/sc/jobs/{lj}/detail', tok=K); _, dr = call('GET', f'/api/sc/jobs/{lj}/detail', tok=R)
    check('6. staff see the leftovers without their rate; the owner still sees it', 'rate_paise' not in json.dumps(dk.get('closure', {})) and 'rate_paise' in json.dumps(dr.get('closure', {})), (json.dumps(dk.get('closure', {}).get('leftovers'))[:120]))
else:
    check('6. (a job with a leftover rate exists to test)', False, 'run sc-smoke-s4.py first')
s1 = call('GET', '/api/sc/links', tok=K)[0]; s2, rq = call('GET', '/api/sc/linking/requests', tok=K); s3, hs = call('GET', '/api/sc/history?ids=b_lakshmi', tok=K)
check("10. staff can't list statement links, link requests (phones) or history", s1 == 403 and rq.get('requests') == [] and hs.get('history') == {}, (s1, rq, hs))
if st: call('DELETE', f"/api/sc/staff/{st[0]['id']}", tok=R)

# 5. A job-work order is delivered when the worker sends the work back
s, rqs = call('GET', '/api/requirements?limit=1', tok=R)
s, jo = call('POST', '/api/jobs/offer', {'requirementId': rqs['requirements'][0]['id'], 'lines': [{'listingId': 'none', 'businessId': 'b_lakshmi', 'qty': 50, 'unitPrice': 10}]}, R)
s, ac = call('POST', f"/api/offers/{jo['offers'][0]['id']}/respond", {'action': 'accept'}, L); jw = ac['order']['id']
s, sm = call('POST', f'/api/sc/orders/{jw}/send-material', {'process_key': 'stitching', 'lines': [{'spec_id': kit, 'qty': 50, 'unit': 'pcs'}], 'client_id': cid(), 'allow_untracked': True, 'untracked_reason': 'audit'}, R)
call('POST', f"/api/sc/movements/{sm['movement']['id']}/share-now", {}, R)
_, mm = call('GET', f"/api/sc/movements/{sm['movement']['id']}", tok=L); call('POST', f"/api/sc/movements/{sm['movement']['id']}/confirm", {'lines': [{'line_id': mm['lines'][0]['line_id']}]}, L)
gar = spec('mt_garment', {'style': 'AUD-1', 'colour': 'navy', 'size': 'M'}, L)
s, sb = call('POST', f"/api/sc/jobs/{sm['job']['id']}/send-back", {'client_id': cid(), 'lines': [{'spec_id': gar, 'grade': 'A', 'qty': 50, 'unit': 'pcs'}]}, L)
call('POST', f"/api/sc/movements/{sb['movement']['id']}/share-now", {}, L)  # delivery counts once past the undo window
time.sleep(2)
o = call('GET', f'/api/orders/{jw}', tok=R)[1]; o = o.get('order', o)
check("5. Lakshmi's send-back of all 50 marks the job-work order delivered", s == 201 and o.get('status') == 'delivered' and o.get('delivered_at'), (s, o.get('status')))

# 7. Linking a contact keeps one Bills row: payments and the rate card move to the business
lph = '97' + ''.join(random.choice('0123456789') for _ in range(8))
s, c = call('POST', '/api/sc/contacts', {'name': 'Audit Link Unit', 'phone': lph}, R); lc7 = {'k': 'c', 'id': c['contact']['id']}
call('POST', '/api/sc/rates', {'party': lc7, 'process_key': 'stitching', 'basis': 'per_output_piece', 'value_paise': 1500, 'effective_from': '2026-01-01'}, R)
s, m = call('POST', '/api/sc/movements/send', {'to': lc7, 'process_key': 'stitching', 'lines': [{'spec_id': kit, 'qty': 10, 'unit': 'pcs'}], 'client_id': cid(), 'allow_untracked': True, 'untracked_reason': 'audit'}, R)
call('POST', f"/api/sc/jobs/{m['job']['id']}/return", {'lines': [{'spec_id': spec('mt_garment', {'style': 'AUD-1', 'colour': 'navy', 'size': 'M'}), 'qty': 10, 'unit': 'pcs'}], 'last': True, 'client_id': cid()}, R)
call('POST', '/api/sc/settlements', {'party': lc7, 'direction': 'paid', 'amount_paise': 5000, 'mode': 'cash', 'client_id': cid()}, R)
N = login(lph)
call('POST', '/api/onboarding/complete', {'draft': {'business_name': 'Audit Link Unit', 'owner_name': 'Audit', 'sells': [], 'city': 'Tiruppur'}, 'language': 'en'}, N)
subprocess.run(['bash', '-lc', f'cd /Users/dev/Desktop/claire && source ~/.nvm/nvm.sh >/dev/null && nvm use 24 >/dev/null && MONGODB_DB=nexconn_sc_dev npm run sc:flag -w server -- {lph} on'], capture_output=True)
call('POST', '/api/sc/linking/request', {}, N)
s, ap = call('POST', f"/api/sc/linking/{lc7['id']}/approve", {}, R)
nb = me(N)
bal = [x for x in call('GET', '/api/sc/bills', tok=R)[1]['parties'] if x['party']['id'] in (nb, lc7['id'])]
check('7. after linking, Bills has one row for the business: the 10 pcs at ₹15 billed, the ₹50 payment with it', s == 200 and len(bal) == 1 and bal[0]['party']['id'] == nb and bal[0]['i_owe'] == 15000 and bal[0]['paid'] == 5000, bal)

# 9. A return on an ordinary sale reduces the bill
s, c = call('POST', '/api/sc/contacts', {'name': f'Audit Buyer {random.randint(100,999)}'}, R); buyer = {'k': 'c', 'id': c['contact']['id']}
call('POST', '/api/sc/movements/trade', {'kind': 'sell', 'party': buyer, 'lines': [{'spec_id': fab, 'qty': 100, 'unit': 'kg'}], 'rate_paise': 20000, 'client_id': cid(), 'allow_untracked': True, 'untracked_reason': 'audit'}, R)
s, rt = call('POST', '/api/sc/movements/trade', {'kind': 'buyer_returned', 'party': buyer, 'lines': [{'spec_id': fab, 'qty': 20, 'unit': 'kg'}], 'client_id': cid()}, R)
bb = call('GET', f"/api/sc/bills/c/{buyer['id']}", tok=R)[1]['balance']
check('9. sell 100 kg at ₹200, 20 kg come back: they owe ₹16,000, not ₹20,000', s == 201 and bb['they_owe'] == 1600000, (s, bb and bb['they_owe']))

# 11. Two people tapping Received on the same delivery at once: one receipt, the other "unchanged" (load test finding)
s, m = call('POST', '/api/sc/movements/send', {'to': {'k': 'b', 'id': 'b_lakshmi'}, 'process_key': 'stitching', 'lines': [{'spec_id': kit, 'qty': 10, 'unit': 'pcs'}], 'client_id': cid(), 'allow_untracked': True, 'untracked_reason': 'audit'}, R)
call('POST', f"/api/sc/movements/{m['movement']['id']}/share-now", {}, R)
_, mm = call('GET', f"/api/sc/movements/{m['movement']['id']}", tok=L)
res = []
th = [threading.Thread(target=lambda: res.append(call('POST', f"/api/sc/movements/{m['movement']['id']}/confirm", {'lines': [{'line_id': mm['lines'][0]['line_id']}]}, L))) for _ in range(4)]
[t.start() for t in th]; [t.join() for t in th]
_, m2 = call('GET', f"/api/sc/movements/{m['movement']['id']}", tok=R)
check('11. four Received taps at once: all succeed, one receipt recorded', all(x[0] == 200 for x in res) and sum(1 for a in m2['lines'][0]['received'] if a.get('by') == 'b_lakshmi' and a.get('evidence') == 'account') == 1, [x[0] for x in res])

v = subprocess.run(['bash', '-lc', 'cd /Users/dev/Desktop/claire/server && source ~/.nvm/nvm.sh >/dev/null && nvm use 24 >/dev/null && MONGODB_DB=nexconn_sc_dev npx tsx src/sc/verify.ts | tail -1'], capture_output=True, text=True).stdout.strip()
check('ledger check: 0 problems', v.endswith('0 problem(s)'), v)
print('ALL PASS' if ok else 'SOME FAILED'); sys.exit(0 if ok else 1)
