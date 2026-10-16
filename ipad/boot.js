(async()=>{try{
 await WebStore.init();
 for(const file of ['rich-text.js','exam-mode.js','adapter.js','grader.js','storage.js','model.js','web-ui.js','app.js'])await new Promise((ok,no)=>{const s=document.createElement('script');s.src=file;s.onload=ok;s.onerror=()=>no(Error('画面ファイルを読み込めません：'+file));document.body.append(s)});
 document.getElementById('web-startup').hidden=true;WebStore.status();
 // Revoke images no longer displayed. URLs are not persisted in study records.
 const observer=new MutationObserver(records=>{for(const r of records)for(const n of r.removedNodes)if(n.nodeType===1){const images=n.matches('img')?[n]:[...n.querySelectorAll('img')];for(const img of images)if(img.src.startsWith('blob:'))URL.revokeObjectURL(img.src)}});observer.observe(document.body,{childList:true,subtree:true});
}catch(e){document.getElementById('web-startup').textContent='起動できません：'+e.message;document.querySelector('main').hidden=true}})();
