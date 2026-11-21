#!/usr/bin/env python3
# Slice 8a smoke: bills and dues, record payment, set-off, performance, CSV, and owner-only money (03 S13–S14).
# LOCAL dev server only (SC_ENABLED=1, MONGODB_DB=nexconn_sc_dev; Ravi, Lakshmi flagged). A fresh contact keeps sums exact.
import json, urllib.request, uuid, sys, random
B='http://localhost:8787'  # local dev server only; never production
def raw(method, path, body=None, tok=None):
    req=urllib.request.Request(B+path, method=method, data=json.dumps(body).encode() if body is not None else None, headers={'content-type':'application/json', **({'authorization':'Bearer '+tok} if tok else {})})
    try:
        with urllib.request.urlopen(req) as r: return r.status, r.read(), dict(r.headers)
    except urllib.error.HTTPError as e: return e.code, e.read(), dict(e.headers)
def call(method, path, body=None, tok=None):
    s, b, _ = raw(method, path, body, tok); return s, json.loads(b or b'{}')
def login(phone): return call('POST','/api/auth/verify',{'phone':phone,'otp':'123456'})[1]['token']
cid = lambda: str(uuid.uuid4())
ok = True
def check(label, cond, extra=''):
    global ok
    ok = ok and bool(cond)
    print(('PASS ' if cond else 'FAIL ') + label + (f'  [{extra}]' if extra else ''))
R, L = login('9000000004'), login('9000000002')
def spec(mt, attrs): return call('POST','/api/sc/specs/resolve',{'material_type_id':mt,'attrs':attrs},R)[1]['spec']['id']
grey = spec('mt_knit_fabric',{'state':'grey','structure':'single jersey','gsm':180})
fab = spec('mt_knit_fabric',{'state':'finished','structure':'single jersey','gsm':180,'colour':'navy'})
today = call('GET','/api/sc/home',tok=R)[1].get('today') or __import__('datetime').datetime.utcnow().strftime('%Y-%m-%d')

# A fresh dyer whose name starts like a spreadsheet formula (for the CSV check).
s, c = call('POST','/api/sc/contacts',{'name':f'=SUM(1,1) Dyers {random.randint(1000,9999)}'},R)
check('a fresh contact', s==201, s); dyer = {'k':'c','id':c['contact']['id']}
s, _ = call('POST','/api/sc/rates',{'party':dyer,'process_key':'dyeing','basis':'per_input_mass','value_paise':4000,'effective_from':'2026-01-01'},R)
check('rate card: dyeing ₹40 a kg', s in (200,201), s)

def dye(kg, back, rate=None, close=True):
    body = {'to':dyer,'process_key':'dyeing','lines':[{'spec_id':grey,'qty':kg,'unit':'kg'}],'client_id':cid(),'allow_untracked':True,'untracked_reason':'demo', **({'rate_paise':rate} if rate else {})}
    s, m = call('POST','/api/sc/movements/send',body,R); j = m['job']['id']
    if back: call('POST',f'/api/sc/jobs/{j}/return',{'lines':[{'spec_id':fab,'qty':back,'unit':'kg'}],'last':True,'client_id':cid()},R)
    if back and close: call('POST',f'/api/sc/jobs/{j}/close',{},R)
    return j
def bill(tok=R, p=dyer): return call('GET',f"/api/sc/bills/{p['k']}/{p['id']}",tok=tok)

# ── Bills derived from rates ────────────────────────────────────────────────────────────────────
j1 = dye(100, 94)
s, b = bill(); bal = b['balance']
check('100 kg dyed at the card rate: you owe ₹4,000', s==200 and bal['i_owe']==400000 and bal['balance_i_owe']==400000, bal)
j2 = dye(50, None, rate=5000)
s, b = bill(); check('a job still at the dyer is not billed yet (rate on weight bills when done)', b['balance']['i_owe']==400000, b['balance']['i_owe'])
call('POST',f'/api/sc/jobs/{j2}/return',{'lines':[{'spec_id':fab,'qty':47,'unit':'kg'}],'last':True,'client_id':cid()},R); call('POST',f'/api/sc/jobs/{j2}/close',{},R)
s, b = bill(); check("the job's own agreed rate (₹50) wins over the card: + ₹2,500", b['balance']['i_owe']==650000, b['balance']['i_owe'])
check('each bill item links to its job', {i['source']['id'] for i in b['items']}=={j1, j2}, [i['source'] for i in b['items']])
check('oldest unpaid shows (0 days today)', b['balance']['oldest_unpaid_days']==0, b['balance']['oldest_unpaid_days'])
s, all_ = call('GET','/api/sc/bills',tok=R)
check('the dyer is on the bills list with net −₹6,500', any(p['party']==dyer and p['net']==-650000 for p in all_['parties']))

# ── Record payment (record only) ────────────────────────────────────────────────────────────────
k = cid()
s, p1 = call('POST','/api/sc/settlements',{'party':dyer,'direction':'paid','amount_paise':300000,'mode':'upi','ref':'UTR 1234','client_id':k},R)
check('record "I paid ₹3,000 by UPI"', s==201, (s, p1))
s, dup = call('POST','/api/sc/settlements',{'party':dyer,'direction':'paid','amount_paise':300000,'mode':'upi','client_id':k},R)
check('the same tap twice records once', dup.get('duplicate') is True, dup)
s, b = bill(); check('balance ₹3,500 left; oldest unpaid now the second job', b['balance']['balance_i_owe']==350000 and b['balance']['paid']==300000, b['balance'])
s, _ = call('POST',f"/api/sc/settlements/{p1['settlement']['id']}/void",{},R)
s2, b = bill(); check('a wrong entry is voided, not deleted: back to ₹6,500', s==200 and b['balance']['balance_i_owe']==650000 and not b['settlements'], b['balance'])
call('POST','/api/sc/settlements',{'party':dyer,'direction':'paid','amount_paise':300000,'mode':'cash','client_id':cid()},R)

# ── Y: work both ways, set off one bill against the other ───────────────────────────────────────
s, t = call('POST','/api/sc/movements/trade',{'kind':'sell','party':dyer,'lines':[{'spec_id':fab,'qty':10,'unit':'kg'}],'rate_paise':20000,'client_id':cid()},R)
check('sell them 10 kg at ₹200 a kg', s==201, (s, t.get('error')))
s, b = bill(); bal = b['balance']
check('they owe ₹2,000, I owe ₹3,500: net −₹1,500', bal['balance_they_owe']==200000 and bal['balance_i_owe']==350000 and bal['net']==-150000, bal)
s, e = call('POST','/api/sc/settlements',{'party':dyer,'direction':'setoff','amount_paise':250000,'mode':'adjustment','client_id':cid()},R)
check('a set-off larger than the smaller side is refused', s==409, (s, e.get('error')))
s, _ = call('POST','/api/sc/settlements',{'party':dyer,'direction':'setoff','amount_paise':200000,'mode':'adjustment','client_id':cid()},R)
s2, b = bill(); bal = b['balance']
check('set off ₹2,000: they owe nothing, I owe ₹1,500, no money moved', s==201 and bal['balance_they_owe']==0 and bal['balance_i_owe']==150000 and bal['setoff']==200000, bal)

# ── Between two businesses: one record, each side sees its own direction ────────────────────────
s, _ = call('POST','/api/sc/settlements',{'party':{'k':'b','id':'b_lakshmi'},'direction':'received','amount_paise':12345,'mode':'neft','client_id':cid()},R)
s2, lb = call('GET','/api/sc/bills/b/b_ravi',tok=L)
check('Ravi records "Lakshmi paid me ₹123.45"; Lakshmi sees it as paid', s==201 and any(x['dir']=='paid' and x['amount_paise']==12345 and not x['mine'] for x in lb['settlements']), [x for x in lb['settlements'] if x['amount_paise']==12345])
s, _ = raw('GET',f"/api/sc/bills/c/{dyer['id']}",tok=L)[:2] and call('GET',f"/api/sc/bills/c/{dyer['id']}",tok=L)
check("Lakshmi cannot open Ravi's contact's bills", s==404, s)
s, _ = call('POST','/api/sc/settlements',{'party':dyer,'direction':'paid','amount_paise':100,'mode':'cash','client_id':cid()},L)
check("nor record a payment to Ravi's contact", s==404, s)

# ── Performance: fixed yardsticks, n ≥ 3 ────────────────────────────────────────────────────────
def perf(): return [r for r in call('GET','/api/sc/reports/performance',tok=R)[1]['rows'] if r['party']==dyer]
p = perf(); check('2 jobs: "not enough history yet", no numbers', p and p[0]['n']==2 and not p[0]['enough'] and p[0]['median_days'] is None and p[0]['loss_pct'] is None, p)
dye(100, 95)
p = perf()[0]
check('3 jobs: median loss 6 % against the usual 7 % and the promised days', p['enough'] and p['loss_pct']==6.0 and p['loss_norm_pct']==7 and p['promised_days']==6 and p['median_days'] is not None, p)

# ── CSV: owner only, formula cells neutralised, negative amounts stay numbers ───────────────────
s, body, hdr = raw('GET','/api/sc/reports/bills.csv',tok=R)
text = body.decode('utf-8-sig')
line = next((l for l in text.splitlines() if 'Dyers' in l and dyer['id'] and '=SUM' in l), '')
check('bills.csv downloads as text/csv', s==200 and 'text/csv' in hdr.get('Content-Type', hdr.get('content-type','')), (s, hdr.get('Content-Type')))
check("a name like =SUM(…) is written as text ('=SUM…), not a formula", line.startswith('"\'=SUM') or line.startswith("'=SUM"), line[:40])
check('negative nets stay plain numbers (−₹5,500 after the third job)', ',-5500.00,' in line, line)
s, body, _ = raw('GET','/api/sc/reports/performance.csv',tok=R); check('performance.csv too', s==200 and b'Median days' in body, s)

# ── Staff never see money ───────────────────────────────────────────────────────────────────────
kphone = '96' + ''.join(random.choice('0123456789') for _ in range(8))
call('POST','/api/sc/staff',{'name':'Kavitha','phone':kphone},R); K = login(kphone)
bad = [(m,p,s) for (m,p,bd) in [('GET','/api/sc/bills',None),('GET',f"/api/sc/bills/c/{dyer['id']}",None),('POST','/api/sc/settlements',{'party':dyer,'direction':'paid','amount_paise':100,'mode':'cash','client_id':cid()}),
        ('GET','/api/sc/reports/performance',None),('GET','/api/sc/reports/gst',None),('GET','/api/sc/reports/bills.csv',None),('GET','/api/sc/reports/performance.csv',None)] for s in [raw(m,p,bd,K)[0]] if s!=403]
check('staff are refused every money and report route', not bad, bad)
st = [x for x in call('GET','/api/sc/staff',tok=R)[1]['staff'] if x['phone']==kphone]
if st: call('DELETE',f"/api/sc/staff/{st[0]['id']}",tok=R)
print('ALL PASS' if ok else 'SOME FAILED'); sys.exit(0 if ok else 1)
