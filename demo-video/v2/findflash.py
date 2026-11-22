import json, subprocess, sys
def flash_time(video, upto=40):
    W, H = 8, 16
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-t', str(upto), '-i', video, '-vf', f'fps=30,crop=390:844:0:0,scale={W}:{H},format=rgb24', '-f', 'rawvideo', '-'], capture_output=True).stdout
    n = W * H * 3
    for i in range(len(raw) // n):
        f = raw[i * n:(i + 1) * n]; r = sum(f[0::3]) / (W * H); g = sum(f[1::3]) / (W * H); b = sum(f[2::3]) / (W * H)
        if r > 200 and g < 80 and b > 200: return i / 30
    return None
if __name__ == '__main__':
    d = json.load(open('raw/all.json'))[sys.argv[1]]
    print({n: flash_time(v) for n, v in d['vids'].items()}, 'flashAt', d.get('flashAt'), 'starts', d['starts'])
