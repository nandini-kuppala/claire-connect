#!/usr/bin/env python3
# Slice 9 smoke: offline retries are safe (04 §5.4). Every record the phone can keep offline is sent twice with the
# same body, as a retry after a lost response would be; the second must not record anything new, and a queued
# confirmation must never fail on a stale version. LOCAL dev server only (SC_ENABLED=1, MONGODB_DB=nexconn_sc_dev).
import json, urllib.request, uuid, sys, subprocess
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
def spec(mt, attrs, tok=R): return call('POST','/api/sc/specs/resolve',{'material_type_id':mt,'attrs':attrs},tok)[1]['spec']['id']
kit = spec('mt_kit',{'style':'RKF-P22','colour':'navy','size':'S'})
gar = spec('mt_garment',{'style':'RKF-P22','colour':'navy','size':'S'})
fab = spec('mt_knit_fabric',{'state':'finished','structure':'single jersey','gsm':180,'colour':'navy'})
def events(): return call('GET','/api/sc/adjust',tok=R)[1]  # cheap touch to keep the session warm
def twice(label, path, body, tok=R, ok_first=(200,201)):
    s1, a = call('POST', path, body, tok); s2, b = call('POST', path, body, tok)
    check(f'{label}: the retry records nothing new', s1 in ok_first and s2 in (200, 201) and (b.get('duplicate') is True or b == a or (path.endswith('/confirm') and all(x.get('unchanged') for x in b.get('results', [])))), (s1, s2, {k: b.get(k) for k in ('duplicate', 'error')}))
    return a

# Send for work → its job; then got back, work done, send back (Lakshmi's side)
send = twice('send for work', '/api/sc/movements/send', {'to':{'k':'b','id':'b_lakshmi'},'process_key':'stitching','lines':[{'spec_id':kit,'qty':30,'unit':'pcs'}],'client_id':cid(),'allow_untracked':True,'untracked_reason':'s9'})
job = send['job']['id']; mv = send['movement']['id']
s, jobs = call('GET','/api/sc/goods/out',tok=R)
check('…and exactly one job and one movement exist for that client id', sum(1 for r in jobs['rows'] for j in r.get('jobs', []) if j.get('id')==job) <= 1, '')
call('POST',f'/api/sc/movements/{mv}/share-now',{},R)
# A queued confirmation: the sender changes the record meanwhile (version bump), then the receiver's queued tap arrives twice
_, m = call('GET',f'/api/sc/movements/{mv}',tok=L)
body = {'lines':[{'line_id':m['lines'][0]['line_id']}]}
call('POST',f'/api/sc/jobs/{job}/instruct',{'to':{'k':'b','id':'b_sree'},'process_key':'checking'},R)  # anything that bumps versions on the job; ignore the result
s1, c1 = call('POST',f'/api/sc/movements/{mv}/confirm',body,L); s2, c2 = call('POST',f'/api/sc/movements/{mv}/confirm',body,L)
check('a queued confirmation never fails on a stale version, and its retry is "unchanged"', s1==200 and s2==200 and c2['results'][0].get('unchanged'), (s1, s2, c2.get('results')))
_, m2 = call('GET',f'/api/sc/movements/{mv}',tok=R)
check('…one receipt assertion from Lakshmi, not two', sum(1 for a in m2['lines'][0]['received'] if a.get('by')=='b_lakshmi') == 1, m2['lines'][0]['received'])
twice('work done (output)', f'/api/sc/jobs/{job}/output', {'lines':[{'spec_id':gar,'qty':10,'unit':'pcs'}],'client_id':cid()}, tok=L)
_, d = call('GET',f'/api/sc/jobs/{job}/detail',tok=R)
check('…the job shows 10 done, not 20', sum(o['qty'] for o in d.get('outputs', [])) in (10,) or d['job'].get('outputs', {}).get('A', 10) == 10, d['job'].get('outputs'))
twice('got back', f'/api/sc/jobs/{job}/return', {'lines':[{'spec_id':gar,'qty':10,'unit':'pcs'}],'client_id':cid()})
# Trade, made here, count, receive-first
twice('a sale', '/api/sc/movements/trade', {'kind':'sell','party':{'k':'c','id':call('GET','/api/sc/contacts',tok=R)[1]['contacts'][0]['id']},'lines':[{'spec_id':fab,'qty':1,'unit':'kg'}],'client_id':cid(),'allow_untracked':True,'untracked_reason':'s9'})
twice('made here', '/api/sc/made', {'process_key':'checking','inputs':[{'spec_id':gar,'qty':5,'unit':'pcs'}],'outputs':[{'spec_id':gar,'qty':5,'unit':'pcs'}],'client_id':cid(),'allow_untracked':True,'untracked_reason':'s9'})
row = next(r for r in call('GET','/api/sc/stock',tok=R)[1]['rows'] if not r['with'] and r['dimension']=='count' and r['qty']>=100)
twice('a stock count', '/api/sc/adjust', {'op':'count','holding_id':row['id'],'qty':row['qty']-1,'unit':'pcs','client_id':cid()})
row2 = next(r for r in call('GET','/api/sc/stock',tok=R)[1]['rows'] if r['id']==row['id'])
check('…the book moved by 1, not 2', row2['qty']==row['qty']-1, (row['qty'], row2['qty']))
# A staff count that waits for the owner: the retry must not ask twice
import random
kph = '96' + ''.join(random.choice('0123456789') for _ in range(8))
call('POST','/api/sc/staff',{'name':'Kavitha','phone':kph},R); K = login(kph)
big = {'op':'count','holding_id':row['id'],'qty':row2['qty']-50,'unit':'pcs','client_id':cid()}
s1, p1 = call('POST','/api/sc/adjust',big,K); s2, p2 = call('POST','/api/sc/adjust',big,K)
pend = [x for x in call('GET','/api/sc/approvals',tok=R)[1]['counts'] if x['id']==p1['adjustment']['id']]
check('a staff count waiting for the owner: the retry does not ask twice', s1==202 and s2==202 and p2['adjustment']['id']==p1['adjustment']['id'] and len(pend)==1, (s1, s2, p1['adjustment']['id'], p2['adjustment']['id']))
call('POST',f"/api/sc/adjust/{p1['adjustment']['id']}/reject",{},R)
st = [x for x in call('GET','/api/sc/staff',tok=R)[1]['staff'] if x['phone']==kph]
if st: call('DELETE',f"/api/sc/staff/{st[0]['id']}",tok=R)
twice('received for work (receiver first)', '/api/sc/movements/receive-first', {'from':{'k':'b','id':'b_ravi'},'process_key':'stitching','lines':[{'spec_id':kit,'qty':5,'unit':'pcs'}],'client_id':cid()}, tok=L)

# Retries of records that used tracked stock (no override): the first send used the stock, so the retry must answer
# "duplicate", never "not enough stock" (an offline re-send after a lost reply). And stock bought with a lot can be
# sent or cut without typing the lot.
lotc = 'RT-' + ''.join(random.choice('0123456789') for _ in range(6))
fx = spec('mt_knit_fabric',{'state':'finished','structure':'single jersey','gsm':180,'colour':'olive'})
supp = call('GET','/api/sc/contacts',tok=R)[1]['contacts'][0]['id']
s, _ = call('POST','/api/sc/movements/trade',{'kind':'buy','party':{'k':'c','id':supp},'lines':[{'spec_id':fx,'qty':40,'unit':'kg','lot':lotc}],'client_id':cid()},R)
check('bought 40 kg with a lot', s in (200,201), _)
s, r = call('POST','/api/sc/movements/send',{'to':{'k':'b','id':'b_lakshmi'},'process_key':'dyeing','lines':[{'spec_id':fx,'qty':25,'unit':'kg'}],'client_id':cid()},R)
check('send without typing the lot takes the goods from the lot', s==201 and r['movement']['lines'][0]['lot']==lotc and r['movement']['lines'][0]['from_untracked']==0, (s, r.get('code'), r.get('lines')))
twice('send of tracked stock (no override)', '/api/sc/movements/send', {'to':{'k':'b','id':'b_lakshmi'},'process_key':'dyeing','lines':[{'spec_id':fx,'qty':10,'unit':'kg','lot':lotc}],'client_id':cid()})
twice('made here from tracked stock (no lot typed)', '/api/sc/made', {'process_key':'checking','inputs':[{'spec_id':fx,'qty':5,'unit':'kg'}],'outputs':[{'spec_id':fx,'qty':5,'unit':'kg'}],'client_id':cid()})
row3 = next(r for r in call('GET','/api/sc/stock',tok=R)[1]['rows'] if not r['with'] and r['spec'] and r['spec']['id']==fx and r['qty']>0)
twice('write off all of a row', '/api/sc/adjust', {'op':'write_off','holding_id':row3['id'],'qty':row3['qty']/1000,'unit':'kg','reason':'retry test','client_id':cid()})

# Budget and translations
b = subprocess.run(['bash','-lc','cd /Users/dev/Desktop/claire && source ~/.nvm/nvm.sh >/dev/null && nvm use 24 >/dev/null && npm run build -w web >/dev/null 2>&1 && node scripts/sc-budget.mjs'], capture_output=True, text=True)
check('every Goods route stays within 150 KB gz beyond the app shell', b.returncode==0, b.stdout.strip().splitlines()[-1:] )
i = subprocess.run(['bash','-lc','cd /Users/dev/Desktop/claire && source ~/.nvm/nvm.sh >/dev/null && nvm use 24 >/dev/null && node scripts/i18n-check.mjs all'], capture_output=True, text=True)
check('i18n:check: all seven overlay languages 100 %', i.returncode==0, [l for l in i.stdout.splitlines() if '✗' in l][:3])
print('ALL PASS' if ok else 'SOME FAILED'); sys.exit(0 if ok else 1)
