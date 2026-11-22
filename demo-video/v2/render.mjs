// Deterministic renderer for anim.html scenes. node render.mjs <id> <seconds> [--preview t1,t2,...]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const [, , id, secs, flag, times] = process.argv;
const FPS = 30, T = +secs;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await p.goto('file://' + new URL('./anim.html', import.meta.url).pathname);
await p.evaluate((id) => window.show(id), id);
await p.waitForTimeout(400);
fs.mkdirSync('clips', { recursive: true }); fs.mkdirSync('preview', { recursive: true });
if (flag === '--preview') {
  for (const t of times.split(',')) { await p.evaluate((t) => window.render(t), +t); await p.screenshot({ path: `preview/${id}-${t}.jpg`, type: 'jpeg', quality: 80 }); }
} else {
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), `clips/${id}.mp4`], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.round(T * FPS);
  for (let f = 0; f < n; f++) {
    await p.evaluate((t) => window.render(t), f / FPS);
    const buf = await p.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r));
}
await b.close(); console.log('ok', id);
