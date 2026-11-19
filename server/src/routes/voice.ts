// Speech-to-text, text-to-speech (Sarvam) and the server-side translation fallback.
import { Router } from 'express';
import { transcribe, speak, saveUpload } from '../voice.js';
import { translate } from '../ai.js';
import { getUser } from '../biz.js';
import { h, HttpError, requireAuth, upload, type AuthedRequest } from '../util.js';
import { LANGS } from '../../../shared/taxonomy.js';

const router = Router();
const isLang = (l: unknown): l is string => LANGS.some((x) => x.code === l);

const EXT: Record<string, string> = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/aac': 'aac' };

router.post(
  '/voice/stt',
  requireAuth,
  upload.single('audio'),
  h(async (req: AuthedRequest, res) => {
    if (!req.file?.buffer?.length) throw new HttpError(400, 'No audio received.');
    const hint = isLang(req.body?.lang) ? req.body.lang : (await getUser(req.uid)).language;
    const mime = req.file.mimetype.split(';')[0];
    const audioUrl = saveUpload(req.file.buffer, 'voice', EXT[mime] ?? (mime.split('/')[1] || 'webm'));
    const stt = await transcribe(req.file, hint);
    const durationMs = Number(req.body?.durationMs) > 0 ? Math.round(Number(req.body.durationMs)) : 0;
    res.json({ text: stt?.text ?? '', lang: stt?.lang ?? hint, audioUrl, durationMs, ok: !!stt });
  }),
);

router.post(
  '/voice/tts',
  requireAuth,
  h(async (req: AuthedRequest, res) => {
    const text = String(req.body?.text ?? '').trim();
    if (!text) throw new HttpError(400, 'Nothing to read out.');
    const lang = isLang(req.body?.lang) ? req.body.lang : (await getUser(req.uid)).language;
    res.json({ url: await speak(text, lang) });
  }),
);

router.post(
  '/translate',
  requireAuth,
  h(async (req, res) => {
    const texts: string[] = Array.isArray(req.body?.texts) ? req.body.texts.map((x: unknown) => String(x ?? '')).slice(0, 50) : [];
    const to = String(req.body?.to ?? '');
    if (!isLang(to)) throw new HttpError(400, 'Unsupported target language.');
    if (!texts.length) return res.json({ translations: [] });
    const from = typeof req.body?.from === 'string' && req.body.from ? req.body.from : 'auto';
    if (from === to) return res.json({ translations: texts });
    res.json({ translations: await translate(texts, to, from) });
  }),
);

export default router;
