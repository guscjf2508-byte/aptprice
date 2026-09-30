export function parseIndex(source){
 const rows=source.rows.map(r=>r.cells),head=rows.findIndex(r=>r.some(c=>/^\d{4}년\s*\d{1,2}월$/.test(String(c).trim())));
 if(head<0)throw Error('월별 가격지수의 연월 제목을 찾지 못했습니다.');
 const cols=[];for(let c=0;c<rows[head].length;c++){const m=String(rows[head][c]).trim().match(/^(\d{4})년\s*(\d{1,2})월$/);if(m&&rows.slice(head+1,head+4).some(r=>r[c]==='원자료'))cols.push({c,month:m[1]+'-'+m[2].padStart(2,'0')});}
 if(!cols.length)throw Error('가격지수 원자료 열이 없습니다.');
 const series=[];for(const row of rows.slice(head+1)){if(!/^\d+$/.test(String(row[0])))continue;const parts=row.slice(1,cols[0].c).map(v=>String(v??'').trim()).filter((v,i,a)=>v&&v!==a[i-1]);const values=Object.fromEntries(cols.map(({c,month})=>{const v=row[c];return [month,v==null||String(v).trim()===''?null:Number.isFinite(Number(v))?Number(v):null];}));series.push({region:parts.join(' > '),values});}
 if(!series.length)throw Error('지역별 가격지수 값이 없습니다.');return {name:source.name,months:cols.map(c=>c.month),series};
}
export function rebaseIndex(series,months,base){const denominator=series.values[base];return months.map(month=>({month,original:series.values[month],index:Number.isFinite(denominator)&&denominator>0&&Number.isFinite(series.values[month])?series.values[month]/denominator*100:null}));}
