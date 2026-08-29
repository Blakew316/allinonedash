/**
 * Icon set — 1.5px stroke geometry on a 24px grid, matching the
 * optical weight of Apple's SF Symbols at body size.
 */
const P = {
  dashboard: '<path d="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z"/>',
  map: '<path d="m9 4-6 2.5v13.5L9 17.5m0-13.5 6 2.5m-6-2.5v13.5m6-11v13.5m0-13.5 6-2.5v13.5L15 20.5m0-13.5v13.5m-6-3 6 3"/>',
  calendarClock: '<path d="M20.5 11.5V7a2 2 0 0 0-2-2h-13a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6"/><path d="M3.5 10h17M8 3v4m8-4v4"/><circle cx="17.5" cy="17.5" r="4"/><path d="M17.5 15.8v1.9l1.3.8"/>',
  board: '<rect x="3" y="4" width="18" height="17" rx="2.5"/><path d="M3 9.5h18M9 9.5V21m6-11.5V21"/>',
  route: '<circle cx="6" cy="5.5" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="M8.5 5.5h6a3.5 3.5 0 0 1 0 7h-5a3.5 3.5 0 0 0 0 7h6"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.6" cy="6" r="1.3"/><circle cx="3.6" cy="12" r="1.3"/><circle cx="3.6" cy="18" r="1.3"/>',
  activity: '<path d="M3 12h4l2.5-7 5 14L17 12h4"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4m8-4v4"/>',
  card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6 14.5h4"/>',
  mail: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="m3.5 7 7.4 5.3a2 2 0 0 0 2.2 0L20.5 7"/>',
  users: '<circle cx="9" cy="8" r="3.4"/><path d="M2.8 20a6.4 6.4 0 0 1 12.4 0"/><path d="M16.5 5.2a3.4 3.4 0 0 1 0 5.6M18 14.4a6.4 6.4 0 0 1 3.2 5.6"/>',
  shield: '<path d="M12 2.8 4.5 6v6.2c0 4.4 3.1 8.2 7.5 9.3 4.4-1.1 7.5-4.9 7.5-9.3V6L12 2.8Z"/><path d="m8.8 12 2.2 2.3 4.2-4.6"/>',
  settings: '<circle cx="12" cy="12" r="3.1"/><path d="M19.9 14.4a1.6 1.6 0 0 0 .32 1.77l.06.06a1.9 1.9 0 1 1-2.7 2.7l-.05-.06a1.6 1.6 0 0 0-1.78-.32 1.6 1.6 0 0 0-.97 1.47v.17a1.9 1.9 0 1 1-3.8 0v-.09a1.6 1.6 0 0 0-1.05-1.46 1.6 1.6 0 0 0-1.77.32l-.06.06a1.9 1.9 0 1 1-2.7-2.7l.06-.06a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.47-.97h-.17a1.9 1.9 0 0 1 0-3.8h.09A1.6 1.6 0 0 0 5.6 8.7a1.6 1.6 0 0 0-.32-1.77l-.06-.06a1.9 1.9 0 1 1 2.7-2.7l.06.06a1.6 1.6 0 0 0 1.77.32h.08a1.6 1.6 0 0 0 .97-1.47v-.17a1.9 1.9 0 1 1 3.8 0v.09a1.6 1.6 0 0 0 .97 1.46 1.6 1.6 0 0 0 1.77-.32l.06-.06a1.9 1.9 0 1 1 2.7 2.7l-.06.06a1.6 1.6 0 0 0-.32 1.77v.08a1.6 1.6 0 0 0 1.47.97h.17a1.9 1.9 0 0 1 0 3.8h-.09a1.6 1.6 0 0 0-1.46.97Z"/>',
  funnel: '<path d="M3.5 5h17l-6.5 8v6.5l-4 1.8V13L3.5 5Z"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m20 20-4.4-4.4"/>',
  bell: '<path d="M18 8.6a6 6 0 1 0-12 0c0 6.1-2.4 7.4-2.4 7.4h16.8S18 14.7 18 8.6Z"/><path d="M13.7 20a2 2 0 0 1-3.4 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  play: '<path d="M6.5 4.6 19 12 6.5 19.4V4.6Z"/>',
  chevronDown: '<path d="m6 9.5 6 6 6-6"/>',
  chevronRight: '<path d="m9.5 6 6 6-6 6"/>',
  chevronLeft: '<path d="m14.5 6-6 6 6 6"/>',
  chevronUp: '<path d="m6 14.5 6-6 6 6"/>',
  chevronsLeft: '<path d="m11.5 6-6 6 6 6M18.5 6l-6 6 6 6"/>',
  close: '<path d="M6 6 18 18M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.6 4.6L19 7.2"/>',
  arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4.5a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2H10"/>',
  refresh: '<path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1"/><path d="M20.5 4.5V10H15"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M4.5 19h15"/>',
  phone: '<path d="M7.5 3.5h-2A2.5 2.5 0 0 0 3 6.2C3 14 10 21 17.8 21a2.5 2.5 0 0 0 2.7-2.5v-2a1.4 1.4 0 0 0-1.1-1.4l-3.2-.7a1.4 1.4 0 0 0-1.4.5l-1 1.3a12.6 12.6 0 0 1-5-5l1.3-1a1.4 1.4 0 0 0 .5-1.4l-.7-3.2a1.4 1.4 0 0 0-1.4-1.1Z"/>',
  pin: '<path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/>',
  clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7v5.2l3.3 2"/>',
  alert: '<path d="M12 3.6 2.8 19.5h18.4L12 3.6Z"/><path d="M12 10v4"/><circle cx="12" cy="17" r=".9" fill="currentColor" stroke="none"/>',
  info: '<circle cx="12" cy="12" r="8.6"/><path d="M12 11.2V16"/><circle cx="12" cy="8.2" r=".9" fill="currentColor" stroke="none"/>',
  checkCircle: '<circle cx="12" cy="12" r="8.6"/><path d="m8.4 12.2 2.5 2.5 4.7-5"/>',
  xCircle: '<circle cx="12" cy="12" r="8.6"/><path d="m9.4 9.4 5.2 5.2m0-5.2-5.2 5.2"/>',
  trending: '<path d="M3 16.5 9 10l4 4 8-8.5"/><path d="M15 5.5h6v6"/>',
  target: '<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
  briefcase: '<rect x="2.8" y="7.2" width="18.4" height="13" rx="2.4"/><path d="M8.4 7.2V5.6a2 2 0 0 1 2-2h3.2a2 2 0 0 1 2 2v1.6M2.8 12.6h18.4"/>',
  handshake: '<path d="m11 7 2.4-2.1a2 2 0 0 1 2.6 0L21 9.2v6.2l-2 1.6-3.6-3.2"/><path d="M13 17.6 10.4 20a1.8 1.8 0 0 1-2.5-.1L3 15V9l4.6-4a2 2 0 0 1 2.6 0L13 7.4"/><path d="m8.6 12.2 2 2m1.4-4.4 2.4 2.4"/>',
  building: '<path d="M4 21V5.5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2V21"/><path d="M15 10h3.2a2 2 0 0 1 2 2v9M2.6 21h18.8M8 8h3M8 12h3M8 16h3"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.2M12 19.2v2.2M4.3 4.3l1.6 1.6M18.1 18.1l1.6 1.6M2.6 12h2.2M19.2 12h2.2M4.3 19.7l1.6-1.6M18.1 5.9l1.6-1.6"/>',
  moon: '<path d="M20.5 14.6A8.6 8.6 0 1 1 9.4 3.5a6.8 6.8 0 0 0 11.1 11.1Z"/>',
  monitor: '<rect x="2.6" y="4" width="18.8" height="13" rx="2.4"/><path d="M8.5 21h7M12 17v4"/>',
  logout: '<path d="M15 4.5h2.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H15"/><path d="M10 8 6 12l4 4M6 12h9"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.8 20a7.2 7.2 0 0 1 14.4 0"/>',
  eye: '<path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  edit: '<path d="M4 20h4l10-10a2.4 2.4 0 0 0-3.4-3.4L4.6 16.6 4 20Z"/><path d="m13.6 7.4 3 3"/>',
  trash: '<path d="M4.5 6.5h15M9.5 6.5V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v1.5"/><path d="M6.5 6.5 7.4 19a2 2 0 0 0 2 1.9h5.2a2 2 0 0 0 2-1.9l.9-12.5"/><path d="M10.5 10.5v6m3-6v6"/>',
  copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.2"/><path d="M15.5 5.6A2 2 0 0 0 13.6 4H5.6a2 2 0 0 0-2 2v8a2 2 0 0 0 1.6 1.9"/>',
  send: '<path d="M21 3 10.5 13.5M21 3l-6.6 18-3.9-7.5L3 9.6 21 3Z"/>',
  google: '<path d="M21.6 12.2c0-.7-.06-1.4-.18-2.05H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.75 3-4.3 3-7.35Z" fill="#4285F4" stroke="none"/><path d="M12 22c2.7 0 4.96-.9 6.6-2.43l-3.2-2.5c-.9.6-2.05.95-3.4.95-2.6 0-4.8-1.75-5.6-4.1H3.1v2.58A10 10 0 0 0 12 22Z" fill="#34A853" stroke="none"/><path d="M6.4 13.9a6 6 0 0 1 0-3.83V7.5H3.1a10 10 0 0 0 0 9l3.3-2.6Z" fill="#FBBC05" stroke="none"/><path d="M12 5.98c1.47 0 2.79.5 3.83 1.5l2.84-2.84C16.95 3.05 14.7 2 12 2a10 10 0 0 0-8.9 5.5l3.3 2.57C7.2 7.73 9.4 5.98 12 5.98Z" fill="#EA4335" stroke="none"/>',
  lock: '<rect x="4.5" y="10" width="15" height="10.5" rx="2.4"/><path d="M8 10V7.2a4 4 0 0 1 8 0V10"/>',
  gauge: '<path d="M4 17a8.6 8.6 0 1 1 16 0"/><path d="m12 14 4-4"/><circle cx="12" cy="15.4" r="1.5"/>',
  layers: '<path d="m12 3 9 4.6-9 4.6-9-4.6L12 3Z"/><path d="m3 12.5 9 4.6 9-4.6M3 17l9 4.6 9-4.6"/>',
  zap: '<path d="M13.5 2.5 4 14h7l-.5 7.5L20 10h-7l.5-7.5Z"/>',
  compass: '<circle cx="12" cy="12" r="8.6"/><path d="m15.2 8.8-1.9 4.5-4.5 1.9 1.9-4.5 4.5-1.9Z"/>',
  navigation: '<path d="M3.5 10.8 20.5 3.5l-7.3 17-2-6.4-7.7-3.3Z"/>',
  qr: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.4"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.4"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.4"/><path d="M13.5 13.5h3v3h-3zM20.5 13.5v3M17.5 20.5h3M13.5 20.5h1"/>',
  inbox: '<path d="M3 13.5h4.2l1.6 3h6.4l1.6-3H21"/><path d="M5.4 5h13.2l2.4 8.5V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4.5L5.4 5Z"/>',
  file: '<path d="M13.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9l-5.5-5.5Z"/><path d="M13.5 3.5V9H19"/>',
  sparkles: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z"/><path d="m18.5 15.5.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/>',
  menu: '<path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17"/>',
  minus: '<path d="M5 12h14"/>',
  flag: '<path d="M5 21V4.5m0 0 5.6 1.9a4 4 0 0 0 2.8-.1l2.2-.9a4 4 0 0 1 2.8-.1L20 6v9l-1.6-.6a4 4 0 0 0-2.8.1l-2.2.9a4 4 0 0 1-2.8.1L5 13.6"/>',
  message: '<path d="M20.5 12.6a7.9 7.9 0 0 1-8.5 7.85L4.5 21.5l1.05-7.5A7.9 7.9 0 1 1 20.5 12.6Z"/>',
  db: '<ellipse cx="12" cy="6" rx="8" ry="3.2"/><path d="M4 6v12c0 1.77 3.58 3.2 8 3.2s8-1.43 8-3.2V6"/><path d="M4 12c0 1.77 3.58 3.2 8 3.2s8-1.43 8-3.2"/>',
  wifiOff: '<path d="M3 3l18 18"/><path d="M8.6 15.4a5 5 0 0 1 6.3-.5M5.4 12a9.5 9.5 0 0 1 3.2-2M18.6 12a9.5 9.5 0 0 0-6.9-2.7M2.5 8.6A14 14 0 0 1 7 6M21.5 8.6a14 14 0 0 0-5.4-2.8"/><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none"/>',
  history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4.5V10H9"/><path d="M12 7.5V12l3.2 2"/>',
  star: '<path d="m12 3.5 2.6 5.4 5.9.85-4.25 4.15 1 5.9L12 17.05 6.75 19.75l1-5.9L3.5 9.75l5.9-.85L12 3.5Z"/>',
  bolt: '<path d="M11 21v-7H6l7-11v7h5l-7 11Z"/>',
  slash: '<circle cx="12" cy="12" r="8.6"/><path d="m6 6 12 12"/>',
  share: '<path d="M12 15.2V3.4"/><path d="M8.4 7 12 3.4 15.6 7"/><path d="M7.6 10.2H5.8a2.3 2.3 0 0 0-2.3 2.3v6.7a2.3 2.3 0 0 0 2.3 2.3h12.4a2.3 2.3 0 0 0 2.3-2.3v-6.7a2.3 2.3 0 0 0-2.3-2.3h-1.8"/>',
  plusSquare: '<rect x="3.5" y="3.5" width="17" height="17" rx="4.2"/><path d="M12 8.4v7.2M8.4 12h7.2"/>',
  download2: '<path d="M12 3.4v11.8"/><path d="M8.4 11.6 12 15.2l3.6-3.6"/><path d="M4 18.5v.8a2.3 2.3 0 0 0 2.3 2.3h11.4a2.3 2.3 0 0 0 2.3-2.3v-.8"/>',
};

/**
 * @param {string} name  key in the icon set
 * @param {{size?:number, cls?:string, stroke?:number}} [opt]
 * @returns {string} SVG markup
 */
export function icon(name, opt = {}) {
  const body = P[name] || P.slash;
  const size = opt.size || 20;
  const cls = ['ico', opt.cls].filter(Boolean).join(' ');
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="${opt.stroke || 1.6}" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

export const iconNames = Object.keys(P);
