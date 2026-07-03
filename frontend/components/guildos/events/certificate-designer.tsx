'use client';

import { useState, type CSSProperties } from 'react';
import {
  resolveEventImageUrl,
  uploadEventMedia,
  type CertificateMode,
  type CertificateNamePlacement,
  type CertificateType,
  type EventInput,
} from '../event-api';
import { Section, Field, Toggle } from './event-form-ui';

type Props = {
  enabled: boolean;
  mode: CertificateMode;
  certificateType: CertificateType;
  template: string;
  placement: CertificateNamePlacement;
  minimumAttendanceDuration: number;
  checkOutRequired: boolean;
  onChange: (patch: Partial<EventInput>) => void;
  onError: (message: string) => void;
};

const CERTIFICATE_TYPES: { value: CertificateType; label: string }[] = [
  { value: 'ATTENDANCE', label: 'Attendance — awarded for participation' },
  { value: 'COMPLETION', label: 'Completion — awarded when activities are completed' },
  { value: 'LEADERSHIP', label: 'Leadership — awarded to organizers and staff' },
  { value: 'VOLUNTEER', label: 'Volunteer — awarded to event volunteers' },
];

export function CertificateDesigner({ enabled, mode, certificateType, template, placement, minimumAttendanceDuration, checkOutRequired, onChange, onError }: Props) {
  const [uploading, setUploading] = useState(false);

  async function handleUpload(file: File | null) {
    if (!file) return;
    try {
      setUploading(true);
      const fd = new FormData();
      fd.append('certificateTemplate', file);
      const uploaded = await uploadEventMedia(fd);
      onChange({ certificateTemplate: uploaded.certificateTemplate });
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to upload certificate template');
    } finally {
      setUploading(false);
    }
  }

  function updatePlacement(patch: Partial<CertificateNamePlacement>) {
    onChange({ certificateNamePlacement: { ...placement, ...patch } });
  }

  return (
    <Section title="Certificate Settings">
      <Toggle label="Issue certificate" checked={enabled} onChange={(v) => onChange({ certificateEnabled: v })} />
      {enabled ? (
        <>
          <Field label="Certificate Type">
            <select className="ev-input" value={certificateType} onChange={(e) => onChange({ certificateType: e.target.value as CertificateType })}>
              {CERTIFICATE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>

          <Field label="Template Source">
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => onChange({ certificateMode: 'STANDARD' })}
                className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${mode === 'STANDARD' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'}`}
              >
                <span className="block font-medium">GuildOS Standard</span>
                <span className={`block text-xs ${mode === 'STANDARD' ? 'text-slate-200' : 'text-slate-500'}`}>Auto-generated design with QR verification. No upload needed.</span>
              </button>
              <button
                type="button"
                onClick={() => onChange({ certificateMode: 'CUSTOM' })}
                className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${mode === 'CUSTOM' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'}`}
              >
                <span className="block font-medium">Upload My Template</span>
                <span className={`block text-xs ${mode === 'CUSTOM' ? 'text-slate-200' : 'text-slate-500'}`}>Use your own certificate design and position the attendee name.</span>
              </button>
            </div>
          </Field>

          {mode === 'CUSTOM' ? (
            <>
              <Field label="Certificate Template (image design)">
                <input type="file" accept="image/*" onChange={(e) => void handleUpload(e.target.files?.[0] ?? null)} />
                <p className="mt-1 text-xs text-slate-500">Upload your certificate background. Position where the attendee&apos;s name should appear below.</p>
                {uploading ? <p className="mt-1 text-sm text-slate-500">Uploading…</p> : null}
              </Field>

              {template ? (
                <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                  <div className="relative overflow-hidden rounded-2xl border border-slate-200" style={{ containerType: 'size' } as CSSProperties}>
                    <img src={resolveEventImageUrl(template)} alt="Certificate template" className="block w-full" />
                    <span
                      style={{
                        position: 'absolute',
                        left: `${placement.x}%`,
                        top: `${placement.y}%`,
                        transform: `translate(${placement.align === 'center' ? '-50%' : placement.align === 'right' ? '-100%' : '0'}, -50%)`,
                        color: placement.color,
                        fontSize: `${placement.fontSize}cqh`,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                      }}
                    >
                      Attendee Name
                    </span>
                  </div>
                  <div className="space-y-3">
                    <Field label={`Horizontal position (${placement.x}%)`}>
                      <input type="range" min={0} max={100} value={placement.x} onChange={(e) => updatePlacement({ x: Number(e.target.value) })} className="w-full" />
                    </Field>
                    <Field label={`Vertical position (${placement.y}%)`}>
                      <input type="range" min={0} max={100} value={placement.y} onChange={(e) => updatePlacement({ y: Number(e.target.value) })} className="w-full" />
                    </Field>
                    <Field label={`Font size (${placement.fontSize}% of height)`}>
                      <input type="range" min={2} max={20} value={placement.fontSize} onChange={(e) => updatePlacement({ fontSize: Number(e.target.value) })} className="w-full" />
                    </Field>
                    <div className="flex items-center gap-3">
                      <Field label="Color"><input type="color" value={placement.color} onChange={(e) => updatePlacement({ color: e.target.value })} /></Field>
                      <Field label="Align">
                        <select className="ev-input" value={placement.align} onChange={(e) => updatePlacement({ align: e.target.value as CertificateNamePlacement['align'] })}>
                          {['left', 'center', 'right'].map((a) => <option key={a} value={a}>{a}</option>)}
                        </select>
                      </Field>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              GuildOS will generate a branded certificate for each eligible attendee — including their name, the event, community, attendance duration, a unique certificate ID, and a scannable QR verification code. No design work required.
            </p>
          )}

          <Field label="Minimum Attendance Duration (minutes)">
            <input type="number" className="ev-input" value={minimumAttendanceDuration} onChange={(e) => onChange({ minimumAttendanceDuration: Number(e.target.value) })} />
          </Field>
          <Toggle label="Require check-out — attendees must stay to the end to earn a certificate" checked={checkOutRequired} onChange={(v) => onChange({ checkOutRequired: v })} />
          <p className="text-xs text-slate-500">Certificates are only issued to attendees who check in and check out at or after the event ends.</p>
        </>
      ) : null}
    </Section>
  );
}
