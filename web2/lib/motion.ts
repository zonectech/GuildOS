/**
 * Motion tokens: every animation in the app takes its timing from here, so the whole site moves the same way.
 * Springs, not linear easing. Only transform and opacity are animated.
 */
import type { Transition, Variants } from 'motion/react';

export const spring = {
  /** Taps, toggles, chips: quick and crisp. */
  snap: { type: 'spring', stiffness: 500, damping: 30 } satisfies Transition,
  /** Page elements, cards, panels: soft and settled. */
  soft: { type: 'spring', stiffness: 200, damping: 25 } satisfies Transition,
  /** Celebrations (stamp drop, avatar pop): a little overshoot. */
  bouncy: { type: 'spring', stiffness: 420, damping: 14 } satisfies Transition,
  /** Sheets and overlays sliding in. */
  sheet: { type: 'spring', stiffness: 320, damping: 34 } satisfies Transition,
};

export const stagger = { children: 0.05, avatars: 0.04 };

/** Content fades and rises 12px; children follow 50ms apart. */
export const page: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { ...spring.soft, staggerChildren: stagger.children } },
};
export const rise: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: spring.soft },
};
export const pop: Variants = {
  hidden: { opacity: 0, scale: 0.6 },
  show: { opacity: 1, scale: 1, transition: spring.bouncy },
};

/** Buttons squish on press. */
export const press = { scale: 0.96 };
