#!/usr/bin/env python3
# Slice 6 smoke: statement links and contact linking. LOCAL dev server only (SC_ENABLED=1, MONGODB_DB=nexconn_sc_dev).
# Lakshmi sends Selvi (a contact) a link; Selvi confirms and says she returned 150; Lakshmi accepts. Then a dyer that
# Ravi kept as a contact joins CLAIRE, asks to link, Ravi approves, and the records merge into one row per dyer.
import json, urllib.request, urllib.parse, uuid, sys, random, subprocess, os, re
B='http://localhost:8787'  # local dev server only; never production
PHONE_UA='Mozilla/5.0 (Linux; Android 12; Selvi phone)'
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k): return None
opener = urllib.request.build_opener(NoRedirect)
def call(method, path, body=None, tok=None):
    req=urllib.request.Request(B+path, method=method, data=json.dumps(body).encode() if body is not None else None, headers={'content-type':'application/json', **({'authorization':'Bearer '+tok} if tok else {})})
    try:
        with urllib.request.urlopen(req) as r: return r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')
def page(path, ua=PHONE_UA, method='GET', form=None):
    req=urllib.request.Request(B+path, method=method, data=urllib.parse.urlencode(form).encode() if form else None, headers={'user-agent':ua, **({'content-type':'application/x-www-form-urlencoded'} if form else {})})
    try:
        with opener.open(req) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode(errors='ignore')
def login(phone): return call('POST','/api/auth/verify',{'phone':phone,'otp':'123456'})[1]['token']
cid = lambda: str(uuid.uuid4())
ok = True
def check(label, cond, extra=''):
    global ok
    ok = ok and bool(cond)
    print(('PASS ' if cond else 'FAIL ') + label + (f'  [{extra}]' if extra else ''))
R, L = login('9000000004'), login('9000000002')
def spec(mt, attrs, tok): return call('POST','/api/sc/specs/resolve',{'material_type_id':mt,'attrs':attrs},tok)[1]['spec']['id']

# ── Statement link: Lakshmi → Selvi ─────────────────────────────────────────────────────────────
selvi_phone = '98' + ''.join(random.choice('0123456789') for _ in range(8))
s, c = call('POST','/api/sc/contacts',{'name':'Selvi Tailoring','phone':selvi_phone,'language':'ta','role_hint':'Home tailor'},L); selvi={'k':'c','id':c['contact']['id']}
kit = spec('mt_kit',{'style':'LG-T10','colour':'white','size':'M'},L); tee = spec('mt_garment',{'style':'LG-T10','colour':'white','size':'M'},L)
s, m = call('POST','/api/sc/movements/send',{'to':selvi,'process_key':'stitching','lines':[{'spec_id':kit,'qty':200,'unit':'pcs'}],'client_id':cid(),'allow_untracked':True,'untracked_reason':'demo'},L)
job = m['job']['id']; line = m['movement']['lines'][0]['line_id']; mv = m['movement']['id']
call('POST',f'/api/sc/movements/{mv}/share-now',{},L)  # the link shows records once past the recorder's undo window
s, lk = call('POST','/api/sc/links',{'party':selvi},L)
token = lk['link']['url'].rsplit('/',1)[1]
check('link created with a WhatsApp message in Tamil to her number', s==201 and f'wa.me/91{selvi_phone}' in lk['whatsapp'] and 'சரிபார்த்து' in urllib.parse.unquote(lk['whatsapp']), lk['whatsapp'][:60])
s, html = page(f'/l/{token}', ua='WhatsApp/2.23.20.0 A')
check('the page renders, server-side, under 50 KB', s==200 and len(html.encode()) < 50_000 and '200' in html, len(html.encode()))
check('no prices, no other parties on the page', '₹' not in html and 'Ravi' not in html and 'Sree' not in html)
check('plain names only (no style code)', 'LG-T10' not in html)
s, ls = call('GET','/api/sc/links',tok=L); me=[x for x in ls['links'] if x['id']==lk['link']['id']][0]
check('a link preview (bare GET) is not "seen"', me['seen_at'] is None, me['seen_at'])
s, _ = page(f'/api/l/{token}/seen', method='POST', form={'x':'1'})
s2, ls = call('GET','/api/sc/links',tok=L); me=[x for x in ls['links'] if x['id']==lk['link']['id']][0]
check('seen on interaction', me['seen_at'], me['seen_at'])
s, _ = page(f'/api/l/{token}/confirm', method='POST', form={'m':mv,'l':line}, ua=f'Python-urllib/{sys.version_info.major}.{sys.version_info.minor}')
check("the recorder's own device can't answer for Selvi", s==403, s)
s, _ = page(f'/api/l/{token}/confirm', method='POST', form={'m':mv,'l':line})
check('Selvi confirms 200 from her phone', s==303, s)
s, led = call('GET',f"/api/sc/parties/c/{selvi['id']}/ledger",tok=L); h=[x for x in led['history'] if x['id']==mv][0]
check('Lakshmi sees "confirmed by Selvi" (via link)', h['badge']['kind']=='confirmed_by', h['badge'])
s, mvd = call('GET',f'/api/sc/movements/{mv}',tok=L)
check('the confirmation is labelled link evidence', any(a['evidence']=='link' for a in mvd['lines'][0]['received']), [a['evidence'] for a in mvd['lines'][0]['received']])
s, _ = page(f'/api/l/{token}/propose', method='POST', form={'j':job,'qty':'150'})
s2, pr = call('GET','/api/sc/links/proposals',tok=L); p=[x for x in pr['proposals'] if x['job_id']==job]
check('"I returned 150" reaches Lakshmi as a proposal', s==303 and p and p[0]['qty']==150, p)
s, a = call('POST',f"/api/sc/links/proposals/{p[0]['id']}/accept",{},L)
check('accepting without knowing what came back asks for it', s==409 and a.get('code')=='pick', a)
s, a = call('POST',f"/api/sc/links/proposals/{p[0]['id']}/accept",{'spec_id':tee},L)
check('Lakshmi accepts: 150 garments recorded as back', s==200 and a.get('accepted'), a)
s, o = call('GET','/api/sc/goods/out',tok=L); j=[x for r in o['rows'] for x in r['jobs'] if x['id']==job]
check('50 still with Selvi', j and j[0]['pending']==50, j and j[0]['pending'])
s, _ = page(f'/api/l/{token}/ready', method='POST', form={'j':job})
s2, o = call('GET','/api/sc/goods/out',tok=L); j=[x for r in o['rows'] for x in r['jobs'] if x['id']==job]
check('Selvi marks ready; Lakshmi sees ready', j and j[0]['ready'], j and j[0]['ready'])
s, html = page(f'/l/{token}?lang=hi')
check('language switch to Hindi', 'हिसाब' in html)
s, _ = page(f'/api/l/{token}/stop', method='POST', form={'x':'1'})
s2, html = page(f'/l/{token}')
s3, ls = call('GET','/api/sc/links',tok=L); me=[x for x in ls['links'] if x['id']==lk['link']['id']][0]
check('Stop: the page says so and Lakshmi sees "stopped by them"', 'நிறுத்தினீர்கள்' in html and me['stopped_by']=='party', me['stopped_by'])
s, html = page('/l/' + 'x'*22)
check('an unknown token is a plain "no longer works" page', s==404 and 'no longer works' in html)
codes=[page(f'/l/{token}', ua='RateTest')[0] for _ in range(32)]
check('rate limit: 30 a minute per token and IP', 429 in codes, codes[-3:])

# ── Scenario L: a dyer Ravi kept as a contact joins, asks to link, Ravi approves ───────────────────
dyer_phone = '97' + ''.join(random.choice('0123456789') for _ in range(8))
s, c = call('POST','/api/sc/contacts',{'name':'Kaveri Dyeing','phone':dyer_phone,'language':'ta','role_hint':'Dyeing unit'},R); kav={'k':'c','id':c['contact']['id']}
grey = spec('mt_knit_fabric',{'state':'grey','structure':'single jersey','gsm':180},R)
s, m1 = call('POST','/api/sc/movements/send',{'to':kav,'process_key':'dyeing','lines':[{'spec_id':grey,'qty':120,'unit':'kg'}],'client_id':cid(),'allow_untracked':True,'untracked_reason':'demo'},R)
call('POST',f"/api/sc/movements/{m1['movement']['id']}/share-now",{},R)  # a link happens days later; skip the undo window
s, lk2 = call('POST','/api/sc/links',{'party':kav},R); tok2 = lk2['link']['url'].rsplit('/',1)[1]
N = login(dyer_phone)
s, done = call('POST','/api/onboarding/complete',{'draft':{'business_name':'Kaveri Dyeing Works','owner_name':'Kaveri','sells':['service.dyeing'],'city':'Tiruppur'},'language':'ta'},N)
env = {**os.environ, 'MONGODB_DB':'nexconn_sc_dev'}
fl = subprocess.run(['bash','-lc',f'source ~/.nvm/nvm.sh >/dev/null && nvm use 24 >/dev/null && npm run sc:flag -w server -- {dyer_phone} on'], cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))), env=env, capture_output=True, text=True)
check('the new business is flagged on the dev DB', 'flags.sc on' in fl.stdout, fl.stdout[-120:] + fl.stderr[-200:])
s, sg = call('GET','/api/sc/linking/suggestions',tok=N)
check('the new business sees only a count, no names', s==200 and sg['count']==1 and set(sg.keys())=={'count','pending'}, sg)
s, rq = call('POST','/api/sc/linking/request',{},N)
s2, reqs = call('GET','/api/sc/linking/requests',tok=R); mine=[x for x in reqs['requests'] if x['contact_id']==kav['id']]
check('Ravi sees the request with the business name', mine and mine[0]['business']['name']=='Kaveri Dyeing Works', mine)
s, o = call('GET','/api/sc/goods/others',tok=N)
check('nothing is shared before Ravi approves', not any(g['client']['id']=='b_ravi' for g in o.get('groups',[])), o.get('groups'))
s, ap = call('POST',f"/api/sc/linking/{kav['id']}/approve",{},R)
check('Ravi approves: holdings re-keyed', s==200 and ap['holdings']>=1, ap)
s, o = call('GET','/api/sc/goods/out',tok=R); rows=[r for r in o['rows'] if r['party']['id'] in (kav['id'], ap['business']['id'])]
check('one row for the dyer, under the business', len(rows)==1 and rows[0]['party']=={'k':'b','id':ap['business']['id']} and any(j['pending']==120000 for j in rows[0]['jobs']), [(r['party'], r['name']) for r in rows])
s, o = call('GET','/api/sc/goods/others',tok=N); g=[x for x in o['groups'] if x['client']['id']=='b_ravi']
check("Kaveri now sees Ravi's 120 kg as others' goods", g and any(j['received']==120000 or j['inputsHere']==120000 for j in g[0]['jobs']), g and g[0]['jobs'][0])
s, cf = call('POST',f"/api/sc/movements/{m1['movement']['id']}/confirm",{'lines':[{'line_id':m1['movement']['lines'][0]['line_id'],'qty':119.2,'unit':'kg'}]},N)
check('Kaveri can confirm the old record from her account (119.2 kg, within tolerance)', s==200, cf)
s, html = page(f'/l/{tok2}')
check("Ravi's statement link to the contact retired", s==404, s)
s, pts = call('GET','/api/sc/parties',tok=R)
check('the party list shows the business, not the old contact', not any(p['ref']['id']==kav['id'] for p in pts['parties']))
s, sg = call('GET','/api/sc/linking/suggestions',tok=N)
check('no more suggestions once linked', sg['count']==0, sg)
print('ALL PASS' if ok else 'SOME FAILED'); sys.exit(0 if ok else 1)
