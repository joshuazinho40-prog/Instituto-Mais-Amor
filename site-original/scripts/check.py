from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit
import json,subprocess,tempfile,shutil,re,sys
root=Path(__file__).resolve().parent.parent;dist=root/'dist'
class Document(HTMLParser):
 def __init__(self):super().__init__();self.links=[];self.assets=[];self.ids=[];self.h1=0;self.lang=None
 def handle_starttag(self,t,attrs):
  a=dict(attrs)
  if t=='html':self.lang=a.get('lang')
  if 'id' in a:self.ids.append(a['id'])
  if t=='h1':self.h1+=1
  if t=='a' and a.get('href'):self.links.append(a['href'])
  if t in ['img','script'] and a.get('src'):self.assets.append(a['src'])
  if t=='img':assert 'alt' in a,'Imagem sem alternativa textual'
checks={}
for f in dist.glob('*.html'):
 c=Document();c.feed(f.read_text());assert c.h1==1,(f,c.h1);assert c.lang=='pt-BR',f;assert len(c.ids)==len(set(c.ids)),f;checks[f.name]=c
for name,c in checks.items():
 for href in c.links:
  u=urlsplit(href)
  if u.scheme:continue
  if u.path in ['/signout-with-chatgpt','/signin-with-chatgpt']:continue
  target=u.path.lstrip('/') or name
  if target in ['admin','impacto']:target+='.html'
  assert (dist/target).is_file(),(name,href)
  if u.fragment:assert u.fragment in checks[target].ids,(name,href)
 for src in c.assets:
  if not urlsplit(src).scheme:assert (dist/src).is_file(),(name,src)
data=json.loads((root/'content.json').read_text());assert len(data['article'])==6;assert len(data['projects'])==8;assert len(data['faq'])==7
with tempfile.TemporaryDirectory(prefix='mais-amor-',dir=root.parent) as folder:
 fixture=Path(folder);shutil.copytree(root/'dist',fixture/'dist');shutil.copytree(root/'scripts',fixture/'scripts');shutil.copy(root/'config.json',fixture/'config.json')
 data['projects'][0]['status']='Em desenvolvimento';data['projects'][1]['status']='Em atividade';(fixture/'content.json').write_text(json.dumps(data))
 subprocess.run([sys.executable,str(fixture/'scripts/build.py')],check=True,capture_output=True)
 html=(fixture/'dist/projetos.html').read_text();assert html.count('data-status="desenvolvimento"')==1;assert html.count('data-status="atividade"')==1;assert html.count('data-status="planejamento"')==6
 cfg=json.loads((fixture/'config.json').read_text());cfg.update(logo='assets/logo-teste.png',siteUrl='https://example.org');(fixture/'dist/assets/logo-teste.png').write_bytes(b'fixture');(fixture/'config.json').write_text(json.dumps(cfg))
 subprocess.run([sys.executable,str(fixture/'scripts/build.py')],check=True,capture_output=True)
 html=(fixture/'dist/index.html').read_text();assert html.count('class="brand brand-official"')==2;assert 'src="assets/logo-teste.png"' in html
 assert 'https://example.org/index.html' in (fixture/'dist/sitemap.xml').read_text()
 cfg['logo']='assets/inexistente.png';(fixture/'config.json').write_text(json.dumps(cfg))
 result=subprocess.run([sys.executable,str(fixture/'scripts/build.py')],capture_output=True);assert result.returncode!=0
print(f'OK: {len(checks)} páginas; links, âncoras, imagens e IDs válidos; 6 finalidades e 8 projetos; mudanças de situação, inclusão de logo e domínio configurável verificadas.')
