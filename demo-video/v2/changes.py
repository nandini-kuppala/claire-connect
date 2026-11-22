import json, subprocess, sys
d = json.load(open('raw/all.json'))['market2']; v = d['vids']; F = {'amit': 4.633, 'lakshmi': 4.533}; fa = d['flashAt']
def sigs(n, g0, g1, step=0.25):
    off = F[n] - fa  # video time = global + off
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{g0 + off:.2f}', '-t', f'{g1 - g0:.2f}', '-i', v[n], '-vf', f'fps={1/step},crop=390:844:0:0,scale=39:84,format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
    N = 39 * 84; out = []
    for i in range(len(raw) // N - 1):
        a, b = raw[i * N:(i + 1) * N], raw[(i + 1) * N:(i + 2) * N]
        dd = sum(abs(x - y) for x, y in zip(a, b))
        if dd > 15000: out.append((round(g0 + (i + 1) * step, 2), dd))
    return out
g0, g1 = float(sys.argv[1]), float(sys.argv[2])
for n in ['amit', 'lakshmi']: print(n, sigs(n, g0, g1))
