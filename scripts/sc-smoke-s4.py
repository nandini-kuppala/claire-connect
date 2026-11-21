#!/usr/bin/env python3
# Slice 4 smoke walkthrough: Made here (cut, pack, QC, make sets, unpack), job detail, closing with leftovers and a
# shortage, reopening (by hand, on a late figure, on a settled claim), cancelling (V) and dyeing loss at close.
# LOCAL dev server only (SC_ENABLED=1, MONGODB_DB=nexconn_sc_dev; Ravi, Lakshmi and Sree flagged).
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
def spec(mt, attrs, tok=R): return call('POST','/api/sc/specs/resolve',{'material_type_id':mt,'attrs':attrs},tok)[1]['spec']['id']
def biz(i): return {'k':'b','id':i}
def share_confirm(mv, tok_from, tok_to):
    call('POST',f"/api/sc/movements/{mv['id']}/share-now",{},tok_from)
    return call('POST',f"/api/sc/movements/{mv['id']}/confirm",{'lines':[{'line_id':l['line_id']} for l in mv['lines']]},tok_to)
def detail(job, tok=R): return call('GET',f'/api/sc/jobs/{job}/detail',tok=tok)

fab = spec('mt_knit_fabric',{'state':'finished','structure':'single jersey','gsm':180,'colour':'navy'})
kS, kM = spec('mt_kit',{'style':'RKF-P22','colour':'navy','size':'S'}), spec('mt_kit',{'style':'RKF-P22','colour':'navy','size':'M'})
gS, gM = spec('mt_garment',{'style':'RKF-P22','colour':'navy','size':'S'}), spec('mt_garment',{'style':'RKF-P22','colour':'navy','size':'M'})
btn = spec('mt_button',{'kind':'polo','colour':'navy'})
call('POST','/api/sc/styles',{'code':'RKF-P22','size_set':['S','M','L','XL','XXL'],'set_weight_g':230,'trims':[{'spec_id':btn,'per_piece':3,'unit':'pcs','spare_pct':2}]},R)

# ── Made here → Cut (J17): 100 kg → 400 sets × 230 g + 7.5 kg waste → 0.5 kg unexplained
s,c = call('POST','/api/sc/made',{'process_key':'cutting','inputs':[{'spec_id':fab,'qty':100,'unit':'kg','lot':'N-0398'}],'outputs':[{'spec_id':kS,'qty':200,'unit':'pcs','lot':'N-0398'},{'spec_id':kM,'qty':200,'unit':'pcs','lot':'N-0398'}],'waste':{'qty':7.5,'unit':'kg'},'client_id':cid(),'allow_untracked':True,'untracked_reason':'opening stock'},R)
check('cut recorded and closed in one go', s==201, c.get('error'))
check('cutting: 0.5 kg unexplained against the style weight', c['plan']['residual']==500 and not c['plan']['unchecked'], c['plan'])
s,d = detail(c['job']['id']); check('cut job detail: closed, in-house', d['job']['status']=='closed' and d['job']['in_house'], d['job']['status'])
s,i = call('GET','/api/sc/goods/in',tok=R); kits={x['spec_id']:x['qty'] for x in i['mine'] if x['spec_id'] in (kS,kM)}
check('the cut kits are in my unit', kits.get(kS,0)>=200 and kits.get(kM,0)>=200, kits)
none = spec('mt_knit_fabric',{'state':'finished','structure':'interlock','gsm':260,'colour':'teal'})
s,_ = call('POST','/api/sc/made',{'process_key':'cutting','inputs':[{'spec_id':none,'qty':100,'unit':'kg'}],'outputs':[{'spec_id':kS,'qty':10,'unit':'pcs'}],'client_id':cid()},R)
check('Made here refuses fabric not in stock (owner can override)', s==409, s)

# ── Send the kits + buttons to Lakshmi, get garments back, close with leftovers and a shortage (H)
s,m = call('POST','/api/sc/movements/send',{'to':biz('b_lakshmi'),'process_key':'stitching','lines':[{'spec_id':kS,'qty':200,'unit':'pcs','lot':'N-0398'},{'spec_id':kM,'qty':200,'unit':'pcs','lot':'N-0398'},{'spec_id':btn,'qty':1224,'unit':'pcs'}],'client_id':cid(),'allow_untracked':True,'untracked_reason':'buttons not entered'},R)
job = m['job']['id']; share_confirm(m['movement'], R, L)
s,rt = call('POST',f'/api/sc/jobs/{job}/return',{'lines':[{'spec_id':gS,'qty':200,'unit':'pcs'},{'spec_id':gM,'qty':190,'unit':'pcs'}],'last':True,'client_id':cid()},R)
ret = rt['movement']; call('POST',f"/api/sc/movements/{ret['id']}/share-now",{},R)
s,pv = call('GET',f'/api/sc/jobs/{job}/close-preview',tok=R)
check('close preview: 10 pieces not accounted for', s==200 and pv['needs']['shortage']==10, pv.get('needs'))
brow=[l for l in pv['lines'] if l['role']=='secondary'][0]
check('close preview lists the buttons as a leftover candidate', brow['consumed']==1224, brow['consumed'])
s,cl = call('POST',f'/api/sc/jobs/{job}/close',{},R)
check('closing asks before recording a shortage', s==409 and cl.get('code')=='unaccounted' and cl.get('shortage')==10, (s, cl.get('code')))
s,cl = call('POST',f'/api/sc/jobs/{job}/close',{},L)
check("Lakshmi cannot close Ravi's job", s==404, s)
s,cl = call('POST',f'/api/sc/jobs/{job}/close',{'accept':True,'leftovers':[{'row_id':brow['row_id'],'qty':24,'unit':'pcs','disposition':'kept_adjusted','rate_paise':600}]},R)
check('closed with 24 buttons kept at ₹6 and the shortage recorded', s==200 and cl['closure']['residual']==10, cl.get('error'))
s,d = detail(job)
check('job detail: bill adjustment 24 × ₹6 = ₹144', any(a['amount_paise']==14400 for a in d['adjustments']), d['adjustments'])
check('conservation bar: 390 good + 10 unaccounted = 400', sorted((x['kind'],x['qty']) for x in d['segments'])==sorted([('output',390),('unaccounted',10)]), d['segments'])
s,i = call('GET','/api/sc/goods/in',tok=L); kept=sum(x['qty'] for x in i['mine'] if x['spec_id']==btn)
check('the kept buttons are now Lakshmi\'s own', kept>=24, kept)
s,d2 = detail(job, S); check('Sree cannot open the job', s==404, s)
s,lg = call('GET',f"/api/sc/movements/{ret['id']}",tok=L)
# Reopen by hand, close again
s,_ = call('POST',f'/api/sc/jobs/{job}/reopen',{'reason':'counting again'},R); s2,d = detail(job)
check('reopen puts the job back in progress', s==200 and d['job']['status'] in ('completed','in_progress') and d['closure'] is None, d['job']['status'])
s,cl = call('POST',f'/api/sc/jobs/{job}/close',{'accept':True,'leftovers':[{'row_id':brow['row_id'],'qty':24,'unit':'pcs','disposition':'kept_adjusted','rate_paise':600}]},R)
check('closes again', s==200, cl.get('error'))
# 04 §5.6.3: Lakshmi says she sent 192 M (not 190) after the close → auto reopen, re-post, close again with the claim carried
mline=[l for l in lg['lines'] if l['label'].endswith('M · Garments')][0]
s,sf = call('POST',f"/api/sc/movements/{ret['id']}/sender-figure",{'lines':[{'line_id':mline['line_id'],'qty':192,'unit':'pcs'}]},L)
s2,d = detail(job)
check('a late figure reopens and closes the job again', s==200 and d['job']['status']=='closed' and any(r['auto'] for r in d['reopens']), (s, sf.get('error'), d['job']['status']))
check('…with the open difference carried as a claim', len(d['closure']['carried_claims'])==1, d['closure']['carried_claims'])
disp = d['closure']['carried_claims'][0]
s,dd = call('GET',f'/api/sc/disputes/{disp}',tok=R)
s,pr = call('POST',f'/api/sc/disputes/{disp}/propose',{'outcome':'sent'},R)
s2,d = detail(job)
check('settling the carried claim reopens and closes again', s==200 and d['job']['status']=='closed' and len(d['reopens'])==3, (s, pr.get('error'), len(d['reopens'])))
check('after settling: 400 = 392 good + 8 unaccounted', sorted((x['kind'],x['qty']) for x in d['segments'])==sorted([('output',392),('unaccounted',8)]), d['segments'])

# ── Made here → Pack, Check (QC), Make sets, Unpack
poly = spec('mt_packing_material',{'kind':'polybag','size':'M'})
pkS = spec('mt_packed_garment',{'style':'RKF-P22','colour':'navy','size':'S','pack':'single'})
s,pk = call('POST','/api/sc/made',{'process_key':'packing','inputs':[{'spec_id':gS,'qty':200,'unit':'pcs'},{'spec_id':poly,'qty':200,'unit':'pcs'}],'outputs':[{'spec_id':pkS,'qty':200,'unit':'pcs'}],'client_id':cid(),'allow_untracked':True,'untracked_reason':'polybags'},R)
check('pack: 200 garments + polybags → 200 packed, nothing unaccounted', s==201 and pk['plan']['residual']==0, pk.get('error') or pk['plan'])
s,qc = call('POST','/api/sc/made',{'process_key':'checking','inputs':[{'spec_id':gM,'qty':190,'unit':'pcs'}],'outputs':[{'spec_id':gM,'qty':180,'unit':'pcs','grade':'A'},{'spec_id':gM,'qty':7,'unit':'pcs','grade':'rework'},{'spec_id':gM,'qty':2,'unit':'pcs','grade':'reject'}],'client_id':cid()},R)
check('QC: 180 good, 7 rework, 2 reject, 1 unaccounted', s==201 and qc['plan']['residual']==1, qc.get('error') or qc['plan'])
top, bot = spec('mt_garment',{'style':'RKF-T1','colour':'navy','size':'S'}), spec('mt_garment',{'style':'RKF-B1','colour':'navy','size':'S'})
st = spec('mt_packed_garment',{'style':'RKF-SET1','colour':'navy','size':'S','pack':'set'})
s,ms = call('POST','/api/sc/made',{'process_key':'make_sets','inputs':[{'spec_id':top,'qty':50,'unit':'pcs'},{'spec_id':bot,'qty':50,'unit':'pcs'}],'outputs':[{'spec_id':st,'qty':48,'unit':'pcs'}],'client_id':cid(),'allow_untracked':True,'untracked_reason':'demo'},R)
check('make sets: a top and a bottom per set (2 + 2 left over as unaccounted)', s==201 and ms['plan']['residual']==4, ms.get('error') or ms['plan'])
s,up = call('POST','/api/sc/made',{'process_key':'unpack','inputs':[{'spec_id':st,'qty':10,'unit':'pcs'}],'outputs':[{'spec_id':top,'qty':10,'unit':'pcs'},{'spec_id':bot,'qty':10,'unit':'pcs'}],'client_id':cid()},R)
check('unpack 10 sets from stock', s==201, up.get('error'))
s,mh = call('GET','/api/sc/made',tok=R); check('Made here history lists the in-house jobs', s==200 and len(mh['jobs'])>=5, len(mh.get('jobs',[])))

# ── V: cancel a job, the kits come back as sent, close
s,m2 = call('POST','/api/sc/movements/send',{'to':biz('b_lakshmi'),'process_key':'stitching','lines':[{'spec_id':kS,'qty':100,'unit':'pcs'}],'client_id':cid(),'allow_untracked':True,'untracked_reason':'demo'},R)
j2 = m2['job']['id']; share_confirm(m2['movement'], R, L)
s,_ = call('POST',f'/api/sc/jobs/{j2}/cancel',{'reason':'order cancelled'},R)
s,o = call('GET','/api/sc/goods/out',tok=R); row=[x for r in o['rows'] for x in r['jobs'] if x['id']==j2]
check('a cancelled job shows as cancelled, still 100 to come back', row and row[0]['cancelled'] and row[0]['pending']==100, row and (row[0]['cancelled'], row[0]['pending']))
s,rt2 = call('POST',f'/api/sc/jobs/{j2}/return',{'lines':[{'spec_id':kS,'qty':100,'unit':'pcs','unprocessed':True}],'last':True,'client_id':cid()},R)
s,o = call('GET','/api/sc/goods/out',tok=R); row=[x for r in o['rows'] for x in r['jobs'] if x['id']==j2]
check('after "as sent" comes back, nothing is left there', not row, row)
s,cl = call('POST',f'/api/sc/jobs/{j2}/close',{},R)
check('the cancelled job closes with nothing unaccounted', s==200 and cl['closure']['residual']==0, cl.get('error'))

# ── Dyeing at a contact: 300 kg → 280 kg back closes (6.7 % vs 7 % norm); 300 → 250 needs a yes
_, cs = call('GET','/api/sc/contacts',tok=R); noy=[c for c in cs['contacts'] if c['name']=='Noyyal Dyeing'][0]['id']
grey = spec('mt_knit_fabric',{'state':'grey','structure':'single jersey','gsm':180})
def dye(back):
    s,m = call('POST','/api/sc/movements/send',{'to':{'k':'c','id':noy},'process_key':'dyeing','lines':[{'spec_id':grey,'qty':300,'unit':'kg'}],'client_id':cid(),'allow_untracked':True,'untracked_reason':'demo'},R)
    j = m['job']['id']
    call('POST',f'/api/sc/jobs/{j}/return',{'lines':[{'spec_id':fab,'qty':back,'unit':'kg'}],'last':True,'client_id':cid()},R)
    return j
j3 = dye(280); s,cl = call('POST',f'/api/sc/jobs/{j3}/close',{},R)
check('dyeing 300 → 280 kg closes: loss 20 kg (6.7 %)', s==200 and cl['closure']['loss']==20000 and cl['closure']['loss_pct']==6.7, cl.get('error') or cl.get('closure'))
s,d = detail(j3); check('dyeing bar: 280 back + 20 loss', sorted((x['kind'],x['qty']) for x in d['segments'])==sorted([('output',280000),('loss',20000)]), d['segments'])
j4 = dye(250); s,cl = call('POST',f'/api/sc/jobs/{j4}/close',{},R)
check('dyeing 300 → 250 kg (16.7 %) needs a yes', s==409 and cl.get('highLoss')==16.7, (s, cl.get('highLoss')))
print('ALL PASS' if ok else 'SOME FAILED'); sys.exit(0 if ok else 1)
