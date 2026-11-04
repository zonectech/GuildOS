// Certificate settings, the same shapes the backend stores on events and certificates.
export type CertificateFont = 'SERIF' | 'ELEGANT' | 'SANS' | 'PLAYFAIR' | 'CORMORANT' | 'MERRIWEATHER' | 'MONTSERRAT' | 'SCRIPT';
export type CertificateNamePlacement = { x: number; y: number; fontSize: number; color: string; align: 'left' | 'center' | 'right'; font?: CertificateFont | '' };
export type TicketQrBox = { x: number; y: number; size: number };
export type CertificateTheme = { accent: string; background: string; font: string };
export type CertificateContent = { title: string; presentation: string; message: string; signatories: { name: string; title: string; image: string }[]; logo?: string; logoAlign?: 'LEFT' | 'CENTER' | 'RIGHT' };
export const DEFAULT_CERTIFICATE_THEME: CertificateTheme = { accent: '#b8933a', background: 'IVORY', font: 'SERIF' };
export const DEFAULT_CERTIFICATE_CONTENT: CertificateContent = { title: '', presentation: '', message: '', signatories: [], logo: '', logoAlign: 'CENTER' };
export const DEFAULT_NAME_PLACEMENT: CertificateNamePlacement = { x: 50, y: 55, fontSize: 6, color: '#111111', align: 'center', font: '' };
export const CERTIFICATE_STYLES = ['CLASSIC', 'MODERN', 'MINIMAL', 'CORPORATE', 'DECO', 'GEOMETRIC', 'RIBBON', 'DOUBLE', 'ROUNDED', 'LAUREL', 'TECH', 'WAVE'] as const;
export const CERTIFICATE_TYPES = ['ATTENDANCE', 'COMPLETION', 'LEADERSHIP', 'VOLUNTEER'] as const;
