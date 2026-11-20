#!/usr/bin/env python3
"""End-to-end API smoke test against a running CLAIRE Connect server (demo accounts only).
Usage: python3 smoke_live.py [base_url]   (default https://claire-connect.onrender.com)"""
import json, sys, time, urllib.request, urllib.error

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'https://claire-connect.onrender.com').rstrip('/') + '/api'
fails = []

def call(path, tok=None, method='GET', body=None, ok=(200,)):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'content-type': 'application/json', **({'authorization': f'Bearer {tok}'} if tok else {})})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        data = json.loads(e.read() or b'{}')
        if e.code not in ok:
            fails.append(f'{method} {path} → {e.code} {data}')
        return e.code, data

def check(name, cond, detail=''):
    print(('PASS ' if cond else 'FAIL ') + name + (f' — {detail}' if detail and not cond else ''))
    if not cond: fails.append(name + ' ' + str(detail))

def login(phone):
    call('/auth/otp', method='POST', body={'phone': phone})
    return call('/auth/verify', method='POST', body={'phone': phone, 'otp': '123456'})[1]['token']

amit, sree, ravi, lakshmi, meena = (login(p) for p in ('9000000001', '9000000003', '9000000004', '9000000002', '9000000901'))
check('logins', all([amit, sree, ravi, lakshmi, meena]))

# 1. Claire: track pants search with every slot in one message
call('/claire/reset', amit, 'POST')
t0 = time.time()
call('/claire/turn', amit, 'POST', {'text': '1000 cotton track pants under 170 rupees, Kolkata, within 2 weeks'})
reqs = call('/requirements?limit=3', amit)[1].get('requirements', [])
check('claire creates a search', bool(reqs) and reqs[0]['categoryId'] == 'garment.trackpants', reqs[:1])
rq = reqs[0]['id'] if reqs else None
print(f'     claire turn {time.time()-t0:.1f}s')
if rq:
    st, det = call(f'/requirements/{rq}', amit)
    res = det.get('results', {})
    check('results have suppliers', len(res.get('singles', [])) + len(res.get('combos', [])) > 0)
    check('recommendation present', bool(det.get('recommendation')))

# 2. Deal with Sree: message, offer, counter, accept
st, d = call('/deals/open', amit, 'POST', {'sellerBusinessId': 'b_sree', 'requirementId': rq})
conv = d.get('conversation', {}).get('id')
check('deal opened', bool(conv))
call(f'/deals/{conv}/inbound', amit, 'POST', {'text': 'Namaste, 1000 pcs at 160 possible?', 'lang': 'en', 'messageId': f'smoke-{int(time.time())}'})
st, o = call('/offers', sree, 'POST', {'conversationId': conv, 'qty': 1000, 'unitPrice': 166, 'dispatchDays': 5, 'advancePct': 30, 'creditDays': 0, 'freight': 'to-pay'})
offer = o.get('offer', {}).get('id')
check('seller offer created', bool(offer), o)
st, r = call(f'/offers/{offer}/respond', amit, 'POST', {'action': 'counter', 'unitPrice': 162})
counter = (r.get('offer') or r.get('counter') or {}).get('id')
det = call(f'/conversations/{conv}', sree)[1]
pending = [x for x in det.get('offers', []) if x.get('status') == 'pending']
check('buyer counter pending for seller', bool(pending))
st, r = call(f"/offers/{pending[-1]['id']}/respond", sree, 'POST', {'action': 'accept'}) if pending else (0, {})
order = (r.get('order') or {}).get('id')
check('order created on accept', bool(order), r)

# 3. Order lifecycle + ratings
if order:
    for who, ev in [(amit, 'advance_paid'), (sree, 'payment_confirmed'), (sree, 'in_production'), (sree, 'dispatched'), (amit, 'delivered'), (amit, 'balance_paid'), (sree, 'payment_confirmed')]:
        payload = {'transporter': 'KPN Parcel', 'lr': 'LR4521', 'bundles': 10} if ev == 'dispatched' else {}
        st, r = call(f'/orders/{order}/event', who, 'POST', {'type': ev, 'payload': payload})
        check(f'order event {ev}', st == 200, r)
    od = call(f'/orders/{order}', amit)[1]
    status = (od.get('order') or od).get('status')
    check('order closed', status == 'closed', status)
    st, r = call('/ratings', amit, 'POST', {'orderId': order, 'scores': {'quality': 5, 'value': 4, 'on_time': 5, 'communication': 5}, 'comment': 'Good stitching'})
    check('buyer rates seller', st == 200, r)
    st, r = call('/ratings', sree, 'POST', {'orderId': order, 'scores': {'paid_on_time': 5, 'clarity': 5, 'fair_returns': 4}})
    check('seller rates buyer', st == 200, r)

# 4. Sample request from a new deal (Kavin Knits)
st, d2 = call('/deals/open', amit, 'POST', {'sellerBusinessId': 'b_kavin', 'requirementId': rq})
conv2 = d2.get('conversation', {}).get('id')
st, r = call('/samples', amit, 'POST', {'conversationId': conv2})
check('sample requested', st == 200, r)

# 5. Job work: Ravi needs stitching → split across units
call('/claire/reset', ravi, 'POST')
call('/claire/turn', ravi, 'POST', {'text': 'Need stitching job work for 5000 polo t-shirts, fabric supplied, in 10 days'})
call('/claire/turn', ravi, 'POST', {'chipId': 'budget:none'})
rr = call('/requirements?limit=2', ravi)[1].get('requirements', [])
check('job-work search created', bool(rr) and rr[0]['categoryId'].startswith('service.'), rr[:1])
if rr:
    det = call(f"/requirements/{rr[0]['id']}", ravi)[1]
    check('job split has units', len(det.get('results', {}).get('combos', [])) + len(det.get('results', {}).get('singles', [])) > 0)

# 6. Help → Trade Desk ticket
call('/claire/turn', lakshmi, 'POST', {'chipId': 'home:human'})
q = call('/desk/tickets', meena)[1]
tickets = q if isinstance(q, list) else q.get('tickets', [])
check('desk has tickets', len(tickets) > 0)

# 7. Inbox + orders + stats
inbox = call('/conversations', amit)[1]
items = inbox if isinstance(inbox, list) else inbox.get('conversations', [])
check('buyer inbox lists deals', len(items) >= 2, len(items))
ol = call('/orders', amit)[1]
check('orders list', len(ol if isinstance(ol, list) else ol.get('orders', [])) > 0)
check('stats ok', call('/stats')[0] == 200)

print('\n' + ('ALL PASSED' if not fails else f'{len(fails)} FAILURE(S):\n  ' + '\n  '.join(fails)))
