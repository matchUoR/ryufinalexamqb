/* Browser-only persistence. No uploads, no Python endpoints. */
window.WebStore=(()=>{
 const KEYS=['answer-attempts','review-schedule','asset-state','error-reasons','flags','exam-session','latest-exam-result'].map(x=>'exam-study-minimal.'+x+'.v1');
 const scope=new URL('./',location.href).pathname;let db,values={},tail=Promise.resolve(),pending=0,failed=null,revision=0,reloading=false;const owner=crypto.randomUUID();
 const request=r=>new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
 const done=t=>new Promise((ok,no)=>{t.oncomplete=()=>ok();t.onabort=()=>no(t.error||Error('保存を中止しました'));t.onerror=()=>{}});
 function status(){const e=document.getElementById('web-save-status');if(e){e.textContent=failed?'保存できません。ページを閉じず「進捗バックアップ」を保存してください。':pending?'端末へ保存中…':'端末に保存済み（定期的に進捗バックアップを保存してください）';e.classList.toggle('error',!!failed)}}
 async function transaction(stores,fn){const t=db.transaction(stores,'readwrite'),finish=done(t);try{await fn(t);await finish}catch(e){try{t.abort()}catch{}await finish.catch(()=>{});throw e}}
 async function guarded(stores,fn){return transaction([...new Set(['meta',...stores])],async t=>{const m=t.objectStore('meta'),lock=await request(m.get('owner'));if(lock?.id!==owner)throw Error('別タブがこのデータを使用しています。このタブを閉じてください。');await fn(t)})}
 async function init(){
  if(!isSecureContext||!indexedDB)throw Error('HTTPSのSafariで開いてください。');
  let nativeLock=false;if(navigator.locks){await new Promise((ok,no)=>{navigator.locks.request('exam-study:'+scope,{ifAvailable:true},lock=>{if(!lock){no(Error('別のタブで学習中です。そのタブを閉じてから再読み込みしてください。'));return}nativeLock=true;ok();return new Promise(()=>{});}).catch(no)});}const r=indexedDB.open('exam-study-ipad-v1:'+scope,1);r.onupgradeneeded=()=>{for(const s of ['packages','assets','learning','meta'])r.result.createObjectStore(s)};db=await request(r);db.onversionchange=()=>db.close();
  // A single tab owns writes. Expired leases can be reclaimed; stale tabs cannot overwrite.
  await transaction(['meta'],async t=>{const s=t.objectStore('meta'),old=await request(s.get('owner'));if(!nativeLock&&old&&Date.now()-old.time<20000)throw Error('同じ学習サイトが別のタブで開いています。閉じて20秒後に再読み込みしてください。');s.put({id:owner,time:Date.now()},'owner')});
  setInterval(()=>guarded([],async t=>t.objectStore('meta').put({id:owner,time:Date.now()},'owner')).catch(e=>{failed=e;status()}),5000);
  const t=db.transaction('learning'),saved=await request(t.objectStore('learning').get('state'));values=saved?.values||{};revision=saved?.revision||0;
  window.addEventListener('pagehide',()=>{if(!pending)guarded([],async t=>t.objectStore('meta').delete('owner')).catch(()=>{})});
  window.addEventListener('pageshow',e=>{if(e.persisted)location.reload()});
  window.addEventListener('beforeunload',e=>{if(pending||failed){e.preventDefault();e.returnValue=''}});status();
 }
 function setItem(k,v){if(reloading)return;if(!KEYS.includes(k))throw Error('未対応の保存項目です');values[k]=String(v);const snapshot=structuredClone(values),rev=++revision;pending++;status();tail=tail.catch(()=>{}).then(()=>guarded(['learning'],async t=>{t.objectStore('learning').put({values:snapshot,revision:rev,updatedAt:new Date().toISOString()},'state')})).then(()=>{failed=null},e=>{failed=e}).finally(()=>{pending--;status()})}
 const memory={getItem:k=>values[k]??null,setItem};
 async function flush(){await tail;if(failed)throw failed}
 async function list(){const t=db.transaction('packages');return request(t.objectStore('packages').getAll())}
 async function putPackage(record,blobs,replaceId){await flush();await guarded(['packages','assets'],async t=>{
  const store=t.objectStore('packages'),all=await request(store.getAll());const others=all.filter(p=>p.id!==replaceId);const ids=new Set(others.flatMap(p=>p.books.flatMap(b=>b.questions.map(q=>q.question_id)))),codes=new Set(others.flatMap(p=>p.books.flatMap(b=>b.questions.map(q=>q.question_code))));
  if(others.some(p=>p.id===record.id||p.title.normalize('NFKC').toLowerCase()===record.title.normalize('NFKC').toLowerCase()))throw Error('同じタイトルまたはIDが登録済みです');
  for(const b of record.books)for(const q of b.questions)if(ids.has(q.question_id)||codes.has(q.question_code))throw Error('他のパッケージと問題IDまたは問題コードが重複しています');
  if(replaceId){const old=all.find(p=>p.id===replaceId);for(const path of old?.assetPaths||[])t.objectStore('assets').delete([replaceId,path]);store.delete(replaceId)}
  store.put(record,record.id);for(const [path,blob] of blobs)t.objectStore('assets').put(blob,[record.id,path]);
 });}
 async function remove(id){await flush();await guarded(['packages','assets'],async t=>{const s=t.objectStore('packages'),p=await request(s.get(id));if(!p)return;for(const path of p.assetPaths)t.objectStore('assets').delete([id,path]);s.delete(id)})}
 async function asset(a){const t=db.transaction('assets'),blob=await request(t.objectStore('assets').get([a.webPackageId,a.webPath]));if(blob)return blob;for(const p of await list()){const found=p.common.assets.find(x=>x.sha256===a.sha256);if(found){const t=db.transaction('assets');const image=await request(t.objectStore('assets').get([p.id,found.download_reference]));if(image)return image}}throw Error('画像が保存されていません。元のパッケージを再取り込みしてください。')}
 async function master(){const pkgs=await list(),result={schema_version:'4.0-booklet-json',questions:[],serial_groups:[],assets:[],asset_bindings:[],exams:[],department_master:[],disease_master:[],references:[],sources:[]};
  for(const p of pkgs){const c=structuredClone(p.common),prefix=p.id+'::';for(const a of c.assets||[]){a.webPackageId=p.id;a.webPath=a.download_reference;a.asset_id=prefix+a.asset_id}result.assets.push(...c.assets||[]);
   for(const key of ['department_master','disease_master','references','sources'])result[key].push(...c[key]||[]);
   for(const book of p.books){const b=structuredClone(book),rule=c.booklet_classification[b.exams[0]['試験種別']][b.booklet];
    for(const q of b.questions){q.exam_half=rule.exam_half;q.exam_day=rule.exam_day;if(q['連問ID'])q['連問ID']=prefix+q['連問ID'];if(q.serial_group_id)q.serial_group_id=prefix+q.serial_group_id;q.asset_ids=(q.asset_ids||[]).map(id=>prefix+id);result.questions.push(q)}
    for(const s of b.serial_groups||[]){if(s['連問ID'])s['連問ID']=prefix+s['連問ID'];if(s.serial_group_id)s.serial_group_id=prefix+s.serial_group_id;result.serial_groups.push(s)}
    for(const a of b.asset_bindings||[]){a.asset_id=prefix+a.asset_id;if(a.serial_group_id)a.serial_group_id=prefix+a.serial_group_id;result.asset_bindings.push(a)}result.exams.push(...b.exams);
   }
  }
  for(const [key,id] of [['department_master','department_id'],['disease_master','disease_id'],['exams','試験ID']])result[key]=[...new Map(result[key].map(x=>[x[id],x])).values()];return result;
 }
 async function backup(){// Include memory values even if disk saving failed.
  return {format:'exam-study-progress',version:1,created_at:new Date().toISOString(),packages:(await list()).map(p=>({title:p.title,package_id:p.id,version:p.manifest.package_version})),values:structuredClone(values)};
 }
 async function restore(data){if(data?.format!=='exam-study-progress'||data.version!==1||!data.values||typeof data.values!=='object'||Array.isArray(data.values))throw Error('進捗バックアップ形式が不正です');const clean={};for(const [k,v]of Object.entries(data.values)){if(!KEYS.includes(k)||typeof v!=='string')throw Error('未対応の保存項目です');const x=JSON.parse(v);if(k.endsWith('answer-attempts.v1')?!Array.isArray(x):(!x||typeof x!=='object'||Array.isArray(x)))throw Error('進捗の構造が不正です');if(k.endsWith('answer-attempts.v1')&&x.some(a=>!a||typeof a.questionId!=='string'||!['correct','incorrect','hold'].includes(a.gradeStatus)))throw Error('解答履歴が不正です');if(k.endsWith('exam-session.v1')||k.endsWith('latest-exam-result.v1')){if(!Array.isArray(x.questions)||x.questions.some(q=>typeof q.id!=='string'||!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(q.id)||!Array.isArray(q.choices)||q.choices.some(c=>!c||typeof c.label!=='string'||!/^[a-z]$/.test(c.label)||typeof c.text!=='string')))throw Error('試験履歴が不正です')}if(k.endsWith('flags.v1')&&(!x.names||!x.questions||Object.values(x.names).some(n=>typeof n!=='string')||Object.values(x.questions).some(a=>!Array.isArray(a)||a.some(id=>!['review','important','edit'].includes(id)))))throw Error('フラグの構造が不正です');clean[k]=v}
  await flush();await guarded(['learning'],async t=>t.objectStore('learning').put({values:clean,revision:revision+1,updatedAt:new Date().toISOString()},'state'));values=clean;revision++;
 }
 async function reload(){await flush();reloading=true;await guarded([],async t=>t.objectStore('meta').delete('owner'));location.reload()}
 return {init,memory,flush,list,putPackage,remove,master,asset,backup,restore,reload,status,KEYS};
})();
