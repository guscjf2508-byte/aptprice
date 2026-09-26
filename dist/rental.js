import * as E from './engine.js';
export const RENT_REQUIRED=['단지명','시군구','번지','전용면적','보증금','월세금','계약년월','계약일'];
export function rentalSource(source){return E.find(source.headers,'보증금')>=0&&E.find(source.headers,'월세금')>=0;}
export function rateFor(region,kind,data){
 if(!region)return null;
 const rates=(data?.records||[]).filter(r=>r.kind===kind&&Number.isFinite(r.rate)&&r.rate>0&&r.rate<100);
 const normalize=s=>s.replace(/^전남광주>/,'').split('>').join(' ');
 const parts=region.split(' ');
 for(let n=parts.length;n>0;n--){const target=parts.slice(0,n).join(' ');const match=rates.find(r=>normalize(r.region)===target);if(match)return {...match,appliedRegion:target,fallback:target!==region};}
 return null;
}
export function parseRental(source,data){
 const ix=Object.fromEntries([...RENT_REQUIRED,'전월세구분','계약구분','건축년도','층','주택유형','해제사유발생일'].map(k=>[k,E.find(source.headers,k)]));
 if(RENT_REQUIRED.some(k=>ix[k]<0))throw Error('전월세 원본의 필수 열이 없습니다.');
 const sourceKind=/오피스텔/.test(source.metadata?.['실거래 구분']||source.name)?'오피스텔':'아파트';
 return source.rows.map((row,index)=>{
  const get=k=>E.clean(row.cells[ix[k]]);const area=E.number(get('전용면적')),deposit=E.number(get('보증금')),rent=E.number(get('월세금')),name=get('단지명'),addr=get('시군구'),region=E.district(addr),dong=E.dong(addr),kind=get('주택유형')||sourceKind;
  const lease=get('전월세구분')||(rent===0?'전세':rent>0?'월세':'미확인');const contract=['신규','갱신'].includes(get('계약구분'))?get('계약구분'):'미기재';
  let reason='포함';
  if(get('해제사유발생일')&&get('해제사유발생일')!=='-')reason='해제 거래';
  else if(!name||!region||!Number.isFinite(area)||area<=0||area>10000||!Number.isFinite(deposit)||deposit<0||deposit>1e12||!Number.isFinite(rent)||rent<0||rent>1e9||(deposit===0&&rent===0))reason='입력값 확인';
  else if(!['아파트','오피스텔'].includes(kind))reason='주택유형 확인';
  else if(!['전세','월세'].includes(lease)||(lease==='전세'&&rent!==0)||(lease==='월세'&&rent<=0))reason='전월세 구분 확인';
  const rate=rateFor(region,kind,data),price=lease==='전세'?deposit:rate?deposit+rent*12/(rate.rate/100):null;
  return {id:'rent-'+row.rowNumber+'-'+index,cells:row.cells,rowNumber:row.rowNumber,name,address:E.clean(addr+' '+get('번지')),sourceAddress:addr,region,dong,regionKey:(region||'주소 미확인')+' '+dong,area,type:Math.floor(area),year:E.yearKey(get('건축년도')),floor:get('층'),date:E.contractDate(get('계약년월'),get('계약일')),kind,lease,contract,deposit,rent,price,unitPrice:price==null?null:price/area*E.SQM_PER_PYEONG,rate:lease==='월세'?rate?.rate??null:null,rateRegion:lease==='월세'?rate?.appliedRegion||'통계 없음':'해당 없음',rateMonth:lease==='월세'?rate?.month||'':'',rateStatus:lease==='전세'?'전세금 그대로 적용':!rate?'환산 불가':rate.fallback?'상위 지역 적용':'해당 지역 적용',reason};
 });
}
const groups=(rows,key)=>{const out=new Map();for(const r of rows){const k=key(r);if(!out.has(k))out.set(k,[]);out.get(k).push(r);}return [...out.values()];};
const avg=(rows,key)=>rows.length?rows.reduce((s,r)=>s+r[key],0)/rows.length:null;
const extrema=(rows,key,max=false)=>rows.length?rows.reduce((s,r)=>(max?Math.max:Math.min)(s,r[key]),max?-Infinity:Infinity):null;
function stats(rows){const valid=rows.filter(r=>Number.isFinite(r.unitPrice)),areas=rows.map(r=>r.area);return {minimum:extrema(valid,'unitPrice'),maximum:extrema(valid,'unitPrice',true),average:avg(valid,'unitPrice'),priceMinimum:extrema(valid,'price'),priceMaximum:extrema(valid,'price',true),priceAverage:avg(valid,'price'),depositAverage:avg(rows,'deposit'),rentAverage:avg(rows,'rent'),count:rows.length,convertedCount:valid.length,missingRateCount:rows.length-valid.length,jeonseCount:rows.filter(r=>r.lease==='전세').length,monthlyCount:rows.filter(r=>r.lease==='월세').length,areaMin:extrema(rows,'area'),areaMax:extrema(rows,'area',true),year:[...new Set(rows.map(r=>r.year))].sort().join(', ')};}
export function aggregateRental(rows){
 const included=rows.filter(r=>r.reason==='포함'),excluded=rows.filter(r=>r.reason!=='포함');
 const apartments=groups(included,r=>JSON.stringify([r.name,r.address,r.type])).map(items=>{const r=items[0],s=stats(items);return {...s,id:'apt-'+JSON.stringify([r.name,r.address,r.type]),name:r.name,address:r.address,region:r.region,dong:r.dong,type:r.type,typeText:r.type+'타입',areaText:E.range(s.areaMin,s.areaMax,'㎡'),pyeongText:E.range(s.areaMin/E.SQM_PER_PYEONG,s.areaMax/E.SQM_PER_PYEONG,'평',2)};}).sort((a,b)=>a.name.localeCompare(b.name,'ko')||a.address.localeCompare(b.address,'ko')||a.type-b.type);
 const districts=[];for(const items of groups(included,r=>r.regionKey).sort((a,b)=>a[0].regionKey.localeCompare(b[0].regionKey,'ko'))){const r=items[0];districts.push({...stats(items),id:'dong-'+r.regionKey,region:r.region,dong:r.dong,name:'동 전체 평균',total:true});for(const p of groups(items,E.propertyKey)){const t=p[0];districts.push({...stats(p),id:'district-'+E.propertyKey(t),region:t.region,dong:t.dong,name:t.name,address:t.address,total:false});}}
 const reasons={};for(const r of excluded)reasons[r.reason]=(reasons[r.reason]||0)+1;
 return {included,excluded,apartments,districts,reasons,total:rows.length,missingRateCount:included.filter(r=>r.price==null).length};
}
export function rentalTrend(rows,key,type,frequency){const trades=rows.filter(r=>r.reason==='포함'&&E.propertyKey(r)===key&&(!type||String(r.type)===type)).sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));const points=groups(trades.filter(r=>r.date&&Number.isFinite(r.unitPrice)),r=>frequency==='month'?r.date.slice(0,7):r.date).map(g=>({date:frequency==='month'?g[0].date.slice(0,7):g[0].date,average:avg(g,'unitPrice'),count:g.length})).sort((a,b)=>a.date.localeCompare(b.date));return {trades,points,missing:trades.filter(r=>!r.date).length,unconverted:trades.filter(r=>r.price==null).length};}
export function rentalSourceText(source,rows,data){const m=source.metadata,applied=[...new Set(rows.filter(r=>r.reason==='포함'&&r.lease==='월세').map(r=>r.rate==null?r.region+' 통계 없음':`${r.kind} ${r.rateRegion} ${Number(r.rate.toFixed(4))}% (${r.rateMonth}, ${r.rateStatus})`))];return [`출처: 국토교통부 실거래가 공개시스템 | 대상: ${m['실거래 구분']||'전월세'} | 계약일 조회기간: ${m['계약일자']||'원본에 없음'}`,`조회범위: ${m['시도']||''} / ${m['시군구']||''} / ${m['읍면동']||''}`,`산식: 환산 전세금 = 보증금 + 월세 × 12 ÷ (연 전환율/100), 전세는 보증금 그대로 | 평당가 = 환산 전세금 ÷ 전용면적 × 3.305785 | 거래별 산술평균`,`단위: 금액 만 원 · 평당가 만원/평 · 전환율 연 % | 전환율 출처: 한국부동산원 R-ONE 최신 공표율 (계약월별 적용 아님)`,`적용: ${applied.join(' / ')||'월세 거래 없음'} | 자료 갱신일: ${data?.fetchedAt?.slice(0,10)||'미수신'}`,`제외: 금액·면적·주소·전월세 구분 오류, 확인 가능한 해제 거래. 원본에 거래유형·중개사 소재지가 없어 직거래·타지역 중개사 제외 불가. 통계 없는 월세는 원금액·건수에 포함, 환산평균·그래프에서 제외.`].join('\n');}
