import * as B from './engine.js';
export const bands=[['49',49,49],['59',59,59],['74',74,74],['84',84,84],['99~101',99,101],['110~114',110,114]];
export const typeLabel=k=>k==='all'?'전체 타입':k+(k.includes('~')?'타입군':'타입');
export const matchesType=(r,k)=>k==='all'||(k.includes('~')?k.split('~').map(Number).every((n,i)=>i?r.type<=n:r.type>=n):r.type===Number(k));
export function marketProfile(kind,mode,lease){
 const office=kind==='오피스텔',rental=mode==='rent',monthly=rental&&lease==='월세';
 const labels=office?['25','40','60','85','86']:bands.map(([key])=>key);
 const metrics=monthly?[['deposit','평균 실제 보증금 (만 원)'],['rent','평균 실제 월세 (만 원/월)'],['adjustedRent','평균 환산 월세 (만 원/월)']]:rental?[['price','평균 전세금 (만 원)'],['unit','평균 전세 평당가 (만원/평)']]:[['price','평균 거래가격 (만 원)'],['unit','평균 평당가 (만원/평)']];
 return {
  bands:labels,
  label:office?key=>B.officetelBandLabel(Number(key)):typeLabel,
  matches:office?(row,key)=>B.officetelBand(row.area)===Number(key):matchesType,
  metrics,
  cardMetrics:monthly?['rent','deposit']:['unit','price'],
  rows(rows){
   const included=rows.filter(r=>r.reason==='포함'&&(!rental||r.lease===(monthly?'월세':'전세')));
   if(!rental)return included.filter(r=>Number.isFinite(r.price)&&Number.isFinite(r.unitPrice));
   if(monthly)return included.filter(r=>Number.isFinite(r.deposit)&&Number.isFinite(r.rent));
   return included.filter(r=>Number.isFinite(r.deposit)&&Number.isFinite(r.area)&&r.area>0)
    .map(r=>({...r,price:r.deposit,unitPrice:r.deposit/r.area*B.SQM_PER_PYEONG}));
  }
 };
}
export function marketStats(rows,keys=['price','unit']){
 const sums=keys.map(()=>0),counts=keys.map(()=>0);
 for(const row of rows)for(let i=0;i<keys.length;i++){
  const value=row[keys[i]==='unit'?'unitPrice':keys[i]];
  if(Number.isFinite(value)){sums[i]+=value;counts[i]++;}
 }
 return {count:rows.length,...Object.fromEntries(keys.map((key,i)=>[key,counts[i]?sums[i]/counts[i]:null]))};
}
export function marketGroups(rows,scope){
 const groups=new Map();
 for(const r of rows){
  const key=JSON.stringify(scope==='city'?[r.region]:scope==='dong'?[r.region,r.dong]:[r.region,r.dong,r.name,r.address]);
  if(!groups.has(key))groups.set(key,{key,label:scope==='city'?r.region:scope==='dong'?r.dong:r.name,rows:[],sample:r});
  groups.get(key).rows.push(r);
 }
 return [...groups.values()].sort((a,b)=>a.label.localeCompare(b.label,'ko')||a.key.localeCompare(b.key));
}
export function marketPeriods(rows,frequency,from,to,coverage=[],keys=['price','unit']){
 if(!from||!to||from>to)return [];
 const step=frequency==='quarter'?3:1, start=new Date(from+'T00:00:00Z'),end=new Date(to+'T00:00:00Z');
 const buckets=new Map(),out=[];
 for(const r of rows){if(!r.date||r.date<from||r.date>to)continue;const k=B.periodLabel(r.date,frequency);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(r);}
 const stamp=d=>d.toISOString().slice(0,10);
 for(let i=start.getUTCFullYear()*12+Math.floor(start.getUTCMonth()/step)*step;i<=end.getUTCFullYear()*12+end.getUTCMonth();i+=step){
  const lo=stamp(new Date(Date.UTC(Math.floor(i/12),i%12,1))),hi=stamp(new Date(Date.UTC(Math.floor(i/12),(i%12)+step,0))),period=B.periodLabel(lo,frequency);
  const a=lo<from?from:lo,b=hi>to?to:hi;
  let days=0,total=0;for(let d=Date.parse(a);d<=Date.parse(b);d+=86400000){const s=stamp(new Date(d));total++;if(coverage.some(c=>c.from<=s&&c.to>=s))days++;}
  const status=!days?'조회 범위 미확인':days<total||a!==lo||b!==hi?'부분 조회':'조회 완료';
  const stats=marketStats(buckets.get(period)||[],keys),prev=out.at(-1);
  out.push({period,...stats,status,change:status==='조회 완료'&&prev?.status==='조회 완료'&&prev.unit&&stats.unit!=null?(stats.unit/prev.unit-1)*100:null});
 }
 return out;
}

export function barAxis(max, divisions=4){
 const target=Math.max(1,max)/divisions;
 const magnitude=10**Math.floor(Math.log10(target));
 const step=Math.max(1,magnitude*[1,1.5,2,2.5,3,4,5,7.5,10].find(n=>n*magnitude>=target));
 return {step,max:step*divisions,ticks:Array.from({length:divisions+1},(_,i)=>i*step)};
}
