'use client';

import { useState } from 'react';

import { SelectMenu } from '../../../../../components/guildos/ui/select-menu';
import { FormattedTextEditor } from '../../../../../components/guildos/ui/formatted-text-editor';
import { Section, Field } from '../../../../../components/guildos/events/event-form-ui';
import { EVENT_TYPES } from '../../../../../components/guildos/event-api';
import { fromLocalInput, toLocalInput, type SectionProps } from './form-model';

export function BasicInfoSection({ form, update }: SectionProps) {
  // Raw text while typing (so trailing commas/newlines survive); the parsed list goes into the form.
  const [tagsText, setTagsText] = useState<string | null>(null);
  const [featuresText, setFeaturesText] = useState<string | null>(null);

  return (
    <Section title="Basic Information">
      <Field label="Event Title"><input className="ev-input" value={form.title ?? ''} onChange={(e) => update('title', e.target.value)} /></Field>
      <Field label="Theme / Topic (optional)">
        <input
          className="ev-input"
          placeholder="e.g. AI for Social Good"
          value={form.theme ?? ''}
          onChange={(e) => update('theme', e.target.value.slice(0, 120))}
        />
      </Field>
      <Field label="Event Type">
        <SelectMenu
          aria-label="Event type"
          value={form.type ?? ''}
          onChange={(v) => update('type', v)}
          options={EVENT_TYPES.map((t) => ({ value: t, label: t.replace(/_/g, ' ') }))}
        />
      </Field>
      <Field label="Short Description"><input className="ev-input" value={form.shortDescription ?? ''} onChange={(e) => update('shortDescription', e.target.value)} /></Field>
      <Field label="Full Description" as="div">
        <FormattedTextEditor className="ev-input min-h-56 w-full" value={form.description ?? ''} onChange={(v) => update('description', v)} />
      </Field>
      <Field label="Tags (comma separated, up to 5)">
        <input
          className="ev-input"
          placeholder="e.g. AI, Careers, Networking"
          value={tagsText ?? (form.tags ?? []).join(', ')}
          onChange={(e) => {
            setTagsText(e.target.value);
            update('tags', e.target.value.split(',').map((t) => t.trim().slice(0, 30)).filter(Boolean).slice(0, 5));
          }}
        />
      </Field>
      <Field label="Event features — what attendees get (one per line, up to 10)">
        <textarea
          className="ev-input min-h-24"
          placeholder={'Hands-on workshops\nFree Wi-Fi\nCertificate of attendance\nNetworking session'}
          value={featuresText ?? (form.features ?? []).join('\n')}
          onChange={(e) => {
            setFeaturesText(e.target.value);
            update('features', e.target.value.split('\n').map((f) => f.trim().slice(0, 80)).filter(Boolean).slice(0, 10));
          }}
        />
      </Field>
    </Section>
  );
}

export function ScheduleSection({ form, update }: SectionProps) {
  return (
    <Section title="Schedule">
      <Field label="Start"><input type="datetime-local" className="ev-input" value={toLocalInput(form.startDate)} onChange={(e) => update('startDate', fromLocalInput(e.target.value))} /></Field>
      <Field label="End"><input type="datetime-local" className="ev-input" value={toLocalInput(form.endDate)} onChange={(e) => update('endDate', fromLocalInput(e.target.value))} /></Field>
      <Field label="Timezone"><input className="ev-input" placeholder="e.g. Africa/Lagos" value={form.timezone ?? ''} onChange={(e) => update('timezone', e.target.value)} /></Field>
    </Section>
  );
}

const APPRECIATION_OPTIONS = [
  { value: 'AUTO' as const, title: 'Auto', desc: 'System sends a branded thank-you to attendees automatically when certificates are issued.' },
  { value: 'CUSTOM' as const, title: 'Custom', desc: 'You design the email yourself (tone, subject, message, button) from the Attendees page.' },
  { value: 'OFF' as const, title: 'Off', desc: 'No thank-you email is sent.' },
];

export function AppreciationSection({ form, update }: SectionProps) {
  const mode = form.appreciationMode ?? 'AUTO';
  return (
    <Section title="Thank-you email (after the event)">
      <div className="grid gap-3 sm:grid-cols-3">
        {APPRECIATION_OPTIONS.map((opt) => (
          <label key={opt.value} className={`cursor-pointer rounded-2xl border p-4 transition ${mode === opt.value ? 'border-indigo-600 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-500/15' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300'}`}>
            <input type="radio" name="appreciationMode" className="sr-only" checked={mode === opt.value} onChange={() => update('appreciationMode', opt.value)} />
            <p className="font-semibold text-slate-900 dark:text-slate-100">{opt.title}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{opt.desc}</p>
          </label>
        ))}
      </div>
    </Section>
  );
}
