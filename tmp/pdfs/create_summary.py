from pathlib import Path
import json, html
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, KeepTogether
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A4

ROOT = Path(r'D:/Users/Administrator/Desktop/Guild0S')
for name, file in [('Segoe','segoeui.ttf'),('SegoeBold','segoeuib.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(Path('C:/Windows/Fonts') / file)))
sections = json.loads((ROOT/'tmp/pdfs/summary.json').read_text(encoding='utf-8'))
output = ROOT/'output/pdf/GuildOS-Comprehensive-Overview.pdf'
body = ParagraphStyle('Body', fontName='Segoe', fontSize=10.2, leading=14.2, textColor=HexColor('#334155'), leftIndent=12, firstLineIndent=-10, spaceAfter=4.6)
heading = ParagraphStyle('Heading', fontName='SegoeBold', fontSize=13.4, leading=18, textColor=HexColor('#3730a3'), spaceBefore=14, spaceAfter=7)
title = ParagraphStyle('Title', fontName='SegoeBold', fontSize=30, leading=36, textColor=HexColor('#0f172a'), spaceAfter=8)
deck = ParagraphStyle('Deck', fontName='Segoe', fontSize=11, leading=16, textColor=HexColor('#64748b'), spaceAfter=16)
kicker = ParagraphStyle('Kicker', fontName='SegoeBold', fontSize=9, leading=13, textColor=HexColor('#4f46e5'), spaceAfter=8)

def page_decor(canvas, doc):
    w,h=A4
    canvas.saveState()
    canvas.setFillColor(HexColor('#4f46e5'))
    canvas.rect(0,h-9,w,9,fill=1,stroke=0)
    canvas.setFont('SegoeBold',8)
    canvas.setFillColor(HexColor('#64748b'))
    canvas.drawString(48,h-34,'GUILDOS  /  PLATFORM OVERVIEW')
    canvas.setStrokeColor(HexColor('#e2e8f0'))
    canvas.line(48,43,w-48,43)
    canvas.setFont('Segoe',8)
    canvas.drawString(48,29,'Features, benefits and current boundaries • 27 October 2026')
    canvas.drawRightString(w-48,29,str(doc.page))
    canvas.restoreState()

story=[Spacer(1,14),Paragraph('COMMUNITIES • EVENTS • ACHIEVEMENTS',kicker),Paragraph('GuildOS',title),Paragraph('A comprehensive platform overview',ParagraphStyle('SubTitle',parent=title,fontSize=18,leading=25,spaceAfter=10)),Paragraph('What the website does, who it serves, its advantages, and the boundaries of its verification and external-platform features.',deck)]
for number,(name,bullets) in enumerate(sections,1):
    h=Paragraph(f'{number:02d}  {html.escape(name)}',heading)
    paras=[Paragraph('•  '+html.escape(b),body) for b in bullets]
    story.append(KeepTogether([h,*paras,Spacer(1,2)]))
doc=SimpleDocTemplate(str(output), pagesize=A4, leftMargin=48,rightMargin=48,topMargin=49,bottomMargin=58,title='GuildOS — Comprehensive Platform Overview',author='GuildOS',subject='Website features, advantages, audiences and current limits')
doc.build(story,onFirstPage=page_decor,onLaterPages=page_decor)
print(output)
try:
    import fitz
    pdf=fitz.open(output)
    print('Pages:',len(pdf))
    for i,page in enumerate(pdf):
        page.get_pixmap(matrix=fitz.Matrix(1,1),alpha=False).save(str(ROOT/f'tmp/pdfs/page-{i+1}.png'))
    print('Rendered every page for visual review.')
except ImportError:
    print('PyMuPDF unavailable; use Poppler to render.')
from pypdf import PdfReader
reader=PdfReader(output)
text='\n'.join(p.extract_text() or '' for p in reader.pages)
assert all(name in text for name,_ in sections), 'Missing section heading'
assert text.count('•') >= 170, 'Missing bullet content'
print('Text checks passed:',len(sections),'sections;',len(reader.pages),'pages')
