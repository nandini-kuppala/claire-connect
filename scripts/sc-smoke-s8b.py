#!/usr/bin/env python3
# Slice 8b smoke: orders ↔ goods (J8, J15, D1, migration). LOCAL dev server only (SC_ENABLED=1, MONGODB_DB=nexconn_sc_dev;
# Ravi, Lakshmi flagged). Orders are created through the normal deal flow (deal → offer → accept).
import json, urllib.request, uuid, sys, random, subprocess
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
tee = call('POST','/api/sc/specs/resolve',{'material_type_id':'mt_garment','attrs':{'style':'LG-T10','colour':'navy','size':'M'}},L)[1]['spec']['id']
def goods(oid, tok=R): return call('GET',f'/api/sc/orders/{oid}/goods',tok=tok)
def order(oid, tok=R): return call('GET',f'/api/orders/{oid}',tok=tok)[1]
def ostatus(oid):
    o = order(oid); o = o.get('order', o); return o.get('status'), o.get('delivered_at') or o.get('deliveredAt')
def confirm(mv, tok=R):
    _, m = call('GET',f'/api/sc/movements/{mv}',tok=tok)
    return call('POST',f'/api/sc/movements/{mv}/confirm',{'lines':[{'line_id':l['line_id']} for l in m['lines']]},tok)

# ── A purchase order through the deal flow: Lakshmi offers 600 tees at ₹150, 30 % advance; Ravi accepts ─────────
s, d = call('POST','/api/deals/open',{'sellerBusinessId':'b_lakshmi'},R); conv = d['conversation']['id']
tshirt = next(l['id'] for l in call('GET','/api/listings?business=b_lakshmi',tok=R)[1]['listings'] if l['category'].startswith('garment'))  # a product, so the offer is a purchase
s, of = call('POST','/api/offers',{'conversationId':conv,'qty':600,'unitPrice':150,'advancePct':30,'creditDays':15,'title':'Navy tees LG-T10 M','listingId':tshirt},L)
s, ac = call('POST',f"/api/offers/{of['offer']['id']}/respond",{'action':'accept'},R)
oid = ac.get('order',{}).get('id'); check('a purchase order through deal → offer → accept', s==200 and oid and ac['order']['kind']=='purchase', (s, ac.get('error'), ac.get('order',{}).get('kind')))
s, g = goods(oid); check('the order has a Goods view: both use Goods, nothing sent yet', s==200 and g['order']['on_goods'] and g['progress']['sent']==0 and g['can']['dispatch'] is False, g.get('can'))
s, g = goods(oid, L); check('the seller may send goods; the buyer may not', g['can']['dispatch'] is True, g.get('can'))
s, e = call('POST',f'/api/sc/orders/{oid}/dispatch',{'lines':[{'spec_id':tee,'qty':10,'unit':'pcs'}],'client_id':cid()},R)
check('the buyer cannot record a dispatch', s==403, s)

# ── J8: 400 now, 200 later; the order is delivered only when all 600 arrived ────────────────────────────────────
s, d1 = call('POST',f'/api/sc/orders/{oid}/dispatch',{'lines':[{'spec_id':tee,'qty':400,'unit':'pcs'}],'dc_no':'DC-81','client_id':cid(),'allow_untracked':True,'untracked_reason':'demo'},L)
check('Lakshmi sends 400 against the order', s==201, (s, d1.get('error')))
m1 = d1['movement']['id']; call('POST',f'/api/sc/movements/{m1}/share-now',{},L)
import time; time.sleep(2)  # the order's own update runs in the background
st, _ = ostatus(oid); check('the order moves to "dispatched" with the first goods', st=='dispatched', st)
s, g = goods(oid); p = g['progress']
check('Ravi sees "600 ordered · 400 on the way"', p['ordered']==600 and p['sent']==400 and p['on_the_way']==400 and p['received']==0, p)
s, c = confirm(m1); s2, g = goods(oid); p = g['progress']
check('Ravi taps Received: 400 of 600 received', s==200 and p['received']==400 and p['on_the_way']==0, p)
st, dat = ostatus(oid); check('not delivered yet (200 still to come)', st=='dispatched' and not dat, (st, dat))
s, d2 = call('POST',f'/api/sc/orders/{oid}/dispatch',{'lines':[{'spec_id':tee,'qty':200,'unit':'pcs'}],'client_id':cid(),'allow_untracked':True,'untracked_reason':'demo'},L)
m2 = d2['movement']['id']; call('POST',f'/api/sc/movements/{m2}/share-now',{},L)
st, _ = ostatus(oid); check('a second dispatch is a partial delivery on the same order (no error)', s==201 and st=='dispatched', (s, st))
confirm(m2)
import time; time.sleep(1.5)
st, dat = ostatus(oid)
check('all 600 received → the order is delivered by the existing flow (delivered_at set)', st=='delivered' and dat, (st, dat))
o = order(oid); o = o.get('order', o)
check('the balance due date follows the credit days', bool(o.get('balance_due_at') or o.get('balanceDueAt')), {k:o.get(k) for k in ('balance_due_at','balanceDueAt')})
s, conv_d = call('GET',f'/api/conversations/{conv}',tok=R)
check('the rating card is posted once delivered', 'rating' in json.dumps(conv_d), s)
s, sm = call('GET','/api/sc/orders/goods-summary',tok=R)
check('the Orders tab summary has it: 600 of 600', sm['orders'].get(oid,{}).get('received')==600, sm['orders'].get(oid))

# ── Return some (J8): 12 wrong size ─────────────────────────────────────────────────────────────────────────────
s, rt = call('POST',f'/api/sc/orders/{oid}/return',{'lines':[{'spec_id':tee,'qty':12,'unit':'pcs'}],'reason':'wrong_size','client_id':cid()},R)
check('Ravi returns 12 (wrong size)', s==201, (s, rt.get('error')))
call('POST',f"/api/sc/movements/{rt['movement']['id']}/share-now",{},R)  # past the undo window, so Lakshmi sees it
s, g = goods(oid); p = g['progress']
check('the return shows on the order with its reason', p['returned']==12 and p['returns'][0]['reason'].startswith('Wrong size'), p['returns'])
s, _ = call('POST',f'/api/sc/orders/{oid}/return',{'lines':[{'spec_id':tee,'qty':1,'unit':'pcs'}],'reason':'defect','client_id':cid()},L)
check('the seller cannot "return" on the buyer\'s behalf', s==403, s)

# ── Bills (D1): both sides see the order at its agreed price, GST added; the advance tapped on the order shows once ──
def order_items(tok, k, i): return [x for x in call('GET',f'/api/sc/bills/{k}/{i}',tok=tok)[1]['items'] if x['label'].startswith(o.get('code') or 'CC-')]
ri = order_items(R,'b','b_lakshmi'); li = order_items(L,'b','b_ravi')
want = 600*150*105 - 12*150*105  # paise: (600 − 12) × ₹150 × 1.05
check('Ravi owes for 600 − 12 at ₹150 + 5 % GST = ₹92,610', sum(x['amount_paise'] for x in ri)==want and all(x['dir']=='i_owe' for x in ri), (sum(x['amount_paise'] for x in ri), want))
check('Lakshmi sees the same amount owed to her', sum(x['amount_paise'] for x in li)==want and all(x['dir']=='they_owe' for x in li), sum(x['amount_paise'] for x in li))
s, _ = call('POST',f'/api/orders/{oid}/event',{'type':'advance_paid'},R)
s2, b = call('GET','/api/sc/bills/b/b_lakshmi',tok=R)
adv = [x for x in b['settlements'] if x['id']==f'order:{oid}:advance']
check('the advance tapped on the order shows as a read-only payment (30 % of ₹94,500 = ₹28,350)', s==200 and adv and adv[0]['amount_paise']==2835000 and adv[0]['dir']=='paid' and not adv[0]['mine'], adv)
s, _ = call('POST',f'/api/sc/settlements/order:{oid}:advance/void',{},R); check('a mirrored payment cannot be voided here', s==404, s)

# ── J15: a job-work order → Send material → the work back covers it ──────────────────────────────────────────
s, rq = call('GET','/api/requirements?limit=1',tok=R); rqid = rq['requirements'][0]['id']
s, jo = call('POST','/api/jobs/offer',{'requirementId':rqid,'lines':[{'listingId':'none','businessId':'b_lakshmi','qty':100,'unitPrice':12}]},R)
s, ac = call('POST',f"/api/offers/{jo['offers'][0]['id']}/respond",{'action':'accept'},L)
jw = ac.get('order',{}).get('id'); check('a job-work order: stitch 100 at ₹12', s==200 and ac['order']['kind']=='job_work', (s, ac.get('error')))
s, g = goods(jw); check('the buyer gets Send material; nobody gets Send goods', g['can']['send_material'] and not g['can']['dispatch'], g['can'])
kit = call('POST','/api/sc/specs/resolve',{'material_type_id':'mt_kit','attrs':{'style':'RKF-P22','colour':'navy','size':'M'}},R)[1]['spec']['id']
s, sm = call('POST',f'/api/sc/orders/{jw}/send-material',{'process_key':'stitching','lines':[{'spec_id':kit,'qty':100,'unit':'pcs'}],'client_id':cid(),'allow_untracked':True,'untracked_reason':'demo','to':{'k':'b','id':'b_sree'}},R)
job = sm.get('job',{}).get('id') or (sm.get('movement') or {}).get('lines',[{}])[0].get('job_id')
s2, mv = call('GET',f"/api/sc/movements/{sm['movement']['id']}",tok=R)
check('Send material records a send to the order\'s seller (not who the body says), linked to the order', s==201 and mv['to']['id']=='b_lakshmi', (s, sm.get('error'), mv.get('to')))
s, g = goods(jw); jid = g['progress']['jobs'][0]['id'] if g['progress']['jobs'] else None
check('the order shows its job', jid is not None, g['progress'])
garment = call('POST','/api/sc/specs/resolve',{'material_type_id':'mt_garment','attrs':{'style':'RKF-P22','colour':'navy','size':'M'}},R)[1]['spec']['id']
_s, _r = call('POST',f'/api/sc/jobs/{jid}/return',{'lines':[{'spec_id':garment,'qty':60,'unit':'pcs'}],'client_id':cid()},R); call('POST',f"/api/sc/movements/{_r['movement']['id']}/share-now",{},R)  # delivery counts once past the undo window
s, g = goods(jw); st, _ = ostatus(jw)
check('60 of 100 back: progress 60, not delivered', g['progress']['done']==60 and st!='delivered', (g['progress']['done'], st))
_s, _r = call('POST',f'/api/sc/jobs/{jid}/return',{'lines':[{'spec_id':garment,'qty':40,'unit':'pcs'}],'last':True,'client_id':cid()},R); call('POST',f"/api/sc/movements/{_r['movement']['id']}/share-now",{},R)  # delivery counts once past the undo window
time.sleep(1.5); st, dat = ostatus(jw)
check('all 100 back → the job-work order is delivered', st=='delivered' and dat, (st, dat))
ri = [x for x in call('GET','/api/sc/bills/b/b_lakshmi',tok=R)[1]['items'] if x['source']['id']==jid]
check('the job is billed at the order price: 100 × ₹12 + 5 % = ₹1,260', ri and ri[0]['amount_paise']==126000, ri)

# ── Your history with them (J15) and the work profile (S18) ───────────────────────────────────────────────────
s, hs = call('GET','/api/sc/history?ids=b_lakshmi,b_sree,b_nobody',tok=R); hl = hs['history'].get('b_lakshmi')
check('"you: N jobs, usually D days" with Lakshmi, from my own jobs only', hl and hl['jobs']>=1 and 'b_nobody' not in hs['history'], hl)
s, hs2 = call('GET','/api/sc/history?ids=b_ravi',tok=L); check("Lakshmi's history never includes Ravi's jobs with others", 'b_ravi' not in hs2['history'] or hs2['history']['b_ravi']['jobs'] < 1000, s)
s, w = call('POST','/api/sc/profile/work',{'processes':['stitching','checking_packing'],'turnaround_days':5},L)
s2, w2 = call('GET','/api/sc/profile/work',tok=L)
check('"What work does your unit do?" is saved', s==200 and w2['work']['processes']==['stitching','checking_packing'], w2)
s, _ = call('POST','/api/sc/profile/work',{'processes':['bogus']},L); check('unknown work is refused', s==400, s)

# ── Migration: dry run writes nothing; apply is idempotent ────────────────────────────────────────────────────
def mig(*a): return subprocess.run(['bash','-lc','cd /Users/dev/Desktop/claire/server && source ~/.nvm/nvm.sh >/dev/null && nvm use 24 >/dev/null && MONGODB_DB=nexconn_sc_dev npx tsx src/sc/migrate-cli.ts '+' '.join(a)], capture_output=True, text=True).stdout
out1 = mig(); check('migration dry run prints a plan', 'dry run' in out1, out1.strip().splitlines()[-1:] )
out2 = mig('--apply'); out3 = mig('--apply')
check('apply twice: the second run creates nothing', ' 0 to create' in out3, out3.strip().splitlines()[-1:])
print('ALL PASS' if ok else 'SOME FAILED'); sys.exit(0 if ok else 1)
