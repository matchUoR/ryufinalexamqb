window.PackageReader=(()=>{
 const MB=1024*1024,MAX_FILE=50*MB,MAX_TOTAL=300*MB;
 const check=(ok,message)=>{if(!ok)throw Error(message)};
 const path=s=>{check(typeof s==='string'&&s&&!s.startsWith('/')&&!s.includes('\\')&&!s.includes('\0')&&!s.split('/').some(x=>!x||x==='.'||x==='..'),'ZIP内のパスが不正です');return s};
 const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
 const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s);
 function directory(bytes,maxFile=MAX_FILE,maxTotal=MAX_TOTAL){const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(v.getUint32(i,true)===0x06054b50&&i+22+v.getUint16(i+20,true)===bytes.length){end=i;break}check(end>=0,'ZIPを読み取れません');check(v.getUint16(end+4,true)===0&&v.getUint16(end+6,true)===0,'分割ZIPは非対応です');const count=v.getUint16(end+10,true);check(count===v.getUint16(end+8,true)&&count<=2000,'ZIP内のファイル数が多すぎます');let pos=v.getUint32(end+16,true),size=v.getUint32(end+12,true),total=0;check(pos+size===end,'ZIP64または不正なZIPです');const names=new Map(),decode=new TextDecoder('utf-8',{fatal:true});for(let i=0;i<count;i++){
  check(pos+46<=end&&v.getUint32(pos,true)===0x02014b50,'ZIP一覧が不正です');const flags=v.getUint16(pos+8,true),method=v.getUint16(pos+10,true),compressed=v.getUint32(pos+20,true),expanded=v.getUint32(pos+24,true),n=v.getUint16(pos+28,true),extra=v.getUint16(pos+30,true),comment=v.getUint16(pos+32,true),attrs=v.getUint32(pos+38,true),local=v.getUint32(pos+42,true);
  check(!(flags&1)&&[0,8].includes(method),'暗号化または非対応圧縮です');check(pos+46+n+extra+comment<=end,'ZIP一覧が不正です');const name=decode.decode(bytes.subarray(pos+46,pos+46+n));path(name.replace(/\/$/,''));check(!names.has(name),'ZIP内に同名ファイルがあります');check(((attrs>>>16)&0xf000)!==0xa000,'リンクファイルは取り込めません');check(expanded<=maxFile&&compressed<=maxFile*2,'ファイルが大きすぎます');total+=expanded;check(total<=maxTotal,'展開後の合計サイズ上限を超えています');check(local+30<=bytes.length&&v.getUint32(local,true)===0x04034b50,'ZIP本体が不正です');const ln=v.getUint16(local+26,true),le=v.getUint16(local+28,true);check(decode.decode(bytes.subarray(local+30,local+30+ln))===name,'ZIPのファイル名が一致しません');check(local+30+ln+le+compressed<=v.getUint32(end+16,true),'ZIPデータ範囲が不正です');names.set(name,{expanded,dir:name.endsWith('/')});pos+=46+n+extra+comment;
 }check(pos===end,'ZIP一覧サイズが一致しません');return {names,total};}
 function bounded(file,expected,limit=MAX_FILE){return new Promise((resolve,reject)=>{let size=0;const chunks=[],stream=file.internalStream('uint8array');stream.on('data',chunk=>{size+=chunk.length;if(size>expected||size>limit){stream.pause();reject(Error('展開サイズが申告と一致しません'));return}chunks.push(chunk)}).on('error',reject).on('end',()=>{if(size!==expected)return reject(Error('ファイルサイズが不一致です'));const out=new Uint8Array(size);let at=0;for(const c of chunks){out.set(c,at);at+=c.length}resolve(out)}).resume()})}
 function validImage(bytes,mime,p){const start=String.fromCharCode(...bytes.slice(0,12));check(mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&/\.jpe?g$/i.test(p):mime==='image/png'?start.startsWith('\x89PNG\r\n\x1a\n')&&/\.png$/i.test(p):mime==='image/webp'?start.startsWith('RIFF')&&start.slice(8)==='WEBP'&&/\.webp$/i.test(p):false,'画像の種類・拡張子・内容が一致しません')}
 function validate(common,books){
  for(const field of ['assets','department_master','disease_master'])check(Array.isArray(common[field]),'共通データが不正です：'+field);
  const unique=(xs,label)=>{check(xs.every(x=>typeof x==='string'&&x)&&new Set(xs).size===xs.length,label+'の重複または不足');return new Set(xs)};
  const assets=unique(common.assets.map(x=>x.asset_id),'画像ID'),deps=new Set(common.department_master.map(d=>d.department_id)),diseases=new Set(common.disease_master.map(d=>d.disease_id));
  const questions=books.flatMap(b=>b.questions),ids=unique(questions.map(q=>q.question_id),'問題ID');unique(questions.map(q=>q.question_code),'問題コード');
  const serials=unique(books.flatMap(b=>(b.serial_groups||[]).map(s=>s['連問ID']||s.serial_group_id)),'連問ID');
  for(const b of books){check(b.schema_version==='4.0-booklet-json'&&Array.isArray(b.exams)&&b.exams.length===1&&b.exams[0]['試験ID']===b.exam_id,'冊子の試験情報が不正です');const session=b.exams[0]['試験種別'],rule=common.booklet_classification?.[session]?.[b.booklet];check(rule,'冊子分類がありません');check(b.exam_half==null||b.exam_half===rule.exam_half,'前半/後半が一致しません');check(b.exam_day==null||b.exam_day===rule.exam_day,'試験日が一致しません');const kinds=[rule.exam_type,rule.exam_type==='追試'?'再試':'本試'];check(kinds.includes(b.exams[0]['試験区分']),'試験区分が一致しません');
   for(const q of b.questions){check(uuid(q.question_id),'問題IDはUUIDで指定してください');check(q['選択肢']?.every(c=>typeof c['記号']==='string'&&/^[a-z]$/.test(c['記号'])),'選択肢記号が不正です');check(q.question_id===q['問題ID']&&q.exam_id===b.exam_id&&q.booklet===b.booklet&&q.session_no===session&&kinds.includes(q.exam_type),'問題の冊子情報が不一致です');check((q.exam_half==null||q.exam_half===rule.exam_half)&&(q.exam_day==null||q.exam_day===rule.exam_day),'問題の前後半または試験日が不一致です');check(['present','none','unknown'].includes(q.source_image_presence||'unknown')&&['auto','enabled','disabled'].includes(q.attempt_availability||'auto'),'画像有無または解答可否が不正です');check(typeof q['設問文']==='string'&&q['設問文'].trim()&&Array.isArray(q['選択肢'])&&q['選択肢'].length,'設問または選択肢が不足しています');const labels=unique(q['選択肢'].map(c=>c['記号']),'選択肢記号');check(q['選択肢'].every(c=>typeof c['本文']==='string'),'選択肢の本文が不正です');const r=q.grading_rule;check(r&&['exact_set','hold'].includes(r.type),'採点規則が非対応です');
    if(r.type==='exact_set'){check(Array.isArray(r.accepted_sets)&&r.accepted_sets.length,'正答集合がありません');const counts=[q['指定選択数'],r.required_selection_count].filter(n=>n!=null);check(counts.every(n=>Number.isInteger(n)&&n>0&&n<=labels.size),'選択数が不正です');for(const set of r.accepted_sets)check(Array.isArray(set)&&set.length&&new Set(set).size===set.length&&set.every(x=>labels.has(x))&&counts.every(n=>set.length===n),'正答集合・選択数が不一致です');}
    check(!q['連問ID']||serials.has(q['連問ID']),'共通本文が未登録です');check((q.asset_ids||[]).every(id=>assets.has(id)),'画像IDが未登録です');check((q.departments||[]).every(d=>deps.has(d.department_id))&&(q.diseases||[]).every(d=>diseases.has(d.disease_id)),'分類マスターが未登録です');
   }
   for(const a of b.asset_bindings||[])check(assets.has(a.asset_id)&&(!a.serial_group_id||serials.has(a.serial_group_id))&&(!a.question_id||ids.has(a.question_id)),'画像の関連付けが不正です');
  }
 }
 async function read(file,progress=()=>{}){check(file.size<=100*MB,'ZIPは100MB以内です');progress('ZIPを確認中');const bytes=new Uint8Array(await file.arrayBuffer()),dir=directory(bytes),zip=await JSZip.loadAsync(bytes,{createFolders:false}),files=new Map();
  for(const [n,info]of dir.names)if(!info.dir){const z=zip.file(n);check(z&&(!z.unsafeOriginalName||z.unsafeOriginalName===n),'ZIPのパスが不正です');files.set(n,z)}
  check(files.has('manifest.json')&&files.has('catalog/index.json')&&files.has('catalog/common.json'),'問題パッケージZIPではありません。まとめZIPの入れ子は1階層までです。');check(dir.names.get('manifest.json').expanded<=2*MB,'manifestが大きすぎます');
  const decode=b=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(b));const m=decode(await bounded(files.get('manifest.json'),dir.names.get('manifest.json').expanded));
  check(m.format==='exam-study-package'&&m.format_version===1&&m.content_schema==='4.0-booklet-json'&&Number.isInteger(m.min_reader_version)&&m.min_reader_version<=1&&m.catalog_path==='catalog/index.json','対応していない形式です');check(uuid(m.package_id)&&typeof m.title==='string'&&m.title.trim()&&typeof m.creator?.name==='string'&&m.creator.name.trim()&&typeof m.creator.device_name==='string','タイトル・作成者・IDが不正です');check(Array.isArray(m.files),'ファイル一覧が不正です');const declared=new Set(),json=new Map(),blobs=new Map();let size=0;
  for(const rec of m.files){const name=path(rec.path);check(name!=='manifest.json'&&!declared.has(name)&&files.has(name),'ファイルが不足または重複しています');declared.add(name);check(['catalog/index.json','catalog/common.json'].includes(name)||/^catalog\/booklets\/[^/]+\.json$/.test(name)||name.startsWith('assets/'),'許可されない配置です');check(rec.bytes===dir.names.get(name).expanded,'申告サイズが不一致です');progress('検査中：'+name);const raw=await bounded(files.get(name),rec.bytes);check(await hash(raw)===rec.sha256,'SHA-256が不一致です：'+name);size+=raw.length;
   if(name.startsWith('assets/')){validImage(raw,rec.mime_type,name);blobs.set(name,new Blob([raw],{type:rec.mime_type}))}else json.set(name,decode(raw));
  }
  check(declared.size===files.size-1&&size===m.expanded_bytes,'未申告ファイルまたは展開サイズ不一致');const index=json.get('catalog/index.json'),common=json.get('catalog/common.json');check(index?.schema_version==='4.0-booklet-json'&&index.common==='common.json'&&Array.isArray(index.booklets)&&index.booklets.length,'冊子一覧が不正です');check(common?.schema_version==='4.0-booklet-json','共通データ形式が不正です');
  const cr=m.common_release;check(cr?.path==='catalog/common.json'&&uuid(cr.common_release_id)&&Number.isInteger(cr.revision)&&cr.revision>0&&cr.sha256===m.files.find(r=>r.path===cr.path)?.sha256,'共通データの版が不一致です');check(Array.isArray(m.booklet_releases)&&m.booklet_releases.length===index.booklets.length,'冊子版情報が不一致です');const seen=new Set();
  const books=index.booklets.map(item=>{const name='catalog/'+path(item.file),b=json.get(name),rel=m.booklet_releases.find(r=>r.booklet_id===item.booklet_id);check(b&&Array.isArray(b.questions)&&b.booklet_id===item.booklet_id&&!seen.has(b.booklet_id),'冊子IDの不足または重複');seen.add(b.booklet_id);check(rel?.path===name&&rel.sha256===m.files.find(r=>r.path===name)?.sha256&&uuid(rel.release_id)&&Number.isInteger(rel.revision)&&rel.revision>0&&(rel.required_common_release_id==null||rel.required_common_release_id===cr.common_release_id),'冊子の版が不一致です');return b});
  validate(common,books);for(const a of common.assets){check(blobs.has(a.download_reference)&&m.files.find(r=>r.path===a.download_reference)?.sha256===a.sha256,'画像ファイルの不足またはハッシュ不一致')}
  const count=books.reduce((n,b)=>n+b.questions.length,0);check(m.counts?.questions===count&&m.counts.booklets===books.length&&m.counts.assets===new Set(common.assets.map(a=>a.sha256)).size,'件数が不一致です');
  return {record:{id:m.package_id,title:m.title.trim(),manifest:m,common,books,assetPaths:[...blobs.keys()],registeredAt:new Date().toISOString(),questionCount:count},blobs};
 }
 // A bundle holds child ZIPs; process each fully before expanding the next.
 async function importArchive(file,consume,progress=()=>{}){
  check(file.size<=300*MB,'まとめZIPは300MB以内です。分割して取り込んでください。');
  let bytes=new Uint8Array(await file.arrayBuffer());
  const dir=directory(bytes,100*MB,600*MB);
  if(dir.names.has('manifest.json')){bytes=null;return [await importOne(file,file.name,consume,progress)]}
  const zip=await JSZip.loadAsync(bytes,{createFolders:false});bytes=null;
  const candidates=[...dir.names].filter(([n,v])=>!v.dir&&!n.split('/').some(x=>x==='__MACOSX'||x.startsWith('._'))&&/\.zip$/i.test(n));
  check(candidates.length>0,'冊子ZIPが見つかりません。問題パッケージ、または冊子ZIPをまとめたZIPを選んでください。');
  check(candidates.length<=100,'まとめZIP内の冊子ZIPは100個以内です。');
  const results=[];let expandedTotal=0;
  for(let i=0;i<candidates.length;i++){
   const [name,info]=candidates[i],label=file.name+' / '+name;
   progress(`冊子 ${i+1}/${candidates.length}：${name}`);
   try{
    const entry=zip.file(name);check(entry&&(!entry.unsafeOriginalName||entry.unsafeOriginalName===name),'ZIPのパスが不正です');
    let raw=await bounded(entry,info.expanded,100*MB);
    const childDir=directory(raw);
    check(childDir.names.has('manifest.json'),'まとめZIPの入れ子は1階層までです。中身は冊子ZIPにしてください。');
    expandedTotal+=childDir.total;check(expandedTotal<=600*MB,'冊子の展開後合計が600MBを超えます。残りは別途取り込んでください。');
    const child=new File([raw],name,{type:'application/zip'});raw=null;
    results.push(await importOne(child,label,consume,progress));
   }catch(e){results.push({name:label,status:'failed',message:e.message})}
   // Release the completed child from JSZip's directory (the outer bytes remain bounded).
   zip.remove(name);
  }
  return results;
 }
 async function importOne(file,name,consume,progress){try{
  const item=await read(file,s=>progress(name+'：'+s));
  const status=await consume(item,name);
  return {name,status:status==='skipped'?'skipped':'imported'};
 }catch(e){return {name,status:'failed',message:e.message}}}
 return {read,validate,hash,importArchive};
})();
