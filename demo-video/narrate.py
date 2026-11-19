# narrate.py — edge-tts narration, one mp3 per segment + timings.json (from the narrate-demo skill).
import argparse, asyncio, json, os, ssl, subprocess
import edge_tts, edge_tts.communicate as _c

VOICES = {("in","male"):"en-IN-PrabhatNeural",("in","female"):"en-IN-NeerjaExpressiveNeural",
          ("in","female-plain"):"en-IN-NeerjaNeural",
          ("au","male"):"en-AU-WilliamMultilingualNeural",("au","female"):"en-AU-NatashaNeural",
          ("uk","male"):"en-GB-RyanNeural",("uk","female"):"en-GB-SoniaNeural",
          ("us","male"):"en-US-AndrewMultilingualNeural",("us","female"):"en-US-AvaMultilingualNeural"}
RATE = {"in":"-4%","au":"-2%","uk":"-2%","us":"-2%"}

for ca in (os.environ.get("NARRATE_CA"), "/root/.ccr/ca-bundle.crt"):
    if ca and os.path.exists(ca):
        _c._SSL_CTX = ssl.create_default_context(cafile=ca); break

def seconds(p):
    out = subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",p],capture_output=True,text=True).stdout
    return round(float(out or 0), 2)

ap = argparse.ArgumentParser()
ap.add_argument("script"); ap.add_argument("out_dir")
ap.add_argument("--accent", default="in", choices=["in","au","uk","us"])
ap.add_argument("--gender", default="male", choices=["male","female","female-plain"])
ap.add_argument("--rate")
a = ap.parse_args()
segs = json.load(open(a.script)) if os.path.exists(a.script) else [{"id":"line","text":a.script}]
voice, rate = VOICES[(a.accent, a.gender)], a.rate or RATE[a.accent]
os.makedirs(a.out_dir, exist_ok=True)
out = []
for s in segs:
    p = os.path.join(a.out_dir, s["id"] + ".mp3")
    asyncio.run(edge_tts.Communicate(s["text"], voice, rate=rate).save(p))
    out.append({"id": s["id"], "file": p, "seconds": seconds(p)})
    print(s["id"], out[-1]["seconds"])
json.dump({"voice": voice, "rate": rate, "segments": out}, open(os.path.join(a.out_dir, "timings.json"), "w"), indent=1)
