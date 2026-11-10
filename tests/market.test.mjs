import test from 'node:test';
import assert from 'node:assert/strict';
import {marketStats,marketGroups,marketPeriods,matchesType,barAxis,marketProfile} from '../dist/market.js';
import {areaText,SQM_PER_PYEONG} from '../dist/engine.js';
const row=(over={})=>({region:'경기 하남시',dong:'망월동',type:101,price:100,unitPrice:10,date:'2025-01-10',...over});
test('type ranges preserve exact boundaries and market mean weights individual transactions',()=>{
 assert.equal(matchesType(row(),'99~101'),true);
 assert.equal(matchesType(row({type:102}),'99~101'),false);
 assert.equal(matchesType(row({type:114}),'110~114'),true);
 const rows=[row(),row({unitPrice:20}),row({dong:'선동',unitPrice:60})];
 assert.equal(marketGroups(rows,'city').length,1);
 assert.equal(marketGroups(rows,'dong').length,2);
 assert.deepEqual(marketStats(rows),{count:3,price:100,unit:30});
 assert.equal(areaText(84.995),'85');
});
test('period comparisons distinguish covered empty, missing and partially covered months',()=>{
 const out=marketPeriods([row(),row({date:'2025-02-15',unitPrice:12})],'month','2025-01-01','2025-05-12',[{from:'2025-01-01',to:'2025-03-31'},{from:'2025-05-01',to:'2025-05-12'}]);
 assert.equal(Math.round(out[1].change),20);
 assert.equal(out[2].count,0);assert.equal(out[2].status,'조회 완료');
 assert.equal(out[3].status,'조회 범위 미확인');
 assert.equal(out[4].status,'부분 조회');assert.equal(out[4].change,null);
});

test('dual chart axes use round steps and leave room for the highest value',()=>{
 assert.deepEqual(barAxis(6500),{step:2000,max:8000,ticks:[0,2000,4000,6000,8000]});
 assert.deepEqual(barAxis(5200).ticks,[0,1500,3000,4500,6000]);
 assert.deepEqual(barAxis(190000).ticks,[0,50000,100000,150000,200000]);
});
test('officetel profiles assign fractional and exact boundaries once in sale and rent',()=>{
 const inputs=[[25,'25'],[25.01,'40'],[40,'40'],[40.01,'60'],[60,'60'],[60.01,'85'],[85,'85'],[85.01,'86']];
 for(const [mode,lease] of [['sale',null],['rent','전세'],['rent','월세']]){
  const profile=marketProfile('오피스텔',mode,lease);
  for(const [area,key] of inputs)assert.deepEqual(profile.bands.filter(k=>profile.matches({area},k)),[key]);
  assert.equal(profile.bands.some(k=>profile.matches({area:0},k)),false);
 }
});
test('rental comparison separates leases and keeps actual monthly contracts when conversion is missing',()=>{
 const rows=[row({reason:'포함',lease:'월세',deposit:100,rent:60,price:null,unitPrice:null,adjustedRent:null}),row({reason:'포함',lease:'월세',deposit:300,rent:40,adjustedRent:70}),row({reason:'포함',lease:'전세',deposit:30000,area:60,price:123}),row({reason:'해제 거래',lease:'월세',deposit:9999,rent:9999})];
 const profile=marketProfile('아파트','rent','월세'),keys=profile.metrics.map(([key])=>key);
 const monthly=profile.rows(rows);
 assert.deepEqual(marketStats(monthly,keys),{count:2,deposit:200,rent:50,adjustedRent:70});
 const periods=marketPeriods(monthly,'quarter','2025-01-01','2025-03-31',[],keys);
 assert.equal(periods[0].rent,50);
 assert.equal(periods[0].adjustedRent,70);
 const jeonse=marketProfile('아파트','rent','전세');
 assert.deepEqual(marketStats(jeonse.rows(rows)),{count:1,price:30000,unit:30000/60*SQM_PER_PYEONG});
});
