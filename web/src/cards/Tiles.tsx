import clsx from 'clsx';
import GarmentArt from '../components/GarmentArt';
import type { CardProps } from './types';
import { cleanLabel, isStale } from './format';
import { QuestionBubble } from './ui';
import { useChipLock } from './Chips';

/** Category picker colours in the "Tiruppur cotton" dye palette (the server sends generic swatches). */
export const CATEGORY_ART_COLOR: Record<string, string> = {
  'garment.tshirt': '#B9502F',
  'garment.polo': '#1F8C73',
  'garment.trackpants': '#2B3530',
  'garment.shorts': '#697077',
  'garment.innerwear': '#8A5A12',
  'garment.vest': '#FFFFFF',
  'garment.kids': '#E9A23B',
  'garment.nightwear': '#C98E86',
  'garment.leggings': '#6D4466',
  'garment.hoodie': '#7A2E22',
  'fabric.knit': '#D3D7DC',
  'yarn.cotton': '#FFFFFF',
  'service.stitching': '#1F8C73',
  'service.printing': '#B9502F',
  'service.dyeing': '#E9A23B',
};

/** Flat backdrop for GarmentArt (overrides its built-in shading so art sits on plain cotton). */
export const flatArtStyle = { background: 'var(--color-sunken)' } as const;

export function TilesCard({ message, payload, ctx }: CardProps<'tiles'>) {
  const { locked, pick } = useChipLock(isStale(message, ctx));

  return (
    <div className="flex w-full flex-col gap-2.5">
      <QuestionBubble text={payload.text} />
      {/* Once a tile is picked the grid folds away; the user's reply bubble shows the choice. */}
      {!locked && (
        <div className="grid w-full max-w-[380px] grid-cols-3 gap-2.5">
          {payload.tiles.map((tile) => {
            const catId = tile.id.startsWith('cat:') ? tile.id.slice(4) : tile.id;
            return (
              <button
                key={tile.id}
                type="button"
                onClick={() => {
                  if (locked) return;
                  pick(tile.id);
                  void ctx.chip(tile.id, cleanLabel(tile.label));
                }}
                className={clsx(
                  'group flex flex-col overflow-hidden rounded-[18px] border border-line bg-surface p-1.5 text-left transition-[background-color,transform] hover:bg-sunken active:scale-[0.97]',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                )}
              >
                <span className="block aspect-square w-full overflow-hidden rounded-[14px]">
                  <GarmentArt shape={tile.shape} color={CATEGORY_ART_COLOR[catId] ?? tile.color} style={flatArtStyle} />
                </span>
                <span className="flex min-h-11 items-center justify-center px-1 pt-1.5 pb-1 text-center text-[13px] leading-[1.35] font-semibold text-ink">
                  {cleanLabel(tile.label)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default TilesCard;
