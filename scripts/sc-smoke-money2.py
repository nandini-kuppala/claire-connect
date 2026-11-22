#!/usr/bin/env python3
# Money, orders, staff and link regressions from the 22 Nov bug hunt (each failed before its fix). LOCAL dev server only.
import json, urllib.request, urllib.parse, uuid, sys, random, time
B = 'http://localhost:8787'  # local dev server only; never production
def call(method, path, body=None, tok=None, headers=None):
    req = urllib.request.Request(B + path, method=method, data=json.dumps(body).encode() if body is not None else None, headers={'content-type': 'application/json', **({'authorization': 'Bearer ' + tok} if tok else {}), **(headers or {})})
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read();
            try: return r.status, json.loads(raw or b'{}')
            except Exception: return r.status, {'html': raw.decode(errors='ignore')}
    except urllib.error.HTTPError as e:
        raw = e.read()
        try: return e.code, json.loads(raw or b'{}')
        except Exception: return e.code, {'html': raw.decode(errors='ignore')}
def login(phone): return call('POST', '/api/auth/verify', {'phone': phone, 'otp': '123456'})[1]['token']
cid = lambda: str(uuid.uuid4())
ok = True
def check(label, cond, extra=''):
    global ok
    ok = ok and bool(cond)
    print(('PASS ' if cond else 'FAIL ') + label + (f'  [{extra}]' if extra else ''))
R, L = login('9000000004'), login('9000000002')
def spec(mt, attrs, tok=R): return call('POST', '/api/sc/specs/resolve', {'material_type_id': mt, 'attrs': attrs}, tok)[1]['spec']['id']
kit = spec('mt_kit', {'style': 'MNY2', 'colour': 'navy', 'size': 'M'})
gar = spec('mt_garment', {'style': 'MNY2', 'colour': 'navy', 'size': 'M'})
fab = spec('mt_knit_fabric', {'state': 'finished', 'structure': 'single jersey', 'gsm': 180, 'colour': 'navy'})
def job_work_order(qty=100, price=12):
    rq = call('GET', '/api/requirements?limit=1', tok=R)[1]['requirements'][0]['id']
    jo = call('POST', '/api/jobs/offer', {'requirementId': rq, 'lines': [{'listingId': 'none', 'businessId': 'b_lakshmi', 'qty': qty, 'unitPrice': price}]}, R)[1]
    ac = call('POST', f"/api/offers/{jo['offers'][0]['id']}/respond", {'action': 'accept'}, L)[1]
    oid = ac['order']['id']
    s, sm = call('POST', f'/api/sc/orders/{oid}/send-material', {'process_key': 'stitching', 'lines': [{'spec_id': kit, 'qty': qty, 'unit': 'pcs'}], 'client_id': cid(), 'allow_untracked': True, 'untracked_reason': 'money2'}, R)
    call('POST', f"/api/sc/movements/{sm['movement']['id']}/share-now", {}, R)
    return oid, sm['job']['id']
def status(oid): o = call('GET', f'/api/orders/{oid}', tok=R)[1]; o = o.get('order', o); return o.get('status')

# 1. A piece bill counts pieces only (2 kg of fabric back is not 2,000 pieces)
oid, job = job_work_order()
s, r = call('POST', f'/api/sc/jobs/{job}/return', {'lines': [{'spec_id': gar, 'qty': 100, 'unit': 'pcs'}, {'spec_id': fab, 'qty': 2, 'unit': 'kg'}], 'last': True, 'client_id': cid()}, R)
items = [x for x in call('GET', '/api/sc/bills/b/b_lakshmi', tok=R)[1]['items'] if x['source']['id'] == job]
check('1. 100 pcs + 2 kg back on a ₹12/pc order bills 100 pcs (₹1,260), not 2,100', items and items[0]['amount_paise'] == 126000, [(x['qty'], x['amount_paise']) for x in items])

# 2. A return still inside its undo window doesn't deliver the order; undoing it leaves it undelivered
oid, job = job_work_order()
s, r = call('POST', f'/api/sc/jobs/{job}/return', {'lines': [{'spec_id': gar, 'qty': 100, 'unit': 'pcs'}], 'last': True, 'client_id': cid()}, R)
time.sleep(2); st1 = status(oid)
call('POST', f"/api/sc/movements/{r['movement']['id']}/undo", {}, R)
time.sleep(1); st2 = status(oid)
check('2. Got back 100 of 100 then Undo within 10 minutes → the order was never marked delivered', st1 != 'delivered' and st2 != 'delivered', (st1, st2))

# 3. 1 kg back on a 100-piece order doesn't count as 1,000 pieces
oid, job = job_work_order()
s, r = call('POST', f'/api/sc/jobs/{job}/return', {'lines': [{'spec_id': fab, 'qty': 1, 'unit': 'kg'}], 'client_id': cid()}, R)
call('POST', f"/api/sc/movements/{r['movement']['id']}/share-now", {}, R); time.sleep(2)
g = call('GET', f'/api/sc/orders/{oid}/goods', tok=R)[1]['progress']
check('3. 1 kg back on a 100-pc order: 0 pcs done, not delivered', g['done'] == 0 and status(oid) != 'delivered', (g['done'], status(oid)))

# 10. A buyer can't return more than arrived on the order
s, d = call('POST', '/api/deals/open', {'sellerBusinessId': 'b_lakshmi'}, R); conv = d['conversation']['id']
tshirt = next(l['id'] for l in call('GET', '/api/listings?business=b_lakshmi', tok=R)[1]['listings'] if l['category'].startswith('garment'))
of = call('POST', '/api/offers', {'conversationId': conv, 'qty': 10, 'unitPrice': 150, 'title': 'money2 tees', 'listingId': tshirt}, L)[1]
po = call('POST', f"/api/offers/{of['offer']['id']}/respond", {'action': 'accept'}, R)[1]['order']['id']
tee = spec('mt_garment', {'style': 'MNY2', 'colour': 'navy', 'size': 'L'}, L)
s, dsp = call('POST', f'/api/sc/orders/{po}/dispatch', {'lines': [{'spec_id': tee, 'qty': 10, 'unit': 'pcs'}], 'client_id': cid(), 'allow_untracked': True, 'untracked_reason': 'money2'}, L)
call('POST', f"/api/sc/movements/{dsp['movement']['id']}/share-now", {}, L)
_, mm = call('GET', f"/api/sc/movements/{dsp['movement']['id']}", tok=R); call('POST', f"/api/sc/movements/{dsp['movement']['id']}/confirm", {'lines': [{'line_id': mm['lines'][0]['line_id']}]}, R)
s1, _ = call('POST', f'/api/sc/orders/{po}/return', {'lines': [{'spec_id': tee, 'qty': 50, 'unit': 'pcs'}], 'reason': 'defect', 'client_id': cid()}, R)
s2, _ = call('POST', f'/api/sc/orders/{po}/return', {'lines': [{'spec_id': tee, 'qty': 4, 'unit': 'pcs'}], 'reason': 'defect', 'client_id': cid()}, R)
check('10. returning 50 of a 10-pc order is refused; returning 4 works', s1 == 409 and s2 == 201, (s1, s2))

# 7 and 8. Staff: agents can't be absorbed; staff never see orders
s, a = call('POST', '/api/sc/staff', {'name': 'Meena', 'phone': '9000000901'}, R)
check('7. a support agent cannot be added as staff', s == 409 and a.get('code') == 'not_allowed', (s, a.get('code')))
kph = '96' + ''.join(random.choice('0123456789') for _ in range(8))
call('POST', '/api/sc/staff', {'name': 'Kavitha', 'phone': kph}, R); K = login(kph)
codes = [call('GET', '/api/sc/orders/goods-summary', tok=K)[0], call('GET', f'/api/sc/orders/{po}/goods', tok=K)[0], call('POST', f'/api/sc/orders/{po}/dispatch', {'lines': [{'spec_id': tee, 'qty': 1, 'unit': 'pcs'}], 'client_id': cid()}, K)[0]]
s, pr = call('GET', '/api/sc/links/proposals', tok=K)
check('8. staff get 403 on order goods (summary, page, dispatch) and no link proposals', codes == [403, 403, 403] and pr.get('proposals') == [], (codes, pr))
st = [x for x in call('GET', '/api/sc/staff', tok=R)[1]['staff'] if x['phone'] == kph]
if st: call('DELETE', f"/api/sc/staff/{st[0]['id']}", tok=R)

# 5 and 6. Public link: a forged X-Forwarded-For doesn't reset the rate limit; records in the undo window aren't shown
s, c = call('POST', '/api/sc/contacts', {'name': f'Money2 Tailor {random.randint(100, 999)}', 'phone': '98' + ''.join(random.choice('0123456789') for _ in range(8))}, R); ct = {'k': 'c', 'id': c['contact']['id']}
s, m = call('POST', '/api/sc/movements/send', {'to': ct, 'process_key': 'stitching', 'lines': [{'spec_id': kit, 'qty': 7, 'unit': 'pcs'}], 'client_id': cid(), 'allow_untracked': True, 'untracked_reason': 'money2'}, R)
lk = call('POST', '/api/sc/links', {'party': ct}, R)[1]; token = lk['link']['url'].rsplit('/', 1)[1]
ua = {'user-agent': 'Mozilla/5.0 (Linux; Android 12; money2)'}
s, html = call('GET', f'/l/{token}', headers=ua)
check("6. the link page doesn't show a record still in the recorder's undo window", s == 200 and '7 pcs' not in html.get('html', ''), s)
codes = [call('GET', f'/l/{token}', headers={**ua, 'x-forwarded-for': f'10.0.0.{i}'})[0] for i in range(40)]
check('5. 40 requests with a different forged X-Forwarded-For each still hit the limit (429)', 429 in codes, codes[-5:])

print('ALL PASS' if ok else 'SOME FAILED'); sys.exit(0 if ok else 1)
