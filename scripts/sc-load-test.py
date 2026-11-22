#!/usr/bin/env python3
# Load test for Goods (LOCAL dev server + dev DB only). Creates 10 new test businesses (not demo, not in the demo
# logins), flags them for Goods, then runs a realistic mix of reads and writes from 1, 10 and 20 concurrent workers.
# Each worker plays one business: it sends work to a partner, confirms what partners sent it, records returns, sales and
# payments, and reads its lists, bills and reports. Reports latency per endpoint, errors, throughput, server CPU/memory,
# and then checks the data: every successful send is exactly one movement, and the ledger still balances.
import json, urllib.request, uuid, sys, subprocess, threading, time, random, statistics, os
from collections import defaultdict
B = 'http://localhost:8787'  # local dev server only; never production
N_USERS = 10
PHASES = [(1, 20), (10, 60), (20, 60)]  # (concurrent workers, seconds)

def call(method, path, body=None, tok=None, timeout=60):
    req = urllib.request.Request(B + path, method=method, data=json.dumps(body).encode() if body is not None else None, headers={'content-type': 'application/json', **({'authorization': 'Bearer ' + tok} if tok else {})})
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = json.loads(r.read() or b'{}'); return r.status, data, time.perf_counter() - t0
    except urllib.error.HTTPError as e:
        try: data = json.loads(e.read() or b'{}')
        except Exception: data = {}
        return e.code, data, time.perf_counter() - t0
    except Exception as e:
        return 0, {'error': str(e)}, time.perf_counter() - t0
cid = lambda: str(uuid.uuid4())

# ── Setup: 10 new businesses ─────────────────────────────────────────────────────────────────────
users = []
for i in range(1, N_USERS + 1):
    phone = f'93000000{i:02d}'
    s, v, _ = call('POST', '/api/auth/verify', {'phone': phone, 'otp': '123456'}); tok = v['token']
    s, me, _ = call('GET', '/api/me', tok=tok); u = me.get('user', me)
    if not (u.get('onboarded') == 1 and u.get('business_id')):
        call('POST', '/api/onboarding/complete', {'draft': {'owner_name': f'Load {i}', 'business_name': f'Load Test Unit {i:02d}', 'city': 'Tiruppur', 'role_label': 'Garment maker', 'sells': [], 'buys': []}, 'language': random.choice(['en', 'ta', 'hi'])}, tok)
        s, me, _ = call('GET', '/api/me', tok=tok); u = me.get('user', me)
    users.append({'phone': phone, 'tok': tok, 'id': u['business_id'], 'name': f'Load Test Unit {i:02d}'})
for u in users:
    subprocess.run(['bash', '-lc', f'cd /Users/dev/Desktop/claire && source ~/.nvm/nvm.sh >/dev/null && nvm use 24 >/dev/null && MONGODB_DB=nexconn_sc_dev npm run sc:flag -w server -- {u["phone"]} on'], capture_output=True)
for u in users:  # refresh: the flag shows in /me
    s, v, _ = call('POST', '/api/auth/verify', {'phone': u['phone'], 'otp': '123456'}); u['tok'] = v['token']
    u['kit'] = call('POST', '/api/sc/specs/resolve', {'material_type_id': 'mt_kit', 'attrs': {'style': 'LT-1', 'colour': 'navy', 'size': 'M'}}, u['tok'])[1]['spec']['id']
    u['gar'] = call('POST', '/api/sc/specs/resolve', {'material_type_id': 'mt_garment', 'attrs': {'style': 'LT-1', 'colour': 'navy', 'size': 'M'}}, u['tok'])[1]['spec']['id']
    u['fab'] = call('POST', '/api/sc/specs/resolve', {'material_type_id': 'mt_knit_fabric', 'attrs': {'state': 'finished', 'structure': 'single jersey', 'gsm': 180, 'colour': 'navy'}}, u['tok'])[1]['spec']['id']
ok_setup = all(call('GET', '/api/sc/home', tok=u['tok'])[0] == 200 for u in users)
print(f'setup: {len(users)} businesses ({users[0]["phone"]}–{users[-1]["phone"]}), Goods on: {ok_setup}')
if not ok_setup: sys.exit(1)
partner = {u['id']: users[(i + 1) % N_USERS] for i, u in enumerate(users)}  # a ring: each sends work to the next

# ── Workload ─────────────────────────────────────────────────────────────────────────────────────
lock = threading.Lock()
stats = defaultdict(list)       # op → [seconds]
codes = defaultdict(lambda: defaultdict(int))
sends_ok = []                   # (user, body, movement_id)
def rec(op, s, dt):
    with lock: stats[op].append(dt); codes[op][s] += 1

def read(u):
    op, path = random.choice([('GET home', '/api/sc/home'), ('GET out', '/api/sc/goods/out'), ('GET coming', '/api/sc/goods/coming'), ('GET in', '/api/sc/goods/in'),
                              ('GET stock', '/api/sc/stock'), ('GET bills', '/api/sc/bills'), ('GET performance', '/api/sc/reports/performance'), ('GET ledger', f"/api/sc/parties/b/{partner[u['id']]['id']}/ledger")])
    s, _, dt = call('GET', path, tok=u['tok']); rec(op, s, dt)

def write(u):
    p = partner[u['id']]
    r = random.random()
    if r < 0.30:   # send for work to the partner, then end the undo window so they can confirm
        body = {'to': {'k': 'b', 'id': p['id']}, 'process_key': 'stitching', 'lines': [{'spec_id': u['kit'], 'qty': 10, 'unit': 'pcs'}], 'client_id': cid(), 'allow_untracked': True, 'untracked_reason': 'load test'}
        s, m, dt = call('POST', '/api/sc/movements/send', body, u['tok'])
        rec('POST send', s, dt)
        if s == 201:
            with lock: sends_ok.append((u, body, m['movement']['id']))
            s, _, dt = call('POST', f"/api/sc/movements/{m['movement']['id']}/share-now", {}, u['tok']); rec('POST share-now', s, dt)
    elif r < 0.55:  # confirm what arrived from others
        s, c, dt = call('GET', '/api/sc/goods/coming', tok=u['tok']); rec('GET coming', s, dt)
        todo = [x for x in (c.get('toConfirm') or []) if x.get('role') == 'receiver'][:2] if s == 200 else []
        for x in todo:
            s, _, dt = call('POST', f"/api/sc/movements/{x['movementId']}/confirm", {'lines': [{'line_id': l['line_id']} for l in x['lines']]}, u['tok']); rec('POST confirm', s, dt)
    elif r < 0.75:  # got back on one of my open jobs
        s, o, dt = call('GET', '/api/sc/goods/out', tok=u['tok']); rec('GET out', s, dt)
        jobs = [j for row in (o.get('rows') or []) for j in row.get('jobs', []) if j.get('pending', 0) >= 10] if s == 200 else []
        if jobs:
            j = random.choice(jobs)
            s, _, dt = call('POST', f"/api/sc/jobs/{j['id']}/return", {'lines': [{'spec_id': u['gar'], 'qty': 10, 'unit': 'pcs'}], 'last': True, 'client_id': cid()}, u['tok']); rec('POST got back', s, dt)
    elif r < 0.90:  # a sale to the partner
        s, m, dt = call('POST', '/api/sc/movements/trade', {'kind': 'sell', 'party': {'k': 'b', 'id': p['id']}, 'lines': [{'spec_id': u['fab'], 'qty': 5, 'unit': 'kg'}], 'rate_paise': 20000, 'client_id': cid(), 'allow_untracked': True, 'untracked_reason': 'load test'}, u['tok'])
        rec('POST sale', s, dt)
    else:           # record a payment to the partner
        s, _, dt = call('POST', '/api/sc/settlements', {'party': {'k': 'b', 'id': p['id']}, 'direction': 'paid', 'amount_paise': 10000, 'mode': 'upi', 'client_id': cid()}, u['tok']); rec('POST payment', s, dt)

def worker(u, until, counter):
    while time.time() < until:
        (read if random.random() < 0.6 else write)(u)
        with lock: counter[0] += 1

health = []
def ping(until):
    while time.time() < until:
        s, _, dt = call('GET', '/api/health'); health.append(dt); time.sleep(0.5)

cpu = []
def sample(until):
    pid = subprocess.run(['bash', '-lc', 'lsof -ti :8787 | head -1'], capture_output=True, text=True).stdout.strip()
    while time.time() < until and pid:
        out = subprocess.run(['ps', '-o', '%cpu=,rss=', '-p', pid], capture_output=True, text=True).stdout.split()
        if len(out) == 2: cpu.append((float(out[0]), int(out[1]) / 1024))
        time.sleep(1)

def pct(xs, p):
    xs = sorted(xs); return xs[min(len(xs) - 1, int(round(p / 100 * (len(xs) - 1))))] if xs else 0

results = []
for conc, secs in PHASES:
    stats.clear(); codes.clear(); cpu.clear(); health.clear()
    counter = [0]; until = time.time() + secs
    th = [threading.Thread(target=worker, args=(users[i % N_USERS], until, counter)) for i in range(conc)]
    smp = threading.Thread(target=sample, args=(until,)); hp = threading.Thread(target=ping, args=(until,))
    t0 = time.time(); smp.start(); hp.start(); [t.start() for t in th]; [t.join() for t in th]; smp.join(); hp.join(); el = time.time() - t0
    allx = [x for v in stats.values() for x in v]
    total = sum(sum(c.values()) for c in codes.values())
    errs = {op: {k: v for k, v in c.items() if k not in (200, 201, 202)} for op, c in codes.items()}
    errs = {op: e for op, e in errs.items() if e}
    res = {'concurrent': conc, 'seconds': round(el), 'requests': total, 'rps': round(total / el, 1), 'p50_ms': round(pct(allx, 50) * 1000), 'p95_ms': round(pct(allx, 95) * 1000), 'p99_ms': round(pct(allx, 99) * 1000), 'max_ms': round(max(allx) * 1000) if allx else 0,
           'errors': errs, 'cpu_avg': round(statistics.mean([c for c, _ in cpu]), 1) if cpu else None, 'cpu_max': max([c for c, _ in cpu]) if cpu else None, 'rss_max_mb': round(max([m for _, m in cpu])) if cpu else None,
           'ops': {op: {'n': len(v), 'p50': round(pct(v, 50) * 1000), 'p95': round(pct(v, 95) * 1000), 'max': round(max(v) * 1000)} for op, v in sorted(stats.items())}}
    results.append(res)
    res['health_p50_ms'] = round(pct(health, 50) * 1000); res['health_max_ms'] = round(max(health) * 1000) if health else 0
    print(f"\n== {conc} concurrent · {res['seconds']} s · {total} requests · {res['rps']} req/s · p50 {res['p50_ms']} ms · p95 {res['p95_ms']} ms · p99 {res['p99_ms']} ms · max {res['max_ms']} ms · server CPU avg {res['cpu_avg']}% (max {res['cpu_max']}%) · RSS max {res['rss_max_mb']} MB · /api/health (no DB) p50 {res['health_p50_ms']} ms max {res['health_max_ms']} ms")
    for op, o in res['ops'].items(): print(f"   {op:18} n={o['n']:5}  p50={o['p50']:5} ms  p95={o['p95']:5} ms  max={o['max']:5} ms  {dict(codes[op])}")
    if errs: print('   errors:', errs)

# ── Correctness after the load ───────────────────────────────────────────────────────────────────
ids = [m for _, _, m in sends_ok]
dups = 0
for u, body, m in random.sample(sends_ok, min(30, len(sends_ok))):  # a retry of the same record (same business, same client id)
    s2, r, _ = call('POST', '/api/sc/movements/send', body, u['tok'])
    if s2 == 201: dups += 1
v = subprocess.run(['bash', '-lc', 'cd /Users/dev/Desktop/claire/server && source ~/.nvm/nvm.sh >/dev/null && nvm use 24 >/dev/null && MONGODB_DB=nexconn_sc_dev npx tsx src/sc/verify.ts | tail -1'], capture_output=True, text=True).stdout.strip()
print(f'\ncorrectness: {len(sends_ok)} sends succeeded, all unique movement ids: {len(set(ids)) == len(ids)}; replaying {min(30, len(sends_ok))} of them (same business, same client id) made {dups} new records; ledger: {v}')
json.dump(results, open(os.environ.get('LOAD_OUT', '/dev/null'), 'w'), indent=1)
