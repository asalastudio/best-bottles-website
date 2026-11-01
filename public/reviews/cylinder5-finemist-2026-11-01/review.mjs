const model=await fetch('./model.json',{cache:'no-store'}).then(r=>r.json());
const $=id=>document.getElementById(id),query=new URLSearchParams(location.search);
if([...$('glass').options].some(o=>o.value===query.get('glass')))$('glass').value=query.get('glass');
let view=['CAP ON','EXPLODED'].includes(query.get('view'))?query.get('view'):'SIDECAR';
let preferredFinish=query.get('finish')||'Matte Gold';
function chooseView(){
 for(const b of document.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(b.dataset.view===view));
 const d=$('live').contentDocument;
 if(d){const b=[...d.querySelectorAll('button')].find(b=>b.textContent.trim()===view);if(b)b.click();}
 const glass=$('glass').value==='Clear'?'clear':'cobalt-blue',shot=view==='CAP ON'?'capon':view==='EXPLODED'?'exploded':'sidecar';
 $('before').src=`before-${glass}-${shot==='capon'?'cap-on':shot}.png`;
 $('after').src=`after-${glass}-${shot}.png`;
 history.replaceState(null,'','?'+new URLSearchParams({glass:$('glass').value,finish:$('finish').value,view}));
}
function select(){const rows=model.configurations.filter(c=>c.glassLabel===$('glass').value),old=preferredFinish||$('finish').value;preferredFinish=null;$('finish').replaceChildren(...rows.map(c=>new Option(c.finishLabel,c.finishLabel)));if(rows.some(c=>c.finishLabel===old))$('finish').value=old;show();}
function show(){const c=model.configurations.find(c=>c.glassLabel===$('glass').value&&c.finishLabel===$('finish').value),href='/products/'+c.productGroupSlug+'?sku='+encodeURIComponent(c.websiteSku);$('product').href=href;$('builder').href='/matrix?family=Cylinder&sku='+encodeURIComponent(c.websiteSku);$('sku').textContent=c.websiteSku;$('live').src=href;chooseView();}
$('live').addEventListener('load',()=>{chooseView();let count=0;const timer=setInterval(()=>{chooseView();if(++count===5)clearInterval(timer)},400)});
$('glass').addEventListener('change',select);$('finish').addEventListener('change',show);
for(const b of document.querySelectorAll('[data-view]'))b.addEventListener('click',()=>{view=b.dataset.view;chooseView()});select();
