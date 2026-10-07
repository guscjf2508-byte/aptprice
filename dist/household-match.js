import * as E from './engine.js';
const clean=v=>String(v??'').trim().replace(/\s+/g,' ');
export const normalizedName=v=>clean(v).normalize('NFKC').replace(/아파트$/,'').replace(/(\d+)차/g,'$1').replace(/[\s()·.,\-]/g,'').toLowerCase();
export function normalizedAddress(value){
 const text=clean(value);const region=E.district(text);if(!region||/\*/.test(text))return null;
 const parts=text.split(' '),start=region.split(' ').length;
 const tail=parts.slice(start).join(' ').match(/^(.+?(?:동|가|읍|면|리))\s+(산\s*)?(\d+)(?:-(\d+))?(?:\s|$)/);
 return tail?region+' '+tail[1]+' '+(tail[2]?'산':'')+Number(tail[3])+(tail[4]?'-'+Number(tail[4]):''):null;
}
const compatible=(a,b)=>a===b||(Math.min(a.length,b.length)>=4&&(a.includes(b)||b.includes(a)));
export function createHouseholdLookup(data={records:[]}){
 const byAddress=new Map(),byLocation=new Map();
 for(const r of data.records||[]){const address=normalizedAddress(r.address),loc=E.district(r.region)+' '+clean(r.dong);if(address){if(!byAddress.has(address))byAddress.set(address,[]);byAddress.get(address).push(r);}if(!byLocation.has(loc))byLocation.set(loc,[]);byLocation.get(loc).push(r);}
 return row=>{
  if(row.total)return {households:null,householdStatus:'동 전체는 단지 세대수 미표기'};
  const address=normalizedAddress(row.address);if(!address)return {households:null,householdStatus:'주소 확인 필요'};
  const name=normalizedName(row.name),candidates=(byAddress.get(address)||[]).filter(r=>compatible(name,normalizedName(r.name)));
  if(candidates.length===1){const r=candidates[0];return {households:r.households||null,householdCode:r.code,householdStatus:r.households?'조회 완료':r.updatedAt?'세대수 미제공':'세대수 수집 대기',householdUpdatedAt:r.updatedAt||null,approval:r.approval||null};}
  if(candidates.length>1)return {households:null,householdStatus:'동일 주소 후보 복수 · 미확인'};
  const loc=(row.region||E.district(row.address))+' '+(row.dong||E.dong(row.address));const pending=(byLocation.get(loc)||[]).filter(r=>normalizedName(r.name)===name&&!r.address);
  return {households:null,householdStatus:pending.length?'세대수 수집 대기':'연결 미확인'};
 };
}
export function enrichRows(rows,lookup){const memo=new Map();return rows.map(r=>{const key=E.propertyKey(r);if(!memo.has(key))memo.set(key,lookup(r));return {...r,...memo.get(key)};});}
export function enrichResult(result,raw,lookup){
 const byKey=new Map(raw.map(r=>[E.propertyKey(r),r]));
 for(const tab of ['apartments','districts','periods'])if(result[tab])result[tab]=result[tab].map(r=>{let identity=r;if(!r.address){const key=r.targetKey||(r.id?.startsWith('district-')?r.id.slice(9):null);identity=key&&byKey.get(key)||r;}return {...r,...lookup(identity)};});
 return result;
}
