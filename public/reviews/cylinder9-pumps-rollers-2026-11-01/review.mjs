const model=await fetch('./model.json', {cache:'no-store'}).then(r=>r.json());
const $=id=>document.getElementById(id),query=new URLSearchParams(location.search);
if([...$('fitment').options].some(o=>o.value===query.get('fitment')))$('fitment').value=query.get('fitment');
if([...$('glass').options].some(o=>o.value===query.get('glass')))$('glass').value=query.get('glass');
let view=query.get('view')==='EXPLODED'?'EXPLODED':query.get('view')==='CAP ON'?'CAP ON':'SIDECAR';
let preferredFinish=query.get('finish');
function chooseView(){
 for(const b of document.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(b.dataset.view===view));
 const d=$('live').contentDocument;
 if(d){const b=[...d.querySelectorAll('button')].find(b=>b.textContent.trim()===view);if(b)b.click();}
 const type=$('fitment').value==='lotion-pump'?'pump':$('fitment').value==='metal-roller'?'metal':'plastic';
 const shot=view==='EXPLODED'?'exploded':'sidecar';
 $('before').src=`before-${type}-${shot}.png`;$('after').src=`after-${type}-${shot}.png?seating=2`;
 const params=new URLSearchParams({fitment:$('fitment').value,glass:$('glass').value,finish:$('finish').value,view});history.replaceState(null,'','?'+params);
}
function select(){const rows=model.configurations.filter(c=>c.applicatorKey===$('fitment').value&&c.glassLabel===$('glass').value);const old=preferredFinish||$('finish').value;preferredFinish=null;$('finish').replaceChildren(...rows.map(c=>new Option(c.finishLabel,c.finishLabel)));if(rows.some(c=>c.finishLabel===old))$('finish').value=old;show();}
function show(){const c=model.configurations.find(c=>c.applicatorKey===$('fitment').value&&c.glassLabel===$('glass').value&&c.finishLabel===$('finish').value);const href='/products/'+c.productGroupSlug+'?sku='+encodeURIComponent(c.websiteSku);$('product').href=href;$('builder').href='/matrix?family=Cylinder&sku='+encodeURIComponent(c.websiteSku);$('sku').textContent=c.websiteSku;$('live').src=href;chooseView();}
$('live').addEventListener('load',()=>{chooseView();let count=0;const t=setInterval(()=>{chooseView();if(++count===5)clearInterval(t)},400)});
$('fitment').addEventListener('change',select);$('glass').addEventListener('change',select);$('finish').addEventListener('change',show);
for(const b of document.querySelectorAll('[data-view]'))b.addEventListener('click',()=>{view=b.dataset.view;chooseView()});
select();
