"""Python 3標準ライブラリのみ。テンプレートから新規ZIPを作成。
使用例: python3 build_package.py template new-exam.zip
"""
from pathlib import Path, PurePosixPath
import json,hashlib,uuid,zipfile,sys,mimetypes
from datetime import datetime,timezone

def build(folder,output):
 root=Path(folder).resolve();out=Path(output).resolve()
 def read(name):return json.loads((root/name).read_text(encoding='utf-8'))
 def safe(name):
  p=PurePosixPath(name)
  if not isinstance(name,str) or '\\' in name or p.is_absolute() or '..' in p.parts or str(p)!=name:raise ValueError('不正なパス: '+str(name))
  f=(root/name).resolve()
  if not f.is_relative_to(root) or (root/name).is_symlink() or not f.is_file():raise ValueError('ファイルがありません: '+name)
  return f
 meta=read('metadata.json');index=read('catalog/index.json');common_path='catalog/'+index['common'];common=read(common_path)
 paths={common_path,'catalog/index.json'};books=[];ids=set();codes=set()
 for item in index['booklets']:
  path='catalog/'+item['file'];b=read(path)
  if b['booklet_id']!=item['booklet_id']:raise ValueError('冊子ID不一致')
  for q in b['questions']:
   if q['question_id'] in ids or q['question_code'] in codes:raise ValueError('問題IDまたはコードの重複')
   if q['question_id']!=q['問題ID']:raise ValueError('問題ID不一致')
   ids.add(q['question_id']);codes.add(q['question_code'])
  paths.add(path);books.append((path,b))
 for a in common.get('assets',[]):
  path=a['download_reference'];f=safe(path)
  if not path.startswith('assets/') or f.suffix.lower() not in ['.jpg','.jpeg','.png','.webp']:raise ValueError('画像はassets内のJPEG/PNG/WebPに限定')
  digest=hashlib.sha256(f.read_bytes()).hexdigest()
  if a.get('sha256')!=digest:raise ValueError('画像hashが不一致: '+path)
  paths.add(path)
 records=[]
 for path in sorted(paths):
  f=safe(path);raw=f.read_bytes();records.append({'path':path,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'mime_type':mimetypes.guess_type(path)[0] or 'application/octet-stream','role':'asset' if path.startswith('assets/') else 'catalog'})
 bypath={r['path']:r for r in records};stamp=datetime.now(timezone.utc).isoformat().replace('+00:00','Z');meta.setdefault('created_at',stamp);(root/'metadata.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');state_path=root/'release-state.json';state=read('release-state.json') if state_path.exists() else {'booklets':{}}
 def release(previous,digest,idkey):
  if previous and previous['sha256']==digest:return previous
  return {idkey:str(uuid.uuid4()),'revision':previous['revision']+1 if previous else 1,'supersedes_'+idkey:previous[idkey] if previous else None,'sha256':digest}
 cr=release(state.get('common'),bypath[common_path]['sha256'],'common_release_id');cr['path']=common_path;state['common']=cr
 releases=[]
 for path,b in books:
  bid=b['booklet_id'];br=release(state['booklets'].get(bid),bypath[path]['sha256'],'release_id');br.update(booklet_id=bid,path=path,required_common_release_id=cr['common_release_id']);state['booklets'][bid]=br;releases.append(br)
 manifest={'format':'exam-study-package','format_version':1,'package_id':str(uuid.uuid4()),'package_version':meta.get('package_version','1.0.0'),'title':meta['title'],'creator':meta['creator'],'created_at':meta.get('created_at',stamp),'updated_at':stamp,'content_schema':'4.0-booklet-json','min_reader_version':1,'catalog_path':'catalog/index.json','common_release':cr,'booklet_releases':releases,'files':records,'expanded_bytes':sum(r['bytes'] for r in records),'counts':{'questions':len(ids),'booklets':len(books),'assets':len({a['sha256'] for a in common.get('assets',[])}),'omitted_questions':len(common.get('omitted_questions',[]))},'sources':meta.get('sources',[]),'description':meta.get('description',''),'template_example':meta.get('template_example',False)}
 with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
  z.writestr('manifest.json',json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
  for r in records:z.write(safe(r['path']),r['path'])
 state_path.write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(str(out))
 return manifest
if __name__=='__main__':
 if len(sys.argv)!=3:raise SystemExit('使い方: python3 build_package.py template 出力.zip')
 build(sys.argv[1],sys.argv[2])
