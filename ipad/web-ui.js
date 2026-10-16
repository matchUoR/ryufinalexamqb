window.PackageManager=(()=>{
 const $=id=>document.getElementById(id);let busy=false,changed=false;
 const say=s=>$('web-package-status').textContent=s;
 function running(){try{const s=JSON.parse(WebStore.memory.getItem('exam-study-minimal.exam-session.v1'));return s&&!s.finished}catch{return false}}
 function download(value,name){const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(value)],{type:'application/json'}));a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000)}
 async function refresh(){const box=$('web-packages');box.replaceChildren();const ps=await WebStore.list();ps.sort((a,b)=>$('web-sort').value==='title'?a.title.localeCompare(b.title,'ja',{numeric:true}):a.registeredAt.localeCompare(b.registeredAt));if($('web-direction').value==='desc')ps.reverse();for(const p of ps){const card=document.createElement('article');card.className='web-package-card';const title=document.createElement('strong');title.textContent=p.title;const detail=document.createElement('p');detail.textContent=p.questionCount+'問 / '+p.books.length+'冊子 / '+p.manifest.package_version;const button=document.createElement('button');button.className='secondary';button.textContent='削除';button.disabled=busy||running();button.onclick=async()=>{if(busy||running())return;if(!confirm(`「${p.title}」の問題と画像をこのiPadから削除します。学習履歴は残り、同じ問題IDを再取り込みすると引き継げます。削除しますか？`))return;busy=true;try{await WebStore.remove(p.id);changed=true;say('削除しました。学習履歴は保持しています。')}catch(e){say('削除できません：'+e.message)}finally{busy=false;refresh()}};card.append(title,detail,button);box.append(card)}if(!ps.length)box.textContent='パッケージはありません。冊子ZIPを取り込んでください。'}
 async function show(){if(running()){alert('試験を終了してから問題パッケージを操作してください。');return}await WebStore.flush().catch(()=>{});await refresh();$('web-package-dialog').showModal()}
 async function close(){if(busy)return;say('');if(changed){try{await WebStore.reload()}catch(e){say('保存待ちです：'+e.message)}}else $('web-package-dialog').close()}
 async function importFiles(){
  if(busy||running())return;
  const files=[...$('web-files').files];if(!files.length){say('冊子ZIPまたはまとめZIPを選んでください');return}
  busy=true;$('web-import').disabled=true;$('web-files').disabled=true;
  const results=[];
  try{
   await refresh();await navigator.storage?.persist?.().catch(()=>false);
   for(const file of files){try{
    results.push(...await PackageReader.importArchive(file,async(item)=>{
     const all=await WebStore.list();
     const conflicts=all.filter(p=>p.id===item.record.id||p.title.normalize('NFKC').toLowerCase()===item.record.title.normalize('NFKC').toLowerCase()||p.books.some(b=>item.record.books.some(x=>x.booklet_id===b.booklet_id)));
     if(conflicts.length>1)throw Error('複数の登録と重複しています。対象を確認して削除後に取り込んでください。');
     let replace=null;
     if(conflicts.length){const old=conflicts[0];if(!confirm(`「${old.title}」が登録済みです。書き換えますか？\n学習履歴は保持します。キャンセルでこの冊子をスキップします。`))return 'skipped';replace=old.id;item.record.registeredAt=old.registeredAt}
     await WebStore.putPackage(item.record,item.blobs,replace);changed=true;return 'imported';
    },say));
   }catch(e){results.push({name:file.name,status:'failed',message:e.message})}}
  }finally{
   busy=false;$('web-import').disabled=false;$('web-files').disabled=false;
   const count=status=>results.filter(x=>x.status===status).length;
   say(`取り込み完了 ${count('imported')}冊／スキップ ${count('skipped')}冊／失敗 ${count('failed')}件\n`+results.map(r=>r.name+'：'+({imported:'取り込み完了',skipped:'スキップ',failed:'失敗 — '+r.message}[r.status])).join('\n'));
   await refresh();$('web-files').value='';
  }
 }

 function init(){
  $('open-packages').onclick=show;$('web-close-packages').onclick=close;$('web-package-dialog').addEventListener('cancel',e=>{e.preventDefault();close()});$('web-import').onclick=importFiles;$('web-sort').onchange=refresh;$('web-direction').onchange=refresh;
  $('web-backup').onclick=async()=>{try{const data=await WebStore.backup();download(data,'学習進捗_'+new Date().toISOString().replace(/[:.]/g,'-')+'.json');$('web-backup-note').textContent='保存操作を開始しました。「ファイル」で保存済みか確認してください。問題ZIPも別途保管してください。'}catch(e){$('web-backup-note').textContent='バックアップできません：'+e.message}};
  $('web-restore').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(running())throw Error('試験を終了してから復元してください');if(file.size>50*1024*1024)throw Error('バックアップは50MB以内です');const data=JSON.parse(await file.text());if(!confirm('現在の進捗をバックアップの内容で置き換えます。先に現在の進捗を保存してください。復元しますか？'))return;await WebStore.restore(data);await WebStore.reload()}catch(err){$('web-backup-note').textContent='復元できません：'+err.message}finally{e.target.value=''}};
  $('web-persist').onclick=async()=>{try{const granted=await navigator.storage?.persist?.();const estimate=await navigator.storage?.estimate?.();$('web-backup-note').textContent=(granted?'永続保存が許可されました。':'永続保存は許可されていないか、この環境では確認できません。')+'バックアップは引き続き必要です。'+(estimate?' 使用量：約'+Math.ceil(estimate.usage/1024/1024)+'MB':'')}catch(e){$('web-backup-note').textContent=e.message}};
  $('web-retry-save').onclick=async()=>{try{const b=await WebStore.backup();for(const [k,v]of Object.entries(b.values))WebStore.memory.setItem(k,v);await WebStore.flush()}catch{}};
 }
 return {init,show};
})();
window.ExamEditor={load:()=>WebStore.master(),init:()=>{},open:()=>{}};
