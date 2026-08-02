// One-off sanity check: confirm pdf-parse v2 extracts text from the generated test PDF.
import { readFileSync } from 'node:fs';
import { PDFParse } from 'pdf-parse';

async function main() {
  const buf = readFileSync('test-leaders.pdf');
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  const result = await parser.getText();
  await parser.destroy();
  console.log(result.text.slice(0, 600));
}

main().catch((e) => { console.error(e); process.exit(1); });
