import React from 'react';
import { MOON_WHITE_PAGES } from './metadata.mjs';
import css from './style.css';

const Text = ({ as: Tag = 'p', children, className = '', ...rest }) => <Tag className={className} data-mw-text="true" {...rest}>{children}</Tag>;
function Header(p) { return <header className="mw-header" data-mw-region="header"><Text className="mw-kicker">{p.kicker}</Text><Text as="h2" className="mw-title">{p.title}</Text><Text className="mw-subtitle">{p.subtitle}</Text></header>; }
function Photo(p) {
  const image = p.images?.[0];
  const src = typeof image === 'string' ? image : image?.src;
  return <figure className="mw-photo" data-mw-region="photo"><div className="mw-image" onDoubleClick={() => p.__mediaApi?.pick('images', 0)} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const file = e.dataTransfer.files?.[0]; if (file) p.__mediaApi?.acceptFile('images', 0, file); }}>
    {src ? <img src={src} alt={p.caption} style={{ objectFit: p.imageFit || 'cover' }}/> : <Text className="mw-empty">双击添加本页主图</Text>}<div className="mw-image-shade" aria-hidden="true"/>
  </div><Text as="figcaption" className="mw-caption">{p.caption}</Text></figure>;
}
function Page({ kind, ...p }) {
  let content;
  const cover = kind.startsWith('cover');
  if (cover) {
    const text = <div className="mw-cover-copy" data-mw-region="cover-copy"><Text className="mw-kicker">{p.kicker}</Text><Text as="h1" className="mw-cover-title">{p.title}</Text><Text className="mw-cover-sub">{p.subtitle}</Text></div>;
    content = <div className={`mw-cover ${kind}`}>
      {text}{['cover-photo', 'cover-split'].includes(kind) && <Photo {...p}/>}
      {kind === 'cover-metric' && <div className="mw-cover-number" data-mw-region="cover-number"><Text className="mw-number">{p.metric}<small>{p.unit}</small></Text><Text>{p.label}</Text></div>}
    </div>;
  } else if (kind === 'overview-metrics') {
    content = <div className="mw-overview"><Text className="mw-summary" data-mw-region="summary">{p.summary}</Text><div className="mw-metrics" data-mw-region="metrics" style={{ gridTemplateColumns: `repeat(${p.metricCount},minmax(0,1fr))` }}>{p.metrics.slice(0, p.metricCount).map((m, i) => <div className="mw-metric" key={i}><Text className="mw-label">{m.label}</Text><Text className="mw-number">{m.value}<small>{m.unit}</small></Text><Text className="mw-detail">{m.detail}</Text></div>)}</div></div>;
  } else if (kind === 'case-image') {
    content = <div className="mw-case"><div className="mw-points" data-mw-region="points">{p.points.slice(0, p.pointCount).map((item, i) => <div key={i}><Text className="mw-point-index">{String(i + 1).padStart(2, '0')}</Text><Text as="h3">{item.title}</Text><Text className="mw-detail">{item.detail}</Text></div>)}</div><Photo {...p}/></div>;
  } else if (kind === 'metrics-chart') {
    const bars = p.bars.slice(0, p.barCount);
    const lo = Math.min(0, ...bars.map(b => Number(b.value)));
    const hi = Math.max(0, ...bars.map(b => Number(b.value)));
    const range = hi - lo || 1;
    const zero = -lo / range * 100;
    content = <div className="mw-chart-layout"><div className="mw-chart" data-mw-region="chart"><Text as="h3">{p.chartTitle}<span className="mw-chart-unit">{p.unit}</span></Text><div className="mw-bars">{bars.map((b, i) => <div className="mw-bar-row" key={i}><Text className="mw-bar-label">{b.label}</Text><div className="mw-bar-track"><div className="mw-zero" style={{ left: `${zero}%` }}/><div className="mw-bar" style={{ left: `${Number(b.value) < 0 ? (Number(b.value) - lo) / range * 100 : zero}%`, width: `${Math.abs(Number(b.value)) / range * 100}%`, background: i === 0 ? '#1ECF77' : '#7D9385' }}/></div><Text className="mw-bar-value">{b.value}</Text></div>)}</div></div><div className="mw-judgment" data-mw-region="judgment"><Text className="mw-label">本页判断</Text><Text className="mw-insight">{p.insight}</Text></div></div>;
  } else if (kind === 'process-comparison') {
    content = <div className="mw-process"><div className="mw-process-row" data-mw-region="before"><Text as="h3">{p.leftTitle}</Text><div className="mw-flow" style={{ gridTemplateColumns: `repeat(${p.stepCount},minmax(0,1fr))` }}>{p.before.slice(0, p.stepCount).map((s, i) => <div className="mw-step" key={i}><Text className="mw-step-num">{String(i + 1).padStart(2,'0')}</Text><Text as="h4">{s.title}</Text><Text className="mw-detail">{s.detail}</Text>{i < p.stepCount - 1 && <span className="mw-arrow">→</span>}</div>)}</div></div><div className="mw-process-row mw-after" data-mw-region="after"><Text as="h3">{p.rightTitle}</Text><div className="mw-flow" style={{ gridTemplateColumns: `repeat(${p.stepCount},minmax(0,1fr))` }}>{p.after.slice(0, p.stepCount).map((s, i) => <div className="mw-step" key={i}><Text className="mw-step-num">{String(i + 1).padStart(2,'0')}</Text><Text as="h4">{s.title}</Text><Text className="mw-detail">{s.detail}</Text>{i < p.stepCount - 1 && <span className="mw-arrow">→</span>}</div>)}</div></div><Text className="mw-conclusion" data-mw-region="conclusion">{p.conclusion}</Text></div>;
  } else if (kind === 'table-evidence') {
    content = <div className="mw-table-wrap" data-mw-region="table"><table className="mw-table"><colgroup><col style={{width:'20%'}}/><col style={{width:'34%'}}/><col style={{width:'20%'}}/><col style={{width:'26%'}}/></colgroup><thead><tr>{p.headers.map((h,i)=><th key={i}><Text>{h}</Text></th>)}</tr></thead><tbody>{p.rows.slice(0,p.rowCount).map((r,i)=><tr key={i}>{['name','detail','evidence','action'].map(k=><td key={k}><Text>{r[k]}</Text></td>)}</tr>)}</tbody></table></div>;
  } else {
    content = <div className="mw-action-layout"><div className="mw-actions" data-mw-region="actions">{p.actions.slice(0,p.actionCount).map((a,i)=><div className="mw-action" key={i}><Text className="mw-when">{a.when}</Text><div><Text as="h3">{a.title}</Text><Text className="mw-detail">{a.detail}</Text></div><Text className="mw-owner">{a.owner}</Text></div>)}</div><Text className="mw-conclusion" data-mw-region="conclusion">{p.conclusion}</Text></div>;
  }
  return <div className={`mw-root ${kind === 'cover-statement' ? 'mw-dark' : ''}`} data-mw-kind={kind}><style>{css}</style>{!cover && <Header {...p}/>}<main className={cover ? 'mw-cover-main' : 'mw-main'}>{content}</main><footer className="mw-source" data-mw-region="source"><Text>{p.source}</Text></footer></div>;
}
export const runtimePages = MOON_WHITE_PAGES.map(page => ({ ...page, Component: props => <Page kind={page.slot} {...props}/> }));
