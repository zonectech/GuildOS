// One-off: builds a minimal valid PDF containing an AMAS-style leadership list, for
// testing the "Import from document" flow. Offsets are computed so the xref is correct.
import { writeFileSync } from 'node:fs';

const lines = [
  'ASSOCIATION OF MUSLIM ACADEMICS AND STUDENTS (AMAS)',
  'NEWLY NOMINATED EXECUTIVES - 2026/2027 SESSION',
  '',
  'S/N  NAME                      OFFICE                DEPT                LEVEL  PHONE',
  '1    Abdullahi Musa Kabir      Amir (President)      Computer Science    400    08031234567',
  '2    Fatima Sani Bello         Amirah (VP Female)    Biochemistry        300    08059876543',
  '3    Ibrahim Yusuf Adam        General Secretary     Mechanical Eng.     300    07061112222',
  '4    Khadija Aliyu Umar        Asst. Gen. Secretary  Microbiology        200    08123334444',
  '5    Usman Garba Sadiq         Financial Secretary   Accounting          300    09015556666',
  '6    Aisha Mohammed Tukur      Treasurer             Economics           200    08187778888',
  '7    Suleiman Bala Nuhu        PRO I                 Mass Communication  300    07039990000',
];

function esc(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

const contentLines = lines.map((l, i) => `BT /F1 10 Tf 40 ${760 - i * 18} Td (${esc(l)}) Tj ET`).join('\n');
const contentStream = contentLines;

const objects: string[] = [];
objects.push('<< /Type /Catalog /Pages 2 0 R >>');
objects.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>');
objects.push(`<< /Length ${Buffer.byteLength(contentStream)} >>\nstream\n${contentStream}\nendstream`);
objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');

let pdf = '%PDF-1.4\n';
const offsets: number[] = [];
objects.forEach((obj, i) => {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
});
const xrefStart = Buffer.byteLength(pdf);
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

writeFileSync('test-leaders.pdf', pdf, 'binary');
console.log('Wrote test-leaders.pdf');
