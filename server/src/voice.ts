// Speech-to-text and text-to-speech for Indian languages via Sarvam AI (Nexconn has no speech API).
// Docs: https://docs.sarvam.ai — POST /speech-to-text (multipart, saaras:v4), POST /text-to-speech (JSON, bulbul).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { cfg, features } from './config.js';

export const uploadsDir = path.resolve(process.cwd(), 'uploads');
fs.mkdirSync(path.join(uploadsDir, 'voice'), { recursive: true });
fs.mkdirSync(path.join(uploadsDir, 'tts'), { recursive: true });
fs.mkdirSync(path.join(uploadsDir, 'img'), { recursive: true });

const SARVAM = 'https://api.sarvam.ai';
const LANG_CODE: Record<string, string> = {
  ta: 'ta-IN', hi: 'hi-IN', en: 'en-IN', te: 'te-IN', kn: 'kn-IN', ml: 'ml-IN', bn: 'bn-IN', or: 'od-IN', mr: 'mr-IN', gu: 'gu-IN', pa: 'pa-IN',
};
const FROM_CODE = Object.fromEntries(Object.entries(LANG_CODE).map(([k, v]) => [v, k]));

export async function transcribe(file: { buffer: Buffer; mimetype: string; originalname?: string }, hintLang?: string): Promise<{ text: string; lang: string } | null> {
  if (!features.sarvam) return null;
  const form = new FormData();
  const type = file.mimetype.split(';')[0] || 'audio/webm';
  form.append('file', new Blob([new Uint8Array(file.buffer)], { type }), file.originalname || `voice.${type.split('/')[1] || 'webm'}`);
  form.append('model', 'saaras:v4');
  form.append('mode', 'transcribe');
  const res = await fetch(`${SARVAM}/speech-to-text`, { method: 'POST', headers: { 'api-subscription-key': cfg.sarvamKey }, body: form });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.warn('[voice] STT failed', res.status, JSON.stringify(json).slice(0, 300));
    return null;
  }
  return { text: String(json.transcript || '').trim(), lang: FROM_CODE[json.language_code] || hintLang || 'en' };
}

export async function speak(text: string, lang: string): Promise<string | null> {
  if (!features.sarvam || !text.trim()) return null;
  const clean = text.slice(0, 2400);
  const hash = crypto.createHash('sha1').update(`${lang}|${clean}`).digest('hex').slice(0, 20);
  const rel = `tts/${hash}.wav`;
  const abs = path.join(uploadsDir, rel);
  if (fs.existsSync(abs)) return `${cfg.serverUrl}/uploads/${rel}`;
  const res = await fetch(`${SARVAM}/text-to-speech`, {
    method: 'POST',
    headers: { 'api-subscription-key': cfg.sarvamKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: clean, language_code: LANG_CODE[lang] || 'en-IN', model: 'bulbul:v4-flash' }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || !json.audios?.length) {
    console.warn('[voice] TTS failed', res.status, JSON.stringify(json).slice(0, 300));
    return null;
  }
  fs.writeFileSync(abs, Buffer.from(json.audios.join(''), 'base64'));
  return `${cfg.serverUrl}/uploads/${rel}`;
}

export function saveUpload(buffer: Buffer, folder: 'voice' | 'img', ext: string) {
  const name = `${crypto.randomUUID()}.${ext.replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'bin'}`;
  fs.writeFileSync(path.join(uploadsDir, folder, name), buffer);
  return `${cfg.serverUrl}/uploads/${folder}/${name}`;
}
