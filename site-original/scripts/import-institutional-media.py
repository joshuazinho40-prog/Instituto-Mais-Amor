"""Prepare user-supplied media for the site without changing the source files."""
from pathlib import Path
from PIL import Image,ImageOps
import sys,shutil,hashlib
source=Path(sys.argv[1]);root=Path(__file__).resolve().parent.parent
target=root/'dist/assets/galeria';target.mkdir(parents=True,exist_ok=True)
photos={
 'Gemini_Generated_Image (1).jpeg':'solidariedade-mochilas',
 'Gemini_Generated_Image (2).jpeg':'apoio-inclusivo',
 'Gemini_Generated_Image.jpeg':'solidariedade-abraco',
 'Gemini_Generated_Image_65zlfm65zlfm65zl.jpg':'convivencia-parque',
 'Gemini_Generated_Image_f1t0tjf1t0tjf1t0.jpg':'oficina-criativa',
 'Gemini_Generated_Image_motuvhmotuvhmotu.jpg':'brincar-aprender',
 'Gemini_Generated_Image_o5nnrno5nnrno5nn.jpg':'vinculos-familiares',
 'Gemini_Generated_Image_w0r19hw0r19hw0r1.jpg':'acolhimento-familias',
 'Gemini_Generated_Image_kcvhkukcvhkukcvh (1).jpg':'amizade-inclusiva',
}
for name,slug in photos.items():
 with Image.open(source/name) as original:
  image=ImageOps.exif_transpose(original).convert('RGB');image.thumbnail((1600,1600),Image.Resampling.LANCZOS)
  destination=target/(slug+'.webp');image.save(destination,'WEBP',quality=82,method=6)
  print(slug,image.size,destination.stat().st_size)
docs=root/'private/documentos';docs.mkdir(parents=True,exist_ok=True)
pdf_source=source/'Estatuto Social - Instituto Mais Amor.pdf';pdf_target=docs/'estatuto-social-instituto-mais-amor.pdf';shutil.copyfile(pdf_source,pdf_target)
assert hashlib.sha256(pdf_source.read_bytes()).digest()==hashlib.sha256(pdf_target.read_bytes()).digest()
print('Original statute copied and verified unchanged.')
