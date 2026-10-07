import * as E from './engine.js';
const group=(rows,key)=>{const map=new Map();for(const r of rows){const k=key(r);if(!map.has(k))map.set(k,[]);map.get(k).push(r);}return [...map.values()];};
const avg=(rows,key)=>{const values=rows.map(r=>r[key]).filter(Number.isFinite);return values.length?values.reduce((a,b)=>a+b,0)/values.length:null;};
const extent=(rows,key,max=false)=>{const values=rows.map(r=>r[key]).filter(Number.isFinite);return values.length?values.reduce((a,b)=>(max?Math.max:Math.min)(a,b)):null;};
export function targetRows(rows,{referenceYear,maxAge=10,types=[59,84],selected=null}={}){
 return rows.filter(r=>{const y=Number(r.year);return r.reason==='포함'&&Number.isInteger(y)&&y>1900&&y<=referenceYear&&referenceYear-y<=maxAge&&types.includes(r.type)&&(selected==null||selected.has(E.propertyKey(r)));});
}
function summary(items,mode){const first=items[0],sale=mode==='sale',jeonse=items.filter(r=>r.lease==='전세'),monthly=items.filter(r=>r.lease==='월세'),prices=sale?items:jeonse,adjusted=monthly.filter(r=>Number.isFinite(r.adjustedRent));return {name:first?.name,address:first?.address,region:first?.region,dong:first?.dong,type:first?.type,year:first?.year,households:first?.households??null,householdStatus:first?.householdStatus,priceMinimum:extent(prices,sale?'price':'deposit'),priceMaximum:extent(prices,sale?'price':'deposit',true),priceAverage:avg(prices,sale?'price':'deposit'),minimum:extent(prices,'unitPrice'),maximum:extent(prices,'unitPrice',true),average:avg(prices,'unitPrice'),depositAverage:avg(monthly,'deposit'),rentMinimum:extent(monthly,'rent'),rentMaximum:extent(monthly,'rent',true),rentAverage:avg(monthly,'rent'),adjustedMinimum:extent(adjusted,'adjustedRent'),adjustedMaximum:extent(adjusted,'adjustedRent',true),adjustedAverage:avg(adjusted,'adjustedRent'),jeonseCount:jeonse.length,monthlyCount:monthly.length,adjustedCount:adjusted.length,count:items.length,areaMin:extent(items,'area'),areaMax:extent(items,'area',true)};}
export function previousPeriod(period,frequency){if(frequency==='quarter'){const [y,q]=period.split(' Q').map(Number);return q===1?(y-1)+' Q4':y+' Q'+(q-1);}const d=new Date(period+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()-1);return d.toISOString().slice(0,7);}
const change=(current,previous)=>Number.isFinite(current)&&Number.isFinite(previous)&&previous>0?(current/previous-1)*100:null;
export function periodBounds(period,frequency){const year=Number(period.slice(0,4)),month=frequency==='quarter'?(Number(period.at(-1))-1)*3+1:Number(period.slice(5));const from=new Date(Date.UTC(year,month-1,1)).toISOString().slice(0,10),to=new Date(Date.UTC(year,month-1+(frequency==='quarter'?3:1),0)).toISOString().slice(0,10);return {from,to};}
export function buildReport(rows,options){
 const {mode='sale',from,to,frequency='month'}=options;
 const chosen=targetRows(rows,options).filter(r=>(!from&&!to)||r.date&&(!from||r.date>=from)&&(!to||r.date<=to));
 const apartments=group(chosen,r=>JSON.stringify([r.name,r.address,r.type])).map(g=>summary(g,mode)).sort((a,b)=>a.region.localeCompare(b.region,'ko')||a.dong.localeCompare(b.dong,'ko')||a.name.localeCompare(b.name,'ko')||a.address.localeCompare(b.address,'ko')||a.type-b.type);
 const districts=group(chosen,r=>JSON.stringify([r.region,r.dong,r.type])).map(g=>({...summary(g,mode),complexCount:new Set(g.map(E.propertyKey)).size})).sort((a,b)=>a.region.localeCompare(b.region,'ko')||a.dong.localeCompare(b.dong,'ko')||a.type-b.type);
 const periods=[];
 for(const items of group(chosen,E.propertyKey))for(const typeItems of group(items,r=>r.type)){
  const buckets=new Map(group(typeItems.filter(r=>r.date),r=>E.periodLabel(r.date,frequency)).map(g=>[E.periodLabel(g[0].date,frequency),summary(g,mode)]));
  const periodsSet=new Set();if(from&&to)for(let d=new Date(from.slice(0,7)+'-01T00:00:00Z');d.toISOString().slice(0,10)<=to;d.setUTCMonth(d.getUTCMonth()+1))periodsSet.add(E.periodLabel(d.toISOString().slice(0,10),frequency));else for(const p of buckets.keys())periodsSet.add(p);
  for(const period of [...periodsSet].sort()){const current=buckets.get(period),previous=buckets.get(previousPeriod(period,frequency)),bounds=periodBounds(period,frequency),priorBounds=periodBounds(previousPeriod(period,frequency),frequency),partial=(from&&bounds.from<from)||(to&&bounds.to>to),priorPartial=(from&&priorBounds.from<from)||(to&&priorBounds.to>to);periods.push({...summary(typeItems,mode),...(current||{priceAverage:null,average:null,depositAverage:null,rentAverage:null,count:0,jeonseCount:0,monthlyCount:0}),period,partial:!!partial,priceChange:partial||priorPartial?null:change(current?.priceAverage,previous?.priceAverage),unitChange:partial||priorPartial?null:change(current?.average,previous?.average)});}
 }
 periods.sort((a,b)=>a.name.localeCompare(b.name,'ko')||a.address.localeCompare(b.address,'ko')||a.type-b.type||a.period.localeCompare(b.period));
 return {options,rows:chosen,apartments,districts,periods,complexCount:new Set(chosen.map(E.propertyKey)).size,unknownYears:rows.filter(r=>r.reason==='포함'&&!/^\d{4}$/.test(String(r.year))).length,missingDates:chosen.filter(r=>!r.date).length};
}
const fmt=v=>Number.isFinite(v)?Math.round(v).toLocaleString('ko-KR'):'-';
export function conclusions(report){
 const {mode,from,to,referenceYear,maxAge}=report.options,lines=[`${from||'시작일 미확인'} ~ ${to||'종료일 미확인'} · 건축년도 ${referenceYear-maxAge}~${referenceYear}년 · ${report.complexCount}개 단지 · ${report.rows.length}건 분석.`];
 if(!report.rows.length)return [...lines,'선정 조건에 맞는 거래가 없습니다.'];
 for(const r of report.apartments){const basis=`${r.name} ${r.type}타입`;if(mode==='sale')lines.push(`${basis}: 평균 거래가격 ${fmt(r.priceAverage)}만 원, 평균 평당가 ${fmt(r.average)}만원/평. 거래가격 ${fmt(r.priceMinimum)}~${fmt(r.priceMaximum)}만 원 · 거래 ${r.count}건${r.count===1?' (거래 1건 기준)':''}.`);else{if(r.jeonseCount)lines.push(`${basis} 전세: 평균 전세금 ${fmt(r.priceAverage)}만 원, 평균 평당가 ${fmt(r.average)}만원/평 · 거래 ${r.jeonseCount}건${r.jeonseCount===1?' (거래 1건 기준)':''}.`);if(r.monthlyCount)lines.push(`${basis} 월세: 실제 보증금 평균 ${fmt(r.depositAverage)}만 원, 실제 월세 평균 ${fmt(r.rentAverage)}만 원/월 · 거래 ${r.monthlyCount}건. 서로 다른 보증금 조건의 계약을 함께 집계한 값입니다.`);}}
 return lines;
}
