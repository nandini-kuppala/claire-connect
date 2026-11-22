#!/usr/bin/env python3
# Slice 2 smoke walkthrough: two-sided records between Ravi (sender/owner) and Lakshmi (receiver/performer), with Sree
# as an unrelated business for isolation. LOCAL dev server only (SC_ENABLED=1, MONGODB_DB=nexconn_sc_dev, the three
# businesses flagged). Writes demo records to the dev database.
import json, urllib.request, uuid, sys
B='http://localhost:8787'  # local dev server only; never production
def call(method, path, body=None, tok=None):
    req=urllib.request.Request(B+path, method=method, data=json.dumps(body).encode() if body is not None else None, headers={'content-type':'application/json', **({'authorization':'Bearer '+tok} if tok else {})})
    try:
        with urllib.request.urlopen(req) as r: return r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')
def login(phone): return call('POST','/api/auth/verify',{'phone':phone,'otp':'123456'})[1]['token']
R, L, S = login('9000000004'), login('9000000002'), login('9000000003')
cid = lambda: str(uuid.uuid4())
ok = True
def check(label, cond, extra=''):
    global ok
    ok = ok and bool(cond)
    print(('PASS ' if cond else 'FAIL ') + label + (f'  [{extra}]' if extra else ''))
_, kit = call('POST','/api/sc/specs/resolve',{'material_type_id':'mt_kit','attrs':{'style':'RKF-P22','colour':'navy','size':'M'}},R)
_, fab = call('POST','/api/sc/specs/resolve',{'material_type_id':'mt_knit_fabric','attrs':{'state':'finished','structure':'single jersey','gsm':180,'colour':'black'}},R)
_, tee = call('POST','/api/sc/specs/resolve',{'material_type_id':'mt_garment','attrs':{'style':'RKF-P22','colour':'navy','size':'M'}},R)
kit, fab, tee = kit['spec']['id'], fab['spec']['id'], tee['spec']['id']
lak = {'k':'b','id':'b_lakshmi'}
def send(spec, qty, unit, proc='stitching', **kw):
    body={'to':lak,'process_key':proc,'lines':[{'spec_id':spec,'qty':qty,'unit':unit}],'client_id':cid(),'allow_untracked':True,'untracked_reason':'demo','rate_paise':1400, **kw}
    s,r=call('POST','/api/sc/movements/send',body,R); assert s==201, (s,r); return r
# 1. Ravi sends 600 kits; hidden from Lakshmi during the undo window
m1 = send(kit, 600, 'pcs'); mv1 = m1['movement']['id']; job1 = m1['job']['id']
s,_ = call('GET',f'/api/sc/movements/{mv1}',tok=L); check('hidden from receiver during undo window', s==404, s)
call('POST',f'/api/sc/movements/{mv1}/share-now',{},R)
s,mv = call('GET',f'/api/sc/movements/{mv1}',tok=L); check('visible to receiver after Share now', s==200, s)
check('receiver sees no price fields', 'rate' not in json.dumps(mv) and 'paise' not in json.dumps(mv))
s,_ = call('GET',f'/api/sc/movements/{mv1}',tok=S); check('third business cannot see it', s==404, s)
s,c = call('GET','/api/sc/goods/coming',tok=L); check('appears in receiver to-confirm', any(t['movementId']==mv1 for t in c['toConfirm']))
s,h = call('GET','/api/sc/home',tok=L); check('receiver chip to confirm ≥1', h['chips']['toConfirm']>=1, h['chips'])
# 2. Lakshmi counts 598 (counted goods: allowance 0) → dispute visible to both
line1 = mv['lines'][0]['line_id']
s,r = call('POST',f'/api/sc/movements/{mv1}/confirm',{'lines':[{'line_id':line1,'qty':598,'unit':'pcs'}]},L); dq = r['results'][0]['disputeId']
check('598 of 600 opens a dispute', bool(dq), r)
s,_ = call('GET',f'/api/sc/disputes/{dq}',tok=S); check('third business cannot see the dispute', s==404, s)
s,dr = call('GET',f'/api/sc/disputes/{dq}',tok=R); check('sender sees the dispute', s==200 and dr['twoSided'], dr.get('side'))
s,u = call('POST',f'/api/sc/movements/{mv1}/undo',{},R); check('undo refused once the receiver acted', s==409 and u.get('code')=='acted_on', u)
# 3. Ravi proposes split; Lakshmi accepts → resolved; issued = 599
s,p = call('POST',f'/api/sc/disputes/{dq}/propose',{'outcome':'split'},R); check('split proposed (not conceded)', p['dispute']['state']=='proposed', p)
s,a = call('POST',f'/api/sc/disputes/{dq}/accept',{},L); check('receiver accepts the split', s==200, a)
s,j = call('GET',f'/api/sc/jobs/{job1}',tok=R); check('issued after split = 599', j['job']['issued']==599, j['job']['issued'])
# 4. Weighed: 300 kg, Lakshmi confirms 297 (1.0 %, within 1.5 %) → weighing difference, badge confirmed
m2 = send(fab, 300, 'kg', proc='dyeing'); mv2=m2['movement']['id']; call('POST',f'/api/sc/movements/{mv2}/share-now',{},R)
s,mv = call('GET',f'/api/sc/movements/{mv2}',tok=L)
s,r = call('POST',f'/api/sc/movements/{mv2}/confirm',{'lines':[{'line_id':mv['lines'][0]['line_id'],'qty':297,'unit':'kg'}]},L)
check('297 of 300 kg is within tolerance', r['results'][0]['outcome']['outcome']=='within', r)
s,r2 = call('POST',f'/api/sc/movements/{mv2}/confirm',{'lines':[{'line_id':mv['lines'][0]['line_id'],'qty':297,'unit':'kg'}]},L)
check('a second identical confirm is a no-op', r2['results'][0].get('unchanged') is True, r2)
s,led = call('GET','/api/sc/parties/b/b_lakshmi/ledger',tok=R); b2=[x for x in led['history'] if x['id']==mv2][0]['badge']
check('sender history badge: confirmed by them', b2['kind']=='confirmed_by', b2)
s,led = call('GET','/api/sc/parties/b/b_ravi/ledger',tok=L); b3=[x for x in led['history'] if x['id']==mv2][0]['badge']
check('receiver history badge: confirmed by you', b3['kind']=='confirmed_by_you', b3)
check('receiver ledger lists no prices', 'paise' not in json.dumps(led))
# 5. Receiver-first: Lakshmi records 100 kg before Ravi does; Ravi records; match on visibility
s,rf = call('POST','/api/sc/movements/receive-first',{'from':{'k':'b','id':'b_ravi'},'process_key':'dyeing','lines':[{'spec_id':fab,'qty':100,'unit':'kg'}],'client_id':cid()},L)
check('receiver-first saved as unmatched', rf['receiveFirst']['status']=='unmatched', rf['receiveFirst']['status'])
s,o = call('GET','/api/sc/goods/out',tok=R); check('owner never sees the unmatched row', all(j['inputLabel'] for row in o['rows'] for j in row['jobs']))
m3 = send(fab, 100, 'kg', proc='dyeing'); mv3=m3['movement']['id']; call('POST',f'/api/sc/movements/{mv3}/share-now',{},R)
import time
for _ in range(20):  # matching runs in the background; under load it can take a few seconds
    time.sleep(0.5); s,mv = call('GET',f'/api/sc/movements/{mv3}',tok=R)
    if any(a['evidence']=='account' for a in mv['lines'][0]['received']): break
check('matched: receiver figure attached as account', any(a['evidence']=='account' and a['qty']==100000 for a in mv['lines'][0]['received']), mv['lines'][0]['received'])
s,c = call('GET','/api/sc/goods/coming',tok=L); check('unmatched list now empty', not any(u['id']==rf['receiveFirst']['id'] for u in c['unmatched']))
# 6. Return recorded by Ravi; Lakshmi gives her own (sender) figure; counted mismatch → dispute → she concedes
s,r = call('POST',f'/api/sc/jobs/{job1}/return',{'lines':[{'spec_id':tee,'qty':590,'unit':'pcs'}],'client_id':cid()},R); mvr=r['movement']['id']
call('POST',f'/api/sc/movements/{mvr}/share-now',{},R)
s,mv = call('GET',f'/api/sc/movements/{mvr}',tok=L)
s,r = call('POST',f'/api/sc/movements/{mvr}/sender-figure',{'lines':[{'line_id':mv['lines'][0]['line_id'],'qty':592,'unit':'pcs'}]},L); dq2=r['results'][0]['disputeId']
check('her 592 vs his 590 (counted) opens a dispute', bool(dq2), r)
s,p = call('POST',f'/api/sc/disputes/{dq2}/propose',{'outcome':'received'},L); check('sender conceding settles at once', p['dispute']['state']=='resolved', p)
s,j = call('GET',f'/api/sc/jobs/{job1}',tok=R); check('declared output now 592', j['job']['outputs']==592, j['job']['outputs'])
print('ALL PASS' if ok else 'SOME FAILED'); sys.exit(0 if ok else 1)
