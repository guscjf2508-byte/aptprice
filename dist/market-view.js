import * as M from './market.js';
import * as B from './engine.js';
export function bindMarket(context,copy){
 const panel=document.querySelector('#marketPanel'),$=s=>panel.querySelector(s),nf=new Intl.NumberFormat('ko-KR',{maximumFractionDigits:0}),fmt=n=>n==null?'—':nf.format(n),precise=new Intl.NumberFormat('ko-KR',{maximumFractionDigits:2}),colors=['#1872d3','#b45309','#078266','#8a48b4'];
 const formatMetric=(key,value)=>value==null?'—':['rent','adjustedRent'].includes(key)?precise.format(value):fmt(value);
 const metricParts=title=>{const match=/^(.*?)\s*\(([^()]*)\)$/.exec(title);return match?[match[1].trim(),match[2]]:[title,''];};
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
 const ctrl=(id,label,items)=>{const wrap=node('label',label+' '),s=node('select');s.id=id;for(const [key,name] of items){const o=node('option',name);o.value=key;s.append(o);}wrap.append(s);return wrap;};
 const button=(label,fn)=>{const b=node('button',label);b.type='button';b.onclick=fn;return b;};
 function table(root,headers,rows){
  const frame=node('div'),t=node('table');frame.className='report-table-frame';t.className='report-table';const hr=t.createTHead().insertRow();headers.forEach(h=>hr.append(node('th',h)));
  const body=t.createTBody();for(const row of rows){const tr=body.insertRow();for(const v of row){const td=tr.insertCell();if(v instanceof Node)td.append(v);else {td.textContent=v;if(/^(?:[+−-]?[0-9][0-9,]*(?:\.[0-9]+)?(?:%\*?)?|—|-)$/.test(String(v)))td.className='numeric';}}}
  if(!rows.length){const td=body.insertRow().insertCell();td.colSpan=headers.length;td.textContent='선택 조건에 해당하는 거래가 없습니다.';}
  frame.append(t);root.append(frame);return t;
 }
 function chartTooltip(mark,heading,row,metrics){
  const info=[heading,...metrics.map(([key,title])=>{const [label,unit]=metricParts(title);return label+': '+formatMetric(key,row[key])+(row[key]==null||!unit?'':' '+unit);}), '거래건수: '+fmt(row.count)+'건'];
  mark.setAttribute('tabindex','0');mark.setAttribute('aria-label',info.join(' · '));
  const hide=()=>{const tip=$('.market-chart-tooltip');if(tip)tip.hidden=true;};
  const show=event=>{
   let tip=$('.market-chart-tooltip');if(!tip){tip=node('div');tip.className='market-chart-tooltip';tip.setAttribute('aria-hidden','true');panel.append(tip);}
   tip.replaceChildren(node('strong',info[0]),...info.slice(1).map(line=>node('span',line)));tip.hidden=false;
   const rect=mark.getBoundingClientRect(),x=event.type==='focus'?rect.right:event.clientX,y=event.type==='focus'?rect.top:event.clientY;
   const w=tip.offsetWidth,h=tip.offsetHeight;
   tip.style.left=Math.max(8,Math.min(x+12,window.innerWidth-w-8))+'px';
   tip.style.top=Math.max(8,y+h+16>window.innerHeight?y-h-12:y+12)+'px';
  };
  mark.onpointerenter=mark.onpointermove=mark.onfocus=show;
  mark.onpointerleave=mark.onblur=hide;
  mark.onkeydown=event=>{if(event.key==='Escape')hide();};
 }
 function chart(root,title,series,key,metrics,bars=false,baseline=null){
  root.append(node('h4',title));const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
  svg.setAttribute('xmlns',ns);svg.setAttribute('viewBox','0 0 780 185');svg.setAttribute('role','img');svg.setAttribute('aria-label',title);
  const add=(tag,attrs,label)=>{const n=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);if(label!=null)n.textContent=label;svg.append(n);return n;};
  const labels=series[0]?.rows.map(r=>r.period)||[],values=series.flatMap(s=>s.rows.map(r=>r[key])).concat(baseline).filter(Number.isFinite);
  if(!values.length){root.append(node('p','표시할 거래가 없습니다.'));return;}
  const low=bars?0:Math.min(...values),high=Math.max(...values),pad=bars?0:Math.max((high-low)*.08,Math.abs(high)*.01,1);
  const step=M.barAxis(high-low+2*pad).step,min=bars?0:Math.max(0,Math.floor((low-pad)/step)*step),max=Math.max(min+step,Math.ceil((high+pad)/step)*step);
  const y=v=>144-119*(v-min)/(max-min),dx=680/Math.max(1,labels.length),x=i=>72+dx*(i+.5);
  for(let v=min;v<=max;v+=step){add('line',{x1:72,x2:752,y1:y(v),y2:y(v),stroke:'#dae2ed'});add('text',{x:65,y:y(v)+4,'text-anchor':'end','font-size':11},fmt(v));}
  if(baseline!=null){add('line',{x1:72,x2:752,y1:y(baseline),y2:y(baseline),stroke:'#283548','stroke-dasharray':'5 3'});add('text',{x:750,y:y(baseline)-5,'text-anchor':'end','font-size':11},'시군구 평균 '+fmt(baseline));}
  labels.forEach((s,i)=>{if((bars&&labels.length<=12)||i%Math.ceil(labels.length/8)===0||i===labels.length-1)add('text',{x:x(i),y:166,'text-anchor':'middle','font-size':11},s);});
  series.forEach((s,j)=>{let prev=null;s.rows.forEach((r,i)=>{const v=r[key];if(v==null){prev=null;return;}const xx=x(i),yy=y(v),color=(colors[j]||"hsl("+(j*137.508%360)+" 63% 38%)"),w=Math.min(45,dx*.75/series.length);let mark;if(bars){mark=add('rect',{x:xx+(j-series.length/2)*w,y:yy,width:w,height:Math.max(1,144-yy),fill:color});}else{if(prev)add('line',{x1:prev[0],y1:prev[1],x2:xx,y2:yy,stroke:color,'stroke-width':2});mark=add('circle',{cx:xx,cy:yy,r:4,fill:color,stroke:'transparent','stroke-width':8});prev=[xx,yy];}chartTooltip(mark,s.label+' · '+r.period,r,metrics);});});
  root.append(svg);const legend=node('div');legend.className='market-legend';series.forEach((s,i)=>{const l=node('span','● '+s.label);l.style.color=(colors[i]||"hsl("+(i*137.508%360)+" 63% 38%)");legend.append(l);});root.append(legend);
 }
 const barColors=[['#152b58','#9ba6b9'],['#4e9bcf','#b3d4eb']];
 function dualBars(root,entries,cardMetrics,metrics){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),width=Math.max(365,122+entries.length*30);
  svg.setAttribute('viewBox','0 0 '+width+' 190');svg.setAttribute('role','img');svg.setAttribute('aria-label','지역별 '+cardMetrics.map(([,title])=>metricParts(title)[0]).join(' 및 ')+', 좌우 축 사용');
  const add=(tag,attrs,label,parent=svg)=>{const el=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);if(label!=null)el.textContent=label;parent.append(el);return el;};
  const left=49,right=width-65,top=28,bottom=139,step=(right-left)/entries.length;
  const axes=cardMetrics.map(([key,title])=>{const [name,unit]=metricParts(title);return {key,label:name.replace(/^평균 /,'')+(unit?' · '+unit:''),...M.barAxis(Math.max(0,...entries.map(r=>r[key]||0)))};});
  for(let i=0;i<axes[0].ticks.length;i++){const y=bottom-(bottom-top)*axes[0].ticks[i]/axes[0].max;add('line',{x1:left,x2:right,y1:y,y2:y,stroke:'#d8e1ec'});axes.forEach((a,j)=>add('text',{x:j?right+5:left-5,y:y+3,'text-anchor':j?'start':'end','font-size':10},fmt(a.ticks[i])));}
  axes.forEach((a,j)=>add('text',{x:j?width-4:4,y:13,'text-anchor':j?'end':'start','font-size':11,fill:'#324762'},a.label));
  entries.forEach((r,i)=>{const x=left+(i+.5)*step;add('text',{x,y:151,transform:'rotate(-48 '+x+' 151)','text-anchor':'end','font-size':10},i?r.period:r.period.split(' ').at(-1));axes.forEach(({key,label,max},j)=>{if(r[key]==null)return;const h=(bottom-top)*r[key]/max,w=Math.min(15,step*.33),color=barColors[i?1:0][j];const bar=add('rect',{x:x+(j?1:-w-1),y:bottom-h,width:w,height:h,rx:1,fill:color,tabindex:0});chartTooltip(bar,r.period,r,metrics);});});
  const key=node('div');key.className='market-dual-key';
  for(const [i,region] of ['시군구','법정동'].entries()){
   const group=node('div');group.className='market-dual-legend-group';group.append(node('strong',region));
   for(const [j,[,title]] of cardMetrics.entries()){
    const metric=metricParts(title)[0].replace(/^평균 /,'');
    const item=node('span'),swatch=node('span');swatch.className='market-legend-swatch';swatch.style.backgroundColor=barColors[i][j];swatch.setAttribute('aria-hidden','true');
    item.append(swatch,node('span',metric));group.append(item);
   }
   key.append(group);
  }
  const frame=node('div');frame.className='market-dual-frame';svg.style.minWidth=Math.min(width,Math.max(280,entries.length*25+105))+'px';frame.append(svg);root.append(frame,key);
 }
 function trendMatrix(root,series,key,title,renderTable){
  root.append(node('h4',title));
  const header=['구분',...(series[0]?.rows||[]).map(p=>p.period.replace(/^(\d{4}) Q([1-4])$/,'$1년 $2분기'))];
  const rows=series.flatMap(s=>[[s.label,...s.rows.map(p=>formatMetric(key,p[key]))],['',...s.rows.map((p,i)=>{const prev=s.rows[i-1];if(!prev?.[key]||p[key]==null)return '—';const partial=p.status!=='조회 완료'||prev.status!=='조회 완료';if(partial&&i!==s.rows.length-1)return '—';const change=(p[key]/prev[key]-1)*100;return (change>0?'+':'')+change.toFixed(1)+'%'+(partial?'*':'');})]]);
  const t=renderTable(root,header,rows);t.classList.add('market-matrix','market-delta-table','market-trend-matrix');
  for(let i=0;i<rows.length;i+=2){const [value,change]=[t.tBodies[0].rows[i],t.tBodies[0].rows[i+1]];value.cells[0].rowSpan=2;value.cells[0].classList.add('market-region-cell');change.deleteCell(0);}
 }
 const groupStats=(rows,label)=>[{label,rows},...M.marketGroups(rows,'dong')];
 function reportMatrix(root,rows,label,types,renderTable,profile,metrics){
  const targets=groupStats(rows,label);
  const keys=metrics.map(([key])=>key);
  const grid=types.flatMap(type=>{const stats=targets.map(g=>M.marketStats(g.rows.filter(r=>profile.matches(r,type)),keys));return metrics.map(([key,title],i)=>[i?'':profile.label(type),metricParts(title)[0],...stats.map(a=>formatMetric(key,a[key]))]);});
  const t=renderTable(root,[profile.bands.length===5?'전용면적':'타입','구분',...targets.map(g=>g.label)],grid);
  for(let i=0;i<grid.length;i+=metrics.length){t.tBodies[0].rows[i].cells[0].rowSpan=metrics.length;for(let j=1;j<metrics.length;j++)t.tBodies[0].rows[i+j].deleteCell(0);}
  t.classList.add('market-matrix');
 }
 const prefs={frequency:'quarter',metric:'unit',region:''};const unselectedDongs=new Set(),selectedTypes=new Set();let comparisonSource,comparisonKind;
 function render(){
  const c=context(),profile=M.marketProfile(c.kind||'아파트',c.mode||'sale',c.lease),scopedRows=c.rows,all=profile.rows(scopedRows);
  const metrics=profile.metrics,metricKeys=metrics.map(([key])=>key),cardMetrics=(profile.cardMetrics||metricKeys).slice(0,2).map(key=>metrics.find(([k])=>k===key)).filter(Boolean);
  if(!metricKeys.includes(prefs.metric))prefs.metric=cardMetrics[0]?.[0]||metricKeys[0];
  if(comparisonSource!==c.source||comparisonKind!==c.kind){unselectedDongs.clear();selectedTypes.clear();profile.bands.forEach(k=>selectedTypes.add(k));comparisonSource=c.source;comparisonKind=c.kind;}
  const regions=M.marketGroups(c.rows,'city');if(!regions.some(g=>g.sample.region===prefs.region))prefs.region=regions[0]?.sample.region||'';
  const data=all.filter(r=>r.region===prefs.region),regionLabel=prefs.region||'선택 지역',scoped=c.rows.filter(r=>r.region===prefs.region);
  panel.replaceChildren();panel.dataset.view='districts';
  const toolbar=node('div');toolbar.className='market-controls';panel.append(toolbar);
  const add=(id,label,items)=>{const w=ctrl(id,label,items),s=w.lastChild;s.value=prefs[id];s.onchange=()=>{prefs[id]=s.value;render();};toolbar.append(w);};
  add('region','시군구',regions.map(g=>[g.sample.region,g.label]));
  const typeChoices=node('div');typeChoices.className='market-type-choices';typeChoices.setAttribute('role','group');typeChoices.setAttribute('aria-label','종합 분석 타입');
  typeChoices.append(node('strong',c.kind==='오피스텔'?'전용면적':'타입'));
  for(const k of profile.bands){
   const label=node('label'),check=node('input');check.type='checkbox';check.name='marketType';check.id='market-type-'+String(k).replace(/[^a-zA-Z0-9_-]+/g,'-');check.checked=selectedTypes.has(k);
   check.onchange=()=>{if(check.checked)selectedTypes.add(k);else selectedTypes.delete(k);render();$('#'+check.id)?.focus();};
   label.append(check,node('span',profile.label(k)));typeChoices.append(label);
  }
  const toggleTypes=button(selectedTypes.size===profile.bands.length?'전체 해제':'전체 선택',()=>{if(selectedTypes.size===profile.bands.length)selectedTypes.clear();else profile.bands.forEach(k=>selectedTypes.add(k));render();$('#market-types-toggle')?.focus();});toggleTypes.id='market-types-toggle';typeChoices.append(toggleTypes);toolbar.append(typeChoices);
  const body=node('article');body.className='market-content';panel.append(body);
  const comparisonTypes=profile.bands.filter(k=>selectedTypes.has(k));
  const selected=data.filter(r=>comparisonTypes.some(k=>profile.matches(r,k)));
  const dongGroups=M.marketGroups(selected,'dong');
  const range=B.sourceDateRange(c.source,c.raw),from=c.filters.from||range.from,to=c.filters.to||range.to;
  const coverage=c.coverage;
  const history=rows=>M.marketPeriods(rows,prefs.frequency,from,to,coverage,metricKeys);
  const basis=regionLabel+' · 업로드 자료 기준 · '+(from||'—')+' ~ '+(to||'—')+' · '+scoped.length+'건 중 '+data.length+'건 포함';
  const policy=c.mode==='rent'?'실제 계약금액 기준 · 현재 지역·계약 구분·면적·기간 필터 및 수동 제외 반영':'직거래 '+(c.policy.direct?'포함':'제외')+' · 타지역 중개사 '+(c.policy.outside?'포함':'제외')+' · 현재 지역·타입·기간 필터 및 수동 제외 반영';
  const clipboardGrid=t=>{const rows=Array.from(t.rows,()=>[]);[...t.rows].forEach((row,i)=>{let j=0;for(const cell of row.cells){while(rows[i][j]!==undefined)j++;for(let y=0;y<cell.rowSpan&&i+y<rows.length;y++)for(let x=0;x<cell.colSpan;x++)rows[i+y][j+x]=y||x?'':cell.textContent;j+=cell.colSpan;}});return rows;};
  const copyTable=t=>{const clone=t.cloneNode(true);for(const b of clone.querySelectorAll('button'))b.replaceWith(b.textContent);for(const td of clone.querySelectorAll('th,td'))td.style.cssText='border:1px solid #cdd6e0;padding:5px'+(td.classList.contains('numeric')?';text-align:right':'');return copy({text:clipboardGrid(clone).map(row=>row.join('\t')).join('\n'),html:clone.outerHTML});};
  const showTable=(root,head,rows)=>{const t=table(root,head,rows);root.append(button('표 복사',()=>copyTable(t)));return t;};
  {
   body.append(node('h2','종합 분석(시장 현황)'),node('p',basis),node('small',policy),node('p','단위: '+metrics.map(([,title])=>metricParts(title).join(' ')).join(' · ')));
   if(c.mode==='rent'&&c.lease==='월세')body.append(node('p','실제 보증금·월세는 원계약 기준입니다. 환산 월세는 '+(c.targetDeposit==null?'기준 보증금을 입력하고 전환율이 확인된 거래만 계산합니다.':'기준 보증금 '+fmt(c.targetDeposit)+'만 원으로 환산 가능한 거래만 집계합니다.')));
   if(!comparisonTypes.length){body.append(node('p','표시할 타입을 하나 이상 선택하세요.'));return;}
   reportMatrix(body,data,regionLabel,comparisonTypes,showTable,profile,metrics);
   body.append(node('h3','법정동별 비교'));
   const graphics=node('div');graphics.className='dong-graphics';body.append(graphics);
   for(const k of comparisonTypes){
    const entries=groupStats(data,regionLabel).map(g=>({period:g.label,...M.marketStats(g.rows.filter(r=>profile.matches(r,k)),metricKeys)}));
    if(!entries[0].count)continue;
    const card=node('section');card.className='dong-graphic';
    card.append(node('h4',regionLabel+' · '+profile.label(k)));
    dualBars(card,entries,cardMetrics,metrics);
    const columns=metrics.filter(([key])=>cardMetrics.some(([k])=>k===key));
    showTable(card,['구분',...columns.map(([,title])=>title)],entries.map(r=>[r.period,...columns.map(([key])=>formatMetric(key,r[key]))])).classList.add('market-card-prices');
    graphics.append(card);
   }
   if(!graphics.children.length)graphics.append(node('p','선택한 타입의 거래가 없습니다.'));
   const groups=dongGroups;
   const heading=node('div');heading.className='market-trend-heading';heading.append(node('h2','기간별 가격 추이'));
   for(const [setting,label,options] of [['frequency','기간 단위',[['month','월별'],['quarter','분기별']]],['metric','가격 지표',[...cardMetrics,...metrics.filter(([key])=>!cardMetrics.some(([k])=>k===key))].map(([key,title])=>[key,metricParts(title)[0]])]]){
    const segments=node('div');segments.className='market-segments';segments.setAttribute('role','group');segments.setAttribute('aria-label',label);
    for(const [key,text] of options){const id='trend-'+setting+'-'+key,b=button(text,()=>{prefs[setting]=key;render();$('#'+id)?.focus();});b.id=id;b.setAttribute('aria-pressed',String(prefs[setting]===key));segments.append(b);}
    heading.append(segments);
   }
   body.append(heading,node('p','* 마지막 월·분기의 증감률은 조회가 불완전한 기간이 포함되면 현재까지 확인된 거래를 기준으로 표시합니다.'),node('p',basis+' · '+(comparisonTypes.length===profile.bands.length?(c.kind==='오피스텔'?'전용면적 전체':'대표 타입 전체'):comparisonTypes.map(k=>profile.label(k)).join(' · '))));
   const selectionRow=node('div');selectionRow.className='market-dong-selection';body.append(selectionRow);
   const chooser=node('div');chooser.className='market-controls market-target-list';selectionRow.append(chooser);
   {const toggles=node('div');toggles.className='market-controls market-dong-actions';toggles.append(button('전체 선택',()=>{groups.forEach(g=>unselectedDongs.delete(g.key));render();}),button('전체 해제',()=>{groups.forEach(g=>unselectedDongs.add(g.key));render();}));selectionRow.append(toggles);} for(const g of groups){const l=node('label',g.label+' '),box=node('input');box.type='checkbox';box.checked=!unselectedDongs.has(g.key);box.onchange=()=>{box.checked?unselectedDongs.delete(g.key):unselectedDongs.add(g.key);render();};l.append(box);chooser.append(l);}
   const series=comparisonTypes.flatMap(k=>{const label=profile.label(k),forType=rows=>history(rows.filter(r=>profile.matches(r,k)));return [{label:regionLabel,type:label,rows:forType(data)},...groups.filter(g=>!unselectedDongs.has(g.key)).map(g=>({label:g.label,type:label,rows:forType(g.rows)}))];});
   if(!series.some(s=>s.rows.some(r=>r.count>0)))body.append(node('p','선택 조건에 해당하는 기간별 거래가 없습니다.'));
   const trendCards=node('div');trendCards.className='dong-graphics market-trend-grid';body.append(trendCards);
   for(const k of comparisonTypes){
    const label=profile.label(k),subset=series.filter(s=>s.type===label&&s.rows.some(r=>r.count>0));
    if(!subset.length)continue;
    const card=node('section');card.className='dong-graphic market-trend-card';trendCards.append(card);
    card.append(node('h3',regionLabel+' · '+label));
    const [key,title]=metrics.find(([key])=>key===prefs.metric);
    chart(card,title,subset,key,metrics);
    trendMatrix(card,subset,key,title+' · 기간별 집계',showTable);
   }
  }
 }
 return {render};
}





