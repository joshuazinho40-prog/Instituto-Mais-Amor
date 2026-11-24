from pathlib import Path
import json,re,base64,zipfile,subprocess,sys,mimetypes
root=Path(__file__).resolve().parent.parent;dist=root/'dist'
out=Path(sys.argv[1]) if len(sys.argv)>1 else root/'output'
out.mkdir(parents=True,exist_ok=True)
subprocess.run([sys.executable,str(root/'scripts/build.py')],check=True)
css=(dist/'style.css').read_text();css=re.sub(r'@import url\(.*?\);','',css,count=1)
image='data:image/svg+xml;base64,'+base64.b64encode((dist/'assets/acolhimento.svg').read_bytes()).decode()
config=json.loads((root/'config.json').read_text())
js=(dist/'app.js').read_text().replace("import { config } from './config.js';",'const config = '+json.dumps(config,ensure_ascii=False)+';')
bridge="""document.addEventListener('click',event=>{const a=event.target.closest('a');if(!a)return;const href=a.getAttribute('href');if(!href||href.startsWith('#')||/^(https?:|mailto:|tel:|blob:|data:)/.test(href))return;event.preventDefault();parent.postMessage({type:'navigate',path:href},'*');});"""
pages={}
for file in dist.glob('*.html'):
 s=file.read_text().replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>')
 s=re.sub(r'<link rel="icon".*?>','',s)
 s=re.sub(r'src="https://images.unsplash.com/[^\"]+"',lambda m:'src="'+image+'"',s)
 s=s.replace('alt="Família reunida ao ar livre em um momento de afeto"','alt="Ilustração de pessoas reunidas, simbolizando acolhimento e pertencimento"').replace('Imagem ilustrativa. Não representa atendimentos do Instituto.','Ilustração conceitual. Espaço preparado para fotografia autorizada.')
 s=s.replace('<script type="module" src="app.js"></script>' ,'<script>'+js+'\n'+bridge+'</script>')
 pages[file.name]=s
bundle={'pages':pages,'files':{str(f.relative_to(dist)):base64.b64encode(f.read_bytes()).decode() for f in dist.rglob('*') if f.is_file()}}
if config.get('logo'):
 logo=dist/config['logo'];mime={'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp'}.get(logo.suffix.lower())
 if mime:bundle.update(logoData='data:'+mime+';base64,'+base64.b64encode(logo.read_bytes()).decode(),logoExtension=logo.suffix.lstrip('.'))
payload=json.dumps(bundle,ensure_ascii=False).replace('<','\\u003c')
preview=(root/'scripts/preview-shell.html').read_text().replace('__PREVIEW_DATA__',payload)
(out/'Previa-Instituto-Mais-Amor.html').write_text(preview)
with zipfile.ZipFile(out/'Instituto-Mais-Amor-codigo-completo.zip','w',zipfile.ZIP_DEFLATED) as archive:
 for f in sorted(root.rglob('*')):
  if f.is_file() and not any(part in ['.openai','.git','output','__pycache__'] for part in f.relative_to(root).parts):archive.write(f,'instituto-mais-amor/'+str(f.relative_to(root)))
with zipfile.ZipFile(out/'Instituto-Mais-Amor-Hostinger.zip','w',zipfile.ZIP_DEFLATED) as archive:
 for f in sorted(dist.rglob('*')):
  if f.is_file():archive.write(f,str(f.relative_to(dist)))
(out/'Como-publicar-na-Hostinger.md').write_text((root/'LEIA-ME.md').read_text())
print('Pacotes atualizados em '+str(out))
