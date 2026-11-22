import json, subprocess, sys
c = json.load(open('raw/cast_market2.json'))
def sigs(n, g0, g1, step=0.2):
    off = -c[n]['t0']
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{g0 + off:.2f}', '-t', f'{g1 - g0:.2f}', '-i', c[n]['mp4'], '-vf', f'fps={1/step},scale=39:84,format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
    N = 39 * 84; out = []
    for i in range(len(raw) // N - 1):
        dd = sum(abs(x - y) for x, y in zip(raw[i * N:(i + 1) * N], raw[(i + 1) * N:(i + 2) * N]))
        if dd > 15000: out.append(round(g0 + (i + 1) * step, 1))
    return out
g0, g1 = float(sys.argv[1]), float(sys.argv[2])
for n in ['amit', 'lakshmi']: print(n, sigs(n, g0, g1))
