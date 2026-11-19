import * as Icons from './index';
import type { LucideIcon } from './index';

const COLOURS = [
  { name: 'ink', value: '#13203B' },
  { name: 'primary', value: '#1F8C73' },
  { name: 'clay', value: '#B9502F' },
] as const;

const ENTRIES = Object.entries(Icons)
  .filter((entry): entry is [string, LucideIcon] => typeof entry[1] === 'function')
  .sort(([a], [b]) => a.localeCompare(b));

/** Visual check of every icon at 24px and 40px in the three brand colours. */
export default function IconGallery() {
  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF', color: '#13203B', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 4px' }}>CLAIRE icons</h1>
      <p style={{ fontSize: 13, margin: '0 0 20px', opacity: 0.7 }}>
        {ENTRIES.length} exports · 24px and 40px · ink, primary, clay
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
          gap: 12,
        }}
      >
        {ENTRIES.map(([name, Icon]) => (
          <div
            key={name}
            style={{
              background: '#FBF8F2',
              border: '1px solid #E4DCCD',
              borderRadius: 14,
              padding: '12px 12px 10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {COLOURS.map((c) => (
                <span key={c.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: c.value }}>
                  <Icon size={24} style={{ flexShrink: 0 }} />
                  <Icon size={40} style={{ flexShrink: 0 }} />
                </span>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
              {name}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
