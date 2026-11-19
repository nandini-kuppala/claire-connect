// Photos → Claire drafts products → check & price (one sentence, typed or spoken) → publish → share.
// Used from onboarding, the chat composer and the owner's storefront. Props: { open, onClose, onPublished? }.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Camera, Check, Copy, ExternalLink, ImagePlus, Mic, Send, Share2, Square, Trash2 } from '../icons';
import { api } from '../lib/api';
import { GarmentArt } from './GarmentArt';
import { Sheet } from './Sheet';
import { Button } from './Button';
import { ClaireMark } from './Avatar';
import { catById } from '../../../shared/taxonomy';
import { Spinner, catName, copyText, errMsg, extFor, inr, useMe, useRecorder, whatsappShare } from '../desk/kit';
import { CatS } from './CatalogSheet.strings';

interface Draft {
  tempId: string;
  imageUrls: string[];
  category: string;
  title: string;
  attrs: Record<string, any>;
  price: number | null;
  moq: number | null;
  sizes: string[];
  unit?: string;
}
interface Picked { file: File; url: string }
type S = ReturnType<typeof CatS.use>;

const MAX = 12;
type Stage = 'pick' | 'uploading' | 'drafts' | 'publishing' | 'done';

export function CatalogSheet({ open, onClose, onPublished }: { open: boolean; onClose: () => void; onPublished?: (r: { listings: any[]; storefrontUrl: string }) => void }) {
  const s = CatS.use();
  const { lang, business } = useMe();
  const [stage, setStage] = useState<Stage>('pick');
  const [picked, setPicked] = useState<Picked[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [sentence, setSentence] = useState('');
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ listings: any[]; storefrontUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [active, setActive] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const recorder = useRecorder();
  const [transcribing, setTranscribing] = useState(false);

  // Reset when reopened after a finished run.
  useEffect(() => {
    if (open && stage === 'done') reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => () => picked.forEach((p) => URL.revokeObjectURL(p.url)), [picked]);

  function reset() {
    setStage('pick');
    setPicked([]);
    setDrafts([]);
    setSentence('');
    setApplied(false);
    setResult(null);
    setError(null);
    setActive(0);
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const imgs = Array.from(list).filter((f) => f.type.startsWith('image/'));
    setError(null);
    setPicked((cur) => {
      const room = MAX - cur.length;
      if (imgs.length > room) setError(s('max', { n: MAX }));
      return [...cur, ...imgs.slice(0, Math.max(0, room)).map((file) => ({ file, url: URL.createObjectURL(file) }))];
    });
  }

  async function upload() {
    if (!picked.length) return;
    setStage('uploading');
    setError(null);
    try {
      const fd = new FormData();
      picked.forEach((p) => fd.append('images', p.file, p.file.name));
      const r = (await api.upload('/api/catalog/photos', fd)) as { drafts: Draft[] };
      const ds = (r.drafts ?? []).map((d) => ({ ...d, sizes: d.sizes ?? [], attrs: d.attrs ?? {} }));
      if (!ds.length) throw new Error(s('none'));
      setDrafts(ds);
      setStage('drafts');
    } catch (e) {
      setError(errMsg(e));
      setStage('pick');
    }
  }

  async function apply(text: string) {
    const v = text.trim();
    if (!v) return;
    setApplying(true);
    setError(null);
    try {
      const r = (await api.post('/api/catalog/apply', { drafts, text: v })) as { drafts: Draft[] };
      setDrafts((r.drafts ?? drafts).map((d) => ({ ...d, sizes: d.sizes ?? [], attrs: d.attrs ?? {} })));
      setApplied(true);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setApplying(false);
    }
  }

  async function toggleMic() {
    if (recorder.recording) {
      const rec = await recorder.stop();
      if (!rec || rec.durationMs < 500) return;
      setTranscribing(true);
      try {
        const fd = new FormData();
        fd.append('audio', rec.blob, `price.${extFor(rec.mime)}`);
        fd.append('lang', lang);
        const r = (await api.upload('/api/voice/stt', fd)) as { text: string };
        if (r.text) {
          setSentence(r.text);
          await apply(r.text);
        }
      } catch (e) {
        setError(errMsg(e));
      } finally {
        setTranscribing(false);
      }
      return;
    }
    try {
      await recorder.start();
    } catch {
      setError(s('mic_denied'));
    }
  }

  async function publish() {
    setStage('publishing');
    setError(null);
    try {
      const r = (await api.post('/api/catalog/publish', { drafts })) as { listings: any[]; storefrontUrl: string };
      const url = r.storefrontUrl?.startsWith('http') ? r.storefrontUrl : `${window.location.origin}${r.storefrontUrl ?? (business?.slug ? `/s/${business.slug}` : '')}`;
      const res = { listings: r.listings ?? [], storefrontUrl: url };
      setResult(res);
      setStage('done');
      onPublished?.(res);
    } catch (e) {
      setError(errMsg(e));
      setStage('drafts');
    }
  }

  const updateDraft = (i: number, patch: Partial<Draft>) => setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const removeDraft = (i: number) => setDrafts((ds) => ds.filter((_, j) => j !== i));
  const allPriced = drafts.length > 0 && drafts.every((d) => d.price != null && d.price > 0);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const w = el.firstElementChild ? (el.firstElementChild as HTMLElement).offsetWidth + 12 : el.clientWidth;
    setActive(Math.round(el.scrollLeft / w));
  };

  const step = stage === 'done' ? 3 : stage === 'drafts' || stage === 'publishing' ? 2 : 1;
  const title = stage === 'done' ? s('title_live') : step === 2 ? s('title_found', { n: drafts.length }) : s('title_add');
  const busyMic = applying || transcribing;

  let footer: ReactNode;
  if (step === 1) {
    footer = (
      <Button block size="lg" disabled={!picked.length} loading={stage === 'uploading'} onClick={() => void upload()}>
        {stage === 'uploading' ? s('reading') : s('make')}
      </Button>
    );
  } else if (step === 2) {
    footer = (
      <>
        {!allPriced && <p className="mb-2 text-center text-[13px] text-meta">{s('need_price')}</p>}
        <Button block size="lg" icon={Check} disabled={!allPriced} loading={stage === 'publishing'} onClick={() => void publish()}>
          {s('publish', { n: drafts.length })}
        </Button>
      </>
    );
  } else if (result) {
    footer = (
      <>
        <a
          href={whatsappShare(`${s('share_msg')}: ${result.storefrontUrl}`)}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-[16px] font-semibold text-white hover:bg-primary-hover"
        >
          <Share2 size={18} aria-hidden /> {s('share_whatsapp')}
        </a>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            icon={copied ? Check : Copy}
            onClick={async () => {
              if (await copyText(result.storefrontUrl)) {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1800);
              }
            }}
          >
            {copied ? s('copied') : s('copy_link')}
          </Button>
          <Button variant="ghost" onClick={onClose}>{s('done')}</Button>
        </div>
      </>
    );
  }

  return (
    <Sheet open={open} onClose={onClose} title={title} subtitle={<Stepper step={step} s={s} />} footer={footer} className="h-[88dvh]">
      {/* Step 1 · photos */}
      {step === 1 && (
        <div className="pb-2">
          <p className="text-[15px] leading-relaxed text-ink-2">{s('pick_sub')}</p>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />

          {stage === 'pick' && picked.length < MAX && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                className="flex min-h-[104px] flex-col items-center justify-center gap-2 rounded-[22px] border border-primary-soft bg-primary-tint px-3 text-[15px] font-semibold text-primary transition-colors hover:bg-primary-soft"
                onClick={() => fileRef.current?.click()}
              >
                <span className="flex size-11 items-center justify-center rounded-full bg-surface"><ImagePlus size={22} /></span>
                {s('gallery')}
              </button>
              <button
                className="flex min-h-[104px] flex-col items-center justify-center gap-2 rounded-[22px] border border-line bg-surface px-3 text-[15px] font-semibold text-ink-2 transition-colors hover:bg-sunken"
                onClick={() => camRef.current?.click()}
              >
                <span className="flex size-11 items-center justify-center rounded-full bg-sunken"><Camera size={22} /></span>
                {s('camera')}
              </button>
            </div>
          )}

          {picked.length > 0 && (
            <>
              <div className="mt-4 grid grid-cols-4 gap-2">
                {picked.map((p, i) => (
                  <div key={p.url} className="relative aspect-square overflow-hidden rounded-[16px] bg-sunken">
                    <img src={p.url} alt="" className="size-full object-cover" />
                    {stage === 'pick' && (
                      <button
                        className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-surface text-danger"
                        onClick={() => setPicked((cur) => cur.filter((_, j) => j !== i))}
                        aria-label={s('remove_photo')}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                    {stage === 'uploading' && <div className="absolute inset-0 animate-pulse bg-surface/50" />}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-right text-[13px] tabular-nums text-meta">{picked.length}/{MAX}</p>
            </>
          )}

          {stage === 'uploading' && (
            <div className="mt-4 flex items-center gap-3 rounded-[18px] bg-accent-tint px-4 py-3">
              <ClaireMark size={32} />
              <p className="text-[14px] font-medium text-accent-ink">{s('reading')}</p>
            </div>
          )}
          {error && <p className="mt-3 rounded-[16px] bg-danger-tint px-4 py-2.5 text-[14px] text-danger" role="alert">{error}</p>}
        </div>
      )}

      {/* Step 2 · check & price */}
      {step === 2 && (
        <div className="pb-2">
          {/* One sentence for all prices */}
          <div className={`rounded-[22px] p-4 ${applied ? 'bg-success-tint' : 'bg-accent-tint'}`}>
            <div className="flex items-start gap-3">
              <ClaireMark size={32} />
              <div className="min-w-0 flex-1">
                {applied ? (
                  <p className="flex items-start gap-1.5 text-[14px] font-medium leading-[1.45] text-success">
                    <Check size={16} className="mt-0.5 shrink-0" aria-hidden /> {s('applied')}
                  </p>
                ) : (
                  <>
                    <p className="text-[15px] font-semibold leading-[1.45] text-ink">{s('price_q')}</p>
                    <p className="mt-0.5 text-[13px] leading-[1.45] text-accent-ink">{s('price_eg')}</p>
                  </>
                )}
              </div>
            </div>
            <form className="mt-3 flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); void apply(sentence); }}>
              <input
                value={recorder.recording ? s('listening') : sentence}
                onChange={(e) => setSentence(e.target.value)}
                readOnly={recorder.recording}
                placeholder={s('price_ph')}
                className="h-12 min-w-0 flex-1 rounded-full border border-line bg-surface px-4 text-[15px] text-ink outline-none placeholder:text-faint focus:border-primary"
              />
              {sentence.trim() && !recorder.recording ? (
                <button type="submit" disabled={applying} className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-white disabled:opacity-60" aria-label={s('apply')}>
                  {applying ? <Spinner size={18} color="#FFFFFF" /> : <Send size={19} />}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void toggleMic()}
                  disabled={busyMic}
                  className={`flex size-12 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-60 ${recorder.recording ? 'bg-clay' : 'bg-primary'}`}
                  aria-label={recorder.recording ? s('stop') : s('speak')}
                >
                  {busyMic ? <Spinner size={18} color="#FFFFFF" /> : recorder.recording ? <Square size={17} /> : <Mic size={20} />}
                </button>
              )}
            </form>
          </div>

          {/* Drafts carousel */}
          <div
            ref={scroller}
            onScroll={onScroll}
            className="-mx-5 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none]"
          >
            {drafts.map((d, i) => (
              <DraftCard key={d.tempId} d={d} lang={lang} s={s} onChange={(p) => updateDraft(i, p)} onRemove={drafts.length > 1 ? () => removeDraft(i) : undefined} />
            ))}
          </div>
          {drafts.length > 1 && (
            <div className="mt-2 flex items-center justify-center gap-1.5" aria-label={s('swipe')}>
              {drafts.map((d, i) => (
                <span key={d.tempId} className={`h-1.5 rounded-full transition-all ${i === active ? 'w-4 bg-primary' : 'w-1.5 bg-line-strong'}`} />
              ))}
            </div>
          )}
          {error && <p className="mt-3 rounded-[16px] bg-danger-tint px-4 py-2.5 text-[14px] text-danger" role="alert">{error}</p>}
        </div>
      )}

      {/* Step 3 · live + share */}
      {step === 3 && result && (
        <div className="flex flex-col items-center pb-2 pt-4 text-center">
          <span className="flex size-[72px] items-center justify-center rounded-full bg-success-tint text-success">
            <Check size={34} />
          </span>
          <p className="mt-4 font-head text-[22px] font-bold text-ink">{s('published_n', { n: result.listings.length || drafts.length })}</p>
          <p className="mt-1 text-[15px] text-ink-2">{s('share_sub')}</p>
          <div className="mt-5 flex w-full items-center gap-2 rounded-[16px] border border-line bg-page py-1.5 pl-4 pr-1.5">
            <span className="min-w-0 flex-1 truncate text-left text-[14px] text-ink">{result.storefrontUrl.replace(/^https?:\/\//, '')}</span>
            <a href={result.storefrontUrl} target="_blank" rel="noreferrer" className="flex size-11 items-center justify-center rounded-full text-ink-2 hover:bg-sunken" aria-label={s('open_store')}>
              <ExternalLink size={17} />
            </a>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function Stepper({ step, s }: { step: number; s: S }) {
  const labels = [s('step_photos'), s('step_check'), s('step_share')];
  return (
    <span className="mt-1 flex items-center gap-2" aria-label={s('step_of', { n: step })}>
      {labels.map((l, i) => {
        const n = i + 1;
        const done = n < step;
        const on = n === step;
        return (
          <span key={l} className="flex min-w-0 items-center gap-2">
            {i > 0 && <span className={`h-px w-4 shrink-0 ${done || on ? 'bg-primary' : 'bg-line-strong'}`} aria-hidden />}
            <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${done ? 'bg-primary text-white' : on ? 'bg-primary-tint text-primary ring-1 ring-primary' : 'bg-sunken text-meta'}`}>
              {done ? <Check size={13} aria-hidden /> : n}
            </span>
            <span className={`truncate text-[13px] ${on ? 'font-semibold text-ink' : 'text-meta'}`}>{l}</span>
          </span>
        );
      })}
    </span>
  );
}

function DraftCard({ d, lang, s, onChange, onRemove }: { d: Draft; lang: string; s: S; onChange: (p: Partial<Draft>) => void; onRemove?: () => void }) {
  const cat = catById(d.category);
  const unit = d.unit ?? cat?.unit ?? 'piece';
  const u = unit === 'kg' ? s('kg') : unit === 'dozen' ? s('dozen') : s('pc');
  const colours: string[] = Array.isArray(d.attrs?.colours) ? d.attrs.colours : Array.isArray(d.attrs?.colors) ? d.attrs.colors : [];
  const numIn = 'mt-1 h-12 w-full rounded-[16px] border border-line bg-surface px-3 font-head text-[17px] font-bold tabular-nums text-ink outline-none placeholder:text-faint focus:border-primary';
  return (
    <div className="w-[84%] max-w-[340px] shrink-0 snap-center overflow-hidden rounded-[22px] border border-line bg-surface">
      <div className="relative aspect-[5/4] bg-sunken">
        {d.imageUrls?.[0] ? (
          <img src={d.imageUrls[0]} alt={d.title} className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center"><GarmentArt shape={cat?.shape ?? 'tshirt'} color={colours[0] ?? '#1F8C73'} size={150} /></div>
        )}
        <span className="absolute left-2.5 top-2.5 inline-flex h-7 items-center rounded-full bg-surface px-3 text-[12px] font-semibold text-primary">{catName(d.category, lang)}</span>
        {d.imageUrls?.length > 1 && (
          <span className="absolute bottom-2.5 left-2.5 inline-flex h-6 items-center rounded-full bg-surface px-2.5 text-[11px] font-medium text-ink-2">{s('n_photos', { n: d.imageUrls.length })}</span>
        )}
        {onRemove && (
          <button className="absolute right-2 top-2 flex size-10 items-center justify-center rounded-full bg-surface text-danger" onClick={onRemove} aria-label={s('remove_product')}>
            <Trash2 size={16} />
          </button>
        )}
      </div>
      <div className="space-y-3 p-3.5">
        <input
          value={d.title}
          onChange={(e) => onChange({ title: e.target.value })}
          className="w-full rounded-[12px] border border-transparent bg-transparent px-1.5 py-1 font-head text-[16px] font-semibold text-ink outline-none hover:border-line focus:border-primary"
          aria-label={s('title')}
        />
        {colours.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-1">
            {colours.slice(0, 5).map((c) => (
              <span key={c} className="inline-flex h-6 items-center gap-1.5 rounded-full bg-sunken px-2.5 text-[12px] text-ink-2">
                <span className="size-2.5 rounded-full ring-1 ring-line-strong" style={{ background: c }} />
                {c}
              </span>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[13px] font-medium text-meta">
            {s('price', { u })}
            <input inputMode="numeric" value={d.price ?? ''} placeholder="₹" onChange={(e) => onChange({ price: e.target.value ? Number(e.target.value.replace(/\D/g, '')) : null })} className={numIn} />
          </label>
          <label className="text-[13px] font-medium text-meta">
            {s('moq')}
            <input inputMode="numeric" value={d.moq ?? ''} onChange={(e) => onChange({ moq: e.target.value ? Number(e.target.value.replace(/\D/g, '')) : null })} className={numIn} />
          </label>
        </div>
        {d.sizes.length > 0 && <p className="px-1 text-[13px] text-ink-2">{d.sizes.join(' · ')}</p>}
        {d.price != null && d.price > 0 && (
          <p className="px-1 text-[13px] text-meta">
            <span className="font-semibold text-ink">{inr(d.price)}</span> / {u}
            {d.moq != null && ` · ${s('moq')} ${d.moq.toLocaleString('en-IN')}`}
          </p>
        )}
      </div>
    </div>
  );
}
