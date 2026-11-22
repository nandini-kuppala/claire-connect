#!/usr/bin/env python3
# Ledger regressions from the 21 Nov bug hunt (each of these failed before its fix). LOCAL dev server only.
import json, urllib.request, uuid, sys, threading, subprocess
B = 'http://localhost:8787'  # local dev server only; never production
def call(method, path, body=None, tok=None):
    req = urllib.request.Request(B + path, method=method, data=json.dumps(body).encode() if body is not None else None, headers={'content-type': 'application/json', **({'authorization': 'Bearer ' + tok} if tok else {})})
    try:
        with urllib.request.urlopen(req) as r: return r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read() or b'{}')
        except Exception: return e.code, {}
def login(phone): return call('POST', '/api/auth/verify', {'phone': phone, 'otp': '123456'})[1]['token']
R, L, S = login('9000000004'), login('9000000002'), login('9000000003')
cid = lambda: str(uuid.uuid4())
biz = lambda i: {'k': 'b', 'id': i}
lot = 'LDG' + uuid.uuid4().hex[:5]
ok = True
def check(label, cond, extra=''):
    global ok
    ok = ok and bool(cond)
    print(('PASS ' if cond else 'FAIL ') + label + (f'  [{extra}]' if extra else ''))
def spec(mt, attrs, tok=R): return call('POST', '/api/sc/specs/resolve', {'material_type_id': mt, 'attrs': attrs}, tok)[1]['spec']['id']
kit = spec('mt_kit', {'style': 'LDG1', 'colour': 'navy', 'size': 'M'})
tee = spec('mt_garment', {'style': 'LDG1', 'colour': 'navy', 'size': 'M'})
grey = spec('mt_knit_fabric', {'state': 'grey', 'structure': 'single jersey', 'gsm': 180})
def send(qty, spec_id=kit, unit='pcs', proc='stitching', to='b_lakshmi', confirm=True):
    s, m = call('POST', '/api/sc/movements/send', {'to': biz(to), 'process_key': proc, 'lines': [{'spec_id': spec_id, 'qty': qty, 'unit': unit, 'lot': lot}], 'client_id': cid(), 'allow_untracked': True, 'untracked_reason': 'ledger smoke'}, R)
    mv, job, ln = m['movement']['id'], m['job']['id'], m['movement']['lines'][0]['line_id']
    call('POST', f'/api/sc/movements/{mv}/share-now', {}, R)
    if confirm: call('POST', f'/api/sc/movements/{mv}/confirm', {'lines': [{'line_id': ln}]}, L)
    return mv, job, ln
def outputs(job): return sum(o['qty'] for o in call('GET', f'/api/sc/jobs/{job}', tok=R)[1].get('outputs', []))

# 1. Got back after the worker's Work done counts the output once
mv, job, ln = send(100)
call('POST', f'/api/sc/jobs/{job}/output', {'lines': [{'spec_id': tee, 'qty': 100, 'unit': 'pcs'}], 'client_id': cid()}, L)
s, _ = call('POST', f'/api/sc/jobs/{job}/return', {'lines': [{'spec_id': tee, 'qty': 100, 'unit': 'pcs'}], 'last': True, 'client_id': cid()}, R)
check('1. Work done 100, then Got back 100 → 100 output, not 200', s == 201 and outputs(job) == 100, outputs(job))

# 3. Send-back by grade doesn't imply extra output
mv, job, ln = send(110)
call('POST', f'/api/sc/jobs/{job}/output', {'lines': [{'spec_id': tee, 'qty': 100, 'unit': 'pcs', 'grade': 'A'}, {'spec_id': tee, 'qty': 10, 'unit': 'pcs', 'grade': 'B'}], 'client_id': cid()}, L)
call('POST', f'/api/sc/jobs/{job}/send-back', {'lines': [{'spec_id': tee, 'qty': 100, 'unit': 'pcs', 'grade': 'A'}], 'client_id': cid()}, L)
call('POST', f'/api/sc/jobs/{job}/send-back', {'lines': [{'spec_id': tee, 'qty': 10, 'unit': 'pcs', 'grade': 'B'}], 'client_id': cid()}, L)
check('3. 100 A + 10 B done, sent back in two goes → still 110 output', outputs(job) == 110, outputs(job))

# 2. Sender figure only on a return the other side recorded
mv, job, ln = send(50, confirm=False)
s, r = call('POST', f'/api/sc/movements/{mv}/sender-figure', {'lines': [{'line_id': ln, 'qty': 80, 'unit': 'pcs'}]}, R)
check("2. Ravi can't give a 'sender figure' on his own send", s == 409, (s, r.get('error')))

# 4. Undo after the worker acted is refused
mv, job, ln = send(30, confirm=False)
call('POST', f'/api/sc/jobs/{job}/output', {'lines': [{'spec_id': tee, 'qty': 30, 'unit': 'pcs'}], 'client_id': cid()}, L)
s, r = call('POST', f'/api/sc/movements/{mv}/undo', {}, R)
check('4. after Work done, Undo is refused (acted on)', s == 409 and r.get('code') == 'acted_on', (s, r.get('code')))

# 9. Going back to an earlier figure is a change, not "unchanged"
mv, job, ln = send(100, grey, 'kg', 'dyeing', confirm=False)
for q in (100, 99.5, 100): s, r = call('POST', f'/api/sc/movements/{mv}/confirm', {'lines': [{'line_id': ln, 'qty': q, 'unit': 'kg'}]}, L)
_, m = call('GET', f'/api/sc/movements/{mv}', tok=R)
check('9. confirm 100 → 99.5 → 100 kg: the last figure stands (100 kg)', not r['results'][0].get('unchanged') and m['lines'][0]['received'][-1]['qty'] == 100000, (r['results'][0], m['lines'][0]['received'][-1]['qty']))

# 7. A refused late figure leaves the closed job closed
mv, job, ln = send(100, confirm=False)
call('POST', f'/api/sc/movements/{mv}/confirm', {'lines': [{'line_id': ln, 'qty': 95, 'unit': 'pcs'}]}, L)
s, c = call('POST', f'/api/sc/jobs/{job}/close', {'accept': True, 'carry_claim': True}, R)
s2, _ = call('POST', f'/api/sc/movements/{mv}/confirm', {'lines': [{'line_id': ln, 'qty': 97, 'unit': 'pcs'}]}, L)
d = call('GET', f'/api/sc/jobs/{job}/detail', tok=R)[1]
check('7. a late figure on a line with an open difference is refused and the job stays closed', s == 200 and s2 == 409 and d['job']['status'] == 'closed', (s, s2, d['job']['status']))

# 6. A parent job can't close while part is with a sub-contractor
mv, job, ln = send(100)
s, f = call('POST', f'/api/sc/jobs/{job}/forward', {'to': biz('b_sree'), 'lines': [{'spec_id': kit, 'qty': 40, 'unit': 'pcs', 'lot': lot}], 'client_id': cid()}, L)
s2, c = call('POST', f'/api/sc/jobs/{job}/close', {'accept': True}, R)
check('6. closing the parent while 40 are with the sub-contractor is refused', s == 201 and s2 == 409 and c.get('code') == 'subcontract_open', (s, s2, c.get('code')))

# 10. Finished work can be forwarded
mv, job, ln = send(20)
call('POST', f'/api/sc/jobs/{job}/output', {'lines': [{'spec_id': tee, 'qty': 10, 'unit': 'pcs'}], 'client_id': cid()}, L)
s, f = call('POST', f'/api/sc/jobs/{job}/forward', {'to': biz('b_sree'), 'process_key': 'checking', 'lines': [{'spec_id': tee, 'qty': 10, 'unit': 'pcs'}], 'client_id': cid()}, L)
check('10. Lakshmi forwards 10 finished garments to Sree for checking', s == 201, (s, f.get('error')))

# 13. Two counts at once don't both apply against the same book
s, fnd = call('POST', '/api/sc/adjust', {'op': 'found', 'spec_id': kit, 'qty': 100, 'unit': 'pcs', 'lot': f'{lot}C', 'reason': 'ledger smoke', 'client_id': cid()}, R)
row = next(r for r in call('GET', '/api/sc/stock', tok=R)[1]['rows'] if r.get('lot') == f'{lot}C' and not r['with'])
codes = []
th = [threading.Thread(target=lambda: codes.append(call('POST', '/api/sc/adjust', {'op': 'count', 'holding_id': row['id'], 'qty': 80, 'unit': 'pcs', 'client_id': cid()}, R)[0])) for _ in range(2)]
[t.start() for t in th]; [t.join() for t in th]
after = next(r for r in call('GET', '/api/sc/stock', tok=R)[1]['rows'] if r['id'] == row['id'])['qty']
check('13. two counts of 80 at once on a book of 100 → book 80, not 60', after == 80 and 201 in codes, (sorted(codes), after))

v = subprocess.run(['bash', '-lc', 'cd /Users/dev/Desktop/claire/server && source ~/.nvm/nvm.sh >/dev/null && nvm use 24 >/dev/null && MONGODB_DB=nexconn_sc_dev npx tsx src/sc/verify.ts | tail -1'], capture_output=True, text=True).stdout.strip()
check('ledger check: 0 problems', v.endswith('0 problem(s)'), v)
print('ALL PASS' if ok else 'SOME FAILED'); sys.exit(0 if ok else 1)
