// A small set of line icons drawn for Dawang-PPT (24×24 grid, round stroke), used to fill spare room in metric
// tiles. Each is one vector path; pickIcon chooses one from a tile's label and unit.
export const ICONS = {
  document: 'M6 3h9l3 3v15H6z M14 3v4h4 M9 12h6 M9 16h6',
  pen: 'M4 20h4L19 9l-4-4L4 16z M14 6l4 4',
  renew: 'M20 11a8 8 0 0 0-14.5-4.5L4 8 M4 4v4h4 M4 13a8 8 0 0 0 14.5 4.5L20 16 M20 20v-4h-4',
  link: 'M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1 M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1',
  coin: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M9 8l3 4 3-4 M12 12v5 M9 13h6 M9 15.5h6',
  ticket: 'M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z M13 7v10',
  store: 'M4 9l1.5-5h13L20 9 M4 9v11h16V9 M4 9h16 M9 20v-6h6v6',
  screen: 'M3 4h18v12H3z M8 20h8 M12 16v4',
  pin: 'M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11z M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  trend: 'M3 17l6-6 4 4 8-8 M15 7h6v6',
  users: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M3 20c0-3 3-5 6-5s6 2 6 5 M17 11a2.5 2.5 0 1 0 0-5 M17 15c2.5 0 4 2 4 5',
  megaphone: 'M3 10v4h4l8 5V5L7 10z M18 9a4 4 0 0 1 0 6',
  calendar: 'M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 3',
  check: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M8 12l3 3 5-6'
};

const RULES = [
  // Money words win over the action they qualify (续费金额 is an amount, not a renewal).
  [/金额|万元|收入|营收|元/, 'coin'], [/喜报|海报|案例|资料|报告|文档/, 'document'], [/新签|签约|签单|开通/, 'pen'],
  [/续费|续约|复购|复用/, 'renew'], [/贝系|渠道|合作|联动|置换/, 'link'], [/门票|票/, 'ticket'], [/门店|客情|店/, 'store'],
  [/大屏|广告|曝光|屏/, 'screen'], [/场地|商圈|中厅|地点|区域/, 'pin'], [/增长|提升|提效|率|%/, 'trend'],
  [/人|团队|客户|用户|经纪/, 'users'], [/传播|宣传|推广|直播/, 'megaphone'], [/天|月|周|节点|期/, 'calendar'], [/秒|分钟|时长|耗时/, 'clock']
];
export const pickIcon = (text) => (RULES.find(([re]) => re.test(text || '')) || [null, 'check'])[1];

// An icon on a soft disc in the given colour; bounds is the disc's square box.
export function iconElements({ id, name, bounds: [x, y, s], color, disc }) {
  const pad = Math.round(s * 0.24), path = ICONS[name] || ICONS.check;
  return [
    ...(disc ? [{ type: 'shape', id: `${id}-disc`, bounds: [x, y, s, s], style: { fill: disc, radius: s / 2 } }] : []),
    { type: 'vector', id: `${id}-icon`, bounds: [x + pad, y + pad, s - pad * 2, s - pad * 2], viewBox: [0, 0, 24, 24], path, style: { fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } }
  ];
}
