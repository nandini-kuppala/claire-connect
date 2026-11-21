#!/usr/bin/env python3
# Slice 3 smoke walkthrough: the job worker's side. LOCAL dev server only (SC_ENABLED=1, MONGODB_DB=nexconn_sc_dev,
# Ravi, Lakshmi and Sree flagged). Ravi (GST-registered) → Lakshmi → Sree (disclosed sub-contract); Lakshmi
# (unregistered) → Sree → Ravi (undisclosed: Lakshmi must never see Ravi; Ravi sees "for Sree" only).
import json, urllib.request, uuid, sys, time
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
def biz(i): return {'k':'b','id':i}
# Grid and style
s,g = call('POST','/api/sc/specs/resolve-grid',{'material_type_id':'mt_kit','base':{'style':'RKF-P22'},'colours':['navy'],'sizes':['S','M']},R)
check('grid resolves one spec per cell', s==200 and len(g['cells']['navy'])==2, list(g.get('cells',{}).get('navy',{}).keys()))
kS, kM = g['cells']['navy']['S']['id'], g['cells']['navy']['M']['id']
_, btn = call('POST','/api/sc/specs/resolve',{'material_type_id':'mt_button','attrs':{'kind':'polo','colour':'navy'}},R); btn=btn['spec']['id']
s,st = call('POST','/api/sc/styles',{'code':'rkf-p22','size_set':['S','M','L','XL','XXL'],'trims':[{'spec_id':btn,'per_piece':3,'unit':'pcs','spare_pct':2}]},R)
check('style saved with trims', s==201 and st['style']['code']=='RKF-P22')
_, tee = call('POST','/api/sc/specs/resolve',{'material_type_id':'mt_garment','attrs':{'style':'RKF-P22','colour':'navy','size':'M'}},R); tee=tee['spec']['id']
_, teeS = call('POST','/api/sc/specs/resolve',{'material_type_id':'mt_garment','attrs':{'style':'RKF-P22','colour':'navy','size':'S'}},R); teeS=teeS['spec']['id']
# Ravi sends S 200, M 200 kits + 1,224 buttons to Lakshmi
s,m = call('POST','/api/sc/movements/send',{'to':biz('b_lakshmi'),'process_key':'stitching','lines':[{'spec_id':kS,'qty':200,'unit':'pcs'},{'spec_id':kM,'qty':200,'unit':'pcs'},{'spec_id':btn,'qty':1224,'unit':'pcs'}],'client_id':cid(),'allow_untracked':True,'untracked_reason':'demo','dc_no':'0419'},R)
mv, job = m['movement']['id'], m['job']['id']; call('POST',f'/api/sc/movements/{mv}/share-now',{},R)
s,_ = call('POST',f'/api/sc/movements/{mv}/confirm',{'lines':[{'line_id':l['line_id']} for l in m['movement']['lines']]},L)
s,j = call('GET',f'/api/sc/jobs/{job}',tok=R); check('trims do not add to the kit count (400, not 1,624)', j['job']['issued']==400, j['job']['issued'])
s,o = call('GET','/api/sc/goods/others',tok=L); grp=[x for x in o['groups'] if x['client']['id']=='b_ravi']
w=[x for x in grp[0]['jobs'] if x['id']==job][0] if grp else None
check('Lakshmi sees Ravi under Others\' goods with 400 received', w and w['received']==400, w and w['received'])
# Work done + ready → Ravi sees ready
call('POST',f'/api/sc/jobs/{job}/output',{'lines':[{'spec_id':teeS,'qty':180,'unit':'pcs'}],'ready':True},L)
s,o = call('GET','/api/sc/goods/out',tok=R); rj=[x for row in o['rows'] for x in row['jobs'] if x['id']==job][0]
check('Ravi sees ready and 220 still with Lakshmi', rj['ready'] and rj['pending']==220, (rj['ready'], rj['pending']))
# Held for dues pauses the clock
call('POST',f'/api/sc/jobs/{job}/hold',{'on':True,'reason':'dues'},L)
s,o = call('GET','/api/sc/goods/out',tok=R); rj=[x for row in o['rows'] for x in row['jobs'] if x['id']==job][0]
check('Ravi sees held for dues', rj['held']=='dues', rj['held'])
call('POST',f'/api/sc/jobs/{job}/hold',{'on':False},L)
# Lakshmi forwards 100 M kits to Sree (sub-contract). Ravi is GST-registered → disclosed to Ravi.
s,f = call('POST',f'/api/sc/jobs/{job}/forward',{'to':biz('b_sree'),'lines':[{'spec_id':kM,'qty':100,'unit':'pcs'}],'client_id':cid()},L)
fmv, child = f['movement']['id'], f['job']['id']; call('POST',f'/api/sc/movements/{fmv}/share-now',{},L)
check('forward to a registered owner is disclosed', f['movement']['disclosed'] is True)
s,mvS = call('GET',f'/api/sc/movements/{fmv}',tok=S)
check('Sree sees a generic name (no RKF-P22 style code)', s==200 and 'RKF' not in json.dumps(mvS), mvS.get('lines',[{}])[0].get('label'))
s,c = call('POST',f'/api/sc/movements/{fmv}/confirm',{'lines':[{'line_id':l['line_id']} for l in mvS['lines']]},S)
check('Sree confirms the forwarded kits', s==200, c.get('error'))
s,led = call('GET','/api/sc/parties/b/b_lakshmi/ledger',tok=R); fw=[h for h in led['history'] if h['id']==fmv]
check('owner sees the disclosed forward with the real style', fw and 'RKF-P22' in fw[0]['lines'][0]['label'], fw and fw[0]['lines'][0]['label'])
check('owner is an onlooker: receipt confirmed, nothing to confirm', fw and fw[0]['badge']['kind']=='receipt_confirmed', fw and fw[0]['badge'])
sent=[h for h in led['history'] if h['id']==mv]
check('no undo once the other side confirmed', sent and sent[0]['undoable_until'] is None, sent and sent[0]['undoable_until'])
s,o = call('GET','/api/sc/goods/others',tok=S); g2=[x for x in o['groups'] if any(jj['id']==child for jj in x['jobs'])]
check('Sree works "for Lakshmi", not for Ravi', g2 and g2[0]['client']['id']=='b_lakshmi', g2 and g2[0]['name'])
s,o = call('GET','/api/sc/goods/out',tok=R); rj=[x for row in o['rows'] for x in row['jobs'] if x['id']==job][0]
check('Ravi still sees all 220 as with Lakshmi (roll-up)', rj['pending']==220, rj['pending'])
# Sree sends back 100 garments to Lakshmi; Lakshmi confirms; they roll up into Ravi's job
s,sb = call('POST',f'/api/sc/jobs/{child}/send-back',{'lines':[{'spec_id':tee,'qty':100,'unit':'pcs'}],'client_id':cid()},S); call('POST',f"/api/sc/movements/{sb['movement']['id']}/share-now",{},S)
s,c = call('POST',f"/api/sc/movements/{sb['movement']['id']}/confirm",{'lines':[{'line_id':l['line_id']} for l in sb['movement']['lines']]},L)
check('Lakshmi confirms the sub-contractor return', s==200, c.get('error'))
s,o = call('GET','/api/sc/goods/out',tok=R); rj=[x for row in o['rows'] for x in row['jobs'] if x['id']==job][0]
check('after the sub-contractor returns 100, 120 remain with Lakshmi', rj['pending']==120, rj['pending'])
# Lakshmi sends back 280 (180 S own + 100 M from Sree) to Ravi; Ravi confirms
s,sb2 = call('POST',f'/api/sc/jobs/{job}/send-back',{'lines':[{'spec_id':teeS,'qty':180,'unit':'pcs'},{'spec_id':tee,'qty':100,'unit':'pcs'}],'client_id':cid()},L)
check('Lakshmi can send back own + sub-contracted goods', s==201, sb2.get('error'))
call('POST',f"/api/sc/movements/{sb2['movement']['id']}/share-now",{},L)
s,c = call('POST',f"/api/sc/movements/{sb2['movement']['id']}/confirm",{'lines':[{'line_id':l['line_id']} for l in sb2['movement']['lines']]},R)
check('Ravi confirms what came back', s==200, c.get('error'))
s,j = call('GET',f'/api/sc/jobs/{job}',tok=R); check('Ravi job outputs = 280 (no double count)', j['job']['outputs']==280, j['job']['outputs'])
s,i = call('GET','/api/sc/goods/in',tok=R); got=sum(x['qty'] for x in i['mine'] if x['spec_id'] in (tee,teeS))
check('Ravi has the garments in his unit', got>=280, got)
# Hop: Ravi tells Lakshmi to send 60 kits on to Sree. The goods leave Lakshmi's job; Ravi's job is with Sree directly.
s,h = call('POST','/api/sc/movements/send',{'to':biz('b_lakshmi'),'process_key':'stitching','lines':[{'spec_id':kM,'qty':60,'unit':'pcs'}],'client_id':cid(),'allow_untracked':True,'untracked_reason':'demo'},R)
hj = h['job']['id']; call('POST',f"/api/sc/movements/{h['movement']['id']}/share-now",{},R)
call('POST',f"/api/sc/movements/{h['movement']['id']}/confirm",{'lines':[{'line_id':l['line_id']} for l in h['movement']['lines']]},L)
s,ins = call('POST',f'/api/sc/jobs/{hj}/instruct',{'to':biz('b_sree'),'process_key':'stitching'},R)
check('owner can tell the unit to send it on', s==201, ins.get('error'))
s,o = call('GET','/api/sc/goods/others',tok=L); wr=[x for g in o['groups'] for x in g['jobs'] if x['id']==hj][0]
check('Lakshmi sees the instruction to Sree', wr['instructions'] and wr['instructions'][0]['to_name'].startswith('Sree'), wr['instructions'])
s,hf = call('POST',f'/api/sc/jobs/{hj}/forward',{'to':biz('b_sree'),'lines':[{'spec_id':kM,'qty':60,'unit':'pcs'}],'instruction_id':ins['instruction']['id'],'client_id':cid()},L)
check('the hop is recorded as a hop, disclosed, with no via', s==201 and hf['movement']['purpose']=='hop' and hf['movement']['disclosed'] and hf['movement']['via'] is None, hf.get('error'))
call('POST',f"/api/sc/movements/{hf['movement']['id']}/share-now",{},L)
s,mh = call('GET',f"/api/sc/movements/{hf['movement']['id']}",tok=S)
check('on a hop Sree sees the real style (it is Ravi\'s instruction)', 'RKF-P22' in mh['lines'][0]['label'], mh['lines'][0]['label'])
call('POST',f"/api/sc/movements/{hf['movement']['id']}/confirm",{'lines':[{'line_id':l['line_id']} for l in mh['lines']]},S)
s,o = call('GET','/api/sc/goods/out',tok=R); allj={x['id']:(row['party']['id'],x['pending']) for row in o['rows'] for x in row['jobs']}
check("Ravi: nothing left with Lakshmi on that job, 60 with Sree (no double count)", hj not in allj and allj.get(hf['job']['id'])==('b_sree',60), (allj.get(hj), allj.get(hf['job']['id'])))
s,o = call('GET','/api/sc/goods/others',tok=L); wr=[x for g in o['groups'] for x in g['jobs'] if x['id']==hj][0]
check('Lakshmi: nothing of it left to work on, instruction cleared', wr['inputsHere']==0 and not wr['instructions'], (wr['inputsHere'], wr['instructions']))
s,o = call('GET','/api/sc/goods/others',tok=S); g4=[g for g in o['groups'] if any(x['id']==hf['job']['id'] for x in g['jobs'])]
check('Sree works for Ravi directly on a hop', g4 and g4[0]['client']['id']=='b_ravi', g4 and g4[0]['name'])
# Undisclosed: Lakshmi (unregistered) sends 50 kits to Sree; Sree forwards 50 to Ravi.
s,m2 = call('POST','/api/sc/movements/send',{'to':biz('b_sree'),'process_key':'stitching','lines':[{'spec_id':kM,'qty':50,'unit':'pcs'}],'client_id':cid(),'allow_untracked':True,'untracked_reason':'demo'},L)
call('POST',f"/api/sc/movements/{m2['movement']['id']}/share-now",{},L)
call('POST',f"/api/sc/movements/{m2['movement']['id']}/confirm",{'lines':[{'line_id':l['line_id']} for l in m2['movement']['lines']]},S)
s,f2 = call('POST',f"/api/sc/jobs/{m2['job']['id']}/forward",{'to':biz('b_ravi'),'lines':[{'spec_id':kM,'qty':50,'unit':'pcs'}],'client_id':cid()},S)
check('forward for an unregistered owner is not disclosed', f2['movement']['disclosed'] is False)
s,_ = call('GET',f"/api/sc/movements/{f2['movement']['id']}",tok=L); check('the owner cannot open the sub-contract record', s==404, s)
s,led = call('GET','/api/sc/parties/b/b_sree/ledger',tok=L); check("owner's history never shows the forward", all(h['id']!=f2['movement']['id'] for h in led['history']))
s,o = call('GET','/api/sc/goods/out',tok=L); lrow=[row for row in o['rows'] if any(jj['id']==m2['job']['id'] for jj in row['jobs'])]
check('owner sees it "with Sree" only', lrow and lrow[0]['party']['id']=='b_sree', lrow and lrow[0]['name'])
call('POST',f"/api/sc/movements/{f2['movement']['id']}/share-now",{},S); time.sleep(1)
s,o = call('GET','/api/sc/goods/others',tok=R); g3=[x for x in o['groups'] if any(jj['id']==f2['job']['id'] for jj in x['jobs'])]
check('the sub-contractor sees "for Sree", never Lakshmi', g3 and g3[0]['client']['id']=='b_sree' and 'Lakshmi' not in json.dumps(g3), g3 and g3[0]['name'])
# Principal vs principal at one job worker: Lakshmi holds Ravi's and Sree's goods; neither sees the other's
s,m3 = call('POST','/api/sc/movements/send',{'to':biz('b_lakshmi'),'process_key':'stitching','lines':[{'spec_id':kS,'qty':40,'unit':'pcs'}],'client_id':cid(),'allow_untracked':True,'untracked_reason':'demo'},S)
call('POST',f"/api/sc/movements/{m3['movement']['id']}/share-now",{},S)
s,_ = call('GET',f"/api/sc/movements/{m3['movement']['id']}",tok=R); check("Ravi cannot see Sree's goods at Lakshmi", s==404, s)
s,o = call('GET','/api/sc/goods/others',tok=L); names={x['client']['id'] for x in o['groups']}
check('Lakshmi sees both principals, separately', {'b_ravi','b_sree'} <= names, names)
print('ALL PASS' if ok else 'SOME FAILED'); sys.exit(0 if ok else 1)
