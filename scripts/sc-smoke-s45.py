#!/usr/bin/env python3
# Slice 4.5 smoke walkthrough: buy (kept at seller, N), collect, return to supplier (M), grade per line (Z), sell to a
# business on CLAIRE and to a contact, kept for the buyer, sell from a job worker's premises (AA), samples (AD), move
# between places (AB), sale in place of allocated goods (04 §5.6.6), adjustments incl. respec (E2), casualty.
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
def contact(name, tok=R):
    _, cs = call('GET','/api/sc/contacts',tok=tok); f=[c for c in cs['contacts'] if c['name']==name]
    return {'k':'c','id': f[0]['id'] if f else call('POST','/api/sc/contacts',{'name':name,'phone':'98765'+str(abs(hash(name)))[:5],'language':'ta'},tok)[1]['contact']['id']}
def place(name, tok=R):
    _, ps = call('GET','/api/sc/places',tok=tok); f=[p for p in ps['places'] if p['name']==name]
    return f[0]['_id'] if f else call('POST','/api/sc/places',{'name':name,'kind':'godown'},tok)[1]['place']['_id']
def stock(tok=R): return call('GET','/api/sc/stock',tok=tok)[1]['rows']
def qty_of(rows, spec_id, **kw):
    return sum(r['qty'] for r in rows if r['spec'] and r['spec']['id']==spec_id and all((r.get(k) if k!='with_id' else (r['with'] or {}).get('party',{}).get('id')) == v for k,v in kw.items()))
def trade(body, tok=R): return call('POST','/api/sc/movements/trade',{'client_id':cid(), **body},tok)
def confirm(mv_id, tok, qty=None):
    _, m = call('GET',f'/api/sc/movements/{mv_id}',tok=tok)
    return call('POST',f'/api/sc/movements/{mv_id}/confirm',{'lines':[{'line_id':l['line_id'], **({'qty':qty,'unit':'kg'} if qty else {})} for l in m['lines']]},tok)

amman, kumaran, mani = contact('Sri Amman Fabrics'), contact('Kumaran Trims'), contact('Mani Exports')
godown, floor = place('Godown'), place('Cutting floor')
black = spec('mt_knit_fabric',{'state':'finished','structure':'single jersey','gsm':180,'colour':'black'})
zip9 = spec('mt_zip',{'length_in':9,'colour':'navy'})
tee = spec('mt_garment',{'style':'RKF-P22','colour':'navy','size':'L'})

# ── N: buy 200 kg kept at the seller; collect 60 kg to the godown
b0 = qty_of(stock(), black, with_id=amman['id'])
s,_ = trade({'kind':'buy','party':amman,'in_place':True,'lines':[{'spec_id':black,'qty':200,'unit':'kg','lot':'B-77'}]})
check('buy kept at the seller', s==201, s)
check('200 kg are mine, at Sri Amman', qty_of(stock(), black, with_id=amman['id'])-b0==200000)
g0 = qty_of(stock(), black, place_id=godown, with_id=None)
s,_ = trade({'kind':'collect','party':amman,'to_place_id':godown,'lines':[{'spec_id':black,'qty':60,'unit':'kg','lot':'B-77'}]})
st = stock()
check('collect 60 kg: 140 still at Sri Amman, 60 in the godown', s==201 and qty_of(st, black, with_id=amman['id'])-b0==140000 and qty_of(st, black, place_id=godown, with_id=None)-g0==60000, s)
s,_ = trade({'kind':'collect','party':amman,'to_place_id':godown,'lines':[{'spec_id':black,'qty':1000,'unit':'kg','lot':'B-77'}]})
check('cannot collect more than is there', s==409, s)
s,x = trade({'kind':'buy','party':biz('b_sree'),'lines':[{'spec_id':black,'qty':5,'unit':'kg'}]})
check('a business on CLAIRE records its own sale (buy refused)', s==409 and x.get('code')=='they_record', s)

# ── M: buy zips (their bill says 102, I counted 100 → a difference), return 20 to the supplier
z0 = qty_of(stock(), zip9, with_id=None)
s,bz = trade({'kind':'buy','party':kumaran,'to_place_id':godown,'lines':[{'spec_id':zip9,'qty':100,'unit':'pcs','they_sent':102}]})
check('buy 100 zips, bill says 102: a counted difference opens', s==201 and bz['movement']['lines'][0]['settled']['outcome']=='beyond', bz.get('movement'))
s,_ = trade({'kind':'return_to_supplier','party':kumaran,'lines':[{'spec_id':zip9,'qty':20,'unit':'pcs','holding_id':[r for r in stock() if r['spec'] and r['spec']['id']==zip9 and not r['with']][0]['id']}]})
check('return 20 zips to the supplier → 80 left', s==201 and qty_of(stock(), zip9, with_id=None)-z0==80, s)
s,led = call('GET',f"/api/sc/parties/c/{kumaran['id']}/ledger",tok=R)
check("Kumaran's ledger shows bought and returned", {'buy','return_to_supplier'} <= {h['action'] for h in led['history']}, [h['action'] for h in led['history']][:4])

# ── Z: grade per line
t0 = qty_of(stock(), tee, grade='B', with_id=None)
s,_ = trade({'kind':'buyer_returned','party':mani,'to_place_id':godown,'lines':[{'spec_id':tee,'qty':50,'unit':'pcs','grade':'B'}]})
check('buyer returned 50 pcs graded B', s==201 and qty_of(stock(), tee, grade='B', with_id=None)-t0==50, s)

# ── Sell to Lakshmi (on CLAIRE): title passes on her confirm; within tolerance → weighing loss
src=[r for r in stock() if r['spec'] and r['spec']['id']==black and r['place_id']==godown and not r['with']][0]
s,sl = trade({'kind':'sell','party':biz('b_lakshmi'),'lines':[{'spec_id':black,'qty':30,'unit':'kg','holding_id':src['id']}],'rate_paise':42000})
mv = sl['movement']['id']; call('POST',f'/api/sc/movements/{mv}/share-now',{},R)
l0 = qty_of(stock(L), black, with_id=None)
s,c = confirm(mv, L, 29.8)
check('Lakshmi confirms 29.8 kg: hers now, within tolerance', s==200 and qty_of(stock(L), black, with_id=None)-l0==29800, c)
s,mvL = call('GET',f'/api/sc/movements/{mv}',tok=L); check('the buyer never sees the rate', 'rate' not in json.dumps(mvL), '')
# Sell to a contact (leaves my books), and kept for the buyer at my unit
g1 = qty_of(stock(), black, place_id=godown, with_id=None)
s,_ = trade({'kind':'sell','party':mani,'lines':[{'spec_id':black,'qty':10,'unit':'kg','holding_id':src['id']}]})
s2,_ = trade({'kind':'sell','party':mani,'in_place':True,'lines':[{'spec_id':black,'qty':5,'unit':'kg','holding_id':src['id']}]})
check('sold 10 kg to Mani and 5 kg kept for Mani: 15 kg less of mine', s==201 and s2==201 and g1-qty_of(stock(), black, place_id=godown, with_id=None)==15000, (s,s2))
s,au = call('GET','/api/sc/adjust/at-my-unit',tok=R); kept=[x for x in au['rows'] if not x['mine'] and x['for']=='Mani Exports']
check("Mani's 5 kg are at my unit, not mine", kept and kept[0]['qty']>=5000, kept)

# ── AD: lend a sample to Lakshmi; AA: sell 5 of it to Mani from Lakshmi's premises; give a sample to Sree
s,smp = trade({'kind':'returnable_sample','party':biz('b_lakshmi'),'returnable_until':'2026-12-05','lines':[{'spec_id':tee,'qty':10,'unit':'pcs','grade':'B','holding_id':[r for r in stock() if r['spec'] and r['spec']['id']==tee and r['grade']=='B' and not r['with']][0]['id']}]})
call('POST',f"/api/sc/movements/{smp['movement']['id']}/share-now",{},R); confirm(smp['movement']['id'], L)
w0 = qty_of(stock(), tee, with_id='b_lakshmi')
check('the lent sample is still mine, at Lakshmi', w0>=10, w0)
row=[r for r in stock() if r['spec'] and r['spec']['id']==tee and (r['with'] or {}).get('party',{}).get('id')=='b_lakshmi'][0]
s,_ = trade({'kind':'sell','party':mani,'from_party':biz('b_lakshmi'),'lines':[{'spec_id':tee,'qty':5,'unit':'pcs','grade':'B','holding_id':row['id']}]})
check("AA: sold 5 from Lakshmi's premises → 5 left there", s==201 and w0-qty_of(stock(), tee, with_id='b_lakshmi')==5, s)
s,gv = trade({'kind':'sample','party':biz('b_sree'),'lines':[{'spec_id':zip9,'qty':2,'unit':'pcs','holding_id':[r for r in stock() if r['spec'] and r['spec']['id']==zip9 and not r['with']][0]['id']}]})
call('POST',f"/api/sc/movements/{gv['movement']['id']}/share-now",{},R); confirm(gv['movement']['id'], S)
check('a given sample is Sree\'s once confirmed', qty_of(stock(S), zip9, with_id=None)>=2)

# ── AB: move 20 kg from the godown to the cutting floor
f0 = qty_of(stock(), black, place_id=floor, with_id=None)
s,_ = trade({'kind':'move','from_place_id':godown,'to_place_id':floor,'lines':[{'spec_id':black,'qty':10,'unit':'kg','holding_id':src['id']}]})
check('moved 10 kg to the cutting floor', s==201 and qty_of(stock(), black, place_id=floor, with_id=None)-f0==10000, s)

# ── 04 §5.6.6: sell 40 kg of grey that is at Lakshmi for dyeing to Sree; the rest stays Ravi's job
grey = spec('mt_knit_fabric',{'state':'grey','structure':'single jersey','gsm':180})
s,m = call('POST','/api/sc/movements/send',{'to':biz('b_lakshmi'),'process_key':'dyeing','lines':[{'spec_id':grey,'qty':100,'unit':'kg'}],'client_id':cid(),'allow_untracked':True,'untracked_reason':'demo'},R)
pj = m['job']['id']; call('POST',f"/api/sc/movements/{m['movement']['id']}/share-now",{},R); confirm(m['movement']['id'], L)
s,sp = call('POST',f'/api/sc/jobs/{pj}/sell-part',{'to':biz('b_sree'),'lines':[{'spec_id':grey,'qty':40,'unit':'kg'}],'client_id':cid()},R)
check('sold 40 kg in place: a child job for Sree', s==201, sp.get('error'))
s,o = call('GET','/api/sc/goods/out',tok=R); rj=[x for r in o['rows'] for x in r['jobs'] if x['id']==pj]
check("Ravi's job now has 60 kg at Lakshmi", rj and rj[0]['pending']==60000, rj and rj[0]['pending'])
s,o = call('GET','/api/sc/goods/out',tok=S); sj=[x for r in o['rows'] for x in r['jobs'] if x['id']==sp['job']['id']]
check("Sree sees her 40 kg at Lakshmi as her own job", sj and sj[0]['pending']==40000, sj and sj[0]['pending'])
s,_ = call('GET',f'/api/sc/jobs/{pj}/detail',tok=S); check("Sree cannot open Ravi's job", s==404, s)
s,o = call('GET','/api/sc/goods/others',tok=L); grp={g['client']['id']:[x for x in g['jobs'] if x['id'] in (pj, sp['job']['id'])] for g in o['groups']}
check('Lakshmi holds 60 for Ravi and 40 for Sree', grp.get('b_ravi') and grp['b_ravi'][0]['inputsHere']==60000 and grp.get('b_sree') and grp['b_sree'][0]['inputsHere']==40000, (grp.get('b_ravi'), grp.get('b_sree')))

# ── Adjustments: found → respec (E2), regrade, relot/split, write off, count
unspec = spec('mt_unspecified_mass',{'note':'black lot from shelf'})
s,_ = call('POST','/api/sc/adjust',{'op':'found','spec_id':unspec,'qty':12,'unit':'kg','place_id':godown,'client_id':cid()},R)
hid=[r for r in stock() if r['spec'] and r['spec']['id']==unspec and r['place_id']==godown][0]['id']
b1 = qty_of(stock(), black, place_id=godown, with_id=None)
s,_ = call('POST','/api/sc/adjust',{'op':'respec','holding_id':hid,'qty':12,'unit':'kg','to_spec_id':black,'reason':'it is black SJ','client_id':cid()},R)
check('E2: found 12 kg "other", respec to black SJ', s==201 and qty_of(stock(), black, place_id=godown, with_id=None)-b1==12000, s)
s,x = call('POST','/api/sc/adjust',{'op':'respec','holding_id':src['id'],'qty':1,'unit':'kg','to_spec_id':tee,'client_id':cid()},R)
check('respec refuses a different measure (kg → pcs)', s==400, x.get('error'))
trow=[r for r in stock() if r['spec'] and r['spec']['id']==tee and r['grade']=='B' and not r['with']][0]
s,_ = call('POST','/api/sc/adjust',{'op':'regrade','holding_id':trow['id'],'qty':4,'unit':'pcs','to_grade':'reject','client_id':cid()},R)
check('regrade 4 pcs B → reject', s==201 and qty_of(stock(), tee, grade='reject', with_id=None)>=4, s)
s,_ = call('POST','/api/sc/adjust',{'op':'relot','holding_id':src['id'],'qty':5,'unit':'kg','to_lot':'B-77/2','client_id':cid()},R)
check('split 5 kg into lot B-77/2', s==201 and qty_of(stock(), black, lot='B-77/2', with_id=None)>=5000, s)
s,x = call('POST','/api/sc/adjust',{'op':'write_off','holding_id':trow['id'],'qty':1,'unit':'pcs','client_id':cid()},R)
check('write off needs a reason', s==400, x.get('error'))
s,_ = call('POST','/api/sc/adjust',{'op':'write_off','holding_id':trow['id'],'qty':1,'unit':'pcs','reason':'torn','client_id':cid()},R)
zrow=[r for r in stock() if r['spec'] and r['spec']['id']==zip9 and not r['with']][0]
s,cn = call('POST','/api/sc/adjust',{'op':'count','holding_id':zrow['id'],'qty':zrow['qty']-3,'unit':'pcs','client_id':cid()},R)
check('count 3 short of the book', s==201 and cn['adjustment']['difference']==-3, cn.get('adjustment'))
s,x = call('POST','/api/sc/adjust',{'op':'count','holding_id':[r for r in stock() if r['with']][0]['id'],'qty':1,'unit':'kg','client_id':cid()},R)
check('counts are only for goods at my own unit', s==400, x.get('error'))

# ── Casualty at Lakshmi's unit: her own black, Ravi's grey (job), Sree's grey (child job)
s,au = call('GET','/api/sc/adjust/at-my-unit',tok=L)
own=[x for x in au['rows'] if x['mine'] and x['label'].startswith('Finished black')][0]
ravi=[x for x in au['rows'] if x['job_id']==pj][0]
sree=[x for x in au['rows'] if x['job_id']==sp['job']['id']][0]
s,cs = call('POST','/api/sc/adjust/casualty',{'cause':'fire','note':'boiler room','items':[{'holding_id':own['id'],'qty':5,'unit':'kg'},{'holding_id':ravi['id'],'qty':10,'unit':'kg'},{'holding_id':sree['id'],'qty':4,'unit':'kg'}],'client_id':cid()},L)
check('fire recorded: one difference per owner (Ravi, Sree)', s==201 and {d['for'] for d in cs['disputes']}=={'b_ravi','b_sree'}, cs.get('disputes'))
dr=[d for d in cs['disputes'] if d['for']=='b_ravi'][0]['id']; ds=[d for d in cs['disputes'] if d['for']=='b_sree'][0]['id']
s,_ = call('GET',f'/api/sc/disputes/{ds}',tok=R); check("Ravi cannot see Sree's loss", s==404, s)
s,cl = call('POST',f'/api/sc/jobs/{pj}/close',{},R); check("Ravi's job can't close while the loss is open", s==409 and cl.get('code')=='disputes', cl.get('code'))
s,_ = call('POST',f'/api/sc/disputes/{dr}/propose',{'outcome':'received'},R)
s2,dd = call('GET',f'/api/sc/disputes/{dr}',tok=R)
check('Ravi accepts the loss: settled, written off', s==200 and dd['state']=='resolved', dd.get('state'))
s,d = call('GET',f'/api/sc/jobs/{pj}/detail',tok=R)
check("Ravi's job: 100 in = 40 sold in place + 10 lost + about 50 still there", sorted((x['kind'],x['qty']) for x in d['segments'])==sorted([('sold',40000),('lost',10000),('still_there',50000)]), d['segments'])
s,_ = call('POST',f'/api/sc/disputes/{ds}/propose',{'outcome':'sent'},S)
s2,dd = call('GET',f'/api/sc/disputes/{ds}',tok=S); check("Sree says hers were not lost: pending Lakshmi's yes", dd['state']=='proposed', dd['state'])
s,_ = call('POST',f'/api/sc/disputes/{ds}/accept',{},L); s2,dd = call('GET',f'/api/sc/disputes/{ds}',tok=S)
check('Lakshmi accepts: back where they were', dd['state']=='resolved', dd['state'])
print('ALL PASS' if ok else 'SOME FAILED'); sys.exit(0 if ok else 1)
