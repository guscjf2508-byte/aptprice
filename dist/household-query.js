import * as E from './engine.js';
import * as H from './household-match.js';
const provinceCodes={'서울':'11','부산':'26','대구':'27','인천':'28','광주':'29','대전':'30','울산':'31','세종':'36','경기':'41','충북':'43','충남':'44','전남':'46','경북':'47','경남':'48','제주':'50','강원':'51','전북':'52'};
const lists=new Map();
export function apiBody(data){const error=data?.OpenAPI_ServiceResponse?.cmmMsgHeader;if(error)throw Error(error.returnReasonCode==='04'?'제공기관 API 연결 오류(04). 잠시 후 다시 조회해 주세요.':'API 조회 오류 ('+(error.returnReasonCode||'미확인')+')');const response=data?.response||data;if(String(response?.header?.resultCode)!=='00')throw Error('API 응답을 확인할 수 없습니다. 인증키와 활용신청 상태를 확인해 주세요.');return response.body;}
export async function queryHouseholds(row,key,{fetcher=fetch,onProgress=()=>{}}={}){
 if(!key.trim())throw Error('공공데이터포털 인증키를 입력해 주세요.');
 if(!H.normalizedAddress(row.address))throw Error('주소가 비공개이거나 번지를 확인할 수 없어 자동 조회할 수 없습니다.');
 const code=provinceCodes[(row.region||E.district(row.address))?.split(' ')[0]];if(!code)throw Error('시도 확인 필요');
 async function request(service,method,params){const url=new URL('https://apis.data.go.kr/1613000/'+service+'/'+method);url.search=new URLSearchParams({serviceKey:key.trim(),...params});let response;try{response=await fetcher(url,{signal:AbortSignal.timeout(20000)});}catch{throw Error('API에 연결하지 못했습니다. 인터넷 연결 또는 제공기관 상태를 확인해 주세요.');}if(!response.ok)throw Error('API 연결 오류 ('+response.status+')');let data;try{data=await response.json();}catch{throw Error('API 응답 형식 확인 필요');}return apiBody(data);}
 if(!lists.has(code)){const items=[];let page=1,total=Infinity;while(items.length<total){onProgress('단지 목록 확인 중…');const body=await request('AptListService4','getSidoAptList4',{sidoCode:code,pageNo:String(page),numOfRows:'1000'});const rows=Array.isArray(body?.items)?body.items:body?.items?.item?[body.items.item].flat():[];total=Number(body?.totalCount);if(total===0)break;if(!Number.isInteger(total)||total<0||!rows.length||page>100)throw Error('단지 목록 응답 확인 필요');items.push(...rows);page++;}lists.set(code,items);}
 const name=H.normalizedName(row.name),region=row.region||E.district(row.address),dong=row.dong||E.dong(row.address);const location=lists.get(code).filter(r=>E.district([r.as1,r.as2].join(' '))===region&&(r.as3===dong||r.as4===dong));
 const exact=location.filter(r=>H.normalizedName(r.kaptName)===name),candidates=exact.length?exact:location.filter(r=>{const other=H.normalizedName(r.kaptName);return Math.min(other.length,name.length)>=4&&(other.includes(name)||name.includes(other));});
 if(!candidates.length)throw Error('등록된 단지를 연결하지 못했습니다. 단지명·주소가 다르거나 K-apt 미등록일 수 있습니다.');if(candidates.length>8)throw Error('단지 후보가 여러 개여서 자동 연결하지 않습니다.');
 const confirmed=[];
 for(const c of candidates){onProgress('세대수 조회 중…');const body=await request('AptBasisInfoServiceV5','getAphusBassInfoV5',{kaptCode:c.kaptCode}),item=body?.item;if(!item||item.kaptCode!==c.kaptCode||H.normalizedAddress(item.kaptAddr)!==H.normalizedAddress(row.address))continue;const count=Number(item.kaptdaCnt);confirmed.push({households:Number.isInteger(count)&&count>0?count:null,householdCode:item.kaptCode,householdUpdatedAt:new Date().toISOString(),householdStatus:count>0?'조회 완료':'세대수 미제공',approval:item.kaptUsedate||null});}
 if(confirmed.length!==1)throw Error(confirmed.length?'동일 주소 후보가 여러 개여서 자동 연결하지 않습니다.':'단지 후보의 주소가 원본 주소와 달라 자동 연결하지 않습니다.');return confirmed[0];
}
