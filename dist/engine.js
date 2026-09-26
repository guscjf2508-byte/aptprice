export const SQM_PER_PYEONG=3.305785;
const aliases={'서울특별시':'서울','부산광역시':'부산','대구광역시':'대구','인천광역시':'인천','광주광역시':'광주','대전광역시':'대전','울산광역시':'울산','세종특별자치시':'세종','경기도':'경기','강원특별자치도':'강원','강원도':'강원','충청북도':'충북','충청남도':'충남','전북특별자치도':'전북','전라북도':'전북','전라남도':'전남','경상북도':'경북','경상남도':'경남','제주특별자치도':'제주','제주도':'제주'};
const provinces=new Set(Object.values(aliases));
export const clean=v=>String(v??'').trim().replace(/\s+/g,' ');
export const header=v=>String(v??'').replace(/\s/g,'');
export const find=(headers,key)=>headers.findIndex(v=>header(v)===key||(['전용면적','거래금액','보증금','월세금'].includes(key)&&header(v).startsWith(key+'(')));
export const REQUIRED=['단지명','시군구','번지','전용면적','거래금액','해제사유발생일','거래유형','중개사소재지'];
export function district(address){const t=clean(address).split(' '),p=aliases[t[0]]||t[0];if(!provinces.has(p))return null;if(p==='세종')return p;if(t.length<2||!/[시군구]$/.test(t[1]))return null;return p+' '+t[1]+(t[1].endsWith('시')&&t[2]?.endsWith('구')?' '+t[2]:'');}
export function dong(address){const t=clean(address).split(' ');for(let i=t.length-1;i>=1;i--)if(/(동|가|읍|면)$/.test(t[i]))return t[i];return t.length>2?t.at(-1):'미확인';}
export function number(v){const s=String(v??'').replace(/[,\s]/g,'');return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)?Number(s):NaN;}
export function contractDate(ym,day){ym=String(ym??'').trim();const d=Number(day);if(!/^\d{6}$/.test(ym)||!Number.isInteger(d)||d<1||d>31)return null;const date=`${ym.slice(0,4)}-${ym.slice(4)}-${String(d).padStart(2,'0')}`;const parsed=new Date(date+'T00:00:00Z');return !Number.isNaN(+parsed)&&parsed.toISOString().slice(0,10)===date?date:null;}
export const yearKey=v=>!clean(v)||clean(v)==='-'?'미확인':clean(v);
export const propertyKey=t=>JSON.stringify([t.name,t.address]);
export const areaText=n=>Number(n.toFixed(4)).toString();
export const range=(a,b,unit,precision)=>{const fmt=n=>precision===undefined?areaText(n):n.toFixed(precision);return fmt(a)+(a===b?'':'~'+fmt(b))+unit;};
export function parseRows(source){
 const ix=Object.fromEntries([...REQUIRED,'건축년도','계약년월','계약일','층'].map(k=>[k,find(source.headers,k)]));
 if(REQUIRED.some(k=>ix[k]<0))throw Error('매매 자료의 필수 열이 없습니다. 아파트·오피스텔 매매 원본을 선택해 주세요.');
 return source.rows.map((r,index)=>{
  const get=k=>String(r.cells[ix[k]]??'').trim();const name=get('단지명'),addr=clean(get('시군구')),cancel=get('해제사유발생일'),deal=get('거래유형'),broker=get('중개사소재지');
  const area=number(get('전용면적')),price=number(get('거래금액')),region=district(addr),town=dong(addr);let reason=null;
  if(cancel&&cancel!=='-')reason='해제 거래';else if(deal==='직거래')reason='직거래';else if(deal!=='중개거래')reason='거래유형 확인';
  else if(!name||!addr||!Number.isFinite(area)||area<=0||area>10000||!Number.isFinite(price)||price<=0||price>1e12)reason='입력값 확인';
  else{const brokers=broker.split(/[,，;\r\n]/).map(clean);if(!region)reason='아파트 주소 확인';else if(brokers.some(b=>!b||b==='-'||!district(b)))reason='소재지 미확인';else if(brokers.some(b=>district(b)!==region))reason='타지역 중개사';}
  return {id:'raw-'+r.rowNumber+'-'+index,cells:r.cells,rowNumber:r.rowNumber,name,address:clean(addr+' '+get('번지')),sourceAddress:addr,region,dong:town,regionKey:(region||'주소 미확인')+' '+town,area,type:Math.floor(area),price,unitPrice:price/area*SQM_PER_PYEONG,year:yearKey(get('건축년도')),floor:get('층'),date:contractDate(get('계약년월'),get('계약일')),broker,reason:reason||'포함'};
 });
}
export function filtered(rows,filters={}){return rows.filter(t=>(!filters.lease||t.lease===filters.lease)&&(filters.contract==null||filters.contract.has(t.contract))&&(filters.region==null||filters.region.has(t.regionKey))&&(filters.name==null||filters.name.has(t.name))&&(filters.year==null||filters.year.has(t.year))&&(filters.type==null||filters.type.has(String(t.type))||filters.type.has('D:'+Math.floor(t.type/10)*10))&&(!filters.from&&!filters.to||t.date&&(!filters.from||t.date>=filters.from)&&(!filters.to||t.date<=filters.to)));}
function group(items,key){const m=new Map();for(const item of items){const k=key(item);if(!m.has(k))m.set(k,[]);m.get(k).push(item);}return [...m.values()];}
export const mean=(items,key)=>items.reduce((sum,t)=>sum+t[key],0)/items.length;
function stats(items){let min=Infinity,max=-Infinity,pmin=Infinity,pmax=-Infinity,amin=Infinity,amax=-Infinity;for(const t of items){min=Math.min(min,t.unitPrice);max=Math.max(max,t.unitPrice);pmin=Math.min(pmin,t.price);pmax=Math.max(pmax,t.price);amin=Math.min(amin,t.area);amax=Math.max(amax,t.area);}return {minimum:min,maximum:max,average:mean(items,'unitPrice'),priceMinimum:pmin,priceMaximum:pmax,priceAverage:mean(items,'price'),areaMin:amin,areaMax:amax,count:items.length,year:[...new Set(items.map(t=>t.year).filter(y=>y!=='미확인'))].sort().join(', ')||'미확인'};}
const cmp=(a,b)=>a.localeCompare(b,'ko');
export function aggregate(rows){const included=rows.filter(t=>t.reason==='포함'),excluded=rows.filter(t=>t.reason!=='포함');
 const apartments=group(included,t=>JSON.stringify([t.name,t.address,t.type])).map(items=>{const t=items[0],s=stats(items);return {...s,id:'apt-'+JSON.stringify([t.name,t.address,t.type]),name:t.name,region:t.region,dong:t.dong,address:t.address,type:t.type,typeText:t.type+'타입',areaText:range(s.areaMin,s.areaMax,'㎡'),pyeongText:range(s.areaMin/SQM_PER_PYEONG,s.areaMax/SQM_PER_PYEONG,'평',2)};}).sort((a,b)=>cmp(a.name,b.name)||cmp(a.address,b.address)||a.type-b.type);
 const regions=group(included,t=>JSON.stringify([t.region,t.dong])).sort((a,b)=>cmp(a[0].region,b[0].region)||cmp(a[0].dong,b[0].dong));const counts=new Map();for(const g of regions)counts.set(g[0].dong,(counts.get(g[0].dong)||0)+1);
 const districts=[];for(const items of regions){const t=items[0],d=counts.get(t.dong)>1?t.region+' '+t.dong:t.dong;districts.push({id:'dong-'+t.regionKey,dong:d,region:t.region,name:'동 전체 평균',year:'',average:mean(items,'unitPrice'),count:items.length,total:true});
 const names=new Map();for(const p of group(items,propertyKey))names.set(p[0].name,(names.get(p[0].name)||0)+1);
 for(const p of group(items,propertyKey).sort((a,b)=>cmp(a[0].name,b[0].name)||cmp(a[0].address,b[0].address))){const first=p[0];districts.push({id:'district-'+propertyKey(first),dong:d,region:first.region,name:first.name+(names.get(first.name)>1?' ('+first.address+')':''),year:stats(p).year,average:mean(p,'unitPrice'),count:p.length,total:false});}}
 const reasons={};for(const t of excluded)reasons[t.reason]=(reasons[t.reason]||0)+1;return {included,excluded,apartments,districts,reasons,total:rows.length};
}
export function trend(rows,key,type=null,frequency='month'){const trades=rows.filter(t=>t.reason==='포함'&&propertyKey(t)===key&&(type==null||String(t.type)===String(type))).sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')||a.rowNumber-b.rowNumber);
 const points=group(trades.filter(t=>t.date),t=>frequency==='month'?t.date.slice(0,7):t.date).map(items=>({date:frequency==='month'?items[0].date.slice(0,7):items[0].date,average:mean(items,'unitPrice'),count:items.length})).sort((a,b)=>a.date.localeCompare(b.date));return {trades,points,missing:trades.filter(t=>!t.date).length};}
export function sourceText(source){const m=source.metadata,get=k=>m[k]||'원본에 없음';return [`출처: 국토교통부 실거래가 공개시스템 | 대상: ${get('실거래 구분')} | 계약일 조회기간: ${get('계약일자')}`,`조회범위: ${get('시도')} / ${get('시군구')} / ${get('읍면동')}`,`산식: 거래별 [거래금액(만원) ÷ 전용면적(㎡) × 3.305785]의 산술평균 | 단위: 만원/평`,`제외: 직거래·해제 거래·타지역/소재지 미확인 중개사 거래·입력값 및 거래유형 확인 필요 거래`].join('\n');}
