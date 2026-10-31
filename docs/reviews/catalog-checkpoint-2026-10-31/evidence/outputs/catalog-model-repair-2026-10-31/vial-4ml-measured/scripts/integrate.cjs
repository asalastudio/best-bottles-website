const fs=require('fs'),path=require('path'),crypto=require('crypto'),sharp=require('sharp');
(async()=>{
 const out=path.resolve(__dirname,'..'),pub=path.resolve('public/local-kits/vial-4ml-measured-2026-10-31');
 const groups=JSON.parse(fs.readFileSync(out+'/catalog-before.json')),old=JSON.parse(fs.readFileSync(out+'/original-kits.json'));
 const families={clear:'vial-4ml-clear-13-425',amber:'vial-4ml-amber-13-425',cobalt:'vial-4ml-blue-13-425',green:'vial-4ml-green-13-425'};
 const selected=JSON.parse(fs.readFileSync(out+'/selected-masters.json'));
 const rows={},registration={},caps={};fs.mkdirSync(pub+'/parts',{recursive:true});
 const H=44.98,W=14.6,T=12.5,Fh=7,bodyH=900,bodyTop=100,foot=1000,ppm=bodyH/H,bodyW=W*ppm,seat=bodyTop+Fh*ppm;
 for(const [finish,sku]of [['black','GBVAmb1DrmBlackCapSht'],['white','GBVAmb1DrmWhtCapSht']]){
  const source=old[sku].parts.find(p=>p.slot==='cap'),raw=fs.readFileSync(out+'/caps/'+finish+'.webp'),hash=crypto.createHash('sha256').update(raw).digest('hex'),key=hash+'.cap.webp';
  if(hash!==source.image.sha256)throw Error('Source cap hash mismatch');
  fs.copyFileSync(out+'/caps/'+finish+'.webp',pub+'/parts/'+key);
  const b=source.bounds,scale=bodyW*1.028/(b.right-b.left),x=500-(b.left+b.right)/2*scale,y=seat-b.bottom*scale;
  caps[finish]={...structuredClone(source),variantKey:finish,assembled:{x:0,y:0},exploded:{dx:0,dy:-220},bounds:{left:x+b.left*scale,top:y+b.top*scale,right:x+b.right*scale,bottom:seat},box:{x,y,width:source.image.width*scale,height:source.image.height*scale},image:{...source.image,url:'/local-kits/vial-4ml-measured-2026-10-31/parts/'+key,key},image2x:null,mask:null};
 }
 for(const [color,slug]of Object.entries(families)){
  if(!selected[color])continue;
  const file=out+'/sunburst/'+selected[color].file,bytes=fs.readFileSync(file),hash=crypto.createHash('sha256').update(bytes).digest('hex'),key=hash+'.body.png';
  const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const b={left:info.width,top:info.height,right:0,bottom:0};let transparent=0;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const a=data[(y*info.width+x)*4+3];if(!a)transparent++;if(a>32){b.left=Math.min(b.left,x);b.right=Math.max(b.right,x+1);b.top=Math.min(b.top,y);b.bottom=Math.max(b.bottom,y+1)}}
  const ratio=(b.right-b.left)/(b.bottom-b.top),target=W/H,delta=(ratio/target-1)*100;
  if(transparent<info.width*info.height*.05||b.top<4||b.left<4||b.right>info.width-4||b.bottom>info.height-4)throw Error('Alpha or cropping failed '+color);
  if(Math.abs(delta)>5)throw Error('Silhouette ratio deviates from measured guide '+color+' '+delta);
  const scale=bodyH/(b.bottom-b.top),scaleX=bodyW/(b.right-b.left),x=500-(b.left+b.right)/2*scaleX,y=bodyTop-b.top*scale;
  const body={slot:'body',variantKey:null,zOrder:0,explodeIndex:0,bounds:{left:x+b.left*scaleX,top:bodyTop,right:x+b.right*scaleX,bottom:foot},assembled:{x:0,y:0},exploded:{dx:0,dy:0},image:{url:'/local-kits/vial-4ml-measured-2026-10-31/parts/'+key,key,sha256:hash,bytes:bytes.length,width:info.width,height:info.height},image2x:null,mask:null,derivation:'image-generation-review',box:{x,y,width:info.width*scaleX,height:info.height*scale}};
  fs.copyFileSync(file,pub+'/parts/'+key);registration[color]={source:file,hash,dimensions:[info.width,info.height],alphaBounds:b,ratio,targetRatio:target,ratioDeltaPct:delta,transparentPixels:transparent,verticalScale:scale,horizontalScale:scaleX,horizontalCalibrationPct:(scaleX/scale-1)*100,visualQA:selected[color]};
  const group=groups.find(g=>g?.group?.slug===slug);if(group?.variants?.length!==2)throw Error('Expected exact two cap SKUs '+slug);
  for(const variant of group.variants){const finish=/WhtCapSht$/.test(variant.websiteSku)?'white':'black';if(!/BlackCapSht$|WhtCapSht$/.test(variant.websiteSku))throw Error('Unexpected variant');rows[variant.websiteSku]={sku:variant.websiteSku,familyId:slug,canvas:{width:1000,height:1100},anchors:{axisX:500,neckAxisX:500,baselineY:foot,seatY:seat,pxPerMm:ppm},parts:[structuredClone(body),structuredClone(caps[finish])],plateSha256:'',three:null,conflicts:[],completeness:'full',glassSizing:{heightPct:51.74,baselinePct:91}};}
 }
 const manifest={rows,defaultPdpSkus:Object.keys(rows),reviewCandidate:{scope:'localhost only; all 8 screw-cap SKUs across clear, amber, cobalt and green; dropper variants not changed',model:'gpt-image-2.5-sunburst',quality:'high',measurements:{height:H,bodyDiameter:W,threadDiameter:T,neckHeight:Fh},geometry:'2D generated artwork guided by caliper proportions; displayed width registered to measured body aspect with at most 5% horizontal calibration; not a dimensional Blender mesh',registration,capSource:'Saved exact published 13-425 cap masters; shared black and white assets',pixelAssetsUnmodified:true}};
 if(fs.existsSync(pub+'/kits.json'))fs.copyFileSync(pub+'/kits.json',out+'/kits-before-integration.json');
 fs.writeFileSync(pub+'/kits.json',JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync(out+'/registration.json',JSON.stringify(registration,null,2));fs.writeFileSync(out+'/kits-after.json',JSON.stringify(manifest,null,2));console.log(JSON.stringify({skus:Object.keys(rows),registration}));
})().catch(e=>{console.error(e);process.exit(1)});
