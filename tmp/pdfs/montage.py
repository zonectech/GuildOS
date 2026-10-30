from PIL import Image, ImageOps, ImageDraw
from pathlib import Path
root=Path(r'D:/Users/Administrator/Desktop/Guild0S/tmp/pdfs')
files=sorted(root.glob('review-*.png'))
thumbs=[]
for f in files:
 im=Image.open(f).convert('RGB'); im.thumbnail((420,600))
 tile=Image.new('RGB',(450,640),'#e2e8f0'); tile.paste(im,((450-im.width)//2,20)); ImageDraw.Draw(tile).text((18,617),f.stem,fill='#0f172a'); thumbs.append(tile)
canvas=Image.new('RGB',(450*4,640*2),'#cbd5e1')
for i,t in enumerate(thumbs):canvas.paste(t,((i%4)*450,(i//4)*640))
canvas.save(root/'contact-sheet.jpg')
print(len(files),'pages rendered')
