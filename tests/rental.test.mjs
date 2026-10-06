import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../dist/rental.js';
import * as E from '../dist/engine.js';
import {rentalColumns} from '../dist/columns.js';
const rates={records:[{kind:'아파트',region:'서울>용산구',rate:5,month:'2026-07'},{kind:'아파트',region:'서울',rate:4,month:'2026-07'},{kind:'아파트',region:'전남광주>광주',rate:6,month:'2026-07'},{kind:'오피스텔',region:'서울',rate:6,month:'2026-08'}]};
const headers=['단지명','시군구','번지','전용면적(㎡)','보증금(만원)','월세금(만원)','계약년월','계약일','전월세구분','계약구분','건축년도','층'];
const source=(cells)=>({headers,name:'아파트(전월세).xlsx',metadata:{},rows:cells.map((cells,i)=>({cells,rowNumber:i+14}))});
const base=['A','서울특별시 용산구 문배동','1',59.99,10000,100,'202601',3,'월세','신규',2000,4];
test('exact regional annual rate and property type separation',()=>{
 const row=R.parseRental(source([base]),rates)[0];assert.equal(row.price,34000);assert.equal(row.rate,5);assert.equal(row.rateRegion,'서울 용산구');assert.equal(row.type,59);
 assert.equal(R.rateFor('서울 용산구','오피스텔',rates).rate,6);
 assert.equal(R.rateFor('서울 강남구','아파트',rates).fallback,true);
 assert.equal(R.rateFor('광주 북구','아파트',rates).rate,6);
 assert.equal(R.rateFor('경기 광주시','아파트',rates),null);
});
test('jeonse without rates, missing rates kept but never treated as zero',()=>{
 const j=[...base];j[5]=0;j[8]='전세';j[9]='-';
 const rows=R.parseRental(source([base,j]),{records:[]});assert.equal(rows[0].price,null);assert.equal(rows[1].price,10000);assert.equal(rows[1].contract,'미기재');
 const group=R.aggregateRental(rows).apartments[0];assert.equal(group.count,2);assert.equal(group.missingRateCount,1);assert.equal(group.priceAverage,10000);assert.equal(group.depositAverage,10000);
 const tr=R.rentalTrend(rows,E.propertyKey(rows[0]),null,'month');assert.equal(tr.trades.length,2);assert.equal(tr.points[0].count,1);
});
test('lease, multi contract, and inclusive date filters recalculate means',()=>{
 const b=[...base];b[5]=200;b[9]='갱신';const c=[...base];c[5]=0;c[8]='전세';
 const rows=R.parseRental(source([base,b,c]),rates);
 const f=E.filtered(rows,{lease:'월세',contract:new Set(['신규','갱신']),from:'2026-01-03',to:'2026-01-03'});
 assert.equal(f.length,2);assert.equal(R.aggregateRental(f).apartments[0].rentAverage,150);
 assert.equal(E.filtered(rows,{contract:new Set()}).length,0);
 assert.equal(R.aggregateRental(E.filtered(rows,{lease:'전세'})).apartments[0].priceAverage,10000);
});
test('rental validation and monthly columns order',()=>{
 const bad=[...base];bad[8]='전세';assert.equal(R.parseRental(source([bad]),rates)[0].reason,'전월세 구분 확인');
 const blank=[...base];blank[5]='';assert.equal(R.parseRental(source([blank]),rates)[0].reason,'입력값 확인');
 const cols=rentalColumns('월세').apartments.map(c=>c.key);assert.ok(cols.indexOf('rentAverage')<cols.indexOf('adjustedMinimum'));
 const rows=R.parseRental(source([base]),rates);assert.equal(R.rentalTrend(rows,E.propertyKey(rows[0]),'60','day').trades.length,0);
});
test('manual district rates override only exact district and retain jeonse and exclusions',()=>{
 const data={...rates,manual:{'서울 용산구':8}};
 const row=R.parseRental(source([base]),data)[0];assert.equal(row.price,25000);assert.equal(row.rateStatus,'수동 입력');assert.equal(row.rateMonth,'수동 입력');
 assert.equal(R.rateFor('서울 강남구','아파트',data).rate,4);assert.equal(R.rateFor('서울 용산구','오피스텔',data).rate,8);
 const jeonse=[...base];jeonse[5]=0;jeonse[8]='전세';assert.equal(R.parseRental(source([jeonse]),data)[0].price,10000);
 assert.equal(R.parseRental(source([base]),rates)[0].price,34000);
 const applied=E.reviewedRows([row],new Set([row.id]));assert.equal(R.aggregateRental(applied).included.length,0);
});
