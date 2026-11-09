(function (global) {
  'use strict';

  const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const COLORS = ['#b99248','#577c85','#a6bfb4','#c1a979','#9cabb6','#928d72'];
  const LABELS = {delivery:'日度交割',market:'成交与持仓',efp:'EFP 与交易',options:'金银期权',monthly:'月度与年度',stocks:'仓库库存'};
  const FAMILY = {delivery:'Daily I&S',section62:'期货 PG62',section64:'期权 PG64',monthly:'月度 MTD',mtd:'月度 MTD',ytd:'年度 YTD',gold_stocks:'黄金库存',silver_stocks:'白银库存',stocks:'库存',gold_stock:'黄金库存',silver_stock:'白银库存'};
  const CATEGORIES = {registered:'注册库存',eligible:'合格库存',pledged:'质押库存',combined:'总库存'};
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const reportValue = (row,key) => row && (!row.status || row.status==='ok') && finite(row[key]) ? row[key] : null;
  const sum = rows => rows.length && rows.every(finite) ? rows.reduce((a,b) => a+b,0) : null;
  const fmt = (value,digits=0) => finite(value) ? value.toLocaleString('zh-CN',{maximumFractionDigits:digits}) : '—';
  const compact = value => !finite(value) ? '—' : Math.abs(value)>=1e8 ? (value/1e8).toFixed(1)+'亿' : Math.abs(value)>=1e4 ? (value/1e4).toFixed(Math.abs(value)>=1e6?0:1)+'万' : fmt(value,Math.abs(value)<1?1:0);
  const esc = value => String(value ?? '').replace(/[&<>"']/g,char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const dateLabel = value => value ? String(value).slice(0,10) : '未提供';
  const unique = rows => [...new Set(rows.filter(Boolean))];
  const last = rows => rows[rows.length-1];
  const utc = value => Date.parse(String(value).slice(0,10)+'T00:00:00Z');

  // Display translations identify the report's brand, not a Chinese legal subsidiary.
  const MEMBER_NAMES = [
    ['ABN AMRO','荷兰银行'],['ADM','ADM 投资服务'],['ADVANTAGE','Advantage 期货'],
    ['BARCLAYS','巴克莱'],['BMO CAPITAL','蒙特利尔银行资本市场'],['BNP PARIBAS','法国巴黎银行证券'],
    ['BOFA SECURITIES','美国银行证券'],['CITADEL','城堡证券'],['CITIGROUP','花旗集团'],
    ['CLEAR STREET','Clear Street 清算'],['CME','芝商所'],['DB AG','德意志银行'],['DEUTSCHE BANK','德意志银行'],
    ['DORMAN','多曼交易'],['GOLDMAN','高盛'],['HSBC','汇丰'],['INTERACTIVE BRO','盈透证券'],
    ['IRONBEAM','Ironbeam 期货'],['JP MORGAN','摩根大通证券'],['MACQUARIE','麦格理期货'],
    ['MAREX','Marex 金融'],['MIZUHO','瑞穗证券'],['MORGAN STANLEY','摩根士丹利'],
    ['NANHUA','南华美国'],['PHILLIP','辉立资本'],['PLUS500','Plus500 美国金融'],
    ['PTG DIVISION OF SGAS','法兴美国证券 PTG 部门'],['RBC CAP','加拿大皇家银行资本市场'],
    ['RJ OBRIEN','瑞杰欧布莱恩'],['SCOTIA','丰业资本'],['SG AMERICAS','法国兴业美国证券'],
    ['STANDARD CHARTE','渣打银行'],['STONEX','StoneX 金融'],['STRAITS','时瑞金融'],
    ['UBS','瑞银证券'],['WEDBUSH','韦德布什证券'],['WELLS FARGO','富国银行证券']
  ];
  const memberName = name => MEMBER_NAMES.find(([prefix])=>String(name||'').startsWith(prefix))?.[1] || name || '未提供名称';
  const memberLabel = row => `${memberName(row.name)}（${row.org==='H'?'H 自营':row.org==='C'?'C 客户':row.org || '类别未提供'}）`;
  function rankMembers(firms,key) {
    return firms.slice().sort((a,b)=>(finite(b[key])?b[key]:-Infinity)-(finite(a[key])?a[key]:-Infinity) || String(a.id||'').localeCompare(String(b.id||'')) || String(a.org||'').localeCompare(String(b.org||'')) || String(a.name||'').localeCompare(String(b.name||'')));
  }
  function memberRankings(contract) {
    return `<div class="member-rankings">${[['issued','Issued 发出',COLORS[0]],['stopped','Stopped 接收',COLORS[1]]].map(([key,label,color])=>{
      const firms=rankMembers(contract.firms||[],key);
      const max=Math.max(1,...firms.map(row=>finite(row[key])?row[key]:0));
      const rows=items=>items.map(row=>`<li class="member-ranked-row"><details class="member-identity"><summary>${esc(memberLabel(row))}</summary><small>原报告：${esc(row.name)} · 会员 ${esc(row.id)}</small></details><div class="member-ranked-value"><span class="member-ranked-track"><i style="background:${color};width:${finite(row[key])?100*row[key]/max:0}%"></i></span><span>${fmt(row[key])}</span></div></li>`).join('');
      return `<section class="member-ranking" aria-label="${label}排名"><h3 style="color:${color}">${label}<small>通知量降序 · 手 · 共 ${firms.length} 项</small></h3><ol>${rows(firms.slice(0,6))}</ol>${firms.length>6?`<details class="member-more"><summary><span class="member-expand">展开全部 ${firms.length} 项 ▾</span><span class="member-collapse">收起至前 6 项 ▴</span></summary><ol start="7">${rows(firms.slice(6))}</ol></details>`:firms.length?`<p class="member-complete">已显示全部 ${firms.length} 项</p>`:''}${firms.length?'':'<p class="chart-empty">报告未列示会员</p>'}</section>`;
    }).join('')}</div>`;
  }

  function monthISO(value) {
    if (!value) return null;
    if (/^\d{4}-\d{2}$/.test(value)) return value;
    const match = String(value).toUpperCase().replace(/\s/g,'').match(/^([A-Z]{3})(\d{2}|\d{4})$/);
    if (!match || !MONTHS.includes(match[1])) return null;
    return `${match[2].length===2?'20'+match[2]:match[2]}-${String(MONTHS.indexOf(match[1])+1).padStart(2,'0')}`;
  }
  function latestSnapshot(rows, cutoff, group = row => `${row.product}|${row.contract_month}`) {
    const dates = new Map();
    rows.forEach(row => {
      if (!row.business_date || row.business_date > cutoff) return;
      const key = group(row);
      if (!dates.has(key) || dates.get(key) < row.business_date) dates.set(key,row.business_date);
    });
    return rows.filter(row => dates.get(group(row)) === row.business_date && row.business_date <= cutoff);
  }
  function inventoryTotals(rows, category) {
    const selected = rows.filter(row => row.category === category);
    const totalRows = selected.filter(row => row.is_total || /^(TOTAL|COMEX TOTAL|TOTAL COMEX|GRAND TOTAL)$/i.test(row.warehouse || ''));
    const pool = totalRows.length ? [totalRows[0]] : selected;
    if (!pool.length) return {value:null,sourceIds:[],rows:[]};
    return {value:sum(pool.map(row => reportValue(row,'today'))),sourceIds:unique(pool.map(row => row.source_id)),rows:pool};
  }
  function metric(day, product, month, field) {
    const metal = product === 'GC' ? 'gold' : 'silver';
    const delivery = (day.delivery_records || []).filter(row => row.product === product && (month === 'all' || row.contract_month === month));
    let value=null, sourceId=null, reason='资料未列示';
    if (field === 'notices') {
      value=sum(delivery.map(row => reportValue(row,'total_issued')));
      sourceId=day.sources?.delivery?.source_id;
      reason=day.delivery?.[metal]?.status || '未列示该合约';
    } else if (['volume','oi','oi_change','settle'].includes(field)) {
      const productData=day.futures?.[product];
      const contract=productData?.contracts?.find(row => monthISO(row.month)===month);
      const keys={volume:'total_volume',oi:'total_oi',oi_change:'total_oi_change'};
      if (productData?.status==='ok' || !productData?.status) {
        if (month==='all') value=productData?.total?.[keys[field]] ?? null;
        else value=contract?.[{volume:'volume',oi:'open_interest',oi_change:'oi_change',settle:'settle'}[field]] ?? null;
      }
      sourceId=day.sources?.section62?.source_id;
      reason=productData?.status || '无期货报告';
    } else {
      const efp=day.efp?.[metal];
      const record=month==='all'?efp:efp?.by_month?.find(row=>monthISO(row.month)===month);
      value=efp?.status && efp.status!=='ok' ? null : record?.[field] ?? null;
      sourceId=day.sources?.section62?.source_id;
      reason=efp?.status || '无期货报告';
    }
    return {date:day.business_date,value:finite(value)?value:null,sourceIds:unique([sourceId,...(field==='notices'?delivery.map(row=>row.source_id):[])]),reason};
  }
  function observedChanges(points) {
    let previous=null;
    return points.map(point=>{
      if (!finite(point.value)) return {...point,value:null,previousDate:null};
      const result={...point,value:previous?point.value-previous.value:null,previousDate:previous?.date || null,sourceIds:unique([...point.sourceIds,...(previous?.sourceIds || [])])};
      previous=point;
      return result;
    });
  }
  function optionRows(day, product, month) {
    const code={GC:'OG',SI:'SO'}[product];
    return (day.options || []).filter(row=>code && row.product===product && row.option_product===code && ['CALL','PUT'].includes(row.option_type) && /^\d{4}-\d{2}$/.test(row.contract_month || '') && (month==='all'||row.contract_month===month));
  }
  function optionMetric(day, product, month, field, direction) {
    const rows=optionRows(day,product,month).filter(row=>row.option_type===direction);
    const duplicate=unique(rows.map(row=>row.contract_month)).length!==rows.length;
    const validSource=!day.sources?.section64?.status || day.sources.section64.status==='ok';
    return {date:day.business_date,value:duplicate||!validSource?null:sum(rows.map(row=>reportValue(row,field))),sourceIds:unique([day.sources?.section64?.source_id,...rows.map(row=>row.source_id)]),reason:!validSource?'PG64报告校验未通过':duplicate?'合约月方向记录重复':rows.length?'已列示标准月度合约':'未列示该合约方向'};
  }
  function optionRatio(day, product, month, field) {
    const call=optionMetric(day,product,month,field,'CALL');
    const put=optionMetric(day,product,month,field,'PUT');
    const rows=optionRows(day,product,month);
    const sameMonths=rows.filter(row=>row.option_type==='CALL').map(row=>row.contract_month).sort().join(',')===rows.filter(row=>row.option_type==='PUT').map(row=>row.contract_month).sort().join(',');
    return {date:day.business_date,value:sameMonths&&finite(call.value)&&call.value>0&&finite(put.value)?put.value/call.value:null,sourceIds:unique([...call.sourceIds,...put.sourceIds])};
  }
  const SERIES_START='2026-10-19';
  const shiftDay=(day,count)=>new Date(utc(day)+count*86400000).toISOString().slice(0,10);
  function businessDay(day,calendar={}) {
    if(Object.prototype.hasOwnProperty.call(calendar.trade_date_overrides || {},day))return calendar.trade_date_overrides[day];
    if((calendar.metal_non_business_dates || []).includes(day))return false;
    if(!(calendar.verified_years || []).includes(Number(day.slice(0,4))))return null;
    return ![0,6].includes(new Date(utc(day)).getUTCDay());
  }
  function businessDates(start,end,calendar={}) {
    const dates=[];let verified=true;
    if(!start || !end || start>end)return {dates,verified};
    for(let day=start;day<=end;day=shiftDay(day,1)) {
      const trading=businessDay(day,calendar);
      if(trading===null)verified=false;
      if(trading)dates.push(day);
    }
    return {dates,verified};
  }
  function consecutiveBusinessDates(previous,current,calendar) {
    if(current<=previous)return false;
    const span=businessDates(shiftDay(previous,1),current,calendar);
    return span.verified && span.dates.length===1 && span.dates[0]===current;
  }
  function monthsBefore(day,count) {
    const value=new Date(utc(day));const d=value.getUTCDate();
    value.setUTCDate(1);value.setUTCMonth(value.getUTCMonth()-count);
    const limit=new Date(Date.UTC(value.getUTCFullYear(),value.getUTCMonth()+1,0)).getUTCDate();
    value.setUTCDate(Math.min(d,limit));return value.toISOString().slice(0,10);
  }
  function selectRange(range,end,floor,calendar={}) {
    let requested=floor,verified=true;
    if(range==='5d') {
      let day=end,count=0;
      while(count<5 && day>=floor) {
        const trading=businessDay(day,calendar);
        if(trading===null){verified=false;break;}
        if(trading)count++;
        requested=day;day=shiftDay(day,-1);
      }
    } else if(/^\d+m$/.test(range))requested=monthsBefore(end,Number(range.slice(0,-1)));
    return {start:requested<floor?floor:requested,end,requested,verified};
  }
  function parseSelection(hash) {
    const raw=String(hash || '').replace(/^#/,'');
    if(LABELS[raw])return {view:raw};
    const params=new URLSearchParams(raw),result={};
    if(LABELS[params.get('view')])result.view=params.get('view');
    if(['GC','SI'].includes(params.get('product')))result.product=params.get('product');
    if(['live','history'].includes(params.get('mode')))result.mode=params.get('mode');
    if(['5d','1m','3m','6m','12m','all'].includes(params.get('range')))result.range=params.get('range');
    for(const key of ['start','end','focusDate']){const v=params.get(key);if(/^\d{4}-\d{2}-\d{2}$/.test(v || '') && Number.isFinite(utc(v)) && new Date(utc(v)).toISOString().slice(0,10)===v)result[key]=v;}
    if(result.start && result.end && !result.range)result.range=null;
    if(/^(all|\d{4}-(0[1-9]|1[0-2]))$/.test(params.get('month') || ''))result.month=params.get('month');
    if(Object.hasOwn(CATEGORIES,params.get('category')))result.category=params.get('category');
    if(/^\d{4}$/.test(params.get('year') || ''))result.year=params.get('year');
    return result;
  }
  function selectionHash(selection) {
    const params=new URLSearchParams();
    for(const key of ['view','product','mode','range','start','end','month','category','year','focusDate'])if(selection[key])params.set(key,selection[key]);
    return '#'+params.toString();
  }
  function completeTotal(points,start,end,calendar) {
    const expected=businessDates(start,end,calendar);
    if(!expected.verified || !expected.dates.length)return null;
    return sum(expected.dates.map(day=>points.find(row=>row.date===day)?.value));
  }
  // Shared pure selectors are exported for offline fixture tests without a browser.
  const selectors={monthISO,latestSnapshot,inventoryTotals,metric,observedChanges,optionRows,optionMetric,optionRatio,sum,reportValue,businessDay,businessDates,consecutiveBusinessDates,monthsBefore,selectRange,parseSelection,selectionHash,completeTotal,memberName,memberLabel,rankMembers,memberRankings};
  if (typeof module!=='undefined' && module.exports) module.exports=selectors;
  global.ComexDashboard=selectors;
  if (typeof document==='undefined') return;

  const state={data:null,product:'GC',view:'delivery',month:'all',start:'',end:'',range:'5d',mode:'live',category:'registered',year:null,memberMonth:null,sources:new Map(),readAt:null,focusDate:null,hiddenSeries:new Set(),manifest:null,loadedMonths:new Set()};
  const publicMode=document.querySelector?.('meta[name="comex-mode"]')?.content==='public';
  const assetVersion=document.currentScript?.dataset.version;
  const chartRecords=new Map();
  let dataRequest=0;
  let sourceRequest=0;
  let lastFocus=null;
  const $=id=>document.getElementById(id);
  const body=$('content');
  const calendar=()=>state.manifest?.calendar || state.data?.calendar || {};
  const getDays=()=> {
    const rows=(state.data?.daily || []).filter(day=>day.business_date>=state.start && day.business_date<=state.end);
    const dates=unique([...rows.map(row=>row.business_date),...businessDates(state.start,state.end,calendar()).dates]).sort();
    return dates.map(day=>rows.find(row=>row.business_date===day) || {business_date:day,missing:true});
  };
  const getSeries=field=>getDays().map(day=>metric(day,state.product,state.month,field));
  const metalName=()=>state.product==='GC'?'黄金':'白银';
  const contractName=()=>state.month==='all'?'全部合约月':`${state.month} 合约`;
  const baseUnit=()=>state.product==='GC'?'100 金衡盎司 / 手':'5,000 金衡盎司 / 手';
  const valid=rows=>rows.filter(row=>finite(row.value));
  const maxDate=rows=>rows.map(row=>row.business_date || row.report_date || '').sort().pop() || null;
  const dateInRange=date=>date && date>=state.start && date<=state.end;

  function sourceButton(ids,label='原报告',context='') {
    const sourceIds=unique(Array.isArray(ids)?ids:[ids]);
    return sourceIds.length ? `<button class="source-mini" data-sources="${esc(sourceIds.join(','))}" data-context="${esc(context)}">${esc(label)} ↗</button>` : '<span class="no-source">无来源</span>';
  }
  function sourceVersion(id) {
    const version=state.sources.get(id)?.version;
    return version==='PRELIMINARY'?'<span class="status-pill preliminary">初步版</span>':version==='FINAL'?'<span class="status-pill">最终版</span>':'';
  }
  function panel(title,subtitle,content,extra='',className='') {
    return `<section class="panel ${className}"><div class="panel-header"><div><h3>${title}</h3>${subtitle?`<p class="panel-subtitle">${subtitle}</p>`:''}</div>${extra}</div>${content}</section>`;
  }
  function chartShell(id,title,subtitle,legend=[],extra='',footer='点击图中数据可查看数值与原始报告。',className='') {
    return panel(title,subtitle,`${legend.length?`<div class="chart-legend">${legend.map((item,i)=>`<span class="legend-item"><i class="legend-swatch" style="background:${esc(item.color || COLORS[i])}"></i>${esc(item.label)}</span>`).join('')}</div>`:''}<div id="${id}" class="chart-body"></div><div class="chart-footer"><span class="chart-note">${footer}</span><span>手</span></div>`,extra,className);
  }
  function disclosure(title,headers,rows,note='') {
    return `<details class="table-disclosure"><summary>${title}<span>${rows.length} 条记录 · 展开查看</span></summary>${note?`<p class="context-note" style="padding:12px 22px 0;margin-bottom:0">${note}</p>`:''}<div class="table-wrap"><table class="data-table"><thead><tr>${headers.map((h,i)=>`<th${i?' class="number"':''}>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td colspan="${headers.length}">所选范围没有记录</td></tr>`}</tbody></table></div></details>`;
  }
  function metricCard(label,point,unit='手',primary=false,field='',note='',comparisonSeries=null) {
    let delta='',comparisonDate='';
    if (finite(point?.value) && (field || comparisonSeries)) {
      const points=valid(comparisonSeries || getSeries(field));
      const previous=points.filter(row=>row.date<point.date).pop();
      if (previous) {
        comparisonDate=previous.date;
        const change=point.value-previous.value;
        const percent=previous.value===0?'':` (${change>=0?'+':''}${(100*change/previous.value).toFixed(1)}%)`;
        delta=`<span class="delta${change<0?' negative':''}" title="相较上次有效记录 ${previous.date}">${change>0?'+':''}${fmt(change)}${percent}</span>`;
      }
    }
    return `<article class="metric${primary?' primary':''}${unit==='金衡盎司'?' inventory-metric':''}"><div class="metric-label">${esc(label)}<span class="metric-code">${esc(state.product)}</span></div><div class="metric-value">${unit==='年'&&finite(point?.value)?String(point.value):fmt(point?.value,unit==='金衡盎司'?3:0)}<small>${unit}</small></div><div class="metric-bottom"><span>${point?esc(point.date):'所选范围无有效记录'}${note?' · '+esc(note):''}</span>${point?sourceButton(point.sourceIds,'来源',`${label} · ${point.date} · ${fmt(point.value,unit==='金衡盎司'?3:0)} ${unit}`):''}</div>${delta?`<div class="metric-bottom" style="margin-top:4px">${delta}<span>较 ${comparisonDate}</span></div>`:''}</article>`;
  }
  function latestMetric(field){return state.focusDate?getSeries(field).find(row=>row.date===state.focusDate):last(valid(getSeries(field)));}
  function heading(title,caption='') {
    return `<div class="section-heading"><h2>${title}</h2><p>${caption || `${metalName()} ${state.product} · ${contractName()}`}</p></div>`;
  }
  function render() {
    if (!state.data) return;
    $('range-error').hidden=!(state.start && state.end && state.start>state.end);
    if (!$('range-error').hidden) {body.innerHTML='<div class="empty-state"><h3>请调整日期范围</h3><p>开始日期需要早于或等于结束日期。</p></div>';return;}
    document.querySelectorAll('[data-view]').forEach(button=>{button.classList.toggle('active',button.dataset.view===state.view);if(button.dataset.view===state.view)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
    $('breadcrumb-view').textContent=LABELS[state.view];
    document.querySelectorAll('[data-product]').forEach(button=>{button.classList.toggle('selected',button.dataset.product===state.product);button.setAttribute('aria-pressed',String(button.dataset.product===state.product));});
    if(state.focusDate && !dateInRange(state.focusDate))state.focusDate=null;
    if($('contract-month'))$('contract-month').disabled=state.view==='stocks';
    document.querySelectorAll('[data-range]').forEach(button=>button.classList.toggle('selected',button.dataset.range===state.range));
    document.querySelectorAll('[data-mode]').forEach(button=>{button.classList.toggle('selected',button.dataset.mode===state.mode);button.setAttribute('aria-pressed',String(button.dataset.mode===state.mode));});
    chartRecords.clear();
    renderStatus();
    ({delivery:renderDelivery,market:renderMarket,efp:renderEfp,options:renderOptions,monthly:renderMonthly,stocks:renderStocks}[state.view])();
    renderSelection();
    renderPointDetails();
    if(global.history?.replaceState)global.history.replaceState(null,'',selectionHash(state));
  }

  function available(day) {
      if(state.view==='stocks')return finite(inventoryTotals((state.data.stocks || []).filter(row=>row.product===state.product && row.report_date===day.business_date),state.category).value);
      if(state.view==='monthly')return ['monthly','ytd'].every(group=>(state.data[group] || []).some(row=>row.product===state.product && row.business_date===day.business_date && (!row.status || row.status==='ok')));
      if(state.view==='options')return ['CALL','PUT'].every(direction=>['volume','open_interest'].every(field=>finite(optionMetric(day,state.product,state.month,field,direction).value)));
      return (state.view==='market'?['volume','oi']:state.view==='efp'?['efp_daily','efr_daily','blocks_daily','tas_daily']:['notices']).every(field=>finite(metric(day,state.product,state.month,field).value));
    }

  function renderStatus() {
    const dates=allDates(),latest=state.manifest?.business_date || state.data.pipeline?.business_date || last(dates);
    const dateTime=value=>value?new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Hong_Kong',hour12:false}):'未提供';
    $('collection-status').innerHTML=`<span class="family-date">数据业务日期 <strong>${esc(latest || '—')}</strong></span><span>网站版本生成 ${esc(dateTime(state.manifest?.published_at || state.data.generated_at))} 香港时间</span><span>本次读取 ${esc(dateTime(state.readAt))}</span><button data-show-collection>更新详情 ↗</button>`;
    const expected=businessDates(state.start,state.end,calendar()),days=getDays();
    const count=expected.dates.filter(date=>available(days.find(day=>day.business_date===date) || {business_date:date})).length;
    const errors=(state.data.issues || []).filter(row=>(!row.product||row.product===state.product) && (!row.business_date||dateInRange(row.business_date)) && row.severity==='error').length;
    const preliminary=['monthly','stocks'].includes(state.view)?0:days.filter(day=>day.sources?.[state.view==='options'?'section64':'section62']?.version==='PRELIMINARY').length;
    const messages=[state.mode==='live'?`正式积累自 ${SERIES_START}`:'历史样本 · 日期不连续'];
    if(expected.verified)messages.push(`本板块覆盖 ${count}/${expected.dates.length} 个业务日`);
    else messages.push('部分年份交易日历尚未核准，不宣称完整覆盖');
    if(state.range==='5d' && expected.dates.length<5)messages.push(`尚未积累满五个交易日，当前窗口 ${expected.dates.length} 日`);
    if(state.requestedStart && state.requestedStart<state.start)messages.push(`所选周期从 ${state.requestedStart} 起，实际积累从 ${state.start} 起`);
    if (preliminary) messages.push(`${preliminary} 份${state.view==='options'?'期权':'期货'}记录为初步版`);
    const observedMissing=days.filter(day=>!day.missing && !available(day)).length;
    if(observedMissing)messages.push(`${observedMissing} 个已存日期存在资料或所选合约缺项`);
    if (errors) messages.push(`${errors} 项待核查错误`);
    const currentDates=state.view==='stocks'?(state.data.stocks||[]).filter(row=>row.product===state.product && dateInRange(row.report_date)).map(row=>row.report_date):state.view==='monthly'?(state.data.monthly||[]).filter(row=>row.product===state.product && dateInRange(row.business_date)).map(row=>row.business_date):days.filter(available).map(row=>row.business_date);
    messages.push(`本板块最新有效日期 ${last(currentDates.sort()) || '—'}`);
    $('quality-banner').innerHTML=`<span><i class="info-mark">i</i>${messages.map(esc).join('；')}。缺失值留空。</span><button data-show-quality>质量与口径 ↗</button>`;
    $('rail-count').textContent=`${state.manifest?.source_count || (state.data.sources||[]).length} 份来源记录`;
  }

  function renderSelection() {
    const target=$('selection-status');if(!target)return;
    const field=state.view==='delivery'?'notices':state.view==='market'?'volume':state.view==='efp'?'efp_daily':null;
    const total=field?completeTotal(getSeries(field),state.start,state.end,calendar()):null;
    target.innerHTML=`<span>${esc(state.start)} 至 ${esc(state.end)}${field?` · 区间${({notices:'通知',volume:'成交',efp_daily:'EFP'})[field]}合计 ${finite(total)?fmt(total)+' 手':'—（覆盖不足）'}`:''}</span>${state.focusDate?`<strong>已选 ${esc(state.focusDate)}</strong><button data-clear-focus>返回最新</button>`:'<span>点击图中日期，联动指标与明细</span>'}`;
  }

  function renderDelivery() {
    const notices=latestMetric('notices');
    const volume=latestMetric('volume');
    const oi=latestMetric('oi');
    const efp=latestMetric('efp_daily');
    const noticeSeries=getSeries('notices');
    const latestDay=notices?getDays().find(day=>day.business_date===notices.date):null;
    const contracts=(latestDay?.delivery_records || []).filter(row=>row.product===state.product && (state.month==='all'||row.contract_month===state.month));
    const selectedContract=contracts.find(row=>row.contract_month===state.memberMonth) || contracts[0];
    state.memberMonth=selectedContract?.contract_month;
    const contractRows=contracts.map(row=>`<tr><td class="name"><button class="contract-link" data-contract="${esc(row.contract_month)}">${esc(row.contract_month)}</button></td><td class="number">${fmt(row.total_issued)}</td><td class="number">${fmt(row.month_to_date)}</td><td class="number">${fmt(row.settlement,3)}</td><td class="number">${sourceButton(row.source_id)}</td></tr>`);
    const memberToolbar=contracts.length>1?`<div class="panel-toolbar"><label for="member-contract">合约</label><select id="member-contract">${contracts.map(row=>`<option value="${row.contract_month}"${row.contract_month===state.memberMonth?' selected':''}>${row.contract_month}</option>`).join('')}</select></div>`:'';
    body.innerHTML=heading('日度交割概览')+`<div class="metric-grid">${metricCard('当日交割通知',notices,'手',true,'notices')}${metricCard('成交量',volume,'手',false,'volume')}${metricCard('持仓量',oi,'手',false,'oi')}${metricCard('EFP 成交',efp,'手',false,'efp_daily')}</div>`+
      chartShell('notices-chart','每日交割通知量','Daily Issues & Stops · 依正文业务日期排列',[{label:`${metalName()} ${state.product} 标准合约`,color:state.product==='GC'?COLORS[0]:COLORS[1]}],'<span class="panel-meta">'+baseUnit()+'</span>','Issued 与 Stopped 为同一次通知的两侧，只计一侧。缺少报告时留空。','full')+
      `<div class="dashboard-grid">${panel('交割合约月份',notices?`${notices.date} · 月累计分别保留，不跨月相加`:'所选范围内没有交割通知',`<div class="table-wrap"><table class="data-table"><thead><tr><th>合约月份</th><th class="number">当日通知 / 手</th><th class="number">月累计 / 手</th><th class="number">结算 / 美元每盎司</th><th class="number">来源</th></tr></thead><tbody>${contractRows.join('') || '<tr><td colspan="5">没有可用记录</td></tr>'}</tbody></table></div><p class="context-note" style="padding:0 22px 16px;margin:0">意向日 ${esc(selectedContract?.intent_date || '—')} <span style="margin:0 9px">·</span> 交割日 ${esc(selectedContract?.delivery_date || '—')}<br>标准合约与微型产品分别统计。</p>`)}${panel('清算会员 · 发出与接收',selectedContract?`${selectedContract.contract_month} 合约 · ${notices.date}`:'没有会员明细',`<div id="member-chart"></div><div class="chart-footer"><span>两侧默认各显示最多 6 项；超过时可展开全部。点击名称核对英文与会员编号。</span>${selectedContract?sourceButton(selectedContract.source_id):''}</div>`,memberToolbar)}</div>`+
      disclosure('逐日记录与原报告',['业务日期','通知 / 手','PG62 交割列 / 手','来源'],getDays().slice().reverse().map(day=>{const n=metric(day,state.product,state.month,'notices');const p=metric(day,state.product,state.month,'delivery_daily');return `<tr><td>${day.business_date}</td><td class="number">${fmt(n.value)}</td><td class="number">${fmt(p.value)}</td><td class="number">${sourceButton(unique([...n.sourceIds,...p.sourceIds]))}</td></tr>`;}),'PG62 交割列与 Issues & Stops 分别保存；两者可能对应不同报告定义，不强制对齐。');
    chart('notices-chart',[{label:'交割通知',points:noticeSeries,color:state.product==='GC'?COLORS[0]:COLORS[1],type:'bar'}]);
    renderMembers(selectedContract);
  }

  function renderMembers(contract) {
    const container=$('member-chart');
    if (!contract) {container.innerHTML=emptyChart('所选范围没有会员明细');return;}
    container.innerHTML=memberRankings(contract);
  }

  function renderMarket() {
    const oiSeries=getSeries('oi');
    const changes=observedChanges(oiSeries);
    const currentOi=latestMetric('oi');
    const officialChange=latestMetric('oi_change');
    body.innerHTML=heading('成交与持仓')+`<div class="metric-grid">${metricCard('成交量',latestMetric('volume'),'手',true,'volume')}${metricCard('持仓量',currentOi,'手',false,'oi')}${metricCard('官方持仓变动',officialChange,'手')}${metricCard('两次已存持仓之差',state.focusDate?changes.find(row=>row.date===state.focusDate):last(valid(changes)),'手')}</div>`+
      chartShell('volume-chart','每日成交量','PG62 · Globex 与场内成交之和',[{label:'成交量',color:COLORS[0]}],'<span class="panel-meta">'+baseUnit()+'</span>','以正文业务日期展示；缺少记录时保留空白。','full')+
      `<div class="dashboard-grid">${chartShell('oi-chart','持仓量水平','PG62 官方持仓量',[{label:'持仓量',color:COLORS[1]}],'','按已核准业务日历识别缺口；缺失业务日处分段。')}${chartShell('oi-change-chart','官方持仓变动','独立保留官方报告值',[{label:'官方变动',color:COLORS[0]}],'','不以两次档案中的持仓差替代官方变动。')}</div>`+
      disclosure('持仓比较与逐合约行情',['业务日期','成交 / 手','持仓 / 手','官方变动 / 手','已存持仓差 / 手','上次记录日期','来源'],getDays().slice().reverse().map(day=>{const oi=metric(day,state.product,state.month,'oi');const delta=changes.find(row=>row.date===day.business_date);return `<tr><td>${day.business_date}</td><td class="number">${fmt(metric(day,state.product,state.month,'volume').value)}</td><td class="number">${fmt(oi.value)}</td><td class="number">${fmt(metric(day,state.product,state.month,'oi_change').value)}</td><td class="number">${fmt(delta?.value)}</td><td class="number">${delta?.previousDate||'—'}</td><td class="number">${sourceButton(delta?.sourceIds || oi.sourceIds)}</td></tr>`;}),'两次已存持仓之差可能跨越多个交易日；上次记录日期单独列示。使用上方合约月份筛选，避免把不同月份的结算价串联。');
    chart('volume-chart',[{label:'成交量',points:getSeries('volume'),color:COLORS[0],type:'bar'}]);
    chart('oi-chart',[{label:'持仓量',points:oiSeries,color:COLORS[1],type:'line'}],{height:235});
    chart('oi-change-chart',[{label:'官方持仓变动',points:getSeries('oi_change'),color:COLORS[0],type:'bar'}],{height:235});
  }

  function renderEfp() {
    const efp=getSeries('efp_daily');
    const latest=state.focusDate?efp.find(row=>row.date===state.focusDate):last(valid(efp));
    const current=latest?getDays().find(day=>day.business_date===latest.date):null;
    const activity=[['efp_daily','EFP'],['efr_daily','EFR'],['efs_daily','EFS'],['blocks_daily','Blocks'],['tas_daily','TAS'],['block_tas_daily','Block TAS']].map(([key,label])=>({label,...(current?metric(current,state.product,state.month,key):{value:null,sourceIds:[]})}));
    body.innerHTML=heading('EFP 与交易活动')+`<p class="view-intro">EFP 为 Exchange for Physical，与交割通知、库存出库分别保留。各交易分类可能交叉，不相加作为市场总量。</p><div class="metric-grid">${metricCard('EFP 成交',latest,'手',true,'efp_daily')}${metricCard('EFR 成交',latestMetric('efr_daily'),'手')}${metricCard('大宗交易 Blocks',latestMetric('blocks_daily'),'手')}${metricCard('TAS 成交',latestMetric('tas_daily'),'手')}</div>`+
      chartShell('efp-chart','EFP / EFR / Blocks / TAS 对照','PG62 · 不同于 Issues & Stops 交割通知',[{label:'EFP',color:COLORS[1]}],'<span class="panel-meta">'+contractName()+'</span>','数据反映报告列示的 EFP 成交量，不直接推断净实物需求。','full')+
      `<div class="dashboard-grid">${chartShell('blocks-chart','大宗交易 Blocks','与 EFP 分别列示',[{label:'Blocks',color:COLORS[0]}],'','各指标使用各自的官方列，不相加。')}${panel('最近交易分类',latest?`${latest.date} · ${contractName()}`:'没有可用记录',`<div class="table-wrap"><table class="data-table"><thead><tr><th>报告分类</th><th class="number">成交 / 手</th><th class="number">来源</th></tr></thead><tbody>${activity.map(row=>`<tr><td class="name">${row.label}</td><td class="number">${fmt(row.value)}</td><td class="number">${sourceButton(row.sourceIds)}</td></tr>`).join('')}</tbody></table></div><p class="context-note" style="padding:0 22px 16px;margin:0">EFP、EFR、EFS 与 Blocks、TAS 可能存在分类交叉；这些项目不构成可相加的分类饼图。</p>`)}</div>`+
      disclosure('EFP 与交易逐日明细',['业务日期','EFP / 手','EFR / 手','EFS / 手','Blocks / 手','TAS / 手','来源'],getDays().slice().reverse().map(day=>{const values=['efp_daily','efr_daily','efs_daily','blocks_daily','tas_daily'].map(key=>metric(day,state.product,state.month,key));return `<tr><td>${day.business_date}</td>${values.map(row=>`<td class="number">${fmt(row.value)}</td>`).join('')}<td class="number">${sourceButton(values.flatMap(row=>row.sourceIds))}</td></tr>`;}));
    chart('efp-chart',[['EFP','efp_daily'],['EFR','efr_daily'],['Blocks','blocks_daily'],['TAS','tas_daily']].map(([label,field],i)=>({label,points:getSeries(field),color:COLORS[i],type:'line'})));
    chart('blocks-chart',[{label:'Blocks',points:getSeries('blocks_daily'),color:COLORS[0],type:'bar'}],{height:235});
  }

  function renderOptions() {
    const days=getDays();
    const code=state.product==='GC'?'OG':'SO';
    const series=(field,direction)=>days.map(day=>optionMetric(day,state.product,state.month,field,direction));
    const callVolume=series('volume','CALL'),putVolume=series('volume','PUT');
    const callOi=series('open_interest','CALL'),putOi=series('open_interest','PUT');
    const snapshot=state.focusDate?days.find(day=>day.business_date===state.focusDate):last(days.filter(day=>optionRows(day,state.product,state.month).length));
    const rows=snapshot?optionRows(snapshot,state.product,state.month).slice().sort((a,b)=>a.contract_month.localeCompare(b.contract_month)||a.option_type.localeCompare(b.option_type)):[];
    const ratioRows=days.slice().reverse().map(day=>{const volume=optionRatio(day,state.product,state.month,'volume'),oi=optionRatio(day,state.product,state.month,'open_interest');return `<tr><td>${esc(day.business_date)}</td><td class="number">${fmt(volume.value,3)}</td><td class="number">${fmt(oi.value,3)}</td><td class="number">${sourceButton(unique([...volume.sourceIds,...oi.sourceIds]))}</td></tr>`;});
    const card=(label,points,primary=false)=>metricCard(label,state.focusDate?points.find(row=>row.date===state.focusDate):last(valid(points)),'手',primary,'',code+' 标准月度',points);
    body.innerHTML=heading('金银期权',`${metalName()} ${code} · ${contractName()} · 标准月度期权`)+`<p class="view-intro">PG64 按合约月、Call / Put 的官方 TOTAL 展示；不并入周度与微型产品，不跨方向重复计算。全部合约月份仅加总已列示记录。持仓量是时点存量，官方持仓变化不是资金流入流出；P/C 比值不作方向信号。</p><div class="metric-grid">${card('Call 成交量',callVolume,true)}${card('Put 成交量',putVolume)}${card('Call 持仓量',callOi)}${card('Put 持仓量',putOi)}</div>`+
      `<div class="dashboard-grid">${chartShell('option-volume-chart','Call / Put 成交量','PG64 · 按正文业务日期排列',[{label:'Call',color:COLORS[0]},{label:'Put',color:COLORS[1]}],'','比较各自上次有效日期，缺报告不补零。')}${chartShell('option-oi-chart','Call / Put 持仓量','时点持仓存量 · 各日期独立快照',[{label:'Call',color:COLORS[0]},{label:'Put',color:COLORS[1]}],'','持仓量与成交量分别观察，不累计各日持仓。')}</div>`+
      panel('合约月份与方向',snapshot?`${snapshot.business_date} · ${code} 官方 TOTAL`:'所选范围没有标准月度期权报告',`<div class="table-wrap"><table class="data-table"><thead><tr><th>合约月 / 方向</th><th class="number">Globex / 手</th><th class="number">公开喊价 / 手</th><th class="number">PNT / 手</th><th class="number">总成交 / 手</th><th class="number">持仓 / 手</th><th class="number">官方持仓变化 / 手</th><th class="number">状态 / 来源</th></tr></thead><tbody>${rows.map(row=>`<tr><td class="name"><button class="contract-link" data-contract="${esc(row.contract_month)}">${esc(row.contract_month)}</button> · ${esc(row.option_type==='CALL'?'Call':'Put')}</td>${['globex_volume','open_outcry_volume','pnt_volume','volume','open_interest','oi_change'].map(field=>`<td class="number">${fmt(reportValue(row,field))}</td>`).join('')}<td class="number">${esc(row.status || 'ok')} ${sourceButton(row.source_id)}</td></tr>`).join('') || '<tr><td colspan="8">没有可用记录；未列示不代表零。</td></tr>'}</tbody></table></div>`,'','full')+
      disclosure('逐日 Put / Call 比值',['业务日期','成交 P/C','持仓 P/C','来源'],ratioRows,'P/C = Put ÷ Call，按所选合约月份内已列示的标准月度合约计算。任一侧缺失、状态异常、两侧合约月不一致或 Call 为零时留空；不等同于行权价分布、隐含波动率或买卖方向。');
    chart('option-volume-chart',[{label:'Call 成交',points:callVolume,color:COLORS[0],type:'bar'},{label:'Put 成交',points:putVolume,color:COLORS[1],type:'bar'}]);
    chart('option-oi-chart',[{label:'Call 持仓',points:callOi,color:COLORS[0]},{label:'Put 持仓',points:putOi,color:COLORS[1]}]);
  }

  function renderMonthly() {
    const monthly=latestSnapshot((state.data.monthly || []).filter(row=>row.product===state.product && (state.month==='all'||row.contract_month===state.month)),(state.focusDate || state.end)).filter(row=>dateInRange(row.business_date));
    const contracts=unique(monthly.map(row=>row.contract_month)).sort();
    const monthlyPoints=contracts.map((month,index)=>({label:month,color:COLORS[index%COLORS.length],type:'line',points:monthly.filter(row=>row.contract_month===month && row.intent_date).sort((a,b)=>a.intent_date.localeCompare(b.intent_date)).map(row=>({date:row.intent_date,value:reportValue(row,'cumulative'),sourceIds:[row.source_id],context:`${month} 合约 · 报告 ${row.business_date}`,businessDate:row.business_date}))}));
    const years=unique((state.data.ytd||[]).filter(row=>row.product===state.product && row.business_date<=(state.focusDate || state.end)).map(row=>String(row.year))).sort().reverse();
    if (!years.includes(String(state.year))) state.year=years[0] || '';
    const ytdAll=(state.data.ytd||[]).filter(row=>row.product===state.product && String(row.year)===String(state.year));
    const ytd=latestSnapshot(ytdAll,(state.focusDate || state.end),row=>`${row.product}|${row.year}`).filter(row=>dateInRange(row.business_date) && (state.month==='all'||row.contract_month===state.month));
    const latestMonthly=monthly.slice().sort((a,b)=>a.business_date.localeCompare(b.business_date)).pop();
    const finalCumulative=contracts.map(month=>monthly.filter(row=>row.contract_month===month).sort((a,b)=>a.intent_date.localeCompare(b.intent_date)).pop());
    const currentYearYtd=ytd.filter(row=>String(row.contract_month).startsWith(String(state.year)+'-') && row.period_label!=='PREV DEC');
    const ytdValue=sum((state.month==='all'?currentYearYtd:ytd).filter(row=>row.status!=='not_reported').map(row=>reportValue(row,'total_notices')));
    const ytdTitle=state.month==='all'?'当年已列示合约累计':'所选合约累计';
    body.innerHTML=heading('月度与年度交割')+`<p class="view-intro">官方累计可包含本站积累前的通知，不代表本站保存了完整逐日报告。每个合约月只使用截止所选日期的最新月度报告；YTD 使用所选年份的最新整份快照。月累计不跨报告日相加，意向日与交割合约月份分别保留。</p><div class="metric-grid">${metricCard('月度报告覆盖合约',latestMonthly?{value:contracts.length,date:latestMonthly.business_date,sourceIds:unique(monthly.map(row=>row.source_id))}:null,'个',true)}${metricCard('月度意向日记录',latestMonthly?{value:monthly.length,date:latestMonthly.business_date,sourceIds:unique(monthly.map(row=>row.source_id))}:null,'条')}${metricCard(ytdTitle,ytd.length?{value:ytdValue,date:ytd[0].business_date,sourceIds:unique(ytd.map(row=>row.source_id))}:null,'手')}${metricCard('YTD 报告年份',ytd.length?{value:Number(state.year),date:ytd[0].business_date,sourceIds:unique(ytd.map(row=>row.source_id))}:null,'年')}</div>`+
      chartShell('mtd-chart','合约月累计通知量','横轴为意向日；每条线对应独立交割合约月',monthlyPoints.map(row=>({label:row.label+' 合约',color:row.color})),latestMonthly?`<span class="panel-meta">报告截至 ${latestMonthly.business_date}</span>`:'','每个合约月采用最新报告中的日序列；不同合约月不拼接。','full')+
      `<div class="dashboard-grid">${panel('YTD · 按交割合约月','年初至报告日累计，不能视作全年终值',`<div id="ytd-chart" class="chart-body"></div><div class="chart-footer"><span>PREV DEC 如有列示，单独保留，不并入当年合约。</span><span>手</span></div>`,`<div class="panel-toolbar"><label for="ytd-year">报告年份</label><select id="ytd-year"${!years.length?' disabled':''}>${years.map(year=>`<option value="${year}"${String(state.year)===year?' selected':''}>${year} 年</option>`).join('') || '<option>无报告</option>'}</select></div>`)}${panel('月度合约快照','每个合约月末次列示值',`<div class="table-wrap"><table class="data-table"><thead><tr><th>合约月份</th><th class="number">月累计 / 手</th><th class="number">末次意向日</th><th class="number">来源</th></tr></thead><tbody>${finalCumulative.map(row=>`<tr><td><button class="contract-link" data-contract="${esc(row.contract_month)}">${esc(row.contract_month)}</button></td><td class="number">${fmt(row.cumulative)}</td><td class="number">${esc(row.intent_date)}</td><td class="number">${sourceButton(row.source_id)}</td></tr>`).join('') || '<tr><td colspan="4">所选日期范围没有月度报告</td></tr>'}</tbody></table></div><p class="context-note" style="padding:0 22px 16px;margin:0">报告日期决定快照选择；图中意向日可能落在交割合约月的上一个自然月。</p>`)}</div>`+
      disclosure('月度报告逐意向日明细',['交割合约月','意向日','当日通知 / 手','月累计 / 手','报告业务日期','来源'],monthly.slice().sort((a,b)=>b.intent_date.localeCompare(a.intent_date)).map(row=>`<tr><td><button class="contract-link" data-contract="${esc(row.contract_month)}">${esc(row.contract_month)}</button></td><td class="number">${esc(row.intent_date)}</td><td class="number">${fmt(row.daily_total)}</td><td class="number">${fmt(row.cumulative)}</td><td class="number">${esc(row.business_date)}</td><td class="number">${sourceButton(row.source_id)}</td></tr>`))+
      disclosure('YTD 快照明细',['报告年份','交割合约月','累计通知 / 手','报告业务日期','来源'],ytd.slice().sort((a,b)=>String(a.contract_month).localeCompare(String(b.contract_month))).map(row=>`<tr><td>${esc(row.year)}</td><td class="number"><button class="contract-link" data-contract="${esc(row.contract_month)}">${esc(row.contract_month)}</button></td><td class="number">${fmt(row.total_notices)}</td><td class="number">${esc(row.business_date)}</td><td class="number">${sourceButton(row.source_id)}</td></tr>`));
    chart('mtd-chart',monthlyPoints,{maxGap:3,height:280});
    horizontalChart('ytd-chart',ytd.map(row=>({label:row.period_label==='PREV DEC'?row.contract_month+' · PREV DEC':row.contract_month,value:reportValue(row,'total_notices'),date:row.business_date,sourceIds:[row.source_id],context:`${row.year} 年 YTD · ${row.contract_month}`})));
  }

  function renderStocks() {
    const rows=(state.data.stocks || []).filter(row=>row.product===state.product && dateInRange(row.report_date));
    const dates=unique(rows.map(row=>row.report_date)).sort();
    const date=state.focusDate || last(dates);
    const snapshot=rows.filter(row=>row.report_date===date);
    const registered=inventoryTotals(snapshot,'registered');
    const eligible=inventoryTotals(snapshot,'eligible');
    const pledged=inventoryTotals(snapshot,'pledged');
    const combined=inventoryTotals(snapshot,'combined');
    const total=finite(combined.value)?combined:{value:sum([registered.value,eligible.value]),sourceIds:unique([...registered.sourceIds,...eligible.sourceIds])};
    const points=dates.map(d=>({date:d,...inventoryTotals(rows.filter(row=>row.report_date===d),state.category)}));
    const category=inventoryTotals(snapshot,state.category);
    const totalRow=category.rows?.[0];
    const movements=['received','withdrawn','adjustment'].map(field=>({value:category.rows?.length?sum(category.rows.map(row=>reportValue(row,field))):null,date,sourceIds:category.sourceIds}));
    const warehouses=snapshot.filter(row=>row.category===state.category && !row.is_total && !/^(TOTAL|COMEX TOTAL|TOTAL COMEX|GRAND TOTAL)$/i.test(row.warehouse||''));
    const pct=finite(total.value)&&total.value>0?100*(registered.value||0)/total.value:0;
    body.innerHTML=heading('官方仓库库存',`${metalName()} ${state.product} · 库存按产品，不适用合约月份筛选`)+`<p class="view-intro">库存单位为金衡盎司，与期货手数分别展示。日期筛选按报告日期；${dates.length===1?'当前范围只有一份库存快照，不绘制虚构的历史趋势。':'历史曲线仅连接已有相邻观察值，缺失区间不补齐。'}${state.product==='GC'?'库存范围采用官方 Gold Stocks 报告（含 Gold 与 4GC），不等同于单一 GC 合约库存。质押包含在注册库存内，不能再次加总。':''}</p><div class="metric-grid">${metricCard(CATEGORIES[state.category],date?{...category,date}:null,'金衡盎司',true)}${metricCard('当日入库 · '+CATEGORIES[state.category],date?movements[0]:null,'金衡盎司')}${metricCard('当日出库 · '+CATEGORIES[state.category],date?movements[1]:null,'金衡盎司')}${metricCard('库存调整 · '+CATEGORIES[state.category],date?movements[2]:null,'金衡盎司')}</div>`+
      `<div class="dashboard-grid">${panel('库存历史',dates.length===1?'单日快照 · 仅显示实际观察点':'依官方报告日期排列',`<div class="category-tabs" role="group" aria-label="库存类别">${['registered','eligible','combined',...(state.product==='GC'?['pledged']:[])].map(cat=>`<button class="${state.category===cat?'selected':''}" data-category="${cat}" aria-pressed="${state.category===cat}">${CATEGORIES[cat]}</button>`).join('')}</div><div id="stock-chart" class="chart-body"></div><div class="chart-footer"><span>报告日期 ${date || '—'} · 库存活动日期 ${esc(totalRow?.activity_date || '—')}</span><span>金衡盎司</span></div>`)}${panel('库存构成',date?`${date} · 注册库存与合格库存`:'没有库存报告',`<div class="stock-total"><div><strong>${fmt(total.value,3)}</strong><small>金衡盎司</small></div>${sourceButton(total.sourceIds)}</div><div class="stock-composition"><div style="width:${pct}%;background:${COLORS[0]}"></div><div style="width:${100-pct}%;background:${COLORS[1]}"></div></div><div class="stock-breakdown"><div><span><i class="legend-swatch" style="background:${COLORS[0]}"></i> 注册 Registered</span><strong>${fmt(registered.value,3)}</strong></div><div><span><i class="legend-swatch" style="background:${COLORS[1]}"></i> 合格 Eligible</span><strong>${fmt(eligible.value,3)}</strong></div>${state.product==='GC'?`<div><span>其中质押 Pledged</span><strong>${fmt(pledged.value,3)}</strong></div>`:''}<div><span>已存报告日期</span><strong>${dates.length} <small style="font-size:10px;font-weight:400">个</small></strong></div></div><p class="stock-date-note">总库存 = 注册 + 合格。${state.product==='GC'?'质押为注册库存的子集，不重复计入总量。':''}</p>`)}</div>`+
      panel('仓库明细',date?`${date} · ${CATEGORIES[state.category]} · 单位 金衡盎司`:'没有可用仓库资料',`<div class="table-wrap"><table class="data-table"><thead><tr><th>官方仓库</th><th class="number">前值</th><th class="number">入库</th><th class="number">出库</th><th class="number">调整</th><th class="number">本日库存</th><th class="number">来源</th></tr></thead><tbody>${warehouses.map(row=>`<tr><td class="name">${esc(row.warehouse)}</td>${['previous','received','withdrawn','adjustment','today'].map(key=>`<td class="number">${fmt(row[key],3)}</td>`).join('')}<td class="number">${sourceButton(row.source_id)}</td></tr>`).join('') || '<tr><td colspan="7">当前类别未列示独立仓库明细</td></tr>'}</tbody></table></div>`,'','full');
    chart('stock-chart',unique(['registered','eligible','combined',state.category]).map((category,i)=>({label:CATEGORIES[category],color:COLORS[i],points:dates.map(date=>({date,...inventoryTotals(rows.filter(row=>row.report_date===date),category)}))})),{height:245,unit:'金衡盎司'});
  }

  function emptyChart(message='所选范围没有可用数据') {
    return `<div class="chart-empty"><span class="empty-symbol" aria-hidden="true">⌁</span><span>${esc(message)}</span><span style="font-size:9px">可以调整日期或合约月份；缺失记录不会显示为零。</span></div>`;
  }
  function chart(id,series,options={}) {
    const container=$(id);
    if (!container) return;
    const allSeries=series;
    const switches=allSeries.length>1?`<div class="series-controls" role="group" aria-label="图表系列">${allSeries.map(item=>`<button data-series-chart="${id}" data-series="${esc(item.label)}" aria-pressed="${!state.hiddenSeries.has(id+'|'+item.label)}"><i style="background:${item.color}"></i>${esc(item.label)}</button>`).join('')}</div>`:'';
    series=series.filter(item=>!state.hiddenSeries.has(id+'|'+item.label));
    const hasData=series.some(item=>item.points.some(row=>finite(row.value)));
    if (!hasData) {container.innerHTML=switches+emptyChart();return;}
    const height=options.height || 260;
    const width=Math.max(300,container.clientWidth || 900);
    const margin={left:55,right:19,top:23,bottom:35};
    const innerWidth=width-margin.left-margin.right;
    const innerHeight=height-margin.top-margin.bottom;
    const allPoints=series.flatMap(item=>item.points);
    const dates=unique(allPoints.map(row=>row.date)).sort();
    const finiteValues=allPoints.map(row=>row.value).filter(finite);
    const min=Math.min(0,...finiteValues);
    const max=Math.max(0,...finiteValues);
    const step=niceStep((max-min)/4 || 1);
    const yMin=Math.floor(min/step)*step;
    const yMax=Math.ceil((max || 1)/step)*step;
    const extent=yMax-yMin || 1;
    const dateMin=utc(dates[0]);
    const dateMax=utc(last(dates));
    const x=date=>margin.left+(dateMax===dateMin?innerWidth/2:(utc(date)-dateMin)/(dateMax-dateMin)*innerWidth);
    const y=value=>margin.top+innerHeight*(1-(value-yMin)/extent);
    const barSeries=series.filter(row=>row.type==='bar');
    const barWidth=Math.min(32,Math.max(2,innerWidth/(Math.max(dates.length,1)*1.7)/Math.max(barSeries.length,1)));
    let markup='';
    for(let tick=yMin;tick<=yMax+step*.01;tick+=step){markup+=`<line class="svg-grid" x1="${margin.left}" x2="${width-margin.right}" y1="${y(tick)}" y2="${y(tick)}"/><text class="svg-axis" x="${margin.left-10}" y="${y(tick)+3}" text-anchor="end">${esc(compact(tick))}</text>`;}
    const tickCount=Math.max(2,Math.min(6,Math.floor(innerWidth/120)));
    const tickDates=unique(Array.from({length:Math.min(tickCount,dates.length)},(_,i)=>dates[Math.round((dates.length-1)*i/(Math.min(tickCount,dates.length)-1 || 1))]));
    markup+=tickDates.map(date=>`<text class="svg-axis" x="${x(date)}" y="${height-12}" text-anchor="middle">${dates.length===1?date:date.slice(2)}</text>`).join('');
    series.forEach((item,seriesIndex)=>{
      const color=item.color || COLORS[seriesIndex%COLORS.length];
      if(item.type==='bar'){
        const barIndex=barSeries.indexOf(item);
        item.points.filter(row=>finite(row.value)).forEach(point=>{const px=x(point.date)+(barIndex-(barSeries.length-1)/2)*barWidth;const py=Math.min(y(0),y(point.value));const h=Math.max(point.value===0?1:2,Math.abs(y(0)-y(point.value)));markup+=`<rect x="${px-barWidth/2}" y="${py}" width="${Math.max(1,barWidth-1)}" height="${h}" rx="1" fill="${color}" opacity=".85"/>`;});
      } else {
        let segments=[],segment=[],previous=null;
        item.points.forEach(point=>{if(!finite(point.value)){if(segment.length)segments.push(segment);segment=[];previous=null;return;}if(previous && !consecutiveBusinessDates(previous.date,point.date,calendar())){if(segment.length)segments.push(segment);segment=[];}segment.push(point);previous=point;});
        if(segment.length)segments.push(segment);
        segments.forEach(points=>{if(points.length>1)markup+=`<path d="${points.map((point,i)=>`${i?'L':'M'}${x(point.date)},${y(point.value)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;});
        item.points.filter(row=>finite(row.value)).forEach(point=>{markup+=`<circle cx="${x(point.date)}" cy="${y(point.value)}" r="${dates.length<25?3.4:2.1}" fill="${color}" stroke="#fff" stroke-width="1"/>`;});
      }
    });
    const hits=[];
    dates.forEach((date,index)=>{
      const values=series.map(item=>({label:item.label,color:item.color,...item.points.find(row=>row.date===date)})).filter(row=>row.date);
      const px=x(date);const halfWidth=dates.length>1?Math.max(5,innerWidth/dates.length/2):18;
      hits.push({date,values,sourceIds:unique(values.flatMap(row=>row.sourceIds || [])),unit:options.unit || '手'});
      markup+=`<g class="plot-hit" tabindex="0" role="button" aria-label="${esc(date+'，'+values.map(row=>`${row.label} ${finite(row.value)?fmt(row.value,options.unit==='金衡盎司'?3:0):'缺失'} ${options.unit || '手'}`).join('，')+'，按回车选择日期')}" data-hit="${index}"><rect class="focus-ring" x="${px-halfWidth}" y="${margin.top}" width="${2*halfWidth}" height="${innerHeight}" fill="transparent"/><title>${esc(date+' · '+values.map(row=>`${row.label}: ${fmt(row.value,3)}`).join(' / '))}</title></g>`;
    });
    container.innerHTML=switches+`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(series.map(row=>row.label).join('、'))}，${esc(dates[0])} 至 ${esc(last(dates))}">${markup}</svg>`;
    bindChartHits(container,hits);
  }
  function niceStep(value) {
    const power=10**Math.floor(Math.log10(Math.abs(value)||1));
    const scaled=value/power;
    return (scaled<=1?1:scaled<=2?2:scaled<=2.5?2.5:scaled<=5?5:10)*power;
  }
  function horizontalChart(id,rows) {
    const container=$(id);
    const points=rows.filter(row=>finite(row.value)).sort((a,b)=>String(a.label).localeCompare(String(b.label)));
    if(!points.length){container.innerHTML=emptyChart('所选年份与日期范围没有 YTD 快照');return;}
    const width=Math.max(300,container.clientWidth || 700);
    const height=Math.max(210,points.length*28+38);
    const left=80,right=75,top=18;
    const plotWidth=width-left-right;
    const max=Math.max(1,...points.map(row=>row.value));
    container.innerHTML=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="YTD 各交割合约月通知量">${points.map((row,i)=>{const y=top+i*28;return `<g class="plot-hit" tabindex="0" role="button" data-hit="${i}" aria-label="${esc(row.label)} ${fmt(row.value)} 手，查看原报告"><rect class="focus-ring" x="0" y="${y-5}" width="${width}" height="27" fill="transparent"/><text x="${left-12}" y="${y+10}" text-anchor="end" class="svg-axis">${esc(row.label)}</text><rect x="${left}" y="${y}" width="${plotWidth}" height="13" rx="2" fill="#f2f4ee"/><rect x="${left}" y="${y}" width="${plotWidth*row.value/max}" height="13" rx="2" fill="${/prev/i.test(row.label)?COLORS[1]:COLORS[0]}" opacity=".9"/><text x="${width-right+9}" y="${y+10}" class="svg-axis">${fmt(row.value)}</text></g>`;}).join('')}</svg>`;
    bindChartHits(container,points.map(row=>({date:row.date,contractMonth:row.label.slice(0,7),values:[{...row,label:row.label}],sourceIds:row.sourceIds,unit:'手'})));
  }
  function bindChartHits(container,hits) {
    chartRecords.set(container.id,hits);
    container.querySelectorAll('[data-hit]').forEach(hit=>{
      const record=hits[Number(hit.dataset.hit)];
      hit.classList.toggle('point-selected',record.date===state.focusDate);
      hit.addEventListener('pointerenter',event=>tooltip(record,event));
      hit.addEventListener('pointermove',event=>positionTooltip(event.clientX,event.clientY));
      hit.addEventListener('pointerleave',hideTooltip);
      hit.addEventListener('focus',()=>{const box=hit.getBoundingClientRect();tooltip(record,{clientX:box.x+box.width/2,clientY:box.y+30});});
      hit.addEventListener('blur',hideTooltip);
      const open=()=>{hideTooltip();state.focusDate=record.values.find(row=>row.businessDate)?.businessDate || record.date;if(record.contractMonth){state.month=record.contractMonth;updateContractOptions();}render();};
      hit.addEventListener('click',open);
      hit.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}});
    });
  }
  function renderPointDetails() {
    const target=$('point-details');if(!target)return;
    target.hidden=!state.focusDate;
    if(target.hidden)return;
    const records=[...chartRecords.values()].flat().filter(record=>record.date===state.focusDate || record.values.some(row=>row.businessDate===state.focusDate));
    const values=new Map();
    records.forEach(record=>record.values.forEach(row=>values.set(row.label+'|'+record.unit,{...row,unit:record.unit})));
    target.innerHTML=`<div class="point-details-head"><strong>${esc(state.focusDate)}</strong><button data-clear-focus aria-label="取消日期选择">×</button></div><div class="point-values">${[...values.values()].map(row=>`<span>${esc(row.label)} <b>${fmt(row.value,row.unit==='金衡盎司'?3:0)}</b> ${esc(row.unit)}</span>`).join('') || '<span>该日没有可用观察值</span>'}</div>${sourceButton(unique(records.flatMap(record=>record.sourceIds)),'查看来源',state.focusDate)}`;
  }
  function tooltip(record,event) {
    $('chart-tooltip').innerHTML=`<div class="tooltip-date">${esc(record.date)}</div>${record.values.map(row=>`<div class="tooltip-row"><span>${esc(row.label)}</span><strong>${finite(row.value)?fmt(row.value,record.unit==='金衡盎司'?3:0)+' '+esc(record.unit):'缺失'}</strong></div>${row.context?`<div class="tooltip-hint">${esc(row.context)}</div>`:''}`).join('')}<div class="tooltip-hint">点击选择日期，再查看来源</div>`;
    $('chart-tooltip').hidden=false;
    positionTooltip(event.clientX,event.clientY);
  }
  function positionTooltip(x,y) {
    const tooltip=$('chart-tooltip');
    tooltip.style.left=Math.max(8,Math.min(x+15,innerWidth-tooltip.offsetWidth-10))+'px';
    tooltip.style.top=Math.max(8,Math.min(y+15,innerHeight-tooltip.offsetHeight-10))+'px';
  }
  function hideTooltip(){$('chart-tooltip').hidden=true;}

  function openDrawer(title,html) {
    if($('source-drawer').hidden)lastFocus=document.activeElement;
    hideTooltip();
    $('drawer-title').textContent=title;
    $('drawer-content').innerHTML=html;
    $('source-drawer').hidden=false;
    $('drawer-backdrop').hidden=false;
    document.body.style.overflow='hidden';
    $('close-drawer').focus();
  }
  function closeDrawer() {
    sourceRequest++;
    $('source-drawer').hidden=true;
    $('drawer-backdrop').hidden=true;
    document.body.style.overflow='';
    lastFocus?.focus();
  }
  function sourceCard(source) {
    if(!source)return '';
    const filename=publicMode?'官方页面展示当前报告，不保证对应本条历史日期。':String(source.path || '').split(/[\\/]/).pop();
    const version={FINAL:'最终版',PRELIMINARY:'初步版',UNSPECIFIED:'报告未标版本'}[source.version] || source.version || '报告未标版本';
    const url=/^https?:\/\//i.test(source.url || '')?source.url:null;
    const localUrl=/^file:\/\//i.test(source.local_url || '')?source.local_url:null;
    const archiveUrl=publicMode?null:location.protocol==='file:'?localUrl:'/api/source/'+encodeURIComponent(source.source_id);
    return `<article class="source-card"><h3>${esc(FAMILY[source.family] || source.family || '官方报告')} ${sourceVersion(source.source_id)}</h3><dl class="source-details"><dt>正文业务日期</dt><dd>${esc(dateLabel(source.business_date))}</dd><dt>版本</dt><dd>${esc(version)}</dd><dt>解析状态</dt><dd>${esc(source.status || '未提供')}</dd><dt>下载文件日期</dt><dd>${esc(source.file_date || '未提供')}（仅归档信息）</dd><dt>快照选择</dt><dd>${source.selected===false?'未选用':'已选用'}</dd><dt>来源编号</dt><dd style="font:9px/1.7 ui-monospace,monospace">${esc(source.source_id)}</dd></dl><p class="filename">${esc(filename)}</p>${source.error?`<p class="drawer-note warning-note">${esc(source.error)}</p>`:''}<div class="source-links">${archiveUrl?`<a href="${esc(archiveUrl)}" target="_blank" rel="noopener">打开归档原文件 ↗</a>`:'<span class="no-source">原件仅在本地或私有档案中提供</span>'}${url?`<a href="${esc(url)}" target="_blank" rel="noopener">CME 官方报告页面 ↗</a>`:''}</div>${source.aliases?.length>1?`<p class="drawer-note">此内容在本地有 ${source.aliases.length} 个相同副本，按内容哈希去重。</p>`:''}</article>`;
  }
  async function openSources(ids,date,context) {
    const request=++sourceRequest;
    const sourceIds=unique(ids || []);
    if(publicMode) {
      openDrawer('数据与原始报告','<p>正在读取来源信息…</p>');
      try {
        const version=state.manifest.version;
        const rows=await Promise.all(sourceIds.filter(id=>/^[a-f0-9]{64}$/.test(id)).map(id=>readPublic(`versions/${version}/sources/${id}.json`,version,'publication_version')));
        if(state.manifest.version!==version || request!==sourceRequest)return;
        rows.forEach(row=>state.sources.set(row.source_id,row));
      } catch(error) {if(request===sourceRequest)openDrawer('来源读取失败',`<p>${esc(error.message)}</p>`);return;}
    }
    openDrawer('数据与原始报告',`${context?`<p class="drawer-note">${esc(context)}</p>`:''}${date?`<div class="drawer-value" style="font-size:22px">${esc(date)}</div>`:''}${sourceIds.map(id=>sourceCard(state.sources.get(id))).join('') || '<p class="drawer-note">该观察值没有可用的报告来源，不能据此判断为零。</p>'}<p class="drawer-note">日期取自报告正文。文件名前缀用于归档，不代表数据业务日期。不同报告的交割与交易指标分别保留。</p>`);
  }
  function openQuality() {
    const issues=(state.data.issues || []).filter(row=>(!row.product||row.product===state.product) && (!row.business_date||dateInRange(row.business_date)));
    const days=getDays(),expected=businessDates(state.start,state.end,calendar());
    const count=expected.dates.filter(date=>available(days.find(day=>day.business_date===date) || {business_date:date})).length;
    openDrawer('资料质量与覆盖',`<p class="quality-summary">${state.start} 至 ${state.end} · ${metalName()} ${state.product} · ${LABELS[state.view]}<br>${expected.verified?`本板块覆盖 ${count}/${expected.dates.length} 个业务日`:'部分年份日历尚未核准，不宣称完整覆盖'}。</p><p class="drawer-note">正式积累自 ${SERIES_START} 起。此前为不连续历史样本，保留初步版标签。缺失、解析异常与真实零值分别处理；图表不补零、不向前凑足五条。流量仅在业务日覆盖完整时合计，持仓与库存按时点展示，MTD / YTD 官方累计不跨日期相加。</p><p class="drawer-note">${publicMode?'公开版来自通过成品校验的版本，内部运行日志不公开。覆盖情况以当前品种、板块和合约筛选为准。':'本地质量记录如下。'}</p><ul class="issue-list">${issues.map(row=>`<li><b>${esc(row.business_date || '日期未提取')} · ${esc(row.code)}</b><br>${esc(row.message)}${row.source_id?'<br>'+sourceButton(row.source_id,'查看问题来源'):''}</li>`).join('')}</ul>`);
  }
  function openCollection() {
    const dateTime=value=>value?new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Hong_Kong',hour12:false})+' 香港时间':'未提供';
    const latest=state.manifest?.business_date || state.data.pipeline?.business_date || last(allDates());
    const dates=state.manifest?.family_dates || Object.fromEntries(Object.keys(FAMILY).map(family=>[family,last((state.data.sources || []).filter(row=>row.family===family && row.selected!==false).map(row=>row.business_date).filter(Boolean).sort())]));
    openDrawer('更新状态与报告日期',`<dl class="source-details"><dt>数据业务日期</dt><dd>${esc(latest || '未提供')}</dd><dt>网站版本生成</dt><dd>${esc(dateTime(state.manifest?.published_at || state.data.generated_at))}</dd><dt>成品生成时间</dt><dd>${esc(dateTime(state.data.generated_at))}</dd><dt>本次读取时间</dt><dd>${esc(dateTime(state.readAt))}</dd>${publicMode?`<dt>发布版本</dt><dd>${esc(state.manifest.version)}</dd>`:''}</dl><div class="collection-results">${Object.entries(dates).map(([family,date])=>`<div class="collection-result"><strong>${esc(FAMILY[family] || family)}</strong>最新报告业务日期 ${esc(date || '未提供')}</div>`).join('')}</div><p class="drawer-note">刷新仅重新读取已发布数据，不会让旧数据变新。采集、校验或发布失败时继续保留上次成功版本，业务日期保持原值。</p><p class="drawer-note">库存以报告日期筛选，同时另列库存活动日期；不能将它解释为同日期货市场的库存变化。交易日历核准年份：${esc((calendar().verified_years || []).join('、') || '未提供')}，跨年前需更新核准日历。</p>`);
  }

  function updateContractOptions() {
    const product=state.product;
    const months=unique(state.view==='options'?(state.data.daily||[]).flatMap(day=>optionRows(day,product,'all').map(row=>row.contract_month)):[
      ...(state.data.daily||[]).flatMap(day=>[...(day.delivery_records||[]).filter(row=>row.product===product).map(row=>row.contract_month),...(day.futures?.[product]?.contracts||[]).map(row=>monthISO(row.month))]),
      ...(state.data.monthly||[]).filter(row=>row.product===product).map(row=>row.contract_month),
      ...(state.data.ytd||[]).filter(row=>row.product===product).map(row=>row.contract_month)
    ]).filter(month=>/^\d{4}-\d{2}$/.test(month)).sort().reverse();
    if(state.month!=='all'&&!months.includes(state.month))months.unshift(state.month);
    $('contract-month').innerHTML='<option value="all">全部合约月份</option>'+months.map(month=>`<option value="${month}"${month===state.month?' selected':''}>${month}</option>`).join('');
    $('contract-month').disabled=state.view==='stocks';
  }
  const allDates=()=>unique([...(state.data?.daily||[]).map(row=>row.business_date),...(state.data?.monthly||[]).map(row=>row.business_date),...(state.data?.ytd||[]).map(row=>row.business_date),...(state.data?.stocks||[]).map(row=>row.report_date)]).sort();
  function applyRange(keepDates=false) {
    const dates=allDates(),latest=state.manifest?.business_date || state.data.pipeline?.business_date || last(dates) || SERIES_START;
    const floor=state.mode==='history'?(state.manifest?.history_start || dates[0] || SERIES_START):SERIES_START;
    const ceiling=state.mode==='history'?(latest<SERIES_START?latest:shiftDay(SERIES_START,-1)):latest;
    if(!keepDates) {
      const chosen=selectRange(state.range || 'all',ceiling,floor,calendar());
      state.start=chosen.start;state.end=chosen.end;state.requestedStart=chosen.requested;
    } else {
      state.requestedStart=state.start;
      state.start=state.start<floor?floor:state.start>ceiling?ceiling:state.start;
      state.end=state.end>ceiling?ceiling:state.end<floor?floor:state.end;
    }
    $('start-date').value=state.start;$('end-date').value=state.end;
    $('start-date').min=floor;$('end-date').min=floor;
    $('start-date').max=ceiling;$('end-date').max=ceiling;
  }
  async function readPublic(path,version=null,versionField='version') {
    const response=await fetch(path,{cache:'no-store'});
    if(!response.ok)throw new Error(`网页数据读取失败 HTTP ${response.status}`);
    const result=await response.json();
    if(version && result[versionField]!==version)throw new Error('数据版本不一致，请刷新页面后重试');
    return result;
  }
  let publicChunks=new Map();
  async function loadRange() {
    const request=++dataRequest;
    if(publicMode && state.start<=state.end) {
      $('loading').hidden=false;
      const manifest=state.manifest,version=manifest.version;
      const months=manifest.months.filter(month=>month>=state.start.slice(0,7) && month<=state.end.slice(0,7));
      const recentEnough=state.start>=manifest.recent_start && state.end<=manifest.business_date;
      const needed=recentEnough?[]:months.filter(month=>!publicChunks.has(month));
      try {
        const chunks=await Promise.all(needed.map(async month=>[month,await readPublic(`versions/${version}/history/${month}.json`,version)]));
        if(request!==dataRequest || state.manifest.version!==version)return;
        chunks.forEach(([month,data])=>publicChunks.set(month,data));
        const packets=[...publicChunks.values()];
        for(const group of ['daily','monthly','ytd','stocks','sources']) {
          const rows=new Map();
          packets.flatMap(chunk=>chunk[group] || []).forEach(row=>rows.set(group==='daily'?row.business_date:group==='sources'?row.source_id:JSON.stringify(row),row));
          state.data[group]=[...rows.values()];
        }
      } catch(error) {
        if(request===dataRequest){$('loading').hidden=true;body.innerHTML='<div class="empty-state">所选范围尚未完整加载，请重试。</div>';$('selection-status').innerHTML='';$('point-details').hidden=true;$('quality-banner').innerHTML=`<span>${esc(error.message)}；本次范围未加载完成。</span><button data-retry-range>重试范围</button>`;}
        return;
      }
    }
    if(request!==dataRequest)return;
    $('loading').hidden=true;
    state.sources=new Map((state.data.sources || []).map(row=>[row.source_id,row]));
    (state.data.daily||[]).forEach(day=>Object.values(day.sources||{}).filter(Boolean).forEach(source=>{if(source.source_id && !state.sources.has(source.source_id))state.sources.set(source.source_id,source);}));
    updateContractOptions();render();
  }
  async function loadData(initial=false) {
    $('refresh').disabled=true;
    try {
      let data;
      if(publicMode) {
        const manifest=await readPublic('site-manifest.json?read='+Date.now());
        if(!/^[A-Za-z0-9_.-]+$/.test(manifest.version) || !Array.isArray(manifest.months) || manifest.months.some(month=>!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)))throw new Error('发布清单格式错误');
        if(assetVersion && manifest.version!==assetVersion)throw new Error('已发布新版本，请重新加载页面');
        const recent=await readPublic(`versions/${manifest.version}/recent.json`,manifest.version);
        state.manifest=manifest;publicChunks=new Map([['recent',recent]]);
        data={schema_version:2,generated_at:manifest.generated_at,calendar:manifest.calendar,...recent,issues:[]};
      } else if(location.protocol==='file:') {
        if(!initial)await new Promise((resolve,reject)=>{
          const script=document.createElement('script');
          script.src='data.js?read='+Date.now();
          script.onload=()=>{script.remove();resolve();};
          script.onerror=()=>{script.remove();reject(new Error('无法重新读取离线数据包 data.js'));};
          document.head.appendChild(script);
        });
        if(!global.COMEX_MARKET_DATA)throw new Error('缺少离线数据包 data.js，请先运行数据构建入口');
        data=global.COMEX_MARKET_DATA;
      } else {
        const response=await fetch('/api/data',{cache:'no-store'});
        if(!response.ok)throw new Error(`数据接口返回 HTTP ${response.status}`);
        data=await response.json();
      }
      if(!Array.isArray(data.daily))throw new Error('数据接口缺少 daily 记录');
      state.data=data;
      state.sources=new Map((data.sources||[]).map(row=>[row.source_id,row]));
      (data.daily||[]).forEach(day=>Object.values(day.sources||{}).filter(Boolean).forEach(source=>{if(source.source_id && !state.sources.has(source.source_id))state.sources.set(source.source_id,source);}));
      const selection=initial?parseSelection(location.hash):{};
      if(initial && !selection.mode && last(allDates())<SERIES_START){state.mode='history';state.range='all';}
      if(initial)Object.assign(state,selection);
      applyRange(Boolean(initial && selection.start && selection.end) || !state.range);
      state.readAt=new Date().toISOString();
      $('start-date').value=state.start;
      $('end-date').value=state.end;
      $('read-time').textContent='页面读取 '+new Date(state.readAt).toLocaleTimeString('zh-CN',{timeZone:'Asia/Hong_Kong',hour12:false});
      await loadRange();
    }catch(error){
      $('loading').hidden=true;
      if(!state.data)body.innerHTML=`<div class="empty-state" role="alert"><h3>暂时无法读取数据</h3><p>${esc(error.message)}</p><p>${location.protocol==='file:'?'运行数据构建入口生成相邻的 data.js 后，即可直接打开此页面。':publicMode?'请检查网络；有新版本时重新加载页面。':'请确认本地服务正在运行，然后重新读取本地数据。'}</p><button class="quiet-button" data-retry>重新读取</button>${publicMode?'<button data-reload>重新加载页面</button>':''}</div>`;
      else $('quality-banner').innerHTML=`<span>本次读取失败：${esc(error.message)}。页面继续保留上次成功读取的数据。</span><button data-retry>重试</button>${publicMode?'<button data-reload>重新加载页面</button>':''}`;
    }finally{$('refresh').disabled=false;}
  }

  document.addEventListener('click',event=>{
    const button=event.target.closest('button');
    if(!button)return;
    if(!state.data && (button.dataset.view||button.dataset.product||button.dataset.range||button.dataset.category))return;
    if(button.dataset.view){state.view=button.dataset.view;updateContractOptions();render();}
    if(button.dataset.product){state.product=button.dataset.product;if(state.product==='SI'&&state.category==='pledged')state.category='registered';updateContractOptions();render();}
    if(button.dataset.range){
      state.range=button.dataset.range;state.focusDate=null;applyRange();loadRange();
    }
    if(button.dataset.mode){state.mode=button.dataset.mode;state.range=state.mode==='history'?'all':'5d';state.focusDate=null;applyRange();loadRange();}
    if(button.dataset.contract){state.month=button.dataset.contract;updateContractOptions();render();}
    if(button.dataset.seriesChart){const key=button.dataset.seriesChart+'|'+button.dataset.series;if(state.hiddenSeries.has(key))state.hiddenSeries.delete(key);else state.hiddenSeries.add(key);render();}
    if(button.hasAttribute('data-clear-focus')){state.focusDate=null;render();}
    if(button.dataset.category){state.category=button.dataset.category;render();}
    if(button.dataset.sources){openSources(button.dataset.sources.split(','),null,button.dataset.context || null);}
    if(button.hasAttribute('data-show-quality'))openQuality();
    if(button.hasAttribute('data-show-collection'))openCollection();
    if(button.hasAttribute('data-retry'))loadData(!state.data);
    if(button.hasAttribute('data-retry-range'))loadRange();
    if(button.hasAttribute('data-reload'))location.reload();
  });
  document.addEventListener('change',event=>{
    const {id,value}=event.target;
    if(id==='start-date'||id==='end-date'){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return;state[id==='start-date'?'start':'end']=value;state.range=null;state.focusDate=null;applyRange(true);loadRange();}
    if(id==='contract-month'){state.month=value;render();}
    if(id==='ytd-year'){state.year=value;render();}
    if(id==='member-contract'){state.memberMonth=value;render();}
  });
  $('refresh').addEventListener('click',()=>loadData());
  $('share')?.addEventListener('click',async()=>{
    const url=location.href.split('#')[0]+selectionHash(state);
    try {await navigator.clipboard.writeText(url);$('share-status').textContent='当前视图链接已复制';}
    catch {openDrawer('分享当前视图',`<p>复制下面链接，打开后保留当前筛选。</p><input class="share-url" aria-label="当前视图链接" readonly value="${esc(url)}">`);}
  });
  $('close-drawer').addEventListener('click',closeDrawer);
  $('drawer-backdrop').addEventListener('click',closeDrawer);
  document.addEventListener('keydown',event=>{
    if($('source-drawer').hidden)return;
    if(event.key==='Escape')closeDrawer();
    if(event.key==='Tab'){
      const focusable=[...$('source-drawer').querySelectorAll('button:not(:disabled),a[href],select')];
      const first=focusable[0],final=last(focusable);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();final?.focus();}
      else if(!event.shiftKey&&document.activeElement===final){event.preventDefault();first?.focus();}
    }
  });
  let resizeTimer;
  addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(state.data)render();},160);});
  addEventListener('hashchange',()=>{if(!state.data)return;const selection=parseSelection(location.hash);state.focusDate=null;Object.assign(state,selection);applyRange(Boolean(selection.start && selection.end));loadRange();});
  if(LABELS[location.hash.slice(1)])state.view=location.hash.slice(1);
  loadData(true);
})(globalThis);
