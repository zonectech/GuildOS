'use client';
import { useState } from 'react';
import * as m from 'motion/react-m';
import { AnimatePresence } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { Stamp, type StampInk, type StampState } from '@/components/brand/stamp';
import { Avatar, MiniStamp } from '@/components/ui/avatar';
import { AvatarStack, type StackPerson } from '@/components/ui/avatar-stack';
import { Btn, Chip, DateTile, Odometer, SkeletonCard } from '@/components/ui/bits';
import { useToast } from '@/components/ui/toast';
import { EventCover } from '@/components/events/cover';
import { TYPE_STYLE } from '@/lib/events';
import { spring } from '@/lib/motion';

const COLORS = [
  ['paper', 'Page background'], ['surface', 'Cards'], ['ink', 'Text'], ['muted', 'Secondary text'], ['line', 'Borders'], ['mist', 'Hover, tracks'],
  ['green', 'Brand fill (white text)'], ['green-text', 'Brand text, icons, links'], ['tint', 'Brand wash'], ['gold', 'Achievements (ink text)'], ['coral', 'Live, urgent (ink text)'],
] as const;

function Swatches() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {COLORS.map(([token, use]) => (
        <div key={token} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-2.5">
          <span className="size-11 shrink-0 rounded-xl border border-line" style={{ background: `var(--${token})` }} />
          <span className="min-w-0"><b className="block text-[13.5px] text-ink">--{token}</b><small className="block truncate text-[12px] text-muted">{use}</small></span>
        </div>
      ))}
    </div>
  );
}

const Section = ({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) => (
  <section className="flex flex-col gap-4 border-t border-line pt-8">
    <div><h2 className="text-[28px] font-extrabold">{title}</h2>{note ? <p className="mt-1 max-w-2xl text-[15px] text-muted">{note}</p> : null}</div>
    {children}
  </section>
);

const PEOPLE: StackPerson[] = ['Guest 1', 'Guest 2', 'Guest 3', 'Guest 4', 'Guest 5', 'Guest 6'].map((n, i) => ({ id: String(i), name: n }));

export function DesignSystem() {
  const toast = useToast();
  const [replay, setReplay] = useState(0);
  const [count, setCount] = useState(128);
  const [stack, setStack] = useState(PEOPLE.slice(0, 4));
  const [chip, setChip] = useState(false);
  const [drop, setDrop] = useState(0);

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-10 px-4 pt-8 pb-16 sm:px-8 lg:pt-12">
      <header className="mesh">
        <span className="text-[13px] font-bold uppercase tracking-[.14em] text-green-text">Kintriva</span>
        <h1 className="mt-2 text-[48px] font-extrabold sm:text-[64px]">Design system</h1>
        <p className="mt-2 max-w-xl text-[17px] text-muted">The stamp is the signature. Everything else is warm paper, confident type and green ink, with motion that feels physical.</p>
      </header>

      <Section title="Colour" note="One set of tokens, two themes. Gold and coral are fills with ink text, never white. In dark mode, brand text uses a lighter green (#2FBF7F) so it reads on near-black.">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="light rounded-[24px] border border-line bg-paper p-4"><b className="mb-3 block text-[14px] text-ink">Light</b><Swatches /></div>
          {/* The .dark class re-scopes every token, so this panel previews dark mode on any page theme. */}
          <div className="dark rounded-[24px] border border-line bg-paper p-4"><b className="mb-3 block text-[14px] text-ink">Dark</b><Swatches /></div>
        </div>
      </Section>

      <Section title="Type" note="Bricolage Grotesque for headings (tight letter-spacing), Figtree for body text. Both load through next/font.">
        <div className="flex flex-col gap-3 rounded-[24px] border border-line bg-surface p-6">
          <span className="font-display text-[64px] font-extrabold leading-none tracking-[-.04em]">Every event counts</span>
          <span className="font-display text-[40px] font-extrabold leading-none tracking-[-.03em]">Happening now</span>
          <span className="font-display text-[24px] font-extrabold tracking-[-.02em]">Guest list</span>
          <span className="text-[17px]">Body large: register and get your QR pass.</span>
          <span className="text-[15px]">Body: Thursday 14 November, 2:00 pm – 5:00 pm.</span>
          <span className="text-[13px] text-muted">Small: 86 of 128 checked in.</span>
          <span className="text-[12px] font-bold uppercase tracking-[.12em] text-green-text">Label: Workshop</span>
        </div>
        <p className="text-[14px] text-muted">Spacing runs on a 4px grid (4, 8, 12, 16, 20, 24, 32, 40, 56). Cards round to 22px, sheets to 28px, chips and pills fully.</p>
      </Section>

      <Section title="Motion" note="Springs, not linear easing. Only transform and opacity animate. With reduce motion on, movement becomes simple fades.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['snap', 'Taps, chips, toggles', spring.snap],
            ['soft', 'Pages, cards, panels', spring.soft],
            ['bouncy', 'Celebrations, avatar pops', spring.bouncy],
            ['sheet', 'Sheets and overlays', spring.sheet],
          ].map(([name, use, tr]) => (
            <button key={name as string} type="button" onClick={() => setReplay((r) => r + 1)} className="flex flex-col gap-3 rounded-[22px] border border-line bg-surface p-4 text-left hover:bg-mist">
              <m.span key={`${name}-${replay}`} initial={{ x: -30, opacity: 0, scale: 0.7 }} animate={{ x: 0, opacity: 1, scale: 1 }} transition={tr as object} className="size-10 rounded-xl bg-green" />
              <span><b className="block font-display text-[17px]">spring.{name as string}</b><small className="text-[13px] text-muted">{use as string}</small></span>
            </button>
          ))}
        </div>
        <p className="text-[13.5px] text-muted">Tap a tile to replay. Pages: content rises 12px and children stagger 50ms apart; avatars cascade 40ms apart; buttons squish to 0.96 on press.</p>
      </Section>

      <Section title="The stamp" note="A crisp SVG seal with an event label and state-specific status. Small sizes use a simplified badge. Four states, four inks.">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {(['stamped', 'pending', 'empty', 'locked'] as StampState[]).map((st) => (
            <div key={st} className="flex flex-col items-center gap-2 rounded-[22px] border border-line bg-surface p-4">
              <Stamp state={st} label="AI Bootcamp 2026" date={{ day: '14', month: 'Nov' }} size={130} tilt={st === 'stamped' ? -8 : 0} />
              <b className="text-[14px] capitalize">{st}</b>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-6 rounded-[22px] border border-line bg-surface p-6">
          {(['green', 'gold', 'coral', 'ink'] as StampInk[]).map((ink, i) => <Stamp key={ink} ink={ink} label={`${ink} ink sample`} date={{ day: String(10 + i), month: 'Nov' }} size={120} tilt={[-10, 6, -4, 9][i]} />)}
          <div className="dark flex rounded-2xl bg-paper p-4"><Stamp label="Dark mode" date={{ day: '22', month: 'Nov' }} size={120} /></div>
        </div>
        <div className="flex flex-wrap items-end justify-center gap-6 rounded-[22px] border border-line bg-surface p-6">
          {[46, 64, 120, 160].map((size) => <div key={size} className="flex flex-col items-center gap-3"><Stamp label="Student Technology and Innovation Workshop" date={{ day: '14', month: 'Nov' }} size={size} /><span className="text-[12px] text-muted">{size}px</span></div>)}
        </div>
        <div className="flex flex-col items-center gap-3 rounded-[22px] border border-line bg-surface p-6">
          <div className="grid h-[180px] place-items-center">
            <AnimatePresence mode="wait">
              <m.div key={drop} initial={{ scale: 2.2, opacity: 0, rotate: -35, y: -40 }} animate={{ scale: [2.2, 0.86, 1.06, 1], opacity: 1, rotate: -8, y: 0 }} transition={{ duration: 0.55, times: [0, 0.55, 0.8, 1], ease: 'easeOut' }}>
                <Stamp label="Stamp drop preview" date={{ day: '14', month: 'Nov' }} size={160} />
              </m.div>
            </AnimatePresence>
          </div>
          <Btn kind="secondary" size="sm" onClick={() => setDrop((d) => d + 1)}>Replay the stamp drop</Btn>
          <p className="text-center text-[13px] text-muted">The full moment (ink splat, confetti, haptics, flying into your profile) is built with the profile stage.</p>
        </div>
      </Section>

      <Section title="Avatars" note="Round photos with a thin ring; without a photo, initials on a brand colour, never a grey silhouette. Photos load at 48px or 96px only.">
        <div className="flex flex-wrap items-center gap-5 rounded-[22px] border border-line bg-surface p-5">
          {['Ada', 'Tobi B', 'Kemi O', 'Musa', 'Zainab I', 'Chidi'].map((n) => <Avatar key={n} name={n} size={52} />)}
          <Avatar name="Checked in" size={52} checked />
          <Avatar name="Attended" size={52} stamped />
          <span className="inline-flex items-center gap-1 rounded-full bg-mist px-2.5 py-1 text-[13px] font-bold"><MiniStamp size={15} />14 stamps</span>
        </div>
        <div className="flex flex-col gap-4 rounded-[22px] border border-line bg-surface p-5">
          <div className="flex flex-wrap items-center gap-4">
            <AvatarStack people={stack} total={count} max={6} size={44} label={`${count} going`} />
            <span className="flex items-baseline gap-2 font-display text-[24px] font-extrabold">Going · <Odometer value={count} className="text-green-text" /></span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn size="sm" onClick={() => { setStack((s) => [{ id: `n${Date.now()}`, name: `Guest ${s.length + 1}` }, ...s]); setCount((c) => c + 1); toast('Guest just joined', <Sparkles size={16} className="text-green-text" />); }}>Someone joins</Btn>
            <Btn size="sm" kind="secondary" onClick={() => setCount((c) => c + 37)}>+37 (odometer)</Btn>
            <Btn size="sm" kind="ghost" onClick={() => { setStack(PEOPLE.slice(0, 4)); setCount(128); }}>Reset</Btn>
          </div>
          <div className="flex items-center gap-3"><AvatarStack people={PEOPLE} total={0} max={5} size={36} label="Signed-out view" blurred /><span className="text-[14px] text-muted">Signed out: faces blurred</span></div>
        </div>
      </Section>

      <Section title="Building blocks">
        <div className="flex flex-wrap items-center gap-3 rounded-[22px] border border-line bg-surface p-5">
          <DateTile value={"2026-11-14T13:00:00.000Z"} size="sm" /><DateTile value={"2026-11-14T13:00:00.000Z"} /><DateTile value={"2026-11-14T13:00:00.000Z"} size="lg" />
          <Btn>Register</Btn><Btn kind="secondary">Share</Btn><Btn kind="gold">View certificate</Btn>
          <Chip on={chip} onClick={() => setChip(!chip)}>My department</Chip>
          <span className="live-ring inline-flex items-center gap-1.5 rounded-full bg-coral px-3 py-1.5 text-[12px] font-extrabold uppercase text-[#111714]"><span className="live-dot size-1.5 rounded-full bg-[#111714]" />Live</span>
          <Btn kind="secondary" size="sm" onClick={() => toast('Toasts slide in and bounce')}>Show a toast</Btn>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {Object.keys(TYPE_STYLE).slice(0, 6).map((t) => (
            <div key={t} className="relative aspect-[16/10] overflow-hidden rounded-[22px] shadow-card"><EventCover title={`sample ${t}`} type={t} sizes="33vw" caption={`${TYPE_STYLE[t].label} sample`} /></div>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-3"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
      </Section>
    </div>
  );
}
