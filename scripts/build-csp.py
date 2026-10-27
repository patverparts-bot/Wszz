from pathlib import Path
import re,hashlib,base64,html
p=Path('index.html');s=p.read_text(encoding='utf-8').replace('<script src="https://cdn.tailwindcss.com"></script>','<link rel="stylesheet" href="js/vendor/tailwind.css?v=3.4.17">').replace("tailwind.config = { darkMode: 'class' };",'').replace('https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js','js/vendor/xlsx.full.min.js');p.write_text(s,encoding='utf-8')
for name in ['index.html','admin/index.html']:
 p=Path(name);s=p.read_text(encoding='utf-8');s=re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>','',s)
 digest=lambda v:"'sha256-"+base64.b64encode(hashlib.sha256(v.encode()).digest()).decode()+"'"
 scripts=[digest(code) for attrs,code in re.findall(r'<script([^>]*)>(.*?)</script>',s,re.S) if 'src=' not in attrs]
 handlers=[digest(html.unescape(code)) for code in re.findall(r'\bon\w+="([^"]*)"',s)]
 handlers += [digest("this.style.display='none'; this.nextElementSibling.style.display='inline-block';"),digest('markProductImageLoaded(this)'),digest('handleImageError(this)')]
 policy="default-src 'self'; script-src 'self' "+' '.join(scripts)+"; script-src-attr 'unsafe-hashes' "+' '.join(sorted(set(handlers)))+"; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; font-src 'self' data:; connect-src 'self' https://xufxevjdfukglplsknrp.supabase.co; object-src 'none'; base-uri 'self'; form-action 'self'; frame-src 'none'"
 s=s.replace('<meta charset="UTF-8">','<meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="'+policy+'">').replace('<meta charset="utf-8">','<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="'+policy+'">')
 p.write_text(s,encoding='utf-8')
