window.ExamEditor=(()=>{
const CACHE='exam-study.editor-master.v1';let data,online=false,onSave,current,dirty=false;
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function cacheData(value){return new Promise((resolve,reject)=>{const request=indexedDB.open('exam-study-content',1);request.onupgradeneeded=()=>request.result.createObjectStore('data');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('data',value?'readwrite':'readonly'),r=value?tx.objectStore('data').put(value,'master'):tx.objectStore('data').get('master');tx.oncomplete=()=>{resolve(r.result);db.close()};tx.onerror=()=>{reject(tx.error);db.close()};};});}
async function load(){
 try{const r=await fetch('./api/questions',{cache:'no-store'});if(!r.ok){if(r.status===409)throw new Error((await r.json()).error);throw Error('サーバーに接続できません。');}data=await r.json();online=true;try{await cacheData(data)}catch{}}
 catch(e){online=false;const saved=await cacheData().catch(()=>null);if(saved)data=saved;else data=await BookletData.load(path=>fetch('./data/'+path).then(r=>{if(!r.ok)throw Error('冊子データを取得できません。');return r.json()}));data.editorError=e.message;}
 return data;
}
function init(raw,callback){data=raw;onSave=callback;const dialog=$('edit-dialog');
 $('edit-form').addEventListener('input',()=>dirty=true);$('edit-form').addEventListener('change',()=>dirty=true);
 function close(){if(!dirty)dialog.close();else{$('edit-message').textContent='保存していない変更があります。閉じる場合は「破棄して閉じる」を押してください。';$('edit-discard').hidden=false;}}
 $('edit-discard').onclick=()=>{dirty=false;dialog.close();};
 $('edit-cancel').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 $('edit-form').onsubmit=async e=>{e.preventDefault();if(!online)return;const patch={問題本文:$('edit-stem').value,設問文:$('edit-prompt').value,追加提示情報:$('edit-additional').value,選択肢:current['選択肢'].map(c=>({...c,本文:$('edit-choice-'+c['記号']).value})), '教室解答（採用版）':[...document.querySelectorAll('[name=edit-answer]:checked')].map(x=>x.value),question_category:$('edit-category').value||null,department_ids:[...document.querySelectorAll('[name=edit-dept]:checked')].map(x=>x.value),disease_ids:[...document.querySelectorAll('[name=edit-disease]:checked')].map(x=>x.value),症例診断名:$('edit-diagnosis').value.split('\n').map(s=>s.trim()).filter(Boolean),評価対象能力:$('edit-ability').value,explanation_summary:$('edit-summary').value,option_reasons:Object.fromEntries(current['選択肢'].map(c=>[c['記号'],$ ('edit-reason-'+c['記号']).value])),intent_sections:current.intent.sections.map((s,i)=>({heading:s.heading,body:$('edit-intent-'+i).value})),学習要点:$('edit-points').value.split('\n').map(s=>s.trim()).filter(Boolean)};
 if(current.grading_rule.type!=='hold'&&current['指定選択数']!=null&&patch['教室解答（採用版）'].length!==current['指定選択数']){$('edit-message').textContent=`正答は${current['指定選択数']}個選択してください。`;return;}
 $('edit-cancel').disabled=true;$('edit-save').disabled=true;$('edit-message').textContent='保存中…';
 try{const r=await fetch('./api/questions/'+encodeURIComponent(current.question_id),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:data.editor.tokens[current.question_id],patch})});const result=await r.json();if(!r.ok)throw Error(result.error||'保存できませんでした。');data=result;try{await cacheData(data)}catch{}dirty=false;dialog.close();onSave(data);$('editor-notice').textContent='編集内容をこのMacに保存しました。公開前の校正待ちです。';}
 catch(e){$('edit-message').textContent=e.message+' 入力内容はそのまま残っています。';}finally{$('edit-save').disabled=!online;$('edit-cancel').disabled=false;}
 };
}
function open(id){current=data.questions.find(q=>q.question_id===id);if(!current)return;dirty=false;$('edit-discard').hidden=true;$('edit-title').textContent=current.display_label+'を編集';
 for(const [id,key] of [['edit-stem','問題本文'],['edit-prompt','設問文'],['edit-additional','追加提示情報'],['edit-ability','評価対象能力']])$(id).value=current[key]||'';
 $('edit-category').value=current.question_category||'';$('edit-diagnosis').value=(current['症例診断名']||[]).join('\n');$('edit-summary').value=current.explanation.summary||'';$('edit-points').value=(current['学習要点']||[]).join('\n');
 $('edit-choices').innerHTML=current['選択肢'].map(c=>`<div class="edit-choice"><label>選択肢 ${esc(c['記号'])}<textarea id="edit-choice-${esc(c['記号'])}" rows="2" required>${esc(c['本文'])}</textarea></label><label class="inline-check"><input type="checkbox" name="edit-answer" value="${esc(c['記号'])}" ${current['教室解答（採用版）'].includes(c['記号'])?'checked':''}>正答</label><label>選択肢 ${esc(c['記号'])} の解説<textarea id="edit-reason-${esc(c['記号'])}" rows="2">${esc(current.explanation.options.find(o=>o.label===c['記号'])?.reason||'')}</textarea></label></div>`).join('');
 $('edit-answer-hint').textContent=`正答は${current['指定選択数']}個選択。変更した解答は原本再照合待ちになります。`;
 $('edit-departments').innerHTML=data.department_master.map(d=>`<label class="inline-check"><input type="checkbox" name="edit-dept" value="${d.department_id}" ${current.departments.some(x=>x.department_id===d.department_id)?'checked':''}>${esc(d.department_id+'. '+d.name)}</label>`).join('');
 $('edit-diseases').innerHTML=data.disease_master.map(d=>`<label class="inline-check"><input type="checkbox" name="edit-disease" value="${d.disease_id}" ${current.diseases.some(x=>x.disease_id===d.disease_id)?'checked':''}>${esc(d.name)}</label>`).join('');
 $('edit-intents').innerHTML=current.intent.sections.map((s,i)=>`<label>${esc(s.heading)}<textarea id="edit-intent-${i}" rows="3">${esc(s.body)}</textarea></label>`).join('');
 $('edit-shared').hidden=!current['連問ID'];$('edit-shared').textContent='連問の共通本文・共通画像は両方の問題に影響するため、この個別編集画面では変更しません。';
 $('edit-message').textContent=online?'保存後、一覧・検索・演習に反映します。公開済み原本と過去の解答履歴は保持します。':'オフラインまたは編集サーバーに未接続のため保存できません。'+(data.editorError||'');$('edit-save').disabled=!online;
 $('edit-dialog').showModal();$('edit-dialog').scrollTop=0;
}
return {load,init,open};
})();
