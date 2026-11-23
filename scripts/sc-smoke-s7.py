#!/usr/bin/env python3
# Slice 7 smoke: staff (scenario U) and the staff isolation suite. LOCAL dev server only (SC_ENABLED=1,
# MONGODB_DB=nexconn_sc_dev; Ravi, Lakshmi, Sree flagged). Ravi adds Kavitha; she uses Goods and Claire only.
import json, urllib.request, uuid, sys, random
B='http://localhost:8787'  # local dev server only; never production
def call(method, path, body=None, tok=None):
    req=urllib.request.Request(B+path, method=method, data=json.dumps(body).encode() if body is not None else None, headers={'content-type':'application/json', **({'authorization':'Bearer '+tok} if tok else {})})
    try:
        with urllib.request.urlopen(req) as r: return r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')
def login(phone): return call('POST','/api/auth/verify',{'phone':phone,'otp':'123456'})[1]['token']
cid = lambda: str(uuid.uuid4())
ok = True
def check(label, cond, extra=''):
    global ok
    ok = ok and bool(cond)
    print(('PASS ' if cond else 'FAIL ') + label + (f'  [{extra}]' if extra else ''))
R, L = login('9000000004'), login('9000000002')

# ── Provisioning ────────────────────────────────────────────────────────────────────────────────
kphone = '96' + ''.join(random.choice('0123456789') for _ in range(8))
s, a = call('POST','/api/sc/staff',{'name':'Kavitha','phone':kphone},R)
check('Ravi adds Kavitha by phone', s==201, a)
s, a = call('POST','/api/sc/staff',{'name':'Kavitha','phone':kphone},R); check('adding her again is refused', s==409 and a.get('code')=='already', a.get('code'))
s, a = call('POST','/api/sc/staff',{'name':'Lakshmi','phone':'9000000002'},R); check("a phone in another business is refused", s==409 and a.get('code')=='other_business', a.get('code'))
s, a = call('POST','/api/sc/staff',{'name':'X','phone':kphone},L); check('another business cannot take her either', s==409 and a.get('code')=='other_business', a.get('code'))
K = login(kphone)
s, me = call('GET','/api/me',tok=K); u = me.get('user', me)
check('she logs in with OTP as staff of Ravi, onboarded', u.get('role')=='staff' and u.get('business_id')=='b_ravi' and u.get('onboarded')==1, {k:u.get(k) for k in ('role','business_id','onboarded')})
check('no PIN hash ever leaves the server', 'pin_hash' not in json.dumps(me))
s, a = call('POST','/api/sc/staff',{'name':'Y','phone':'95'+kphone[2:]},K); check('staff cannot add staff', s==403, s)

# ── Isolation: existing routes ──────────────────────────────────────────────────────────────────
s, convs = call('GET','/api/conversations',tok=R)
deal = next((c for c in (convs if isinstance(convs, list) else convs.get('conversations', convs.get('items', []))) if c.get('kind') not in (None, 'goods')), None)
refused = [
  ('POST','/api/deals/open',{}), ('POST','/api/deals/combo',{}), ('POST','/api/offers',{}), ('GET','/api/orders',None), ('POST','/api/orders/x/event',{}),
  ('GET','/api/requirements',None), ('POST','/api/requirements',{}), ('POST','/api/listings',{}), ('PATCH','/api/listings/x',{}), ('POST','/api/catalog/apply',{}),
  ('GET','/api/desk/me',None), ('GET','/api/desk/tickets',None), ('GET','/api/businesses/b_ravi',None), ('PATCH','/api/me',{'autoReply':'off'}),
  ('POST','/api/onboarding/complete',{}), ('POST','/api/ratings',{}), ('POST','/api/samples',{}), ('POST','/api/jobs/offer',{}),
]
if deal: refused.append(('GET', f"/api/conversations/{deal.get('id') or deal.get('_id')}", None))
bad = [(m,p,s) for (m,p,b) in refused for s in [call(m,p,b,K)[0]] if s != 403]
check(f'{len(refused)} existing routes refuse staff (deals, offers, orders, listings, catalog, desk, business, onboarding…)', not bad, bad)
s, ki = call('GET','/api/conversations',tok=K); items = ki if isinstance(ki, list) else ki.get('conversations', ki.get('items', []))
check('her inbox has Goods conversations only', all(c.get('kind')=='goods' for c in items), [c.get('kind') for c in items][:5])
biz_lang = lambda: (call('GET','/api/me',tok=R)[1].get('business') or {}).get('language')
lang0 = biz_lang(); other = 'hi' if lang0 != 'hi' else 'ta'
s, _ = call('PATCH','/api/me',{'language':other},K); check('she can change her own language', s==200, s)
check("her language does not change the business's language (the owner's)", biz_lang() == lang0, f'{lang0} -> {biz_lang()}')
call('PATCH','/api/me',{'language':'ta'},K)

# ── Isolation: Goods routes ─────────────────────────────────────────────────────────────────────
for m,p,b in [('GET','/api/sc/goods/out',None),('GET','/api/sc/goods/coming',None),('GET','/api/sc/goods/in',None),('GET','/api/sc/stock',None)]:
    s,_ = call(m,p,b,K); check(f'staff may read {p}', s==200, s)
owner_only = [('GET','/api/sc/rates',None),('POST','/api/sc/links',{'party':{'k':'c','id':'x'}}),('GET','/api/sc/staff',None),('GET','/api/sc/approvals',None),
              ('POST','/api/sc/jobs/x/close',{}),('POST','/api/sc/jobs/x/reopen',{'reason':'xx'}),('POST','/api/sc/adjust/casualty',{'cause':'fire','items':[{'holding_id':'x','qty':1,'unit':'kg'}],'client_id':cid()}),
              ('POST','/api/sc/adjust',{'op':'write_off','holding_id':'x','qty':1,'unit':'kg','reason':'x','client_id':cid()}),('POST','/api/sc/jobs/x/sell-part',{'to':{'k':'b','id':'b_sree'},'lines':[{'spec_id':'x','qty':1,'unit':'kg'}],'client_id':cid()})]
bad = [(m,p,s) for (m,p,b) in owner_only for s in [call(m,p,b,K)[0]] if s not in (403,)]
check('owner-only Goods actions refuse staff (rates, links, staff, approvals, close, write-off, casualty, sell part)', not bad, bad)
s, out = call('GET','/api/sc/goods/out',tok=K)
check('no rates or prices in what she reads', '_paise' not in json.dumps(out) and '₹' not in json.dumps(out))

# ── Scenario U: she receives at the gate, counts, and her big count waits for Ravi ─────────────────
s, m = call('POST','/api/sc/movements/send',{'to':{'k':'b','id':'b_ravi'},'process_key':'checking','lines':[{'spec_id':call('POST','/api/sc/specs/resolve',{'material_type_id':'mt_garment','attrs':{'style':'LG-T10','colour':'white','size':'M'}},L)[1]['spec']['id'],'qty':180,'unit':'pcs'}],'client_id':cid(),'allow_untracked':True,'untracked_reason':'demo'},L)
call('POST',f"/api/sc/movements/{m['movement']['id']}/share-now",{},L)
s, c = call('POST',f"/api/sc/movements/{m['movement']['id']}/confirm",{'lines':[{'line_id':m['movement']['lines'][0]['line_id']}]},K)
check("Kavitha confirms Lakshmi's 180 at the gate", s==200, c.get('error'))
s, mv = call('GET',f"/api/sc/movements/{m['movement']['id']}",tok=R)
check('the receipt names Kavitha as who recorded it', any(a.get('by')=='b_ravi' for a in mv['lines'][0]['received']))
row = next(r for r in call('GET','/api/sc/stock',tok=K)[1]['rows'] if not r['with'] and r['dimension']=='count' and r['qty']>=200)
s, a = call('POST','/api/sc/adjust',{'op':'count','holding_id':row['id'],'qty':row['qty']-40,'unit':'pcs','client_id':cid()},K)
check('her count 40 short of the book waits for Ravi (nothing posted)', s==202 and a['adjustment']['pending'], (s, a))
row2 = next(r for r in call('GET','/api/sc/stock',tok=K)[1]['rows'] if r['id']==row['id'])
check('the book is unchanged until Ravi approves', row2['qty']==row['qty'], (row['qty'], row2['qty']))
s, a = call('POST','/api/sc/adjust',{'op':'count','holding_id':row['id'],'qty':row['qty']-3,'unit':'pcs','client_id':cid()},K)
check('a small difference (3 pcs) posts at once', s==201, s)
s, ap = call('GET','/api/sc/approvals',tok=R); pend=[x for x in ap['counts'] if x['by']=='Kavitha']
check('Ravi sees "Kavitha counted …" waiting for him', pend and pend[0]['counted']==row['qty']-40, pend[:1])
s, a = call('POST',f"/api/sc/adjust/{pend[0]['id']}/approve",{},R)
row3 = next(r for r in call('GET','/api/sc/stock',tok=R)[1]['rows'] if r['id']==row['id'])
check('Ravi approves: the book becomes her count', s==200 and row3['qty']==row['qty']-40, (s, row3['qty']))
s, _ = call('POST',f"/api/sc/adjust/{pend[0]['id']}/approve",{},K); check('staff cannot approve', s==403, s)

# ── A difference: she suggests, only Ravi settles; Lakshmi never sees the suggestion ──────────────
kit = call('POST','/api/sc/specs/resolve',{'material_type_id':'mt_kit','attrs':{'style':'RKF-P22','colour':'navy','size':'S'}},R)[1]['spec']['id']
s, m2 = call('POST','/api/sc/movements/send',{'to':{'k':'b','id':'b_lakshmi'},'process_key':'stitching','lines':[{'spec_id':kit,'qty':50,'unit':'pcs'}],'client_id':cid(),'allow_untracked':True,'untracked_reason':'demo'},R)
call('POST',f"/api/sc/movements/{m2['movement']['id']}/share-now",{},R)
s, c2 = call('POST',f"/api/sc/movements/{m2['movement']['id']}/confirm",{'lines':[{'line_id':m2['movement']['lines'][0]['line_id'],'qty':48,'unit':'pcs'}]},L)
dq = c2['results'][0]['disputeId']
s, a = call('POST',f'/api/sc/disputes/{dq}/propose',{'outcome':'received'},K)
s2, d = call('GET',f'/api/sc/disputes/{dq}',tok=R)
check('her "use their count" is a suggestion, not a settlement', s==202 and d['state']=='open', (s, d.get('state')))
s, d = call('GET',f'/api/sc/disputes/{dq}',tok=L); check('Lakshmi never sees the suggestion', 'staff' not in json.dumps(d) and 'Kavitha' not in json.dumps(d))
s, ap = call('GET','/api/sc/approvals',tok=R); check('Ravi sees her suggestion', any(x['dispute_id']==dq and x['by']=='Kavitha' for x in ap['suggestions']))
s, _ = call('POST',f'/api/sc/disputes/{dq}/accept',{},K); check('staff cannot accept or settle', s==403, s)

# ── PIN on a shared phone ───────────────────────────────────────────────────────────────────────
s, _ = call('POST','/api/sc/me/pin',{'pin':'4321'},K)
s2, me = call('GET','/api/me',tok=K); u = me.get('user', me)
check('she sets a PIN; /me says has_pin, never the hash', s==200 and u.get('has_pin') is True and 'pin_hash' not in json.dumps(me))
s, _ = call('POST','/api/sc/me/pin/verify',{'pin':'1111'},K); check('wrong PIN refused', s==401, s)
s, _ = call('POST','/api/sc/me/pin/verify',{'pin':'4321'},K); check('right PIN accepted', s==200, s)
codes = [call('POST','/api/sc/me/pin/verify',{'pin':'0000'},K)[0] for _ in range(6)]
check('locked after repeated wrong PINs', 429 in codes, codes)
s, st = call('GET','/api/sc/staff',tok=R); kv=[x for x in st['staff'] if x['phone']==kphone]
check('Ravi sees her with "PIN set"', kv and kv[0]['has_pin'])

# ── Removal ─────────────────────────────────────────────────────────────────────────────────────
s, _ = call('DELETE',f"/api/sc/staff/{kv[0]['id']}",tok=R)
s2, _ = call('GET','/api/sc/goods/out',tok=K)
check('after removal her login no longer reaches Ravi\'s goods', s==200 and s2==404, (s, s2))
print('ALL PASS' if ok else 'SOME FAILED'); sys.exit(0 if ok else 1)
