// Shared GuildOS STANDARD certificate renderer.
// Used by the public certificate page AND the live preview in the event wizard,
// so the wizard preview always matches the real, printed certificate.
import { resolveEventImageUrl } from './event-api';

export const TYPE_LABEL: Record<string, string> = {
  ATTENDANCE: 'Certificate of Attendance',
  COMPLETION: 'Certificate of Completion',
  LEADERSHIP: 'Certificate of Leadership',
  VOLUNTEER: 'Certificate of Volunteering',
};

type BgDef = { stops: [string, string]; heading: string; ink: string; sub: string; rule: string; dark: boolean };

const BG: Record<string, BgDef> = {
  IVORY: { stops: ['#fdfbf4', '#f4ecd8'], heading: '#182a49', ink: '#22262e', sub: '#7a6f57', rule: '#182a49', dark: false },
  WHITE: { stops: ['#ffffff', '#f5f5f2'], heading: '#1e293b', ink: '#22262e', sub: '#64748b', rule: '#94a3b8', dark: false },
  CREAM: { stops: ['#fbf6ea', '#f3e7cf'], heading: '#3a2e18', ink: '#4a3d28', sub: '#8a7a58', rule: '#c9b892', dark: false },
  SLATE: { stops: ['#f4f6fa', '#e6ebf2'], heading: '#1e293b', ink: '#334155', sub: '#64748b', rule: '#94a3b8', dark: false },
  BLUSH: { stops: ['#fdf3f3', '#f7e3e6'], heading: '#5b2333', ink: '#4a2a33', sub: '#9c6b76', rule: '#e2b7c0', dark: false },
  NAVY: { stops: ['#1d2d4f', '#0f1c33'], heading: '#f6efda', ink: '#eef2f8', sub: 'rgba(244,236,216,0.72)', rule: 'rgba(246,239,218,0.5)', dark: true },
  CHARCOAL: { stops: ['#2b2f36', '#181b20'], heading: '#f4f4f2', ink: '#e8e8e6', sub: 'rgba(240,240,235,0.66)', rule: 'rgba(240,240,235,0.4)', dark: true },
  FOREST: { stops: ['#1f3a2e', '#12241c'], heading: '#f0ecd8', ink: '#e6efe6', sub: 'rgba(240,236,216,0.7)', rule: 'rgba(240,236,216,0.45)', dark: true },
  BURGUNDY: { stops: ['#4a1f2b', '#2c1219'], heading: '#f6e7d8', ink: '#f0e2dd', sub: 'rgba(246,231,216,0.7)', rule: 'rgba(246,231,216,0.45)', dark: true },
};

const FONT_STACK: Record<string, string> = {
  SERIF: 'Georgia, "Times New Roman", serif',
  ELEGANT: '"Palatino Linotype", "Book Antiqua", Georgia, serif',
  SANS: 'Arial, Helvetica, sans-serif',
  PLAYFAIR: '"Playfair Display", Georgia, serif',
  CORMORANT: '"Cormorant Garamond", Georgia, serif',
  MERRIWEATHER: '"Merriweather", Georgia, serif',
  MONTSERRAT: '"Montserrat", Arial, sans-serif',
  SCRIPT: '"Great Vibes", "Segoe Script", cursive',
};

// UI option lists (single source of truth for the wizard controls).
export const CERT_BACKGROUNDS: { value: string; label: string; swatch: string }[] = [
  { value: 'IVORY', label: 'Ivory', swatch: 'linear-gradient(135deg,#fdfbf4,#f4ecd8)' },
  { value: 'WHITE', label: 'White', swatch: '#ffffff' },
  { value: 'CREAM', label: 'Cream', swatch: 'linear-gradient(135deg,#fbf6ea,#f3e7cf)' },
  { value: 'SLATE', label: 'Slate', swatch: 'linear-gradient(135deg,#f4f6fa,#e6ebf2)' },
  { value: 'BLUSH', label: 'Blush', swatch: 'linear-gradient(135deg,#fdf3f3,#f7e3e6)' },
  { value: 'NAVY', label: 'Navy', swatch: 'linear-gradient(135deg,#1d2d4f,#0f1c33)' },
  { value: 'CHARCOAL', label: 'Charcoal', swatch: 'linear-gradient(135deg,#2b2f36,#181b20)' },
  { value: 'FOREST', label: 'Forest', swatch: 'linear-gradient(135deg,#1f3a2e,#12241c)' },
  { value: 'BURGUNDY', label: 'Burgundy', swatch: 'linear-gradient(135deg,#4a1f2b,#2c1219)' },
];

export const CERT_FONTS: { value: string; label: string; css: string }[] = [
  { value: 'SERIF', label: 'Classic Serif', css: FONT_STACK.SERIF },
  { value: 'ELEGANT', label: 'Elegant', css: FONT_STACK.ELEGANT },
  { value: 'SANS', label: 'Modern Sans', css: FONT_STACK.SANS },
  { value: 'PLAYFAIR', label: 'Playfair', css: FONT_STACK.PLAYFAIR },
  { value: 'CORMORANT', label: 'Cormorant', css: FONT_STACK.CORMORANT },
  { value: 'MERRIWEATHER', label: 'Merriweather', css: FONT_STACK.MERRIWEATHER },
  { value: 'MONTSERRAT', label: 'Montserrat', css: FONT_STACK.MONTSERRAT },
  { value: 'SCRIPT', label: 'Signature Script', css: FONT_STACK.SCRIPT },
];

export type CertificateDrawData = {
  attendeeName: string;
  eventTitle: string;
  communityName?: string;
  university?: string;
  type: string;
  theme: { accent: string; background: string; font: string };
  style: string;
  content: { title: string; presentation: string; message: string; signatories: { name: string; title: string; image: string }[]; logo?: string; logoPlacement?: string };
  sponsors?: { name: string; logo: string }[];
  serial: string;
  verificationUrl: string;
  issueDate?: string | null;
  eventDate?: string | null;
  attendanceMinutes?: number;
  qrCanvas?: HTMLCanvasElement | null;
};

function formatDuration(minutes?: number) {
  if (!minutes || minutes <= 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h} Hour${h > 1 ? 's' : ''}`;
  return `${m} Minute${m > 1 ? 's' : ''}`;
}

function formatDate(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

const loadImg = (src: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

/** Draws the STANDARD certificate at a fixed 1600×1450 for consistent printing. */
export async function drawStandardCertificate(canvas: HTMLCanvasElement, data: CertificateDrawData): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  try {
    await (document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts?.ready;
  } catch {
    /* fonts optional */
  }

  const content = data.content ?? { title: '', presentation: '', message: '', signatories: [] };
  const style = data.style ?? 'CLASSIC';
  const signatories = (content.signatories ?? []).filter((s) => s.name || s.title || s.image).slice(0, 3);
  const logoPlacement = content.logo ? (content.logoPlacement || 'NONE') : 'NONE';
  const logoImg = content.logo ? await loadImg(resolveEventImageUrl(content.logo)) : null;
  const W = 1600;
  const H = 1450;
  canvas.width = W;
  canvas.height = H;
  const cx = W / 2;

  const lighten = (hex: string, amt: number) => {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const n = parseInt(full, 16);
    let r = (n >> 16) & 255;
    let g = (n >> 8) & 255;
    let b = n & 255;
    r = Math.round(r + (255 - r) * amt);
    g = Math.round(g + (255 - g) * amt);
    b = Math.round(b + (255 - b) * amt);
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  };

  const theme = data.theme ?? { accent: '#b8933a', background: 'IVORY', font: 'SERIF' };
  const accent = /^#[0-9a-fA-F]{6}$/.test(theme.accent) ? theme.accent : '#b8933a';
  const def = BG[theme.background] ?? BG.IVORY;
  const bgStops = def.stops;
  const gold = accent;
  const goldSoft = lighten(accent, 0.5);
  const navy = def.heading;
  const ink = def.ink;
  const sub = def.sub;
  const ruleColor = def.rule;
  const sealDisk = '#16233d';
  const pillInk = '#182a49';
  const serifStack = FONT_STACK[theme.font] ?? FONT_STACK.SERIF;
  const nameWeight = theme.font === 'SANS' || theme.font === 'MONTSERRAT' ? '700' : theme.font === 'SCRIPT' ? '400' : 'italic 700';

  const seg = (x1: number, y1: number, x2: number, y2: number, color: string, w: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  const diamond = (x: number, y: number, r: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
    ctx.closePath();
    ctx.fill();
  };
  const star = (x: number, y: number, spikes: number, outer: number, inner: number, color: string) => {
    let rot = -Math.PI / 2;
    const stepA = Math.PI / spikes;
    ctx.beginPath();
    ctx.moveTo(x, y - outer);
    for (let i = 0; i < spikes; i += 1) {
      ctx.lineTo(x + Math.cos(rot) * outer, y + Math.sin(rot) * outer);
      rot += stepA;
      ctx.lineTo(x + Math.cos(rot) * inner, y + Math.sin(rot) * inner);
      rot += stepA;
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  const wrap = (text: string, maxW: number) => {
    const words = (text || '').split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur = '';
    for (const wd of words) {
      const t = cur ? `${cur} ${wd}` : wd;
      if (ctx.measureText(t).width > maxW && cur) {
        lines.push(cur);
        cur = wd;
      } else {
        cur = t;
      }
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [''];
  };
  const setSpacing = (px: number) => {
    if ('letterSpacing' in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px}px`;
  };

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, bgStops[0]);
  bg.addColorStop(1, bgStops[1]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Organizer logo watermark (drawn behind all content)
  if (logoImg && logoPlacement === 'WATERMARK') {
    const wmMax = 720;
    const wmScale = Math.min(wmMax / logoImg.naturalWidth, wmMax / logoImg.naturalHeight);
    const wmW = logoImg.naturalWidth * wmScale;
    const wmH = logoImg.naturalHeight * wmScale;
    ctx.save();
    ctx.globalAlpha = def.dark ? 0.1 : 0.07;
    ctx.drawImage(logoImg, cx - wmW / 2, H / 2 - wmH / 2, wmW, wmH);
    ctx.restore();
  }

  // Decoration (ready-made design)
  const deco2 = def.dark ? lighten(accent, 0.3) : '#16233d';
  const frame = (inset: number, w: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
  };
  if (style === 'MODERN') {
    const corner = (ox: number, oy: number, sx: number, sy: number) => {
      ctx.fillStyle = deco2;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + sx * 320, oy);
      ctx.lineTo(ox, oy + sy * 320);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = gold;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + sx * 225, oy);
      ctx.lineTo(ox, oy + sy * 225);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = bgStops[0];
      ctx.beginPath();
      ctx.moveTo(ox + sx * 74, oy);
      ctx.lineTo(ox + sx * 158, oy);
      ctx.lineTo(ox, oy + sy * 158);
      ctx.lineTo(ox, oy + sy * 74);
      ctx.closePath();
      ctx.fill();
    };
    corner(0, 0, 1, 1);
    corner(W, 0, -1, 1);
    corner(0, H, 1, -1);
    corner(W, H, -1, -1);
    frame(72, 2, gold);
  } else if (style === 'MINIMAL') {
    frame(64, 2.5, gold);
  } else if (style === 'CORPORATE') {
    ctx.fillStyle = deco2;
    ctx.fillRect(0, 0, W, 26);
    ctx.fillStyle = gold;
    ctx.fillRect(0, 26, W, 8);
    ctx.fillStyle = deco2;
    ctx.fillRect(0, H - 26, W, 26);
    ctx.fillStyle = gold;
    ctx.fillRect(0, H - 34, W, 8);
    frame(60, 1.5, gold);
  } else if (style === 'DECO') {
    frame(56, 2, gold);
    frame(66, 1, gold);
    const bracket = (x: number, sx: number, y: number, sy: number) => {
      ctx.strokeStyle = gold;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x + sx * 30, y + sy * 96);
      ctx.lineTo(x + sx * 30, y + sy * 30);
      ctx.lineTo(x + sx * 96, y + sy * 30);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + sx * 46, y + sy * 128);
      ctx.lineTo(x + sx * 46, y + sy * 46);
      ctx.lineTo(x + sx * 128, y + sy * 46);
      ctx.stroke();
    };
    bracket(56, 1, 56, 1);
    bracket(W - 56, -1, 56, 1);
    bracket(56, 1, H - 56, -1);
    bracket(W - 56, -1, H - 56, -1);
  } else if (style === 'GEOMETRIC') {
    frame(60, 2, gold);
    for (let x = 96; x < W - 90; x += 48) {
      diamond(x, 60, 6, gold);
      diamond(x, H - 60, 6, gold);
    }
    for (let yy = 96; yy < H - 90; yy += 48) {
      diamond(60, yy, 6, gold);
      diamond(W - 60, yy, 6, gold);
    }
  } else if (style === 'RIBBON') {
    frame(58, 2, gold);
    ctx.fillStyle = deco2;
    ctx.beginPath();
    ctx.moveTo(cx - 70, 58);
    ctx.lineTo(cx + 70, 58);
    ctx.lineTo(cx + 46, 96);
    ctx.lineTo(cx, 80);
    ctx.lineTo(cx - 46, 96);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = gold;
    ctx.fillRect(cx - 70, 58, 140, 5);
  } else if (style === 'DOUBLE') {
    frame(46, 6, gold);
    frame(70, 6, gold);
    for (const [dx, dy] of [[58, 58], [W - 58, 58], [58, H - 58], [W - 58, H - 58]] as const) {
      ctx.fillStyle = gold;
      ctx.fillRect(dx - 8, dy - 8, 16, 16);
    }
  } else if (style === 'ROUNDED') {
    const inset = 58;
    if (ctx.roundRect) {
      ctx.strokeStyle = gold;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(inset, inset, W - inset * 2, H - inset * 2, 30);
      ctx.stroke();
      ctx.strokeStyle = goldSoft;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(inset + 11, inset + 11, W - inset * 2 - 22, H - inset * 2 - 22, 22);
      ctx.stroke();
    } else {
      frame(inset, 3, gold);
    }
  } else if (style === 'LAUREL') {
    frame(58, 2, gold);
    ctx.fillStyle = gold;
    for (let i = 0; i < 22; i += 1) {
      const a = Math.PI * 0.28 + (i / 21) * Math.PI * 1.44;
      const lx = cx + Math.cos(a) * 74;
      const ly = 178 + Math.sin(a) * 74;
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(a + Math.PI / 2);
      ctx.beginPath();
      ctx.ellipse(0, 0, 4, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  } else if (style === 'TECH') {
    frame(60, 1.5, gold);
    const trace = (x: number, sx: number, y: number, sy: number) => {
      ctx.strokeStyle = gold;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + sx * 40, y + sy * 40);
      ctx.lineTo(x + sx * 40, y + sy * 110);
      ctx.lineTo(x + sx * 84, y + sy * 154);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + sx * 40, y + sy * 40);
      ctx.lineTo(x + sx * 132, y + sy * 40);
      ctx.stroke();
      ctx.fillStyle = gold;
      for (const [px, py] of [[40, 110], [84, 154], [132, 40]] as const) {
        ctx.beginPath();
        ctx.arc(x + sx * px, y + sy * py, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    trace(60, 1, 60, 1);
    trace(W - 60, -1, 60, 1);
    trace(60, 1, H - 60, -1);
    trace(W - 60, -1, H - 60, -1);
  } else if (style === 'WAVE') {
    const wave = (yBase: number) => {
      ctx.strokeStyle = gold;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let x = 60; x <= W - 60; x += 4) {
        const yy = yBase + Math.sin(x / 55) * 10;
        if (x === 60) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    };
    wave(74);
    wave(H - 74);
    ctx.strokeStyle = goldSoft;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(60, 88);
    ctx.lineTo(60, H - 88);
    ctx.moveTo(W - 60, 88);
    ctx.lineTo(W - 60, H - 88);
    ctx.stroke();
  } else {
    frame(40, 3, ruleColor);
    frame(55, 9, gold);
    frame(74, 1.5, ruleColor);
    for (const [dx, dy] of [[74, 74], [W - 74, 74], [74, H - 74], [W - 74, H - 74]] as const) {
      diamond(dx, dy, 13, gold);
      diamond(dx, dy, 6, ruleColor);
    }
  }

  ctx.textAlign = 'center';

  // Emblem
  const emY = 178;
  ctx.strokeStyle = goldSoft;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, emY, 58, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = gold;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, emY, 49, 0, Math.PI * 2);
  ctx.stroke();
  if (logoImg && logoPlacement === 'EMBLEM') {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, emY, 44, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    const r = 44;
    const scale = Math.min((r * 2) / logoImg.naturalWidth, (r * 2) / logoImg.naturalHeight);
    const lw = logoImg.naturalWidth * scale;
    const lh = logoImg.naturalHeight * scale;
    ctx.drawImage(logoImg, cx - lw / 2, emY - lh / 2, lw, lh);
    ctx.restore();
  } else {
    ctx.fillStyle = sealDisk;
    ctx.beginPath();
    ctx.arc(cx, emY, 41, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = gold;
    ctx.font = `700 44px ${serifStack}`;
    ctx.textBaseline = 'middle';
    ctx.fillText('G', cx, emY + 3);
    ctx.textBaseline = 'alphabetic';
  }

  // Organizer logo in a top corner
  if (logoImg && (logoPlacement === 'TOP_LEFT' || logoPlacement === 'TOP_RIGHT')) {
    const boxH = 96;
    const boxW = Math.min(200, (logoImg.naturalWidth / logoImg.naturalHeight) * boxH);
    const ly = 96;
    const lx = logoPlacement === 'TOP_LEFT' ? 132 : W - 132 - boxW;
    ctx.drawImage(logoImg, lx, ly, boxW, boxH);
  }

  ctx.fillStyle = navy;
  ctx.font = '700 24px Arial, sans-serif';
  setSpacing(8);
  ctx.fillText('GUILDOS', cx, emY + 100);
  setSpacing(0);

  // Title
  ctx.fillStyle = ink;
  ctx.font = `700 58px ${serifStack}`;
  setSpacing(6);
  ctx.fillText((content.title || TYPE_LABEL[data.type] || 'Certificate').toUpperCase(), cx, 348);
  setSpacing(0);
  seg(cx - 150, 372, cx + 150, 372, gold, 2);
  diamond(cx, 372, 7, gold);
  seg(cx - 205, 372, cx - 162, 372, goldSoft, 2);
  seg(cx + 162, 372, cx + 205, 372, goldSoft, 2);

  // ── Fit + pre-measure the flowing body so it can be vertically centred
  // between the title flourish and the footer. Without this, certificates
  // with no message/sponsors/signatures show a large dead gap.
  const nameMaxW = W - 440;
  let nameSize = 82;
  ctx.font = `${nameWeight} ${nameSize}px ${serifStack}`;
  while (nameSize > 46 && ctx.measureText(data.attendeeName).width > nameMaxW) {
    nameSize -= 2;
    ctx.font = `${nameWeight} ${nameSize}px ${serifStack}`;
  }
  const nameLines = ctx.measureText(data.attendeeName).width > nameMaxW ? wrap(data.attendeeName, nameMaxW) : [data.attendeeName];

  let titleSize = 40;
  const titleMaxW = W - 480;
  ctx.font = `600 ${titleSize}px ${serifStack}`;
  while (titleSize > 28 && ctx.measureText(data.eventTitle).width > titleMaxW) {
    titleSize -= 2;
    ctx.font = `600 ${titleSize}px ${serifStack}`;
  }
  const titleLines = ctx.measureText(data.eventTitle).width > titleMaxW ? wrap(data.eventTitle, titleMaxW).slice(0, 2) : [data.eventTitle];

  ctx.font = `italic 400 22px ${serifStack}`;
  const msgLines = content.message ? wrap(content.message, W - 520).slice(0, 2) : [];

  const org = [data.communityName, data.university].filter(Boolean).join('   ·   ');
  const duration = formatDuration(data.attendanceMinutes);
  const eventDate = formatDate(data.eventDate);
  const metaLine = [duration ? `Attendance: ${duration}` : '', eventDate ? `Event Date: ${eventDate}` : ''].filter(Boolean).join('        ');

  // Mirror the exact y-advances of the draw pass below.
  let simEnd = 442 + 98 + nameLines.length * (nameSize + 8) + 20 + 58 + titleLines.length * (titleSize + 10);
  if (org) simEnd += 10;
  if (metaLine) simEnd += 40;
  if (msgLines.length) simEnd += 46 + msgLines.length * 30;
  const blocksH = ((data.sponsors ?? []).length ? 128 : 0) + (signatories.length ? 106 : 0);
  const bottomLimit = H - 250; // stay clear of the footer / seal area
  const startOffset = Math.max(0, Math.floor((bottomLimit - (simEnd + blocksH)) / 2));

  // Body
  let y = 442 + startOffset;
  ctx.fillStyle = sub;
  ctx.font = `italic 400 25px ${serifStack}`;
  ctx.fillText('This certificate is proudly presented to', cx, y);

  y += 98;
  ctx.fillStyle = navy;
  ctx.font = `${nameWeight} ${nameSize}px ${serifStack}`;
  let widestName = 0;
  for (const ln of nameLines) {
    widestName = Math.max(widestName, ctx.measureText(ln).width);
    ctx.fillText(ln, cx, y);
    y += nameSize + 8;
  }
  const nameW = Math.min(680, Math.max(320, widestName + 90));
  seg(cx - nameW / 2, y - Math.round(nameSize * 0.55), cx + nameW / 2, y - Math.round(nameSize * 0.55), gold, 2);

  y += 20;
  ctx.fillStyle = sub;
  ctx.font = `italic 400 24px ${serifStack}`;
  ctx.fillText(content.presentation || 'for participating in', cx, y);

  y += 58;
  ctx.fillStyle = ink;
  ctx.font = `600 ${titleSize}px ${serifStack}`;
  for (const ln of titleLines) {
    ctx.fillText(ln, cx, y);
    y += titleSize + 10;
  }

  if (org) {
    y += 10;
    ctx.fillStyle = sub;
    ctx.font = '400 22px Arial, sans-serif';
    ctx.fillText(`Organized by ${org}`, cx, y);
  }

  if (metaLine) {
    y += 40;
    ctx.fillStyle = sub;
    ctx.font = '500 20px Arial, sans-serif';
    ctx.fillText(metaLine, cx, y);
  }

  if (msgLines.length) {
    y += 46;
    ctx.fillStyle = ink;
    ctx.font = `italic 400 22px ${serifStack}`;
    for (const ln of msgLines) {
      ctx.fillText(ln, cx, y);
      y += 30;
    }
  }

  // Footer: details (left) + seal (center) + QR (right)
  const drawFooter = () => {
    const baseY = H - 208;
    ctx.textAlign = 'left';
    ctx.fillStyle = sub;
    ctx.font = '600 15px Arial, sans-serif';
    setSpacing(1);
    ctx.fillText('CERTIFICATE ID', 132, baseY);
    setSpacing(0);
    ctx.fillStyle = navy;
    ctx.font = '700 24px Arial, sans-serif';
    ctx.fillText(data.serial, 132, baseY + 32);
    ctx.fillStyle = sub;
    ctx.font = '400 15px Arial, sans-serif';
    ctx.fillText(`Issued ${formatDate(data.issueDate)}`, 132, baseY + 60);
    ctx.fillText('Verify authenticity at', 132, baseY + 84);
    ctx.fillStyle = gold;
    ctx.font = '600 15px Arial, sans-serif';
    ctx.fillText(data.verificationUrl, 132, baseY + 106);

    const sx = cx;
    const sy = H - 155;
    const rSeal = 50;
    const ribbonColor = def.dark ? lighten(accent, 0.12) : '#8a6a22';
    const ribbon = (dir: number) => {
      ctx.fillStyle = ribbonColor;
      ctx.beginPath();
      ctx.moveTo(sx + dir * 16, sy + 24);
      ctx.lineTo(sx + dir * 44, sy + 58);
      ctx.lineTo(sx + dir * 30, sy + 58);
      ctx.lineTo(sx + dir * 22, sy + 74);
      ctx.lineTo(sx + dir * 6, sy + 34);
      ctx.closePath();
      ctx.fill();
    };
    ribbon(-1);
    ribbon(1);
    const scallops = 16;
    ctx.fillStyle = goldSoft;
    for (let i = 0; i < scallops; i += 1) {
      const a = (i / scallops) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(sx + Math.cos(a) * rSeal, sy + Math.sin(a) * rSeal, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = gold;
    ctx.beginPath();
    ctx.arc(sx, sy, rSeal, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = goldSoft;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, rSeal - 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = sealDisk;
    ctx.beginPath();
    ctx.arc(sx, sy, rSeal - 12, 0, Math.PI * 2);
    ctx.fill();
    star(sx, sy - 9, 5, 14, 6, goldSoft);
    ctx.textAlign = 'center';
    ctx.fillStyle = goldSoft;
    ctx.font = '700 11px Arial, sans-serif';
    setSpacing(2);
    ctx.fillText('VERIFIED', sx, sy + 16);
    setSpacing(0);

    const qs = 132;
    const qx = W - 132 - qs;
    const qy = H - 120 - qs;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(qx - 8, qy - 8, qs + 16, qs + 16);
    ctx.strokeStyle = goldSoft;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(qx - 8, qy - 8, qs + 16, qs + 16);
    if (data.qrCanvas) {
      ctx.drawImage(data.qrCanvas, qx, qy, qs, qs);
    } else {
      ctx.fillStyle = '#e5e7eb';
      ctx.fillRect(qx, qy, qs, qs);
      ctx.fillStyle = '#9ca3af';
      ctx.font = '600 16px Arial, sans-serif';
      ctx.fillText('QR', qx + qs / 2, qy + qs / 2 + 6);
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = sub;
    ctx.font = '400 14px Arial, sans-serif';
    ctx.fillText('Scan to verify', qx + qs / 2, qy + qs + 24);
  };

  // Sponsors strip + signatures (with images) then footer
  const sponsors = (data.sponsors ?? []).slice(0, 4);
  if (sponsors.length) {
    const LOGO_H = 46;
    const GAP = 30;
    const loaded = await Promise.all(sponsors.map(async (s) => ({ name: s.name, img: s.logo ? await loadImg(resolveEventImageUrl(s.logo)) : null })));
    const stripY = y + 54;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#a08a5e';
    ctx.font = '600 13px Arial, sans-serif';
    setSpacing(3);
    ctx.fillText('SPONSORED BY', cx, stripY);
    setSpacing(0);
    const rowCenterY = stripY + 42;
    ctx.font = '700 22px Georgia, serif';
    const PAD = 26;
    const widths = loaded.map((s) => (s.img ? (s.img.naturalWidth / s.img.naturalHeight) * LOGO_H : ctx.measureText(s.name).width + PAD * 2));
    const total = widths.reduce((a, b) => a + b, 0) + GAP * Math.max(0, loaded.length - 1);
    let x = cx - total / 2;
    for (let i = 0; i < loaded.length; i += 1) {
      const s = loaded[i];
      const w = widths[i];
      if (s.img) {
        ctx.drawImage(s.img, x, rowCenterY - LOGO_H / 2, w, LOGO_H);
      } else {
        const chipH = 42;
        const chipY = rowCenterY - chipH / 2;
        ctx.fillStyle = '#faf4e4';
        ctx.strokeStyle = goldSoft;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, chipY, w, chipH, 21);
        else ctx.rect(x, chipY, w, chipH);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = pillInk;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(s.name, x + w / 2, rowCenterY + 1);
        ctx.textBaseline = 'alphabetic';
      }
      x += w + GAP;
    }
    y = rowCenterY + 32;
  }

  if (signatories.length) {
    const sigImgs = await Promise.all(signatories.map((s) => (s.image ? loadImg(resolveEventImageUrl(s.image)) : Promise.resolve(null))));
    const colW = 300;
    const gap = 60;
    const totalW = colW * signatories.length + gap * (signatories.length - 1);
    const startCx = cx - totalW / 2 + colW / 2;
    const lineY = y + 52;
    ctx.textAlign = 'center';
    for (let i = 0; i < signatories.length; i += 1) {
      const scx = startCx + i * (colW + gap);
      const im = sigImgs[i];
      if (im) {
        const ih = 50;
        const iw = Math.min(210, (im.naturalWidth / im.naturalHeight) * ih);
        ctx.drawImage(im, scx - iw / 2, lineY - 8 - ih, iw, ih);
      }
      seg(scx - 120, lineY, scx + 120, lineY, ruleColor, 1.5);
      if (signatories[i].name) {
        ctx.fillStyle = navy;
        ctx.font = `700 24px ${serifStack}`;
        ctx.fillText(signatories[i].name, scx, lineY + 30);
      }
      if (signatories[i].title) {
        ctx.fillStyle = sub;
        ctx.font = '400 16px Arial, sans-serif';
        ctx.fillText(signatories[i].title, scx, lineY + 54);
      }
    }
  }

  drawFooter();
}
