#!/usr/bin/env python3
# Slice 1 smoke walkthrough (J-0412: 200 kg grey to a dyer contact, 198.6 kg received, 96 + 92 kg back).
# Runs against the LOCAL dev server only (SC_ENABLED=1, MONGODB_DB=nexconn_sc_dev, Ravi flagged). Writes demo records to the dev database.
import json, urllib.request, uuid
B='http://localhost:8787'  # local dev server only; never production
def call(method, path, body=None, tok=None):
    req=urllib.request.Request(B+path, method=method, data=json.dumps(body).encode() if body is not None else None, headers={'content-type':'application/json', **({'authorization':'Bearer '+tok} if tok else {})})
    try:
        with urllib.request.urlopen(req) as r: return r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')
_, v = call('POST','/api/auth/verify',{'phone':'9000000004','otp':'123456'}); T=v['token']
_, cs = call('GET','/api/sc/contacts',tok=T); noy=[c for c in cs['contacts'] if c['name']=='Noyyal Dyeing'][0]['id']
_, g = call('POST','/api/sc/specs/resolve',{'material_type_id':'mt_knit_fabric','attrs':{'state':'grey','structure':'single jersey','gsm':180},'alias':'grey 180'},T); grey=g['spec']['id']
_, n = call('POST','/api/sc/specs/resolve',{'material_type_id':'mt_knit_fabric','attrs':{'state':'finished','structure':'single jersey','gsm':180,'colour':'navy'}},T); navy=n['spec']['id']
send={'to':{'k':'c','id':noy},'process_key':'dyeing','lines':[{'spec_id':grey,'qty':200,'unit':'kg','lot':'K-221','they_got':198.6}],'business_date':'2026-11-14','dc_no':'0412','rate_paise':7000,'client_id':str(uuid.uuid4())}
s,r=call('POST','/api/sc/movements/send',send,T); print('1 send without stock ->',s,r.get('code'),r.get('lines'))
send['allow_untracked']=True; send['untracked_reason']='opening: fabric bought before using the app'
s,r=call('POST','/api/sc/movements/send',send,T); print('2 send with override ->',s,'settled',r['movement']['lines'][0]['settled'],'expected',r['job']['expected_at'])
job=r['job']['id']; mv=r['movement']['id']
s,r2=call('POST','/api/sc/movements/send',send,T); print('3 retry same client_id ->',s,'duplicate' ,r2.get('duplicate'))
s,j=call('GET',f'/api/sc/jobs/{job}',tok=T); x=j['job']; print('4 job: issued',x['issued'],'pending',x['pending'],'late',x['late'])
s,r=call('POST',f'/api/sc/jobs/{job}/return',{'lines':[{'spec_id':navy,'qty':96,'unit':'kg','lot':'N-0412/1'}],'business_date':'2026-11-19','client_id':str(uuid.uuid4())},T); print('5 return 96 ->',s)
s,j=call('GET',f'/api/sc/jobs/{job}',tok=T); x=j['job']; print('6 pending grey ≈',round(x['pending']/1000,1),'kg; navy to come ≈',round(x['pendingAsOutput']/1000,1),'kg; status',x['status'])
s,o=call('GET','/api/sc/goods/out',tok=T); print('7 out:',[(row['name'],row['status']['status'],[round(jj['pending']/1000,1) for jj in row['jobs']]) for row in o['rows']])
s,c=call('GET','/api/sc/goods/coming',tok=T); print('8 coming:',[(row['name'],round((row['pendingAsOutput'] or 0)/1000,1),row['expected_at']) for row in c['rows']])
s,r=call('POST',f'/api/sc/jobs/{job}/return',{'lines':[{'spec_id':navy,'qty':92,'unit':'kg','rolls':4,'they_sent':93}],'business_date':'2026-11-21','last':True,'client_id':str(uuid.uuid4())},T); print('9 return 92 (they said 93), last ->',s,r['movement']['lines'][0]['settled'])
s,j=call('GET',f'/api/sc/jobs/{job}',tok=T); print('10 job status',j['job'] and j['job']['status'] if j['job'] else 'n/a')
s,led=call('GET',f'/api/sc/parties/c/{noy}/ledger',tok=T); oj=[q for q in led['open'] if q['id']==job][0]; print('11 ledger: status',oj['status'],'outputs',oj['outputs']/1000,'kg, loss so far',oj['lossPctSoFar'],'%, history',[h['action'] for h in led['history'][:3]])
s,i=call('GET','/api/sc/goods/in',tok=T); print('12 in my unit:',[(m['label'],m['qty']/1000 if m['dim']=='mass' else m['qty'],m['lot']) for m in i['mine']])
s,o=call('GET','/api/sc/goods/out',tok=T); print('13 out after completion:',[row['name'] for row in o['rows']])
# undo
s,r=call('POST','/api/sc/movements/send',{**send,'client_id':str(uuid.uuid4()),'lines':[{'spec_id':grey,'qty':10,'unit':'kg'}]},T); mv2=r['movement']['id']; job2=r['job']['id']
s,u=call('POST',f'/api/sc/movements/{mv2}/undo',{},T); print('14 undo ->',s,u)
s,j=call('GET','/api/sc/goods/out',tok=T); print('15 out after undo has job2?', any(jj['id']==job2 for row in j['rows'] for jj in row['jobs']))
s,r=call('POST','/api/sc/movements/send',{**send,'client_id':str(uuid.uuid4()),'lines':[{'spec_id':grey,'qty':5,'unit':'pcs'}]},T); print('16 wrong unit ->',s,r.get('error'))
s,h=call('GET','/api/sc/home',tok=T); print('17 home chips',h['chips'])
