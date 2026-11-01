import fs from 'node:fs/promises';
import path from 'node:path';
import {Workbook, SpreadsheetFile} from '@oai/artifact-tool';

const dir=path.dirname(new URL(import.meta.url).pathname);
const data=JSON.parse(await fs.readFile(path.join(dir,'../audit-data.json'),'utf8'));
const wb=Workbook.create();
const specs=[];
const decisions=['Not reviewed','Fix needed','Spot-check approved','Hold'];
const checks=['Unchecked','Pass','Fix','N/A'];
function sheet(name,headers,rows,widths){
 const s=wb.worksheets.add(name);
 s.getRangeByIndexes(7,0,rows.length+1,headers.length).values=[headers,...rows];
 const used=s.getRangeByIndexes(0,0,rows.length+8,headers.length);
 used.format.font={name:'Arial',size:10,color:'#202124'};
 used.format.fill='#FFFFFF';used.format.verticalAlignment='center';
 used.format.rowHeight=32;used.format.wrapText=true;
 s.getRangeByIndexes(7,0,1,headers.length).format={fill:'#EEEEEE',font:{name:'Arial',size:10,bold:true,color:'#202124'},rowHeight:42};
 for(let i=0;i<headers.length;i++)s.getRangeByIndexes(0,i,rows.length+8,1).format.columnWidthPx=widths[i]||160;
 s.freezePanes.freezeRows(8);s.freezePanes.freezeColumns(1);s.showGridLines=true;
 s.getRange('A1').values=[['Best Bottles catalog review']];
 s.getRange('A1').format.font={name:'Arial',size:14,bold:true};
 s.getRange('A2').values=[['Inventory: October 31, 2026']];
 s.getRange('A1:H6').format.wrapText=false;
 specs.push({name,headers,rows:rows.length,columns:headers.length});return s;
}
const headers=['Product page','Decision','Owner','Reviewer','Meeting notes / next action','Review readiness','Local product URL','Original source URL','Known issues','Implementation evidence','Identity','Glass and geometry','Scale and alignment','Tube / ball / insert','Cap seating','Views and mobile','Builder handoff','Family','Capacity (ml)','Color','Neck','SKU count','Catalog exception','Record ID'];
const rows=data.rows.map(r=>[r.title,'Not reviewed','','','','',r.url,r.sourceUrl||'',r.issues.join('; '),[r.evidence,...r.notes].join('; '),...data.checks.map(()=> 'Unchecked'),r.family,r.capacity??'',r.color,r.neck,r.variants.length,r.exceptions.join('; '),r.id]);
const review=sheet('Review',headers,rows,[390,160,150,150,420,180,340,340,450,450,140,180,180,180,140,160,180,140,110,140,110,100,280,350]);
review.getRange('A3').values=[['Record decisions here. Browser-board notes do not sync automatically.']];
review.getRange('A4').values=[['Start with Main bottles, then review each color and fitment on Review.']];
review.getRange('A5').values=[['Approve only after all seven checks pass or are N/A. A spot check is not a production release.']];
review.getRange('A6').values=[['Local product links require localhost:3010 on the machine opening them.']];
review.getRange('G2').values=[['https://github.com/asalastudio/best-bottles-website/pull/382']];
review.getRange('B9:B371').dataValidation={rule:{type:'list',values:decisions}};
review.getRange('K9:Q371').dataValidation={rule:{type:'list',values:checks}};
review.getRange('F9:F371').formulas=rows.map((_,i)=>[`=IF(COUNTIFS(K${i+9}:Q${i+9},"Pass")+COUNTIFS(K${i+9}:Q${i+9},"N/A")=7,"Checks complete","Checks incomplete")`]);
review.getRange('B9:B371').conditionalFormats.add('containsText',{text:'Fix needed',format:{fill:'#FCE8E6',font:{color:'#A50E0E'}}});
const byId=new Map(data.rows.map(r=>[r.id,r]));
const main=sheet('Main bottles',['Family','Capacity (ml)','Neck','Colors','Product pages','SKU variants','Starting product URL','Representative ID'],data.bodies.map(b=>[b.family,b.capacity,b.neck,b.colors.join(', '),b.pages.length,b.skus,byId.get(b.representative).url,b.representative]),[150,110,110,310,120,110,400,350]);
main.getRange('A3').values=[['90 starting points, grouped by family, capacity and neck.']];
main.getRange('A4').values=[['Use Review for decisions and follow-up owners. This index does not imply approval.']];
main.getRange('A5').values=[['363 product groups include 318 visible bottle and jar pages.']];
main.getRange('A6').values=[['Source: current catalog inventory. Additional color and fitment pages are on Review.']];
const skus=data.rows.flatMap(r=>r.variants.map(v=>[v.sku,r.title,r.color,v.cap||'',v.fitment||'',v.url,r.id,'Linked']));
for(const id of data.unlinkedSkus)skus.push([id,'','','','','','','Unlinked retired record']);
const sku=sheet('SKU index',['SKU','Product page','Color','Cap finish','Fitment','Local product URL','Product group ID','Link state'],skus,[350,400,150,170,180,400,350,220]);
sku.getRange('A3').values=[['2,485 catalog records: 2,483 linked variants and 2 unlinked retired records.']];
sku.getRange('A4').values=[['Use this tab to locate an exact SKU. Record decisions on Review.']];
sku.getRange('A5').values=[['Source: catalog snapshot collected '+data.inventoryAt]];
wb.recalculate();
// Exercise the checklist with one remaining check, then restore all inputs.
review.getRange('K9:P9').values=[Array(6).fill('Pass')];
wb.recalculate();if(review.getRange('F9').values[0][0]!=='Checks incomplete')throw Error('Incomplete checklist accepted');
review.getRange('Q9').values=[['N/A']];wb.recalculate();if(review.getRange('F9').values[0][0]!=='Checks complete')throw Error('Complete checklist rejected');
review.getRange('K9:Q9').values=[Array(7).fill('Unchecked')];wb.recalculate();
console.log((await wb.inspect({kind:'table',range:'Review!A8:F10',include:'values,formulas',tableMaxRows:3,tableMaxCols:6,maxChars:2200})).ndjson);
console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!',options:{useRegex:true,maxResults:10},summary:'Formula error scan'})).ndjson);
for(const name of ['Review','Main bottles','SKU index']){
 const image=await wb.render({sheetName:name,range:'A1:F12',scale:1,format:'png'});
 await fs.writeFile(path.join(dir,name.replaceAll(' ','-')+'.png'),new Uint8Array(await image.arrayBuffer()));
}
await (await SpreadsheetFile.exportXlsx(wb)).save(path.join(dir,'best-bottles-catalog-review.xlsx'));
await fs.writeFile(path.join(dir,'structure.json'),JSON.stringify({specs,decisions,checks,inventoryAt:data.inventoryAt},null,2));
console.log(JSON.stringify(specs));
