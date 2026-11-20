// =========================================================================
// ★ 1. 雲端資料庫 Google Apps Script Web App 網址 ★
// =========================================================================
const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbyiUATsPZF-GWwtYSOUAdacA9lncuNNKxYBz0Z1WuVxNpfPEfxoA2Ua_zNT7_yY6yFJ/exec';

// =========================================================================
// ★ 2. 官方社群主頁連結設定區 ★
// =========================================================================
const SOCIAL_LINKS = {
  lineGroup: 'https://line.me/ti/g2/OEat3DZXqNSXAY5_SzvDuDUqaCrqFkb7etKY8Q?utm_source=invitation&utm_medium=link_copy&utm_campaign=default',
  threads: 'https://www.threads.com/@lin.lin0425?igshid=NTc4MTIwNjQ2YQ==',
  instagram: 'https://www.instagram.com/lin.lin0425?avpt=MWVpbnJ6dDQzbXdrMQ%3D%3D&utm_source=qr',
  facebook: ''
};

let appData = null;
let currentStrategy = 'golden';
let currentZoneCut = 'none';
let currentPredicted = [];
let fixedBalls = new Set();
let excludedBalls = new Set();
let freqChartInstance = null;
let currentChartRange = 'freq_30';
let selectedWeekday = 1;
let currentFortuneBall = null;

// 聰明包牌（旋轉矩陣）狀態變數
let wheelSelectedBalls = new Set();
let wheelGuaranteeMode = '4to3'; // '5to3' | '4to3' | '5to4'
let currentWheelTickets = [];

// =========================================================================
// ★ 多頁架構路由表與跨頁狀態同步（不改變任何原有計算邏輯） ★
// =========================================================================
const PAGE_URLS = {
  home: 'index.html',
  picker: 'picker.html',
  backtest: 'backtest.html',
  stats: 'stats.html',
  community: 'community.html'
};

const CURRENT_PAGE = document.body?.dataset?.page || 'home';

const STORAGE_KEYS = {
  pickerState: '539_mp_picker_state',
  wheelState: '539_mp_wheel_state',
  pendingBacktest: '539_mp_pending_backtest',
  pendingShareText: '539_mp_pending_share_text',
  autoImportWheel: '539_mp_auto_import_wheel',
  gasCache: '539_mp_gas_cache_v1'
};

function savePickerState() {
  try {
    localStorage.setItem(STORAGE_KEYS.pickerState, JSON.stringify({
      fixedBalls: Array.from(fixedBalls),
      excludedBalls: Array.from(excludedBalls),
      currentStrategy,
      currentZoneCut,
      currentPredicted
    }));
  } catch (e) {}
}

function loadPickerState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.pickerState);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (Array.isArray(data.fixedBalls)) fixedBalls = new Set(data.fixedBalls);
    if (Array.isArray(data.excludedBalls)) excludedBalls = new Set(data.excludedBalls);
    if (data.currentStrategy && strategyDetails[data.currentStrategy]) {
      currentStrategy = data.currentStrategy;
    }
    if (data.currentZoneCut) currentZoneCut = data.currentZoneCut;
    if (Array.isArray(data.currentPredicted)) currentPredicted = data.currentPredicted;
  } catch (e) {}
}

function saveWheelState() {
  try {
    localStorage.setItem(STORAGE_KEYS.wheelState, JSON.stringify({
      selectedBalls: Array.from(wheelSelectedBalls),
      guaranteeMode: wheelGuaranteeMode,
      tickets: currentWheelTickets
    }));
  } catch (e) {}
}

function loadWheelState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.wheelState);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (Array.isArray(data.selectedBalls)) wheelSelectedBalls = new Set(data.selectedBalls);
    if (data.guaranteeMode) wheelGuaranteeMode = data.guaranteeMode;
    if (Array.isArray(data.tickets)) currentWheelTickets = data.tickets;
  } catch (e) {}
}

function highlightActiveNav() {
  document.querySelectorAll('.nav-tab-desktop').forEach(btn => {
    if (btn.dataset.tab === CURRENT_PAGE) {
      btn.className = 'nav-tab-desktop active flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-amber-300 bg-amber-500/20 transition';
    } else {
      btn.className = 'nav-tab-desktop flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-slate-200 transition';
    }
  });
  document.querySelectorAll('.nav-tab-mobile').forEach(btn => {
    if (btn.dataset.tab === CURRENT_PAGE) {
      btn.className = 'nav-tab-mobile active flex flex-col items-center justify-center gap-1 py-2 px-0.5 rounded-xl text-amber-400 bg-amber-500/15 font-bold transition';
    } else {
      btn.className = 'nav-tab-mobile flex flex-col items-center justify-center gap-1 py-2 px-0.5 rounded-xl text-slate-400 hover:text-slate-200 font-bold transition';
    }
  });
}

function syncPickerUiState() {
  document.querySelectorAll('.strategy-btn').forEach(b => {
    if (b.dataset.strategy === currentStrategy) {
      b.className = 'strategy-btn active px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold border border-amber-500 bg-amber-500/20 text-amber-300 transition';
    } else {
      b.className = 'strategy-btn px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold border border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-500 transition';
    }
  });
  const detail = strategyDetails[currentStrategy];
  const descEl = document.getElementById('strategyDesc');
  if (detail && descEl) {
    descEl.innerHTML = `
      <div class="font-bold text-amber-300 flex items-center gap-1.5">
        <span>${detail.title}</span>
      </div>
      <p class="text-slate-300 leading-relaxed">${detail.desc}</p>
      <div class="pt-1.5 border-t border-slate-800/80 text-xs text-slate-400">
        <strong class="text-slate-300">${detail.formula.split('：')[0]}：</strong>${detail.formula.split('：')[1]}
      </div>
    `;
  }
  document.querySelectorAll('.zone-btn').forEach(b => {
    if (b.dataset.zone === currentZoneCut) {
      b.className = 'zone-btn active py-2 px-2 rounded-xl text-xs font-bold border border-sky-500 bg-sky-500/20 text-sky-300 transition';
    } else {
      b.className = 'zone-btn py-2 px-2 rounded-xl text-xs font-bold border border-slate-700 bg-slate-900/80 text-slate-400 hover:text-slate-200 transition';
    }
  });
  document.querySelectorAll('.wheel-gmode-btn').forEach(btn => {
    if (btn.dataset.gmode === wheelGuaranteeMode) {
      btn.className = 'wheel-gmode-btn active py-2.5 px-2 rounded-xl text-xs font-bold border border-amber-500 bg-amber-500/20 text-amber-300 transition';
    } else {
      btn.className = 'wheel-gmode-btn py-2.5 px-2 rounded-xl text-xs font-bold border border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-500 transition';
    }
  });
}

function onClick(id, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', handler);
}

// 台灣 539 傳統質數定義（含 01 共 13 顆）
const PRIMES_539 = new Set([1, 2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37]);

// 旋轉矩陣標準覆蓋索引模板（6~12碼：涵蓋中5保3、中4保3、中5保4）
const WHEEL_TEMPLATES = {
  6: {
    '5to3': [[0,1,2,3,4]],
    '4to3': [[0,1,2,3,4], [0,1,2,3,5], [0,4,5,1,2]],
    '5to4': [[0,1,2,3,4], [0,1,2,3,5], [0,1,2,4,5], [0,1,3,4,5], [0,2,3,4,5], [1,2,3,4,5]]
  },
  7: {
    '5to3': [[0,1,2,3,4]],
    '4to3': [[0,1,2,3,4], [0,1,2,5,6], [0,3,4,5,6]],
    '5to4': [[0,1,2,3,4], [0,1,2,5,6], [0,3,4,5,6]]
  },
  8: {
    '5to3': [[0,1,2,3,4], [0,1,5,6,7]],
    '4to3': [[0,1,2,3,4], [0,1,5,6,7], [2,3,4,5,6]],
    '5to4': [[0,1,2,3,4], [0,1,5,6,7], [2,3,4,5,6], [0,2,3,4,7], [1,2,3,4,7]]
  },
  9: {
    '5to3': [[0,1,2,3,4], [0,5,6,7,8]],
    '4to3': [[0,1,2,3,4], [0,5,6,7,8], [1,2,3,4,5], [1,2,6,7,8], [0,3,4,6,7]],
    '5to4': [
      [0,1,2,3,4], [0,5,6,7,8], [1,2,3,5,6], [1,2,4,7,8],
      [0,3,4,5,7], [1,3,4,6,8], [0,2,5,6,8], [0,2,3,6,7],
      [0,1,4,5,7], [1,2,3,5,8], [2,4,6,7,8], [0,1,3,4,7]
    ]
  },
  10: {
    '5to3': [[0,1,2,3,4], [5,6,7,8,9]],
    '4to3': [
      [0,1,2,3,4], [5,6,7,8,9], [0,1,2,5,6], [3,4,7,8,9],
      [0,1,3,4,5], [0,2,6,7,8], [1,2,3,6,9], [2,4,5,7,8], [0,1,4,6,9]
    ],
    '5to4': [
      [0,1,2,3,4], [5,6,7,8,9], [0,1,2,5,6], [3,4,7,8,9],
      [0,1,3,5,7], [2,4,6,8,9], [0,1,4,6,7], [2,3,5,8,9],
      [0,1,2,7,8], [3,4,5,6,9], [0,1,3,6,8], [2,4,5,7,9],
      [0,1,4,5,8], [2,3,6,7,9]
    ]
  },
  11: {
    '5to3': [[0,1,2,3,4], [5,6,7,8,9], [0,1,2,5,10]],
    '4to3': [
      [0,1,2,3,4], [5,6,7,8,9], [0,1,2,5,10], [3,4,6,7,10],
      [0,3,8,9,10], [1,4,5,8,9], [2,3,5,6,9], [1,2,7,8,10],
      [0,4,6,7,8], [1,3,5,7,9], [2,4,6,9,10]
    ],
    '5to4': [
      [0,1,2,3,4], [5,6,7,8,9], [0,1,2,5,10], [3,4,6,7,10],
      [0,1,3,6,8], [2,4,5,7,9], [0,1,4,7,9], [2,3,5,8,10],
      [0,2,3,6,9], [1,4,5,6,10], [0,2,4,8,9], [1,3,7,8,9],
      [0,3,5,7,8], [1,2,4,6,7], [2,3,4,5,6], [0,5,6,9,10],
      [1,2,8,9,10], [0,1,6,7,9], [3,4,8,9,10]
    ]
  },
  12: {
    '5to3': [[0,1,2,3,4], [5,6,7,8,9], [0,1,5,10,11]],
    '4to3': [
      [0,1,2,3,4], [5,6,7,8,9], [0,1,5,10,11], [2,3,6,7,10],
      [4,8,9,10,11], [0,2,4,6,8], [1,3,5,7,9], [0,3,7,8,11],
      [1,2,4,9,10], [2,5,8,9,11], [3,4,5,6,11], [0,1,6,7,9],
      [1,4,6,8,10], [0,2,5,7,10]
    ],
    '5to4': [
      [0,1,2,3,4], [5,6,7,8,9], [0,1,5,10,11], [2,3,6,7,10],
      [4,8,9,10,11], [0,1,2,6,8], [3,4,5,7,9], [0,1,3,7,9],
      [2,4,5,6,11], [0,2,3,5,8], [1,4,6,7,10], [0,2,4,7,10],
      [1,3,5,8,11], [0,3,4,6,9], [1,2,7,8,9], [0,5,6,9,10],
      [1,2,5,6,10], [3,4,7,8,11], [0,1,4,8,9], [2,3,9,10,11],
      [0,6,7,8,11], [1,3,4,6,11], [2,5,7,9,10], [0,1,2,7,11]
    ]
  }
};

function applySocialLinks() {
  const bindHref = (id, url) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (url && url.startsWith('http')) {
      el.href = url;
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  };
  bindHref('linkLineGroup', SOCIAL_LINKS.lineGroup);
  bindHref('linkThreads', SOCIAL_LINKS.threads);
  bindHref('linkInstagram', SOCIAL_LINKS.instagram);
  bindHref('linkFacebook', SOCIAL_LINKS.facebook);
  bindHref('footerLine', SOCIAL_LINKS.lineGroup);
  bindHref('footerThreads', SOCIAL_LINKS.threads);
  bindHref('footerIg', SOCIAL_LINKS.instagram);
  bindHref('footerFb', SOCIAL_LINKS.facebook);
}

// =========================================================================
// 🌟 蓋板廣告控制邏輯（雙分頁獨立冷卻、30秒強制倒數、Klook 動態載入）
// =========================================================================
let adShowTimer = null;
let adCountInterval = null;
let adCountdown = 30;

function loadKlookAffiliateScript() {
  const oldScript = document.getElementById('klook-aff-script');
  if (oldScript) oldScript.remove();

  const s = document.createElement('script');
  s.id = 'klook-aff-script';
  s.type = 'text/javascript';
  s.async = true;
  s.src = 'https://affiliate.klook.com/widget/fetch-iframe-init.js';
  document.body.appendChild(s);
}

function openAdModalByType(type) {
  const isLucky = type === 'lucky';
  const modal = document.getElementById(isLucky ? 'luckyAdModal' : 'klookAdModal');
  const closeBtn = document.getElementById(isLucky ? 'luckyCloseBtn' : 'klookCloseBtn');
  const closeText = document.getElementById(isLucky ? 'luckyCloseText' : 'klookCloseText');
  const badge = document.getElementById(isLucky ? 'luckyCountdownBadge' : 'klookCountdownBadge');
  if (!modal || !closeBtn || !closeText || !badge) return;

  if (adCountInterval) clearInterval(adCountInterval);

  adCountdown = 30;
  closeBtn.disabled = true;
  closeBtn.className = 'w-full font-medium py-2.5 rounded-2xl text-sm transition-colors flex justify-center items-center gap-2 bg-gray-100 text-gray-400 cursor-not-allowed';
  closeText.textContent = '請觀看廣告或等候倒數';
  badge.className = isLucky
    ? 'text-xs px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700'
    : 'text-xs px-2 py-0.5 rounded-full font-bold bg-orange-100 text-orange-600';
  badge.textContent = '30s';

  modal.classList.remove('hidden');

  if (!isLucky) {
    loadKlookAffiliateScript();
  }

  const expireTime = Date.now() + 30000;
  adCountInterval = setInterval(() => {
    const remaining = Math.max(0, Math.ceil((expireTime - Date.now()) / 1000));
    adCountdown = remaining;
    badge.textContent = `${remaining}s`;

    if (remaining <= 0) {
      clearInterval(adCountInterval);
      adCountInterval = null;
      closeBtn.disabled = false;
      closeBtn.className = 'w-full font-medium py-2.5 rounded-2xl text-sm transition-colors flex justify-center items-center gap-2 bg-gray-200 text-gray-700 hover:bg-gray-300 cursor-pointer';
      closeText.textContent = '關閉廣告';
      badge.className = 'text-xs px-2 py-0.5 rounded-full font-bold bg-gray-300 text-gray-700';
      badge.textContent = '0s';
      closeAllAdModals();
    }
  }, 250);
}

window.closeAllAdModals = function() {
  if (adCountInterval) {
    clearInterval(adCountInterval);
    adCountInterval = null;
  }
  document.getElementById('klookAdModal')?.classList.add('hidden');
  document.getElementById('luckyAdModal')?.classList.add('hidden');
};

window.handleAdClick = function() {
  setTimeout(() => {
    closeAllAdModals();
  }, 150);
};

function scheduleTabAd(storageKey, delayMs, modalType) {
  if (adShowTimer) {
    clearTimeout(adShowTimer);
    adShowTimer = null;
  }
  const lastShownTime = localStorage.getItem(storageKey);
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;

  if (!lastShownTime || (now - parseInt(lastShownTime, 10)) > oneHour) {
    adShowTimer = setTimeout(() => {
      localStorage.setItem(storageKey, Date.now().toString());
      openAdModalByType(modalType);
    }, delayMs);
  }
}

const strategyDetails = {
  golden: {
    title: '💡 演算法原理：黃金比例綜合模型',
    desc: '綜合「近 30 期熱度」、「遺漏回補動能」、「拖牌關聯」與「斜連／夾號焦點球」進行加權抽樣，並啟動多輪篩選器，強制過濾出符合真實開獎常態分布的組合。',
    formula: '數學濾網條件：奇偶比 3:2 或 2:3 ｜ 五碼總和 80～125 ｜ AC 複雜度 ≥ 4 ｜ 首尾跨度 18～35。'
  },
  hot: {
    title: '💡 演算法原理：熱門順勢追擊模型',
    desc: '假設強勢號碼在短期內具有「慣性延續」效應。系統會大幅拉高近期頻繁開出號碼的中選機率，完整保留高頻強勢球，適合用來追連莊號與當期最旺的熱門主支。',
    formula: '權重計算公式：基礎分 1 ＋ (近10期開出次數 × 4) ＋ (近30期開出次數 × 2.5)。'
  },
  cold: {
    title: '💡 演算法原理：遺漏冷門回補模型',
    desc: '基於統計學「均值回歸」原理，長期未開出的號碼在機率上具備反彈回補空間。系統會優先鎖定遺漏期數最高、且近 30 期開出次數偏低的冷門號碼。',
    formula: '權重計算公式：基礎分 1 ＋ (連續遺漏期數 × 2.2) ＋ (低頻補償分 × 2)。'
  },
  drag: {
    title: '💡 演算法原理：拖牌與斜連版路模型',
    desc: '專注於「期別之間的連動關係」。根據最新一期開出的 5 顆獎號，計算歷史上緊接著下一期最常跟開的拖牌伴侶，並額外給予「斜連號延伸球」與「夾號」高權重加成。',
    formula: '權重計算公式：基礎分 1 ＋ (歷史拖牌連動分 × 3.5) ＋ (斜連／夾號加成 6 分)。'
  },
  random: {
    title: '💡 演算法原理：等機率純隨機模型',
    desc: '所有未被排除的號碼均享有完全相同的基礎權重（1:1 等機率抽樣），不參考冷熱門或歷史拖牌數據，純粹模擬彩券開獎機的物理隨機性。',
    formula: '過濾規則：100% 遵守您設定的「定膽必選」、「殺號排除」與「三區斷區」條件。'
  }
};

function pad2(num) {
  return String(num).padStart(2, '0');
}

function analyzePrimeAndDigitSum(sortedNums) {
  let primeCount = 0;
  let oddDigitSumCount = 0; // 合數單顆數（十位+個位為奇數）
  sortedNums.forEach(num => {
    if (PRIMES_539.has(num)) primeCount++;
    const digitSum = Math.floor(num / 10) + (num % 10);
    if (digitSum % 2 !== 0) oddDigitSumCount++;
  });
  const compCount = sortedNums.length - primeCount;
  const evenDigitSumCount = sortedNums.length - oddDigitSumCount;
  return {
    primeCount,
    compCount,
    primeRatio: `${primeCount}:${compCount}`,
    isValidPrime: primeCount >= 1 && primeCount <= 3,
    isMeanRevertingPrime: primeCount === 1 || primeCount === 2,
    oddDigitSumCount,
    evenDigitSumCount,
    digitSumRatio: `${oddDigitSumCount}:${evenDigitSumCount}`,
    isValidDigitSum: oddDigitSumCount >= 1 && oddDigitSumCount <= 4
  };
}

function nCr(n, r) {
  if (r < 0 || r > n) return 0;
  if (r === 0 || r === n) return 1;
  let res = 1;
  for (let i = 1; i <= r; i++) {
    res = (res * (n - i + 1)) / i;
  }
  return Math.round(res);
}

function calcACValue(sortedNums) {
  const diffs = new Set();
  for (let i = 0; i < sortedNums.length; i++) {
    for (let j = i + 1; j < sortedNums.length; j++) {
      diffs.add(Math.abs(sortedNums[j] - sortedNums[i]));
    }
  }
  return diffs.size - (sortedNums.length - 1);
}

function calcZones(sortedNums) {
  let z1 = 0, z2 = 0, z3 = 0;
  sortedNums.forEach(n => {
    if (n <= 13) z1++;
    else if (n <= 26) z2++;
    else z3++;
  });
  return { z1, z2, z3, label: `${z1}-${z2}-${z3}` };
}

window.switchTab = function(tabName, queryStr = '') {
  if (tabName === CURRENT_PAGE && !queryStr) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  const targetUrl = PAGE_URLS[tabName] || 'index.html';
  window.location.href = queryStr ? `${targetUrl}?${queryStr}` : targetUrl;
};

window.addSingleBallToFixed = function(ballStr) {
  if (fixedBalls.has(ballStr)) {
    switchTab('picker');
    return;
  }
  if (fixedBalls.size >= 4) {
    alert('定膽已滿 4 顆！請先至 AI 選號分頁取消一顆再加入。');
    switchTab('picker');
    return;
  }
  excludedBalls.delete(ballStr);
  fixedBalls.add(ballStr);
  savePickerState();
  if (CURRENT_PAGE === 'picker') {
    renderNumberGrid();
    generatePrediction();
  } else {
    switchTab('picker');
  }
};

window.setTwinAsFixed = function(b1, b2) {
  fixedBalls.clear();
  fixedBalls.add(b1);
  fixedBalls.add(b2);
  excludedBalls.delete(b1);
  excludedBalls.delete(b2);
  savePickerState();
  if (CURRENT_PAGE === 'picker') {
    renderNumberGrid();
    generatePrediction();
  } else {
    switchTab('picker');
  }
};

window.setFormulaUltimateAsFixed = function() {
  const picks = appData?.stats?.formulaAnalysis?.ultimatePicks || [];
  if (!picks.length) return;
  fixedBalls.clear();
  picks.slice(0, 4).forEach(item => {
    fixedBalls.add(item.ball);
    excludedBalls.delete(item.ball);
  });
  savePickerState();
  if (CURRENT_PAGE === 'picker') {
    renderNumberGrid();
    generatePrediction();
  } else {
    switchTab('picker');
  }
};

function wrap39(num) {
  return (((num - 1) % 39) + 39) % 39 + 1;
}

const FORMULA_CATEGORIES = {
  A: { code: 'A', label: '類型 A｜位置加減型', shortLabel: 'A 位置加減', badgeCls: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  B: { code: 'B', label: '類型 B｜跨期差值型', shortLabel: 'B 跨期差值', badgeCls: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
  C: { code: 'C', label: '類型 C｜極值與和值型', shortLabel: 'C 極值和值', badgeCls: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
  D: { code: 'D', label: '類型 D｜間隔週期型', shortLabel: 'D 間隔週期', badgeCls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' }
};

function scanTopFormulas(records) {
  const emptyResult = {
    champions: [],
    consensusTop: [],
    ultimatePicks: [],
    qualifiedCount: 0,
    dedupedCount: 0,
    overheatedCount: 0,
    longWindow: 0,
    shortWindow: 0,
    scoreWindow: 0,
    minLongHits: 19,
    usedFallbackConsensus: false
  };
  if (!records || records.length < 7) return emptyResult;

  const maxAvailable = records.length - 2; // 類型 B 需用到上期與上上期（records[i+1], records[i+2]）
  const longWindow = Math.min(100, maxAvailable);
  const shortWindow = Math.min(20, maxAvailable);
  const scoreWindow = Math.min(30, maxAvailable);
  // 近 100 期嚴格門檻：命中 >= 19 次（約高於隨機基準 +1.85 個標準差，降低多重檢定雜訊）
  const minLongHits = longWindow >= 100 ? 19 : Math.max(2, Math.ceil(longWindow * 0.19));

  // 預先建立無未來洩漏之「各期開獎前遺漏快照」供類型 D（間隔週期型）使用
  function computeOmissionFrom(startIdx) {
    const om = new Array(40).fill(0);
    for (let b = 1; b <= 39; b++) {
      let miss = 0;
      for (let j = startIdx; j < records.length; j++) {
        if (records[j].numbers.includes(b)) break;
        miss++;
      }
      om[b] = miss;
    }
    return om;
  }

  const omNext = computeOmissionFrom(0); // 推算本期（下一期）用
  const omBefore = new Array(longWindow);
  for (let i = 0; i < longWindow; i++) {
    omBefore[i] = computeOmissionFrom(i + 1); // 推算 records[i] 時僅看 records[i+1..]
  }

  function pickBallByOmissionTarget(om, targetOm) {
    let bestBall = 1;
    let bestDiff = Infinity;
    let foundGe = false;
    for (let b = 1; b <= 39; b++) {
      if (om[b] >= targetOm) {
        const diff = om[b] - targetOm;
        if (!foundGe || diff < bestDiff) {
          foundGe = true;
          bestDiff = diff;
          bestBall = b;
        }
      }
    }
    if (foundGe) return bestBall;
    // 若無號碼達標，取當下遺漏最高者
    let maxOm = -1;
    for (let b = 1; b <= 39; b++) {
      if (om[b] > maxOm) {
        maxOm = om[b];
        bestBall = b;
      }
    }
    return bestBall;
  }

  function pickBallByOmissionRank(om, rankIdx) {
    const arr = [];
    for (let b = 1; b <= 39; b++) arr.push(b);
    arr.sort((a, b) => om[b] - om[a] || a - b);
    return arr[rankIdx] || arr[0];
  }

  // 建立四大基因類型公式庫（含 39 進位標準化去冗餘簽名 originKey）
  const formulas = [];

  // 類型 A（位置加減型）：上期第 X 碼 ± 常數（39 進位，含可驗證同源去重之偏移）
  const offsetsA = [3, 5, 6, 7, 8, 9, 11, 12, 14, 15, 18, 21, 24, 27, 30];
  [0, 1, 2, 3, 4].forEach(idx => {
    offsetsA.forEach(offset => {
      const modPos = ((offset % 39) + 39) % 39;
      formulas.push({
        category: 'A',
        originKey: `A_pos${idx}_mod${modPos}`,
        name: `上期第${idx + 1}碼 + ${pad2(offset)}`,
        calc: r1 => wrap39(r1.numbers[idx] + offset)
      });
      const modNeg = (((-offset) % 39) + 39) % 39;
      formulas.push({
        category: 'A',
        originKey: `A_pos${idx}_mod${modNeg}`,
        name: `上期第${idx + 1}碼 - ${pad2(offset)}`,
        calc: r1 => wrap39(r1.numbers[idx] - offset)
      });
    });
  });

  // 類型 B（跨期差值型）：上期第 X 碼 ± (上期第 Y 碼 - 上上期第 Y 碼)
  [0, 1, 2, 3, 4].forEach(x => {
    [0, 1, 2, 3, 4].forEach(y => {
      formulas.push({
        category: 'B',
        originKey: `B_p${x}_plus_d${y}`,
        name: `上期第${x + 1}碼 + (第${y + 1}碼跨期差)`,
        calc: (r1, r2) => wrap39(r1.numbers[x] + (r1.numbers[y] - r2.numbers[y]))
      });
      formulas.push({
        category: 'B',
        originKey: `B_p${x}_minus_d${y}`,
        name: `上期第${x + 1}碼 - (第${y + 1}碼跨期差)`,
        calc: (r1, r2) => wrap39(r1.numbers[x] - (r1.numbers[y] - r2.numbers[y]))
      });
    });
  });

  // 類型 C（極值與和值型）：跨度 ± 常數、和值尾數 + 常數、首尾極值組合
  [0, 3, 5, 7, 9, 11, -3, -5, -7].forEach(off => {
    const modOff = ((off % 39) + 39) % 39;
    const label = off === 0
      ? '上期跨度（最大碼 - 最小碼）'
      : (off > 0 ? `(最大碼 - 最小碼) + ${pad2(off)}` : `(最大碼 - 最小碼) - ${pad2(-off)}`);
    formulas.push({
      category: 'C',
      originKey: `C_span_mod${modOff}`,
      name: label,
      calc: r1 => wrap39((r1.numbers[4] - r1.numbers[0]) + off)
    });
  });
  [1, 5, 10, 15, 20, 25, 30].forEach(off => {
    formulas.push({
      category: 'C',
      originKey: `C_sumtail_${off}`,
      name: `上期和值尾數 + ${pad2(off)}`,
      calc: r1 => wrap39((r1.sum % 10) + off)
    });
  });
  formulas.push(
    { category: 'C', originKey: 'C_p1_plus_p5', name: '上期第1碼 + 上期第5碼', calc: r1 => wrap39(r1.numbers[0] + r1.numbers[4]) },
    { category: 'C', originKey: 'C_p2_plus_p4', name: '上期第2碼 + 上期第4碼', calc: r1 => wrap39(r1.numbers[1] + r1.numbers[3]) },
    { category: 'C', originKey: 'C_p4_minus_p2', name: '上期第4碼 - 上期第2碼', calc: r1 => wrap39(r1.numbers[3] - r1.numbers[1]) },
    { category: 'C', originKey: 'C_p3m1_p15', name: '(第3碼 - 第1碼) + 15', calc: r1 => wrap39((r1.numbers[2] - r1.numbers[0]) + 15) },
    { category: 'C', originKey: 'C_p5m4_p10', name: '(第5碼 - 第4碼) + 10', calc: r1 => wrap39((r1.numbers[4] - r1.numbers[3]) + 10) },
    { category: 'C', originKey: 'C_p2p4t_p12', name: '(第2+第4碼)尾數 + 12', calc: r1 => wrap39(((r1.numbers[1] + r1.numbers[3]) % 10) + 12) },
    { category: 'C', originKey: 'C_sum_avg', name: '上期五碼均值（四捨五入）', calc: r1 => wrap39(Math.round(r1.sum / 5)) }
  );

  // 類型 D（間隔週期型）：針對特定遺漏期數或極冷排名觸發之固定拖牌公式
  [5, 7, 9, 12, 15, 18].forEach(targetOm => {
    [0, 3, 5, 7, -3, -5, -7].forEach(off => {
      const modOff = ((off % 39) + 39) % 39;
      const label = off === 0
        ? `遺漏滿${pad2(targetOm)}期觸發球（直接回補）`
        : (off > 0 ? `遺漏滿${pad2(targetOm)}期觸發球 + ${pad2(off)}` : `遺漏滿${pad2(targetOm)}期觸發球 - ${pad2(-off)}`);
      formulas.push({
        category: 'D',
        originKey: `D_om${targetOm}_mod${modOff}`,
        name: label,
        calc: (r1, r2, om) => wrap39(pickBallByOmissionTarget(om, targetOm) + off)
      });
    });
  });
  [0, 1, 2].forEach(rk => {
    [0, 2, 5, 9, -2, -5, -9].forEach(off => {
      const modOff = ((off % 39) + 39) % 39;
      const label = off === 0
        ? `遺漏第${rk + 1}冷號（直接回補）`
        : (off > 0 ? `遺漏第${rk + 1}冷號 + ${pad2(off)}` : `遺漏第${rk + 1}冷號 - ${pad2(-off)}`);
      formulas.push({
        category: 'D',
        originKey: `D_rk${rk}_mod${modOff}`,
        name: label,
        calc: (r1, r2, om) => wrap39(pickBallByOmissionRank(om, rk) + off)
      });
    });
  });

  // 逐條執行雙視窗（100期/20期）＋ 30期容差積分 ＋ 當前連槓期數評估
  const evaluated = [];
  formulas.forEach(f => {
    const nextPred = f.calc(records[0], records[1], omNext);
    if (!Number.isInteger(nextPred) || nextPred < 1 || nextPred > 39) return;

    let longHits = 0;
    let shortHits = 0;
    let score30 = 0;
    let exact30 = 0;
    let near30 = 0;
    let tail30 = 0;
    let currentMiss = longWindow;
    let missLocked = false;
    const hitDates = [];

    for (let i = 0; i < longWindow; i++) {
      const pred = f.calc(records[i + 1], records[i + 2], omBefore[i]);
      const actualNums = records[i].numbers;
      const isExact = actualNums.includes(pred);

      if (isExact) {
        longHits++;
        if (i < shortWindow) shortHits++;
        if (!missLocked) {
          currentMiss = i;
          missLocked = true;
        }
        if (hitDates.length < 3) hitDates.push(records[i].date.slice(5));
      }

      if (i < scoreWindow) {
        if (isExact) {
          score30 += 3.0;
          exact30++;
        }
        // ±1 鄰號緩衝（不重複計算精準本身，僅捕捉相鄰號碼）
        if (actualNums.includes(pred - 1) || actualNums.includes(pred + 1)) {
          score30 += 1.0;
          near30++;
        }
        // 同尾數判定（排除推算號本身，捕捉尾數慣性）
        const predTail = pred % 10;
        if (actualNums.some(n => n !== pred && (n % 10) === predTail)) {
          score30 += 0.8;
          tail30++;
        }
      }
    }

    const longRate = Math.round((longHits / longWindow) * 1000) / 10;
    const shortRate = Math.round((shortHits / shortWindow) * 1000) / 10;
    const isLongQualified = longHits >= minLongHits && longRate >= 19;
    const isOverheated = shortHits >= 7 || shortRate >= 35;
    const isWarm = !isOverheated && shortRate >= 20 && shortRate <= 25;

    let thermalStatus = 'cold';
    let thermalLabel = '❄️ 動能觀望';
    if (isOverheated) {
      thermalStatus = 'overheat';
      thermalLabel = '⚠️ 過熱警示';
    } else if (isWarm) {
      thermalStatus = 'warm';
      thermalLabel = '🔥 溫熱最佳';
    } else if (shortRate > 25) {
      thermalStatus = 'strong';
      thermalLabel = '⚡ 動能偏強';
    }

    let missStatus = 'broken';
    let missLabel = `🔴 疑斷版（連槓 ${currentMiss} 期）`;
    if (currentMiss <= 2) {
      missStatus = 'active';
      missLabel = currentMiss === 0 ? '🟢 上期剛中（連槓 0 期）' : `🟢 活躍節奏（連槓 ${currentMiss} 期）`;
    } else if (currentMiss <= 4) {
      missStatus = 'watch';
      missLabel = `🟡 觀察中（連槓 ${currentMiss} 期）`;
    }

    // 綜合排序分：30期容差積分 + 長期超額勝率 + 溫熱動能加成 + 活躍節奏微調，過熱套用冷卻閥降權
    let rankScore = score30 + (longRate - 12.8) * 0.6;
    if (isWarm) rankScore += 4.0;
    else if (thermalStatus === 'strong') rankScore += 2.0;

    if (currentMiss <= 2) rankScore += 2.5;
    else if (currentMiss >= 5) rankScore -= 2.0;

    if (isOverheated) {
      rankScore *= 0.65; // 過熱冷卻閥（Cool-down Cap）
    }

    // 共識投票權重（溫熱活躍加權，過熱降權至 0.5 票）
    let voteWeight = 1.0;
    if (isOverheated) voteWeight = 0.5;
    else if (isWarm && currentMiss <= 2) voteWeight = 1.2;
    else if (currentMiss >= 5) voteWeight = 0.8;

    evaluated.push({
      category: f.category,
      originKey: f.originKey,
      name: f.name,
      predicted: pad2(nextPred),
      // 保留 hits/total 欄位以相容社群分享文字等既有引用
      hits: longHits,
      total: longWindow,
      longHits,
      longTotal: longWindow,
      longRate,
      shortHits,
      shortTotal: shortWindow,
      shortRate,
      score30: Math.round(score30 * 10) / 10,
      scoreTotal: scoreWindow,
      exact30,
      near30,
      tail30,
      currentMiss,
      missStatus,
      missLabel,
      isLongQualified,
      isWarm,
      isOverheated,
      thermalStatus,
      thermalLabel,
      rankScore: Math.round(rankScore * 10) / 10,
      voteWeight,
      hitDates
    });
  });

  // 同源公式去冗餘（每個 originKey 只保留 rankScore 最高的 1 條）
  evaluated.sort((a, b) => b.rankScore - a.rankScore || b.score30 - a.score30 || b.longHits - a.longHits);
  const uniqueMap = new Map();
  let dedupedTotal = 0;
  for (const item of evaluated) {
    if (!uniqueMap.has(item.originKey)) {
      uniqueMap.set(item.originKey, item);
    } else {
      dedupedTotal++;
    }
  }
  const dedupedAll = Array.from(uniqueMap.values());

  // 篩出近 100 期勝率 >= 19%（命中 >= 19 次）之合格公式
  const qualifiedRaw = evaluated.filter(f => f.isLongQualified);
  const qualifiedDeduped = dedupedAll.filter(f => f.isLongQualified);
  const dedupedQualifiedRemoved = qualifiedRaw.length - qualifiedDeduped.length;
  const overheatedCount = qualifiedDeduped.filter(f => f.isOverheated).length;

  // 多公式共識投票（Ensemble）：若樣本過少致無合格公式則標註放寬取前 12 條
  let votingPool = qualifiedDeduped;
  let usedFallbackConsensus = false;
  if (votingPool.length === 0) {
    votingPool = dedupedAll.slice(0, 12);
    usedFallbackConsensus = true;
  }

  const voteMap = new Map();
  votingPool.forEach(f => {
    if (!voteMap.has(f.predicted)) {
      voteMap.set(f.predicted, {
        ball: f.predicted,
        votes: 0,
        weightedVotes: 0,
        categories: new Set(),
        formulas: [],
        overheatVotes: 0,
        warmVotes: 0
      });
    }
    const entry = voteMap.get(f.predicted);
    entry.votes += 1;
    entry.weightedVotes += f.voteWeight;
    entry.categories.add(f.category);
    entry.formulas.push(f.name);
    if (f.isOverheated) entry.overheatVotes++;
    if (f.isWarm) entry.warmVotes++;
  });

  const consensusTop = Array.from(voteMap.values())
    .map(v => ({
      ball: v.ball,
      votes: v.votes,
      weightedVotes: Math.round(v.weightedVotes * 10) / 10,
      categories: Array.from(v.categories).sort(),
      formulas: v.formulas,
      overheatVotes: v.overheatVotes,
      warmVotes: v.warmVotes
    }))
    .sort((a, b) =>
      b.votes - a.votes ||
      b.weightedVotes - a.weightedVotes ||
      b.categories.length - a.categories.length ||
      a.ball.localeCompare(b.ball)
    )
    .slice(0, 6);

  // 四大基因維度分組各取 Top 1（A、B、C、D 各推派 1 條冠軍公式）
  const champions = [];
  ['A', 'B', 'C', 'D'].forEach(cat => {
    const qualifiedCat = qualifiedDeduped.filter(f => f.category === cat);
    if (qualifiedCat.length > 0) {
      champions.push({ ...qualifiedCat[0], fallbackRank: false });
    } else {
      const anyCat = dedupedAll.filter(f => f.category === cat);
      if (anyCat.length > 0) {
        champions.push({ ...anyCat[0], fallbackRank: true });
      }
    }
  });

  // 自動濃縮「🎯 本區終極精選（2～3 顆）」：
  // 規則 1：上下雙重交集（同時在共識榜 & 四大冠軍出現）
  // 規則 2：上排共識頭牌（#1）
  // 規則 3：下排綠燈活躍（連槓 ≤ 2 期且未過熱）最高容差積分冠軍
  const ultimatePicks = [];
  const pickedUltimateSet = new Set();
  const consensusLookup = new Map();
  consensusTop.forEach((c, idx) => consensusLookup.set(c.ball, { ...c, rank: idx + 1 }));

  // 1) 上下雙重交集
  const intersectionChamps = champions
    .filter(ch => consensusLookup.has(ch.predicted))
    .sort((a, b) =>
      (a.isOverheated ? 1 : 0) - (b.isOverheated ? 1 : 0) ||
      (a.currentMiss <= 2 ? 0 : 1) - (b.currentMiss <= 2 ? 0 : 1) ||
      b.score30 - a.score30 ||
      b.longRate - a.longRate
    );

  for (const ch of intersectionChamps) {
    if (ultimatePicks.length >= 3) break;
    if (pickedUltimateSet.has(ch.predicted)) continue;
    const cInfo = consensusLookup.get(ch.predicted);
    pickedUltimateSet.add(ch.predicted);
    ultimatePicks.push({
      ball: ch.predicted,
      tier: 'intersect',
      badge: '👑 上下雙重交集',
      badgeCls: 'bg-amber-500/25 text-amber-200 border-amber-400/60',
      reason: `共識#${cInfo.rank}(${cInfo.votes}條) × 類型${ch.category}冠軍(${ch.score30}分 · 連槓${ch.currentMiss}期)`
    });
  }

  // 2) 上排共識 #1（票數領先頭牌）
  if (ultimatePicks.length < 3 && consensusTop.length > 0) {
    const c0 = consensusTop[0];
    if (!pickedUltimateSet.has(c0.ball)) {
      const isGapLeader = consensusTop.length === 1 ||
        c0.votes > consensusTop[1].votes ||
        (c0.weightedVotes - consensusTop[1].weightedVotes) >= 0.5;
      pickedUltimateSet.add(c0.ball);
      ultimatePicks.push({
        ball: c0.ball,
        tier: 'consensus',
        badge: isGapLeader ? '🗳️ 共識斷層 #1' : '🗳️ 多公式共識 #1',
        badgeCls: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50',
        reason: `${c0.votes} 條算出 · 加權 ${c0.weightedVotes} 票（跨 ${c0.categories.join('/')} 維度）`
      });
    }
  }

  // 3) 下排綠燈活躍（連槓 ≤ 2 期且未過熱）最高分冠軍
  if (ultimatePicks.length < 3) {
    const activeChamps = champions
      .filter(ch => !pickedUltimateSet.has(ch.predicted) && !ch.isOverheated && ch.currentMiss <= 2)
      .sort((a, b) => b.longRate - a.longRate || b.score30 - a.score30 || a.currentMiss - b.currentMiss);

    for (const ch of activeChamps) {
      if (ultimatePicks.length >= 3) break;
      pickedUltimateSet.add(ch.predicted);
      ultimatePicks.push({
        ball: ch.predicted,
        tier: 'champion',
        badge: `🟢 活躍冠軍（類型${ch.category}）`,
        badgeCls: 'bg-sky-500/20 text-sky-300 border-sky-400/50',
        reason: `長期${ch.longRate}% · 容差${ch.score30}分 · 連槓${ch.currentMiss}期`
      });
    }
  }

  // 保底機制：若精選不足 2 顆，依序從次佳未過熱冠軍或共識 #2 補滿至 2 顆
  if (ultimatePicks.length < 2) {
    const backupChamps = champions
      .filter(ch => !pickedUltimateSet.has(ch.predicted))
      .sort((a, b) => (a.isOverheated ? 1 : 0) - (b.isOverheated ? 1 : 0) || b.score30 - a.score30);
    for (const ch of backupChamps) {
      if (ultimatePicks.length >= 2) break;
      pickedUltimateSet.add(ch.predicted);
      ultimatePicks.push({
        ball: ch.predicted,
        tier: 'champion',
        badge: `🧬 維度冠軍（類型${ch.category}）`,
        badgeCls: 'bg-purple-500/20 text-purple-300 border-purple-400/50',
        reason: `長期${ch.longRate}% · 容差${ch.score30}分 · 連槓${ch.currentMiss}期`
      });
    }
  }

  return {
    champions,
    consensusTop,
    ultimatePicks,
    qualifiedCount: qualifiedDeduped.length,
    dedupedCount: dedupedQualifiedRemoved > 0 ? dedupedQualifiedRemoved : dedupedTotal,
    overheatedCount,
    longWindow,
    shortWindow,
    scoreWindow,
    minLongHits,
    usedFallbackConsensus
  };
}

function buildStatsFromRecords(records) {
  const allBalls = Array.from({ length: 39 }, (_, i) => pad2(i + 1));

  function countFreq(sliceRecords) {
    const map = {};
    allBalls.forEach(b => { map[b] = 0; });
    sliceRecords.forEach(r => {
      r.numbers_str.forEach(b => { map[b] = (map[b] || 0) + 1; });
    });
    return map;
  }

  const freq_5 = countFreq(records.slice(0, 5));
  const hot5Ge2Set = new Set(
    allBalls.filter(b => (freq_5[b] || 0) >= 2)
  );
  const freq_10 = countFreq(records.slice(0, 10));
  const freq_30 = countFreq(records.slice(0, 30));
  const freq_50 = countFreq(records.slice(0, 50));
  const freq_all = countFreq(records);

  const omission = {};
  const maxOmissionMap = {};
  allBalls.forEach(ball => {
    let currMiss = 0;
    for (const r of records) {
      if (r.numbers_str.includes(ball)) break;
      currMiss++;
    }
    omission[ball] = currMiss;

    let maxMiss = currMiss;
    let streak = 0;
    for (const r of records) {
      if (r.numbers_str.includes(ball)) {
        if (streak > maxMiss) maxMiss = streak;
        streak = 0;
      } else {
        streak++;
      }
    }
    if (streak > maxMiss) maxMiss = streak;
    maxOmissionMap[ball] = Math.max(maxMiss, 1);
  });

  const top_omission = Object.entries(omission)
    .map(([ball, om]) => {
      const histMax = maxOmissionMap[ball] || Math.max(om, 1);
      const nearPct = Math.min(100, Math.round((om / histMax) * 100));
      return { ball, omission: om, maxOmission: histMax, nearPct };
    })
    .sort((a, b) => b.omission - a.omission || b.nearPct - a.nearPct || a.ball.localeCompare(b.ball))
    .slice(0, 8);

  const tailCounts = Array(10).fill(0);
  records.slice(0, 30).forEach(r => {
    r.numbers_str.forEach(b => { tailCounts[Number(b[1])]++; });
  });

  const tails_30 = tailCounts
    .map((count, digit) => ({ tail: `${digit}尾`, digit: String(digit), count }))
    .sort((a, b) => b.count - a.count || a.digit.localeCompare(b.digit));

  const latestSet = new Set(records[0].numbers_str);
  const dragScore = {};
  const dragSources = {};
  const dragLimit = Math.min(200, records.length);

  for (let i = 1; i < dragLimit; i++) {
    const prevDraw = records[i].numbers_str;
    const nextDraw = records[i - 1].numbers_str;
    const matched = prevDraw.filter(b => latestSet.has(b));
    if (matched.length > 0) {
      nextDraw.forEach(nb => {
        dragScore[nb] = (dragScore[nb] || 0) + matched.length;
        if (!dragSources[nb]) dragSources[nb] = new Set();
        matched.forEach(m => dragSources[nb].add(m));
      });
    }
  }

  const drag_top6 = Object.entries(dragScore)
    .map(([ball, score]) => ({
      ball,
      score,
      triggered_by: Array.from(dragSources[ball]).sort()
    }))
    .sort((a, b) => b.score - a.score || a.ball.localeCompare(b.ball))
    .slice(0, 6);

  const pairCounts = {};
  records.forEach(r => {
    const arr = r.numbers_str;
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const key = `${arr[i]}-${arr[j]}`;
        pairCounts[key] = (pairCounts[key] || 0) + 1;
      }
    }
  });

  const top_twins = Object.entries(pairCounts)
    .map(([pair, count]) => {
      const [b1, b2] = pair.split('-');
      return { b1, b2, count };
    })
    .sort((a, b) => b.count - a.count || a.b1.localeCompare(b.b1))
    .slice(0, 5);

  const recent30 = records.slice(0, 30);
  const recent200 = records.slice(0, 200);
  let repeatDraws = 0;
  let totalRepeatBalls = 0;
  const repeatBallCounter = {};
  for (let i = 0; i < recent200.length - 1; i++) {
    const curr = recent200[i].numbers_str;
    const prevSet = new Set(recent200[i + 1].numbers_str);
    const repeats = curr.filter(b => prevSet.has(b));
    if (repeats.length > 0) {
      repeatDraws++;
      totalRepeatBalls += repeats.length;
      repeats.forEach(b => { repeatBallCounter[b] = (repeatBallCounter[b] || 0) + 1; });
    }
  }
  const comparePairs = Math.max(0, recent200.length - 1);
  const repeatRate = comparePairs > 0 ? Math.round((repeatDraws / comparePairs) * 100) : 0;
  const avgRepeatBalls = comparePairs > 0 ? Math.round((totalRepeatBalls / comparePairs) * 100) / 100 : 0;
  const singleBallRepeatRate = comparePairs > 0 ? Math.round((totalRepeatBalls / (comparePairs * 5)) * 1000) / 10 : 0;
  const topRepeats = Object.entries(repeatBallCounter)
    .map(([ball, count]) => ({ ball, count }))
    .sort((a, b) => b.count - a.count || a.ball.localeCompare(b.ball))
    .slice(0, 4);

  let consecDraws = 0;
  recent200.forEach(r => {
    const nums = r.numbers;
    let hasConsec = false;
    for (let i = 0; i < nums.length - 1; i++) {
      if (nums[i + 1] - nums[i] === 1) {
        hasConsec = true;
        break;
      }
    }
    if (hasConsec) consecDraws++;
  });
  const consecRate = recent200.length > 0 ? Math.round((consecDraws / recent200.length) * 100) : 0;

  const obliqueSet = new Set();
  const skipOneList = [];
  if (records.length >= 2) {
    const d0 = records[0].numbers;
    const d1 = records[1].numbers;
    const d0Set = new Set(d0);

    d1.forEach(prevNum => {
      if (!d0Set.has(prevNum)) skipOneList.push(pad2(prevNum));
      if (d0Set.has(prevNum + 1) && prevNum + 2 <= 39) obliqueSet.add(pad2(prevNum + 2));
      if (d0Set.has(prevNum - 1) && prevNum - 2 >= 1) obliqueSet.add(pad2(prevNum - 2));
    });
  }

  const latestNums = records[0].numbers;
  const latestNumSet = new Set(latestNums);
  const sandwichBalls = [];
  for (let i = 0; i < latestNums.length - 1; i++) {
    if (latestNums[i + 1] - latestNums[i] === 2) {
      sandwichBalls.push(pad2(latestNums[i] + 1));
    }
  }

  const neighborSet = new Set();
  latestNums.forEach(n => {
    if (n - 1 >= 1 && !latestNumSet.has(n - 1)) neighborSet.add(pad2(n - 1));
    if (n + 1 <= 39 && !latestNumSet.has(n + 1)) neighborSet.add(pad2(n + 1));
  });

  let neighborHitDraws = 0;
  for (let i = 0; i < recent30.length - 1; i++) {
    const currNums = recent30[i].numbers;
    const prevNums = recent30[i + 1].numbers;
    const prevNeighbors = new Set();
    prevNums.forEach(n => {
      if (n - 1 >= 1) prevNeighbors.add(n - 1);
      if (n + 1 <= 39) prevNeighbors.add(n + 1);
    });
    if (currNums.some(n => prevNeighbors.has(n))) {
      neighborHitDraws++;
    }
  }
  const neighborHitRate = recent30.length > 1 ? Math.round((neighborHitDraws / (recent30.length - 1)) * 100) : 0;

  const weekdayStats = { 1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {} };
  const weekdayDrawCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  records.forEach(r => {
    const parts = r.date.split('/');
    if (parts.length === 3) {
      const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      const day = dt.getDay();
      if (weekdayStats[day]) {
        weekdayDrawCounts[day]++;
        r.numbers_str.forEach(b => {
          weekdayStats[day][b] = (weekdayStats[day][b] || 0) + 1;
        });
      }
    }
  });

  const weekdayTop5 = {};
  [1, 2, 3, 4, 5, 6].forEach(day => {
    weekdayTop5[day] = Object.entries(weekdayStats[day])
      .map(([ball, count]) => ({ ball, count, totalDraws: weekdayDrawCounts[day] }))
      .sort((a, b) => b.count - a.count || a.ball.localeCompare(b.ball))
      .slice(0, 5);
  });

  const roadCounts = [0, 0, 0];
  records.slice(0, 10).forEach(r => {
    r.numbers.forEach(n => {
      roadCounts[n % 3]++;
    });
  });
  const road0NeedsBoost = roadCounts[0] < 14;
  const road0WeightBoost = road0NeedsBoost ? Math.min(12, 4 + (14 - roadCounts[0]) * 1.5) : 0;

  // 近 30 期質合比、合數單雙、合數值 1～12 熱區與雙尾共現率（姐妹尾）
  const primeRatioCounts = { '0:5': 0, '1:4': 0, '2:3': 0, '3:2': 0, '4:1': 0, '5:0': 0 };
  const digitSumRatioCounts = { '0:5': 0, '1:4': 0, '2:3': 0, '3:2': 0, '4:1': 0, '5:0': 0 };
  const digitSum1to12Counts = {};
  for (let d = 1; d <= 12; d++) digitSum1to12Counts[d] = 0;

  const tailPairCounts = {};
  recent30.forEach(r => {
    const pd = analyzePrimeAndDigitSum(r.numbers);
    if (primeRatioCounts[pd.primeRatio] !== undefined) primeRatioCounts[pd.primeRatio]++;
    if (digitSumRatioCounts[pd.digitSumRatio] !== undefined) digitSumRatioCounts[pd.digitSumRatio]++;

    r.numbers.forEach(n => {
      const ds = Math.floor(n / 10) + (n % 10);
      if (digitSum1to12Counts[ds] !== undefined) digitSum1to12Counts[ds]++;
    });

    const uniqueTails = Array.from(new Set(r.numbers.map(n => n % 10))).sort((a, b) => a - b);
    for (let i = 0; i < uniqueTails.length; i++) {
      for (let j = i + 1; j < uniqueTails.length; j++) {
        const key = `${uniqueTails[i]}-${uniqueTails[j]}`;
        tailPairCounts[key] = (tailPairCounts[key] || 0) + 1;
      }
    }
  });

  const sisterTailsTop6 = Object.entries(tailPairCounts)
    .map(([pair, count]) => {
      const [t1, t2] = pair.split('-');
      const pct = recent30.length > 0 ? Math.round((count / recent30.length) * 100) : 0;
      return { t1, t2, count, pct };
    })
    .sort((a, b) => b.count - a.count || a.t1.localeCompare(b.t1))
    .slice(0, 6);

  const formulaAnalysis = scanTopFormulas(records);
  const topFormulas = formulaAnalysis.champions;

  return {
    updated_at: records[0].updated_at || new Date().toLocaleString('zh-TW'),
    total_analyzed: records.length,
    latest: records[0],
    history: records,
    stats: {
      freq_5,
      hot5Ge2Set,
      freq_10,
      freq_30,
      freq_50,
      freq_all,
      omission,
      maxOmissionMap,
      top_omission,
      tails_30,
      drag_top6,
      top_twins,
      repeatRate,
      avgRepeatBalls,
      singleBallRepeatRate,
      consecRate,
      topRepeats,
      obliqueBalls: Array.from(obliqueSet).sort(),
      skipOneBalls: skipOneList.sort(),
      sandwichBalls,
      neighborBalls: Array.from(neighborSet).sort(),
      neighborHitRate,
      weekdayTop5,
      roadCounts,
      road0NeedsBoost,
      road0WeightBoost,
      primeRatioCounts,
      digitSumRatioCounts,
      digitSum1to12Counts,
      sisterTailsTop6,
      topFormulas,
      formulaAnalysis
    }
  };
}

function normalizeGasPayload(res) {
  const rawRows = Array.isArray(res?.rows)
    ? res.rows
    : (Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []));

  return rawRows.map(item => {
    if (!item) return null;
    const period = String(item.period ?? item.期別 ?? item.drawNumber ?? '').trim();
    const date = String(item.date ?? item.開獎日期 ?? item.drawDate ?? '').trim().replace(/-/g, '/');
    let rawNums = item.nums ?? item.numbers ?? item.獎號 ?? item.號碼 ?? [];
    if (typeof rawNums === 'string') {
      rawNums = rawNums.match(/\d{1,2}/g) || [];
    }
    const nums = Array.isArray(rawNums) ? rawNums.map(Number).filter(n => !isNaN(n) && n >= 1 && n <= 39) : [];
    return {
      period,
      date,
      nums,
      updated_at: item.updated_at ?? item.更新時間 ?? ''
    };
  }).filter(Boolean);
}

async function fetchGasFallback(timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const sep = GAS_WEBAPP_URL.includes('?') ? '&' : '?';
    const url = `${GAS_WEBAPP_URL}${sep}_t=${Date.now()}`;
    const resp = await fetch(url, { method: 'GET', cache: 'no-store', signal: controller.signal });
    if (!resp.ok) throw new Error(`HTTP 狀態碼 ${resp.status}`);
    const text = await resp.text();
    const jsonpMatch = text.match(/^[a-zA-Z0-9_$]+\s*\((.*)\)\s*;?\s*$/s);
    const payloadStr = jsonpMatch ? jsonpMatch[1] : text;
    return JSON.parse(payloadStr);
  } finally {
    clearTimeout(timer);
  }
}

function processGasResponse(res, alertBox, alertMsg, saveToCache = true) {
  try {
    const rows = normalizeGasPayload(res);
    if (!rows || rows.length === 0) {
      throw new Error('試算表「開獎紀錄」分頁尚無資料，請先在 Apps Script 執行 syncDaily539 或確認 doGet 回傳欄位。');
    }

    const seenPeriods = new Set();
    const records = [];

    rows.forEach(item => {
      if (!item.period || !item.date || seenPeriods.has(item.period)) return;
      const nums = (item.nums || []).map(Number).filter(n => !isNaN(n) && n >= 1 && n <= 39);
      if (nums.length < 5) return;

      nums.sort((a, b) => a - b);
      seenPeriods.add(item.period);
      records.push({
        period: item.period,
        date: item.date,
        numbers: nums,
        numbers_str: nums.map(pad2),
        sum: nums.reduce((a, b) => a + b, 0),
        odd_count: nums.filter(n => n % 2 === 1).length,
        ac: calcACValue(nums),
        span: nums[4] - nums[0],
        updated_at: item.updated_at || ''
      });
    });

    if (records.length === 0) throw new Error('解析不到有效的五碼開獎紀錄，請檢查開獎資料格式。');

    records.sort((a, b) => b.date.localeCompare(a.date) || b.period.localeCompare(a.period));
    if (saveToCache) {
      try {
        sessionStorage.setItem(STORAGE_KEYS.gasCache, JSON.stringify({ ts: Date.now(), payload: res }));
      } catch (e) {}
    }
    appData = buildStatsFromRecords(records);
    if (alertBox) alertBox.classList.add('hidden');
    renderAll();
    return true;
  } catch (err) {
    alertBox.classList.remove('hidden');
    alertMsg.textContent = err.message;
    document.getElementById('updateTime').textContent = '同步失敗';
    return false;
  }
}

const FALLBACK_539_ROWS = [
  { period: '115000280', date: '2026/11/19', nums: [4, 12, 19, 28, 36] },
  { period: '115000279', date: '2026/11/18', nums: [2, 11, 18, 25, 34] },
  { period: '115000278', date: '2026/11/17', nums: [6, 14, 21, 29, 38] },
  { period: '115000277', date: '2026/11/16', nums: [3, 10, 17, 26, 33] },
  { period: '115000276', date: '2026/11/14', nums: [5, 13, 22, 30, 37] },
  { period: '115000275', date: '2026/11/13', nums: [1, 9, 16, 24, 35] },
  { period: '115000274', date: '2026/11/12', nums: [7, 15, 23, 31, 39] },
  { period: '115000273', date: '2026/11/11', nums: [4, 12, 20, 27, 36] },
  { period: '115000272', date: '2026/11/10', nums: [2, 8, 17, 25, 34] },
  { period: '115000271', date: '2026/11/09', nums: [6, 13, 21, 28, 38] },
  { period: '115000270', date: '2026/11/07', nums: [3, 11, 19, 26, 35] },
  { period: '115000269', date: '2026/11/06', nums: [5, 14, 22, 30, 37] },
  { period: '115000268', date: '2026/11/05', nums: [1, 8, 16, 24, 33] },
  { period: '115000267', date: '2026/11/04', nums: [7, 15, 23, 31, 39] },
  { period: '115000266', date: '2026/11/03', nums: [4, 10, 18, 27, 36] },
  { period: '115000265', date: '2026/11/02', nums: [2, 12, 20, 29, 34] },
  { period: '115000264', date: '2026/10/31', nums: [6, 13, 19, 25, 38] },
  { period: '115000263', date: '2026/10/30', nums: [3, 9, 17, 26, 35] },
  { period: '115000262', date: '2026/10/29', nums: [5, 11, 21, 28, 37] },
  { period: '115000261', date: '2026/10/28', nums: [1, 7, 16, 24, 33] }
];

function activateOfflineFallback(alertBox, alertMsg, reasonText) {
  if (alertBox && alertMsg) {
    alertBox.classList.remove('hidden');
    alertMsg.textContent = `${reasonText}（已自動載入內建參考開獎資料確保功能正常運作，可隨時點擊右上角「🔄 同步」重試）。`;
  }
  document.getElementById('updateTime').textContent = '離線參考模式';
  processGasResponse({ rows: FALLBACK_539_ROWS }, { classList: { add: () => {} } }, { textContent: '' }, false);
}

function initApp(forceReload = false) {
  const alertBox = document.getElementById('configAlert');
  const alertMsg = document.getElementById('configAlertMsg');

  if (forceReload) {
    sessionStorage.removeItem(STORAGE_KEYS.gasCache);
  } else {
    try {
      const cachedRaw = sessionStorage.getItem(STORAGE_KEYS.gasCache);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (cached && cached.ts && (Date.now() - cached.ts) < 5 * 60 * 1000 && cached.payload) {
          if (processGasResponse(cached.payload, alertBox, alertMsg, false)) {
            return;
          }
        }
      }
    } catch (e) {}
  }

  if (!GAS_WEBAPP_URL || !GAS_WEBAPP_URL.startsWith('https://script.google.com/')) {
    activateOfflineFallback(alertBox, alertMsg, '尚未設定 GAS_WEBAPP_URL');
    return;
  }

  document.getElementById('updateTime').textContent = '讀取雲端中...';

  let settled = false;
  const callbackName = 'handle539Data_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  const script = document.createElement('script');

  const cleanup = () => {
    if (window[callbackName]) delete window[callbackName];
    if (script.parentNode) script.remove();
  };

  const finishWithFallback = async (errLabel) => {
    if (settled) return;
    cleanup();
    try {
      const fallbackRes = await fetchGasFallback(4500);
      if (settled) return;
      settled = true;
      const ok = processGasResponse(fallbackRes, alertBox, alertMsg);
      if (!ok) {
        activateOfflineFallback(alertBox, alertMsg, errLabel);
      }
    } catch (fbErr) {
      if (settled) return;
      settled = true;
      activateOfflineFallback(alertBox, alertMsg, `${errLabel}（${fbErr.message || '連線逾時'}）`);
    }
  };

  const jsonpTimeout = setTimeout(() => {
    finishWithFallback('雲端試算表連線逾時');
  }, 4500);

  window[callbackName] = function(res) {
    if (settled) return;
    settled = true;
    clearTimeout(jsonpTimeout);
    cleanup();
    const ok = processGasResponse(res, alertBox, alertMsg);
    if (!ok) {
      activateOfflineFallback(alertBox, alertMsg, '雲端回傳資料格式異常');
    }
  };

  script.onerror = function() {
    clearTimeout(jsonpTimeout);
    finishWithFallback('無法載入雲端試算表指令碼');
  };

  const sep = GAS_WEBAPP_URL.includes('?') ? '&' : '?';
  script.src = `${GAS_WEBAPP_URL}${sep}callback=${callbackName}&_t=${Date.now()}`;
  document.body.appendChild(script);
}

function renderWeekdayHotList(dayNum) {
  if (!appData) return;
  selectedWeekday = dayNum;
  const dayNames = { 1: '週一', 2: '週二', 3: '週三', 4: '週四', 5: '週五', 6: '週六' };

  document.querySelectorAll('.wd-tab').forEach(btn => {
    if (Number(btn.dataset.day) === dayNum) {
      btn.className = 'wd-tab py-1 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 transition';
    } else {
      btn.className = 'wd-tab py-1 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition';
    }
  });

  const list = appData.stats.weekdayTop5[dayNum] || [];
  const box = document.getElementById('weekdayHotList');
  if (!box) return;
  if (list.length === 0) {
    box.innerHTML = `<div class="text-xs text-slate-500 py-4 text-center">${dayNames[dayNum]}尚無足夠統計資料</div>`;
    return;
  }

  box.innerHTML = list.map((item, idx) => `
    <div class="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-950/75 border border-slate-800/80 text-xs">
      <div class="flex items-center gap-2">
        <span class="w-6 h-6 rounded-full ${idx < 2 ? 'ball-gold' : 'bg-slate-800 text-slate-200'} flex items-center justify-center font-num font-bold text-[11px]">${item.ball}</span>
        <span class="text-slate-300 font-bold">${item.ball} 號</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-amber-400 font-bold">${dayNames[dayNum]}開 ${item.count} 次</span>
        <button onclick="addSingleBallToFixed('${item.ball}')" class="text-[11px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 font-bold">+膽</button>
      </div>
    </div>
  `).join('');
}

function renderTrendMatrix() {
  if (!appData) return;
  const recent15 = appData.history.slice(0, 15);
  const thead = document.getElementById('trendMatrixHead');
  const tbody = document.getElementById('trendMatrixBody');
  if (!thead || !tbody) return;

  let headHtml = '<tr class="bg-slate-900 text-slate-400 border-b border-slate-800">';
  headHtml += '<th class="sticky left-0 z-10 bg-slate-900 px-2.5 py-2 text-left font-sans font-bold text-slate-200 border-r border-slate-800 whitespace-nowrap">期別 / 日期</th>';
  for (let i = 1; i <= 39; i++) {
    headHtml += `<th class="px-1.5 py-2 min-w-[26px]">${pad2(i)}</th>`;
  }
  headHtml += '</tr>';
  thead.innerHTML = headHtml;

  let bodyHtml = '';
  recent15.forEach((draw, rowIdx) => {
    const currSet = new Set(draw.numbers);
    const prevDraw = recent15[rowIdx + 1] ? recent15[rowIdx + 1].numbers : [];
    const prevSet = new Set(prevDraw);

    const prevSandwich = new Set();
    for (let k = 0; k < prevDraw.length - 1; k++) {
      if (prevDraw[k + 1] - prevDraw[k] === 2) {
        prevSandwich.add(prevDraw[k] + 1);
      }
    }

    bodyHtml += '<tr class="hover:bg-slate-900/60">';
    bodyHtml += `
      <td class="sticky left-0 z-10 bg-slate-950 px-2.5 py-1.5 text-left font-sans border-r border-slate-800 whitespace-nowrap">
        <div class="font-bold text-slate-200">${draw.date.slice(5)}</div>
        <div class="text-[10px] text-slate-500">${draw.period.slice(-4)}期</div>
      </td>
    `;

    for (let n = 1; n <= 39; n++) {
      if (currSet.has(n)) {
        let ballCls = 'ball-gold';
        if (prevSet.has(n)) {
          ballCls = 'ball-red';
        } else if (prevSandwich.has(n)) {
          ballCls = 'ball-emerald';
        } else if (prevSet.has(n - 1) || prevSet.has(n + 1)) {
          ballCls = 'ball-purple';
        }
        bodyHtml += `
          <td class="p-1">
            <span class="w-5 h-5 mx-auto rounded-full ${ballCls} flex items-center justify-center font-bold text-[10px]">
              ${pad2(n)}
            </span>
          </td>
        `;
      } else {
        bodyHtml += `<td class="p-1 text-slate-800">·</td>`;
      }
    }
    bodyHtml += '</tr>';
  });

  tbody.innerHTML = bodyHtml;
}

function updateCommunityShareText() {
  const box = document.getElementById('communitySharePreview');
  if (!box) return;
  if (!appData) {
    box.value = '資料同步中，請稍候...';
    return;
  }

  const latest = appData.latest;
  const topTwin = appData.stats.top_twins[0];
  const topFormula = appData.stats.topFormulas[0];
  const aiPickStr = currentPredicted.length ? currentPredicted.join('、') : '演算中';

  const lines = [
    `🔥【今彩539 AI 預測大師｜每日牌路速報】`,
    `📅 最新開獎（${latest.date} 第${latest.period}期）：${latest.numbers_str.join('、')}`,
    `👯 全期最強雙星伴侶：${topTwin ? `${topTwin.b1} & ${topTwin.b2}（同開 ${topTwin.count} 次）` : '--'}`,
    topFormula ? `🧮 近期高準度版路公式：${topFormula.name} ➔ 看好【${topFormula.predicted}】` : '',
    `⚡ AI 黃金比例推薦 5 碼：${aiPickStr}`,
    `👉 免費查牌路／回測對獎：https://kokko-travel.com/539/`
  ].filter(Boolean);

  box.value = lines.join('\n');
}

function renderAll() {
  const updateTimeEl = document.getElementById('updateTime');
  if (updateTimeEl) updateTimeEl.textContent = `已同步：${appData.updated_at.slice(5, 16)}`;

  // 1) 首頁總覽（index.html）
  if (document.getElementById('latestBalls')) {
  const latest = appData.latest;
  document.getElementById('latestPeriod').textContent = `第 ${latest.period} 期`;
  document.getElementById('latestDate').textContent = latest.date;
  document.getElementById('latestSum').textContent = latest.sum;
  document.getElementById('latestOddEven').textContent = `${latest.odd_count}:${5 - latest.odd_count}`;
  const latestPD = analyzePrimeAndDigitSum(latest.numbers);
  document.getElementById('latestPrimeRatio').textContent = latestPD.primeRatio;
  document.getElementById('latestDigitSum').textContent = latestPD.digitSumRatio;
  document.getElementById('latestAcSpan').textContent = `${latest.ac} / ${latest.span}`;
  document.getElementById('totalAnalyzed').textContent = `${appData.total_analyzed}期`;

  document.getElementById('latestBalls').innerHTML = latest.numbers_str.map(b => `
    <div class="w-11 h-11 sm:w-14 sm:h-14 rounded-full ball-gold flex items-center justify-center font-num font-black text-lg sm:text-2xl">
      ${b}
    </div>
  `).join('');

  document.getElementById('historyTableBody').innerHTML = appData.history.slice(0, 10).map(row => `
    <tr class="hover:bg-slate-800/30 transition">
      <td class="py-2.5 px-2">
        <div class="font-bold text-slate-200">${row.date}</div>
        <div class="text-xs text-slate-500">第 ${row.period} 期</div>
      </td>
      <td class="py-2.5 px-2">
        <div class="flex items-center gap-1 sm:gap-1.5">
          ${row.numbers_str.map(b => `
            <span class="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-slate-800 border border-slate-700 text-amber-300 font-num font-bold text-xs flex items-center justify-center">
              ${b}
            </span>
          `).join('')}
        </div>
      </td>
      <td class="py-2.5 px-2 text-right font-num text-slate-300">
        <div>${row.sum}</div>
        <div class="text-xs text-slate-500">AC:${row.ac} / 跨:${row.span}</div>
      </td>
    </tr>
  `).join('');

    computeConsensusEngine();
  }

  // 2) AI 智慧選號與聰明包牌（picker.html）
  if (document.getElementById('numberGrid')) {
    syncPickerUiState();
    renderNumberGrid();
    generatePrediction();
    renderWheelNumberGrid();
    renderWheelResult();

    const params = new URLSearchParams(window.location.search);
    if (params.get('sub') === 'wheel') {
      switchPickerSubTab('wheel');
    }
  }

  // 3) 歷史回測與多注批量對獎機（backtest.html）
  if (document.getElementById('backtestInputs')) {
    populateBatchPeriodSelect();

    const params = new URLSearchParams(window.location.search);
    if (params.get('sub') === 'batch') {
      switchBacktestSubTab('batch');
    }

    const pendingBt = sessionStorage.getItem(STORAGE_KEYS.pendingBacktest);
    if (pendingBt) {
      sessionStorage.removeItem(STORAGE_KEYS.pendingBacktest);
      try {
        const balls = JSON.parse(pendingBt);
        const inputs = document.querySelectorAll('.bt-input');
        balls.forEach((val, idx) => { if (inputs[idx]) inputs[idx].value = val; });
        runBacktest();
      } catch (e) {}
    }

    if (sessionStorage.getItem(STORAGE_KEYS.autoImportWheel) === '1') {
      sessionStorage.removeItem(STORAGE_KEYS.autoImportWheel);
      switchBacktestSubTab('batch');
      importWheelToBatch();
    }
  }

  // 4) 牌路版路與雙星大數據（stats.html）
  if (document.getElementById('formulaList')) {
  const fa = appData.stats.formulaAnalysis;
  const metaBadge = document.getElementById('formulaScannerMetaBadge');
  if (metaBadge && fa && fa.longWindow > 0) {
    metaBadge.textContent = `近${fa.longWindow}期基準(≥${fa.minLongHits}次) × 近${fa.shortWindow}期動能 × 近${fa.scoreWindow}期容差積分`;
  }

  const ultimateBox = document.getElementById('formulaUltimateBox');
  if (ultimateBox) {
    if (fa && fa.ultimatePicks && fa.ultimatePicks.length > 0) {
      const picks = fa.ultimatePicks;
      ultimateBox.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <span class="px-2 py-0.5 rounded-md bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 text-[11px] font-black">
                自動三層漏斗濃縮
              </span>
              <span class="text-sm sm:text-base font-black text-amber-300">
                🎯 本區終極精選（${picks.length} 顆核心主支）
              </span>
            </div>
            <p class="text-[11px] text-slate-400 mt-0.5">
              自動依「上下雙重交集 ➔ 共識斷層 #1 ➔ 綠燈活躍最高分冠軍」濃縮篩出，點擊單球或一鍵全設為定膽
            </p>
          </div>
          <button onclick="setFormulaUltimateAsFixed()" class="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs shadow transition active:scale-95 shrink-0">
            ⭐ 一鍵全設為定膽（${picks.map(p => p.ball).join('、')}）
          </button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          ${picks.map((item, idx) => `
            <div class="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/90 border ${idx === 0 ? 'border-amber-400/60' : 'border-slate-700/80'}">
              <div class="flex items-center gap-3 min-w-0">
                <button onclick="addSingleBallToFixed('${item.ball}')" title="點擊單獨設為定膽" class="w-11 h-11 rounded-full ${idx === 0 ? 'ball-gold ring-2 ring-amber-300/80' : 'ball-gold'} flex items-center justify-center font-num font-black text-base shrink-0 hover:scale-105 transition">
                  ${item.ball}
                </button>
                <div class="min-w-0">
                  <span class="inline-block px-2 py-0.5 rounded border text-[10px] font-bold ${item.badgeCls}">${item.badge}</span>
                  <div class="text-[11px] text-slate-300 mt-1 leading-snug">${item.reason}</div>
                </div>
              </div>
              <button onclick="addSingleBallToFixed('${item.ball}')" class="text-[11px] px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/35 font-bold shrink-0 transition">
                +膽
              </button>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      ultimateBox.innerHTML = '<div class="text-xs text-slate-500">歷史期數不足，暫無本區終極精選號碼</div>';
    }
  }

  const consensusSummaryMeta = document.getElementById('formulaConsensusSummaryMeta');
  if (consensusSummaryMeta && fa && fa.consensusTop && fa.consensusTop.length > 0) {
    consensusSummaryMeta.textContent = `合格 ${fa.qualifiedCount} 條 · 共識前3：${fa.consensusTop.slice(0, 3).map(x => x.ball).join('、')}`;
  }

  const consensusBox = document.getElementById('formulaConsensusBox');
  if (consensusBox) {
    if (fa && fa.consensusTop && fa.consensusTop.length > 0) {
      consensusBox.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 font-bold">
              合格參與：${fa.qualifiedCount} 條${fa.usedFallbackConsensus ? '（樣本偏少・改取前12條）' : ''}
            </span>
            <span class="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
              已排除同源：${fa.dedupedCount} 條
            </span>
            ${fa.overheatedCount > 0 ? `<span class="text-[11px] px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/35 text-rose-300 font-bold">⚠️ 過熱降權：${fa.overheatedCount} 條</span>` : ''}
          </div>
          <span class="text-[11px] text-slate-400">同源公式僅計 1 票・過熱公式權重減半</span>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          ${fa.consensusTop.map((item, idx) => {
            const isTop = idx === 0;
            const catBadges = item.categories.map(c => `<span class="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] font-bold text-slate-300 border border-slate-700">${c}</span>`).join('');
            return `
              <div class="p-2.5 rounded-xl bg-slate-900/90 border ${isTop ? 'border-emerald-400/60 shadow-md shadow-emerald-500/10' : 'border-slate-800'} flex flex-col justify-between gap-2">
                <div class="flex items-center justify-between text-[10px]">
                  <span class="font-black ${isTop ? 'text-emerald-300' : 'text-slate-400'}">共識 #${idx + 1}</span>
                  <span class="font-bold text-amber-300">${item.votes} 條算出</span>
                </div>
                <div class="flex items-center justify-center">
                  <button onclick="addSingleBallToFixed('${item.ball}')" title="點擊設為定膽（${item.formulas.slice(0, 3).join(' / ')}）" class="w-10 h-10 rounded-full ${isTop ? 'ball-gold ring-2 ring-emerald-300/70' : 'ball-emerald'} flex items-center justify-center font-num font-black text-base hover:scale-105 transition">
                    ${item.ball}
                  </button>
                </div>
                <div class="space-y-1 text-center">
                  <div class="text-[10px] text-slate-400 font-num">加權票：${item.weightedVotes}</div>
                  <div class="flex flex-wrap justify-center gap-1">${catBadges}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else {
      consensusBox.innerHTML = '<div class="text-xs text-slate-500">歷史期數不足，暫無多公式共識投票結果</div>';
    }
  }

  const championsSummaryMeta = document.getElementById('formulaChampionsSummaryMeta');
  if (championsSummaryMeta && appData.stats.topFormulas && appData.stats.topFormulas.length > 0) {
    championsSummaryMeta.textContent = `各維度推算：${appData.stats.topFormulas.map(f => `${f.category}:${f.predicted}`).join(' · ')}`;
  }

  const formulaBox = document.getElementById('formulaList');
  if (appData.stats.topFormulas && appData.stats.topFormulas.length > 0) {
    formulaBox.innerHTML = appData.stats.topFormulas.map(f => {
      const catMeta = FORMULA_CATEGORIES[f.category] || FORMULA_CATEGORIES.A;
      const thermalBadgeCls = f.thermalStatus === 'overheat'
        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
        : (f.thermalStatus === 'warm'
          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
          : (f.thermalStatus === 'strong'
            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
            : 'bg-slate-800 text-slate-400 border border-slate-700'));
      const missTextCls = f.missStatus === 'active'
        ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
        : (f.missStatus === 'watch'
          ? 'text-amber-300 bg-amber-500/10 border-amber-500/30'
          : 'text-rose-300 bg-rose-500/10 border-rose-500/30');
      const cardBorder = f.isOverheated ? 'border-rose-500/45' : 'border-amber-500/30';

      return `
        <div class="p-3.5 rounded-xl bg-slate-950/80 border ${cardBorder} flex flex-col justify-between gap-2.5">
          <div class="space-y-1.5">
            <div class="flex flex-wrap items-center justify-between gap-1 text-[11px]">
              <span class="px-2 py-0.5 rounded border font-bold ${catMeta.badgeCls}">${catMeta.label}</span>
              <span class="px-1.5 py-0.5 rounded font-bold ${thermalBadgeCls}">${f.thermalLabel}</span>
            </div>
            <div class="text-xs sm:text-sm font-bold text-slate-100 leading-snug pt-0.5">${f.name}</div>
            <div class="grid grid-cols-2 gap-1.5 text-[11px] bg-slate-900/80 p-2 rounded-lg border border-slate-800/90">
              <div>
                <div class="text-slate-500">長期基準(${f.longTotal}期)</div>
                <div class="font-num font-bold ${f.isLongQualified ? 'text-emerald-400' : 'text-slate-400'}">準 ${f.longHits} 次 (${f.longRate}%)</div>
              </div>
              <div class="border-l border-slate-800 pl-1.5">
                <div class="text-slate-500">短期動能(${f.shortTotal}期)</div>
                <div class="font-num font-bold ${f.isOverheated ? 'text-rose-400' : (f.isWarm ? 'text-amber-300' : 'text-sky-300')}">準 ${f.shortHits} 次 (${f.shortRate}%)</div>
              </div>
            </div>
            <div class="text-[11px] text-slate-300 bg-slate-900/60 px-2 py-1.5 rounded-lg border border-slate-800/80">
              <div>近${f.scoreTotal}期容差積分：<strong class="text-amber-300 font-num">${f.score30} 分</strong></div>
              <div class="text-[10px] text-slate-400 mt-0.5">精準${f.exact30}(+3) · ±1鄰${f.near30}(+1) · 同尾${f.tail30}(+0.8)</div>
            </div>
            <div class="text-[11px] px-2 py-1 rounded-lg border font-bold ${missTextCls}">
              ${f.missLabel}
            </div>
            <div class="text-[11px] text-slate-500">
              近期命中：${f.hitDates.length ? f.hitDates.join('、') : '近視窗無紀錄'}${f.fallbackRank ? ' · <span class="text-amber-400/80">同類最佳</span>' : ''}
            </div>
          </div>
          <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-xs text-slate-400">本期推算：</span>
              <span class="w-8 h-8 rounded-full ${f.isOverheated ? 'ball-red' : 'ball-gold'} flex items-center justify-center font-num font-black text-xs">${f.predicted}</span>
            </div>
            <button onclick="addSingleBallToFixed('${f.predicted}')" class="text-xs px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold transition">
              設為定膽
            </button>
          </div>
        </div>
      `;
    }).join('');
  } else {
    formulaBox.innerHTML = '<div class="col-span-full text-xs text-slate-500 py-3">歷史期數不足，暫無高命中版路公式</div>';
  }

  document.getElementById('twinList').innerHTML = appData.stats.top_twins.map((item, idx) => `
    <div class="flex items-center justify-between p-2 rounded-xl bg-slate-950/75 border border-slate-800/80">
      <div class="flex items-center gap-2">
        <span class="text-xs font-bold text-slate-500 w-4">#${idx + 1}</span>
        <span class="w-7 h-7 rounded-full ball-gold flex items-center justify-center font-num font-black text-xs">${item.b1}</span>
        <span class="w-7 h-7 rounded-full ball-gold flex items-center justify-center font-num font-black text-xs">${item.b2}</span>
        <span class="text-xs text-slate-300 ml-1">同開 <strong class="text-amber-400">${item.count}</strong> 次</span>
      </div>
      <button onclick="setTwinAsFixed('${item.b1}', '${item.b2}')" class="text-xs px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold transition">
        設為定膽
      </button>
    </div>
  `).join('');

  document.getElementById('neighborHitRateBadge').textContent = `鄰號開出率 ${appData.stats.neighborHitRate}%`;
  const sandwichEl = document.getElementById('sandwichBalls');
  sandwichEl.innerHTML = appData.stats.sandwichBalls.length
    ? appData.stats.sandwichBalls.map(b => `
        <button onclick="addSingleBallToFixed('${b}')" title="點擊設為定膽" class="w-9 h-9 rounded-full ball-emerald flex items-center justify-center font-num font-black text-xs hover:scale-105 transition">
          ${b}
        </button>
      `).join('')
    : '<span class="text-xs text-slate-500">本期無相隔2的夾號</span>';

  const neighborEl = document.getElementById('neighborBalls');
  neighborEl.innerHTML = appData.stats.neighborBalls.map(b => `
    <button onclick="addSingleBallToFixed('${b}')" title="點擊設為定膽" class="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-amber-400 text-amber-300 font-num font-bold text-xs transition">
      ${b}
    </button>
  `).join('');

  const obliqueEl = document.getElementById('obliqueBalls');
  obliqueEl.innerHTML = appData.stats.obliqueBalls.length
    ? appData.stats.obliqueBalls.map(b => `
        <button onclick="addSingleBallToFixed('${b}')" title="點擊設為定膽" class="w-9 h-9 rounded-full ball-purple flex items-center justify-center font-num font-black text-xs hover:scale-105 transition">${b}</button>
      `).join('')
    : '<span class="text-xs text-slate-500">本期無明顯斜連延伸球</span>';

  const skipOneEl = document.getElementById('skipOneBalls');
  skipOneEl.innerHTML = appData.stats.skipOneBalls.length
    ? appData.stats.skipOneBalls.map(b => `
        <button onclick="addSingleBallToFixed('${b}')" title="點擊設為定膽" class="w-9 h-9 rounded-full ball-blue flex items-center justify-center font-num font-black text-xs hover:scale-105 transition">${b}</button>
      `).join('')
    : '<span class="text-xs text-slate-500">無隔期跳開號碼</span>';

  const todayDow = new Date().getDay();
  const targetDow = (todayDow >= 1 && todayDow <= 6) ? todayDow : 1;
  const dayLabels = { 0: '今日週日(休市)', 1: '今日週一', 2: '今日週二', 3: '今日週三', 4: '今日週四', 5: '今日週五', 6: '今日週六' };
  document.getElementById('weekdayTodayTag').textContent = dayLabels[todayDow];
  renderWeekdayHotList(targetDow);

  const roads = appData.stats.roadCounts;
  const totalRoadBalls = roads.reduce((a, b) => a + b, 0) || 1;
  const minRoadCount = Math.min(...roads);
  const roadLabels = [
    { name: '0 路（03, 06, 09...39）', desc: '除以 3 餘 0' },
    { name: '1 路（01, 04, 07...37）', desc: '除以 3 餘 1' },
    { name: '2 路（02, 05, 08...38）', desc: '除以 3 餘 2' }
  ];
  document.getElementById('road012Box').innerHTML = roads.map((cnt, idx) => {
    const pct = Math.round((cnt / totalRoadBalls) * 100);
    const isColdest = cnt === minRoadCount;
    return `
      <div class="p-2.5 rounded-xl bg-slate-950/75 border ${isColdest ? 'border-sky-500/50' : 'border-slate-800/80'}">
        <div class="flex items-center justify-between text-xs mb-1">
          <span class="font-bold text-slate-200">${roadLabels[idx].name}</span>
          ${(idx === 0 && appData.stats.road0NeedsBoost)
            ? '<span class="px-1.5 py-0.5 rounded bg-rose-500/25 border border-rose-500/40 text-rose-200 font-black text-[10px]">🔥近10期<14顆・加重0路</span>'
            : (isColdest ? '<span class="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold text-[10px]">偏冷待補</span>' : `<span class="text-slate-400">${pct}%</span>`)}
        </div>
        <div class="flex items-center gap-2">
          <div class="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div class="h-full ${isColdest ? 'bg-sky-400' : 'bg-amber-400'} rounded-full" style="width: ${pct}%"></div>
          </div>
          <span class="font-num text-xs font-bold text-slate-300 w-10 text-right">${cnt}顆</span>
        </div>
      </div>
    `;
  }).join('');

  const repeatRateEl = document.getElementById('repeatRateVal');
  if (repeatRateEl) {
    repeatRateEl.innerHTML = `${appData.stats.repeatRate}%<span class="block text-[11px] font-normal text-slate-400 mt-1 whitespace-nowrap">均 ${appData.stats.avgRepeatBalls.toFixed(2)} 顆/期</span><span class="block text-[11px] font-normal text-slate-400 whitespace-nowrap">單球連莊 ${appData.stats.singleBallRepeatRate}%</span>`;
  }
  document.getElementById('consecRateVal').textContent = `${appData.stats.consecRate}%`;
  document.getElementById('topRepeatBalls').innerHTML = appData.stats.topRepeats.length
    ? appData.stats.topRepeats.map(item => `
        <div class="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800/80 text-xs">
          <div class="flex items-center gap-2">
            <span class="w-6 h-6 rounded-full ball-red flex items-center justify-center font-num font-bold text-[11px]">${item.ball}</span>
            <span class="text-slate-300">${item.ball} 號</span>
          </div>
          <span class="text-amber-400 font-bold">連莊 ${item.count} 次</span>
        </div>
      `).join('')
    : '<div class="text-xs text-slate-500">近期無連莊紀錄</div>';

  document.getElementById('omissionList').innerHTML = appData.stats.top_omission.map((item, idx) => {
    const isRecordDanger = item.nearPct >= 80;
    const barColor = isRecordDanger
      ? 'from-rose-500 via-red-500 to-amber-400'
      : 'from-amber-500 to-orange-500';
    return `
      <div class="flex items-center gap-3">
        <span class="w-7 h-7 rounded-full ${isRecordDanger || idx < 3 ? 'ball-red' : 'bg-slate-800 text-slate-200'} flex items-center justify-center font-num font-bold text-xs shrink-0">
          ${item.ball}
        </span>
        <div class="flex-1">
          <div class="flex flex-wrap justify-between items-center gap-1 text-xs mb-1">
            <span class="text-slate-200 font-bold">
              ${item.ball} 號
              ${isRecordDanger ? '<span class="ml-1 px-1.5 py-0.2 rounded bg-rose-500/25 text-rose-300 text-[10px] font-black">🔥逼近極限</span>' : ''}
            </span>
            <span class="font-num text-[11px] ${isRecordDanger ? 'text-rose-300 font-bold' : 'text-amber-400 font-bold'}">
              ${item.omission} / 史高${item.maxOmission}期 (${item.nearPct}%)
            </span>
          </div>
          <div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div class="h-full bg-gradient-to-r ${barColor} rounded-full" style="width: ${item.nearPct}%"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('dragList').innerHTML = appData.stats.drag_top6.map((item, idx) => `
    <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
      <div class="flex items-center gap-2.5">
        <span class="w-8 h-8 rounded-full ${idx < 2 ? 'ball-gold' : 'ball-blue'} flex items-center justify-center font-num font-black text-xs shrink-0">
          ${item.ball}
        </span>
        <div>
          <div class="text-xs font-bold text-slate-200">下期跟開權重 <span class="text-amber-400">${item.score}</span></div>
          <div class="text-xs text-slate-400">由上期 [${item.triggered_by.join(', ')}] 拖出</div>
        </div>
      </div>
      <span class="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0">TOP ${idx + 1}</span>
    </div>
  `).join('');

  const maxTail = Math.max(...appData.stats.tails_30.map(x => x.count), 1);
  const tailListEl = document.getElementById('tailList');
  if (tailListEl) tailListEl.innerHTML = appData.stats.tails_30.map((item, idx) => {
    const pct = Math.round((item.count / maxTail) * 100);
    return `
      <div class="flex items-center gap-2.5 text-xs">
        <span class="w-9 font-bold ${idx < 3 ? 'text-amber-400' : 'text-slate-300'}">${item.tail}</span>
        <div class="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
          <div class="h-full ${idx < 3 ? 'bg-amber-400' : 'bg-sky-500/70'} rounded-full" style="width: ${pct}%"></div>
        </div>
        <span class="w-10 text-right font-num text-slate-300">${item.count}顆</span>
      </div>
    `;
  }).join('');

    renderPrimeAndDigitSumStats();
    renderTrendMatrix();
    renderFreqChart(currentChartRange);
  }

  // 5) 社群交流與開運靈感籤（community.html）
  if (document.getElementById('communitySharePreview')) {
    const customShare = sessionStorage.getItem(STORAGE_KEYS.pendingShareText);
    if (customShare) {
      sessionStorage.removeItem(STORAGE_KEYS.pendingShareText);
      document.getElementById('communitySharePreview').value = customShare;
    } else {
      if (!currentPredicted.length) generatePrediction();
      updateCommunityShareText();
    }
  }
}

function isBallInCutZone(ballStr) {
  const n = Number(ballStr);
  if (currentZoneCut === 'z1') return n >= 1 && n <= 13;
  if (currentZoneCut === 'z2') return n >= 14 && n <= 26;
  if (currentZoneCut === 'z3') return n >= 27 && n <= 39;
  return false;
}

function renderNumberGrid() {
  const grid = document.getElementById('numberGrid');
  if (!grid) return;
  let html = '';
  for (let i = 1; i <= 39; i++) {
    const b = pad2(i);
    const inCutZone = isBallInCutZone(b);
    let cls = 'bg-slate-900 border-slate-700 text-slate-100 hover:border-slate-500';
    let badge = '';

    if (fixedBalls.has(b)) {
      cls = 'bg-amber-500/25 border-amber-400 text-amber-300 shadow-md shadow-amber-500/20';
      badge = '<span class="absolute -top-1.5 -right-1.5 text-[10px] bg-amber-400 text-slate-950 font-black px-1.5 rounded">膽</span>';
    } else if (excludedBalls.has(b) || inCutZone) {
      cls = 'bg-red-950/60 border-red-500/60 text-red-400 line-through opacity-70';
      badge = inCutZone
        ? '<span class="absolute -top-1.5 -right-1.5 text-[10px] bg-sky-500 text-slate-950 font-black px-1.5 rounded">斷</span>'
        : '<span class="absolute -top-1.5 -right-1.5 text-[10px] bg-red-500 text-white font-black px-1.5 rounded">殺</span>';
    }
    html += `
      <button onclick="toggleBallFilter('${b}')" class="relative py-2.5 sm:py-3 rounded-xl border font-num font-bold text-sm transition active:scale-95 ${cls}">
        ${b}${badge}
      </button>
    `;
  }
  grid.innerHTML = html;

  const fixedEl = document.getElementById('fixedList');
  const hintEl = document.getElementById('filterNextStepHint');

  if (fixedBalls.size) {
    const validCount = Array.from(fixedBalls).filter(b => !isBallInCutZone(b)).length;
    const remainCount = Math.max(0, 5 - validCount);
    fixedEl.innerHTML = Array.from(fixedBalls).sort().map(b =>
      `<span class="inline-block px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/50 text-amber-300 font-num font-bold mr-1">${b}</span>`
    ).join('');
    hintEl.innerHTML = `✅ <strong>已鎖定 ${validCount} 顆主支！</strong>系統已自動幫你補齊剩下 <strong>${remainCount} 顆</strong>號碼；想換別組搭配，可隨時按下方按鈕重新演算！`;
  } else {
    fixedEl.innerHTML = '<span class="text-slate-500 font-normal">尚未設定（由 AI 自動挑選全部 5 碼）</span>';
    hintEl.innerHTML = `👉 <strong>下一步：</strong>點選號碼盤可鎖定 1～4 顆主支，系統會自動幫你補齊剩餘號碼並更新左側推薦結果！`;
  }

  const excludedEl = document.getElementById('excludedList');
  if (excludedBalls.size) {
    excludedEl.innerHTML = Array.from(excludedBalls).sort().map(b =>
      `<span class="inline-block px-2 py-0.5 rounded-md bg-red-500/20 border border-red-400/50 text-red-300 font-num font-bold mr-1">${b}</span>`
    ).join('');
  } else {
    excludedEl.innerHTML = '<span class="text-slate-500 font-normal">尚未設定</span>';
  }
}

window.toggleBallFilter = function(b) {
  if (!fixedBalls.has(b) && !excludedBalls.has(b)) {
    if (fixedBalls.size >= 4) {
      alert('最多只能鎖定 4 顆定膽號碼喔！');
      return;
    }
    fixedBalls.add(b);
  } else if (fixedBalls.has(b)) {
    fixedBalls.delete(b);
    excludedBalls.add(b);
  } else {
    excludedBalls.delete(b);
  }
  savePickerState();
  renderNumberGrid();
  generatePrediction();
};

function weightedPickOne(candidates, weights) {
  const total = weights.reduce((acc, w) => acc + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

function generatePrediction() {
  if (!appData) return;
  const stats = appData.stats;
  const allBalls = Array.from({ length: 39 }, (_, i) => pad2(i + 1));

  const available = allBalls.filter(b =>
    !fixedBalls.has(b) && !excludedBalls.has(b) && !isBallInCutZone(b)
  );
  const validFixed = Array.from(fixedBalls).filter(b => !isBallInCutZone(b));
  const needCount = 5 - validFixed.length;

  if (available.length < needCount) {
    alert('排除的殺號或斷區條件太多，剩餘號碼不足 5 顆！請放寬條件。');
    return;
  }

  const dragMap = {};
  stats.drag_top6.forEach(d => { dragMap[d.ball] = d.score; });
  const obliqueSet = new Set(stats.obliqueBalls || []);
  const sandwichSet = new Set(stats.sandwichBalls || []);

  const repeatBallSet = new Set((stats.topRepeats || []).map(x => x.ball));
  const latestBallSet = new Set(appData.latest?.numbers_str || []);
  const neighborBallSet = new Set(stats.neighborBalls || []);

  function getWeight(b) {
    const f10 = stats.freq_10[b] || 0;
    const f30 = stats.freq_30[b] || 0;
    const om = stats.omission[b] || 0;
    const dg = dragMap[b] || 0;
    const isRepeatHot = repeatBallSet.has(b) || latestBallSet.has(b);
    const repeatStreakBonus = isRepeatHot ? f10 * 1.6 : 0;
    const patternBonus = (obliqueSet.has(b) ? 3 : 0) + (sandwichSet.has(b) ? 3 : 0) + (neighborBallSet.has(b) ? 2.5 : 0);
    const r0Boost = (stats.road0NeedsBoost && Number(b) % 3 === 0) ? (stats.road0WeightBoost || 5) : 0;

    if (currentStrategy === 'hot') {
      return 1 + f10 * 4 + f30 * 2.5;
    }
    if (currentStrategy === 'cold') return 1 + om * 2.2 + Math.max(0, 6 - f30) * 2 + r0Boost;
    if (currentStrategy === 'drag') return 1 + dg * 3.5 + patternBonus * 1.6 + f30 * 1.2 + r0Boost;
    if (currentStrategy === 'golden') return 2 + f30 * 1.5 + Math.min(om, 12) * 1.2 + dg * 1.5 + patternBonus + repeatStreakBonus + r0Boost;
    return 1;
  }

  const usePrimeDigitFilter = document.getElementById('primeDigitFilterToggle')?.checked ?? true;
  let bestCombo = null;
  const maxAttempts = (currentStrategy === 'golden' || usePrimeDigitFilter) ? 180 : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const pool = [...available];
    const chosen = [...validFixed];

    while (chosen.length < 5) {
      const weights = pool.map(getWeight);
      const picked = weightedPickOne(pool, weights);
      chosen.push(picked);
      pool.splice(pool.indexOf(picked), 1);
    }

    chosen.sort();
    bestCombo = chosen;

    const nums = chosen.map(Number);
    const pd = analyzePrimeAndDigitSum(nums);
    const passPrimeDigit = !usePrimeDigitFilter || (pd.isValidPrime && pd.isValidDigitSum);

    if (currentStrategy === 'golden') {
      const sum = nums.reduce((a, b) => a + b, 0);
      const odd = nums.filter(n => n % 2 === 1).length;
      const ac = calcACValue(nums);
      const span = nums[4] - nums[0];

      const passBasic = (odd === 2 || odd === 3) && sum >= 80 && sum <= 125;
      const passAdvanced = ac >= 4 && span >= 18 && span <= 35;

      if (passBasic && passAdvanced && passPrimeDigit) break;
    } else if (passPrimeDigit) {
      break;
    }
  }

  currentPredicted = bestCombo;
  savePickerState();
  renderPredictedBalls(bestCombo);
  updateCommunityShareText();
}

function renderPredictedBalls(balls) {
  const container = document.getElementById('predictedBalls');
  if (!container) return;
  container.innerHTML = balls.map((b, idx) => {
    const isFixed = fixedBalls.has(b);
    const ballStyle = isFixed ? 'ball-gold ring-2 ring-amber-300' : 'ball-red';
    return `
      <div style="animation-delay: ${idx * 60}ms" class="animate-pop w-11 h-11 sm:w-14 sm:h-14 rounded-full ${ballStyle} flex items-center justify-center font-num font-black text-lg sm:text-2xl">
        ${b}
      </div>
    `;
  }).join('');

  const nums = balls.map(Number);
  const sum = nums.reduce((a, b) => a + b, 0);
  const odd = nums.filter(n => n % 2 === 1).length;
  const ac = calcACValue(nums);
  const span = nums[4] - nums[0];
  const zones = calcZones(nums);
  const pd = analyzePrimeAndDigitSum(nums);

  document.getElementById('predictedMeta').innerHTML = `
    <div>和值：<strong class="text-amber-300 block sm:inline">${sum}</strong></div>
    <div>奇偶：<strong class="text-sky-300 block sm:inline">${odd}:${5 - odd}</strong></div>
    <div>質合：<strong class="text-teal-300 block sm:inline">${pd.primeRatio}</strong></div>
    <div>合數單雙：<strong class="text-cyan-300 block sm:inline">${pd.digitSumRatio}</strong></div>
    <div>AC值：<strong class="text-purple-300 block sm:inline">${ac}</strong></div>
    <div>跨度：<strong class="text-rose-300 block sm:inline">${span}</strong></div>
    <div class="col-span-3 sm:col-span-2">三區比：<strong class="text-emerald-300 block sm:inline">${zones.label}</strong></div>
  `;
}

function renderFreqChart(rangeKey) {
  if (!appData) return;
  currentChartRange = rangeKey;
  const freqObj = appData.stats[rangeKey];
  const labels = Object.keys(freqObj).sort();
  const values = labels.map(k => freqObj[k]);

  const sortedVals = [...values].sort((a, b) => b - a);
  const hotThreshold = sortedVals[4];
  const coldThreshold = sortedVals[sortedVals.length - 5];

  const bgColors = values.map(v => {
    if (v >= hotThreshold && v > 0) return 'rgba(239, 68, 68, 0.85)';
    if (v <= coldThreshold) return 'rgba(59, 130, 246, 0.75)';
    return 'rgba(234, 179, 8, 0.65)';
  });

  const canvasEl = document.getElementById('freqChart');
  if (!canvasEl || typeof Chart === 'undefined') return;
  const ctx = canvasEl.getContext('2d');
  if (freqChartInstance) freqChartInstance.destroy();

  freqChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: '開出次數',
        data: values,
        backgroundColor: bgColors,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: items => `${items[0].label} 號`,
            label: item => `開出次數：${item.raw} 次`
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 } } },
        y: { beginAtZero: true, ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: 'rgba(148, 163, 184, 0.1)' } }
      }
    }
  });
}

function runBacktest() {
  if (!appData) return;
  const inputs = Array.from(document.querySelectorAll('.bt-input'));
  const nums = inputs.map(inp => parseInt(inp.value, 10)).filter(n => !isNaN(n) && n >= 1 && n <= 39);
  const uniqueStr = Array.from(new Set(nums.map(pad2))).sort();

  if (uniqueStr.length !== 5) {
    alert('請輸入 5 個不重複的 01～39 號碼！');
    return;
  }

  const targetSet = new Set(uniqueStr);
  let c5 = 0, c4 = 0, c3 = 0, c2 = 0;
  const winLogs = [];

  appData.history.forEach(draw => {
    const hits = draw.numbers_str.filter(b => targetSet.has(b));
    if (hits.length === 5) { c5++; winLogs.push({ date: draw.date, period: draw.period, hits, rank: '頭獎 (中5碼)' }); }
    else if (hits.length === 4) { c4++; winLogs.push({ date: draw.date, period: draw.period, hits, rank: '貳獎 (中4碼)' }); }
    else if (hits.length === 3) { c3++; winLogs.push({ date: draw.date, period: draw.period, hits, rank: '參獎 (中3碼)' }); }
    else if (hits.length === 2) { c2++; }
  });

  const totalPrize = c5 * 8000000 + c4 * 20000 + c3 * 300 + c2 * 50;

  document.getElementById('prize5').textContent = `${c5} 次`;
  document.getElementById('prize4').textContent = `${c4} 次`;
  document.getElementById('prize3').textContent = `${c3} 次`;
  document.getElementById('prize2').textContent = `${c2} 次`;
  document.getElementById('totalSimPrize').textContent = `NT$ ${totalPrize.toLocaleString()}`;
  document.getElementById('backtestSummaryTag').textContent = `已比對 ${appData.history.length} 期`;

  const matchBox = document.getElementById('backtestMatches');
  if (winLogs.length === 0) {
    matchBox.innerHTML = `<div class="h-36 flex items-center justify-center text-slate-500 text-center">共回測 ${appData.history.length} 期，無中 3 碼以上紀錄（肆獎中 2 碼共 ${c2} 次）</div>`;
  } else {
    matchBox.innerHTML = winLogs.map(w => `
      <div class="flex flex-wrap justify-between items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800">
        <div>
          <span class="font-bold text-slate-200">${w.date}</span>
          <span class="text-slate-500 ml-1">第${w.period}期</span>
        </div>
        <div class="text-right">
          <span class="font-bold text-amber-400">${w.rank}</span>
          <span class="text-slate-300 ml-1">[${w.hits.join(', ')}]</span>
        </div>
      </div>
    `).join('');
  }
}

const fortuneMessages = [
  '今日財星高照東方，適合搭配你最直覺的主支號碼！',
  '貴人運旺盛的一天，進 LINE 社團看看彩友靈感會有意外收穫！',
  '穩中求勝之日，優先考慮近期溫熱的雙星伴侶組合。',
  '偏財運悄然升溫，適合小額娛樂、保持輕鬆愉快的心情！',
  '水到渠成之象，留意近兩期的斜連延伸與夾號補中！'
];

onClick('drawFortuneBtn', () => {
  const randNum = Math.floor(Math.random() * 39) + 1;
  currentFortuneBall = pad2(randNum);
  const ballEl = document.getElementById('fortuneNumber');
  ballEl.textContent = currentFortuneBall;
  ballEl.classList.remove('animate-pop');
  void ballEl.offsetWidth;
  ballEl.classList.add('animate-pop');

  const msg = fortuneMessages[Math.floor(Math.random() * fortuneMessages.length)];
  document.getElementById('fortuneText').textContent = `今日幸運靈感球【${currentFortuneBall}】：${msg}`;
});

onClick('applyFortuneFixedBtn', () => {
  if (!currentFortuneBall) {
    alert('請先按「🎲 抽今日靈感球」抽出一顆幸運號碼喔！');
    return;
  }
  addSingleBallToFixed(currentFortuneBall);
});

onClick('refreshShareTextBtn', () => {
  generatePrediction();
  const btn = document.getElementById('refreshShareTextBtn');
  btn.textContent = '✅ 已換新組合！';
  setTimeout(() => {
    btn.textContent = '🔄 更新內容';
  }, 1200);
});

onClick('copyCommunityShareBtn', () => {
  const box = document.getElementById('communitySharePreview');
  if (!box || !box.value) return;
  navigator.clipboard.writeText(box.value).then(() => {
    const btn = document.getElementById('copyCommunityShareBtn');
    btn.textContent = '✅ 已複製報牌文字！快去社團貼上吧';
    setTimeout(() => btn.textContent = '📋 一鍵複製並貼到 LINE 社團分享', 2000);
  });
});

document.querySelectorAll('.strategy-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.strategy-btn').forEach(b => {
      b.className = 'strategy-btn px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold border border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-500 transition';
    });
    btn.className = 'strategy-btn active px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold border border-amber-500 bg-amber-500/20 text-amber-300 transition';
    currentStrategy = btn.dataset.strategy;

    const detail = strategyDetails[currentStrategy];
    const descEl = document.getElementById('strategyDesc');
    if (descEl) {
      descEl.innerHTML = `
        <div class="font-bold text-amber-300 flex items-center gap-1.5">
          <span>${detail.title}</span>
        </div>
        <p class="text-slate-300 leading-relaxed">${detail.desc}</p>
        <div class="pt-1.5 border-t border-slate-800/80 text-xs text-slate-400">
          <strong class="text-slate-300">${detail.formula.split('：')[0]}：</strong>${detail.formula.split('：')[1]}
        </div>
      `;
    }
    savePickerState();
    generatePrediction();
  });
});

document.querySelectorAll('.zone-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.zone-btn').forEach(b => {
      b.className = 'zone-btn py-2 px-2 rounded-xl text-xs font-bold border border-slate-700 bg-slate-900/80 text-slate-400 hover:text-slate-200 transition';
    });
    btn.className = 'zone-btn active py-2 px-2 rounded-xl text-xs font-bold border border-sky-500 bg-sky-500/20 text-sky-300 transition';
    currentZoneCut = btn.dataset.zone;
    savePickerState();
    renderNumberGrid();
    generatePrediction();
  });
});

document.querySelectorAll('.wd-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    renderWeekdayHotList(Number(tab.dataset.day));
  });
});

document.querySelectorAll('.freq-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.freq-tab').forEach(t => {
      t.className = 'freq-tab px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition';
    });
    tab.className = 'freq-tab active px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 transition';
    renderFreqChart(tab.dataset.range);
  });
});

onClick('generateBtn', generatePrediction);
onClick('reloadDataBtn', () => initApp(true));

onClick('copyBtn', () => {
  if (!currentPredicted.length) return;
  const text = `【今彩539 AI預測】推薦號碼：${currentPredicted.join('、')}`;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copyBtn');
    btn.textContent = '✅ 已複製號碼！';
    setTimeout(() => btn.textContent = '📋 複製這組號碼', 1500);
  });
});

onClick('sendToBacktestBtn', () => {
  if (!currentPredicted.length) return;
  sessionStorage.setItem(STORAGE_KEYS.pendingBacktest, JSON.stringify(currentPredicted));
  switchTab('backtest');
});

onClick('fillLatestBtn', () => {
  if (!appData) return;
  const inputs = document.querySelectorAll('.bt-input');
  appData.latest.numbers_str.forEach((val, idx) => {
    if (inputs[idx]) inputs[idx].value = val;
  });
});

onClick('clearBacktestBtn', () => {
  document.querySelectorAll('.bt-input').forEach(inp => inp.value = '');
});

onClick('resetFilterBtn', () => {
  fixedBalls.clear();
  excludedBalls.clear();
  currentZoneCut = 'none';
  document.querySelectorAll('.zone-btn').forEach((b, idx) => {
    b.className = idx === 0
      ? 'zone-btn active py-2 px-2 rounded-xl text-xs font-bold border border-sky-500 bg-sky-500/20 text-sky-300 transition'
      : 'zone-btn py-2 px-2 rounded-xl text-xs font-bold border border-slate-700 bg-slate-900/80 text-slate-400 hover:text-slate-200 transition';
  });
  savePickerState();
  renderNumberGrid();
  generatePrediction();
});

onClick('runBacktestBtn', runBacktest);


// =========================================================================
// 🔬 牌路數據：渲染「質合比與合數單雙走勢分析」
// =========================================================================
function renderPrimeAndDigitSumStats() {
  if (!appData || !appData.stats.primeRatioCounts) return;
  const pCounts = appData.stats.primeRatioCounts;
  const dCounts = appData.stats.digitSumRatioCounts;
  const total = Math.min(30, appData.history.length) || 1;

  const orderKeys = ['0:5', '1:4', '2:3', '3:2', '4:1', '5:0'];
  let bestPrimeRatio = '2:3';
  let bestPrimeVal = -1;
  orderKeys.forEach(k => {
    if ((pCounts[k] || 0) > bestPrimeVal) {
      bestPrimeVal = pCounts[k] || 0;
      bestPrimeRatio = k;
    }
  });

  const recPrimeCount = bestPrimeRatio.split(':')[0];
  document.getElementById('primeAdviceBadge').textContent = `近${total}期最旺 ${bestPrimeRatio}（建議抓 ${recPrimeCount} 顆質數）`;

  document.getElementById('primeRatioBars').innerHTML = orderKeys.map(k => {
    const cnt = pCounts[k] || 0;
    const pct = Math.round((cnt / total) * 100);
    const isGolden = k === '1:4' || k === '2:3' || k === '3:2';
    return `
      <div class="flex items-center gap-2 text-xs">
        <span class="w-10 font-num font-bold ${isGolden ? 'text-teal-300' : 'text-slate-400'}">${k}</span>
        <div class="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
          <div class="h-full ${isGolden ? 'bg-teal-400' : 'bg-slate-600'} rounded-full" style="width: ${pct}%"></div>
        </div>
        <span class="w-16 text-right font-num text-slate-300">${cnt}期 (${pct}%)</span>
      </div>
    `;
  }).join('');

  document.getElementById('digitSumRatioBars').innerHTML = orderKeys.map(k => {
    const cnt = dCounts[k] || 0;
    const pct = Math.round((cnt / total) * 100);
    const isGolden = k === '2:3' || k === '3:2' || k === '1:4' || k === '4:1';
    return `
      <div class="flex items-center gap-2 text-xs">
        <span class="w-10 font-num font-bold ${isGolden ? 'text-cyan-300' : 'text-slate-400'}">${k}</span>
        <div class="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
          <div class="h-full ${isGolden ? 'bg-cyan-400' : 'bg-slate-600'} rounded-full" style="width: ${pct}%"></div>
        </div>
        <span class="w-16 text-right font-num text-slate-300">${cnt}期 (${pct}%)</span>
      </div>
    `;
  }).join('');

  const ds1to12 = appData.stats.digitSum1to12Counts || {};
  const dsEntries = Object.entries(ds1to12).map(([val, cnt]) => ({ val: Number(val), cnt }));
  const maxDsCnt = Math.max(...dsEntries.map(x => x.cnt), 1);
  const topDs = [...dsEntries].sort((a, b) => b.cnt - a.cnt)[0];
  const hotDsTag = document.getElementById('hotDigitSumTag');
  if (hotDsTag && topDs) {
    hotDsTag.textContent = `最旺 ${topDs.val} 合（開出 ${topDs.cnt} 顆）`;
  }

  const dsGrid = document.getElementById('digitSum1to12Grid');
  if (dsGrid) {
    dsGrid.innerHTML = dsEntries.map(item => {
      const isHot = item.cnt >= maxDsCnt - 2 && item.cnt > 0;
      return `
        <div class="p-2 rounded-lg text-center border ${isHot ? 'bg-amber-500/15 border-amber-500/45' : 'bg-slate-900/80 border-slate-800'}">
          <div class="text-[11px] font-bold ${isHot ? 'text-amber-300' : 'text-slate-400'}">${item.val} 合</div>
          <div class="font-num text-sm font-black ${isHot ? 'text-white' : 'text-slate-300'} mt-0.5">${item.cnt}顆</div>
        </div>
      `;
    }).join('');
  }

  const sisters = appData.stats.sisterTailsTop6 || [];
  const sisterBox = document.getElementById('sisterTailsList');
  if (sisterBox) {
    sisterBox.innerHTML = sisters.map((item, idx) => `
      <div class="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-900/85 border border-slate-800/90 text-xs">
        <div class="flex items-center gap-2">
          <span class="text-[11px] font-bold ${idx < 2 ? 'text-emerald-400' : 'text-slate-500'}">#${idx + 1}</span>
          <span class="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">${item.t1}尾 ＋ ${item.t2}尾</span>
        </div>
        <span class="font-num text-slate-300 font-bold">同開 ${item.count}期 (${item.pct}%)</span>
      </div>
    `).join('');
  }
}

// =========================================================================
// 🧮 聰明包牌（旋轉矩陣縮水工具）互動函式
// =========================================================================
window.switchPickerSubTab = function(subName) {
  const singlePanel = document.getElementById('picker-sub-single');
  const wheelPanel = document.getElementById('picker-sub-wheel');
  document.querySelectorAll('.picker-sub-btn').forEach(btn => {
    if (btn.dataset.sub === subName) {
      btn.className = 'picker-sub-btn active px-3 py-1.5 rounded-lg text-xs sm:text-sm font-black bg-amber-500 text-slate-950 transition';
    } else {
      btn.className = 'picker-sub-btn px-3 py-1.5 rounded-lg text-xs sm:text-sm font-black text-slate-300 hover:text-white transition';
    }
  });

  if (subName === 'wheel') {
    singlePanel.classList.add('hidden');
    wheelPanel.classList.remove('hidden');
    renderWheelNumberGrid();
    renderWheelResult();
  } else {
    wheelPanel.classList.add('hidden');
    singlePanel.classList.remove('hidden');
  }
};

function renderWheelNumberGrid() {
  const grid = document.getElementById('wheelNumberGrid');
  if (!grid) return;
  let html = '';
  for (let i = 1; i <= 39; i++) {
    const b = pad2(i);
    const isSelected = wheelSelectedBalls.has(b);
    const cls = isSelected
      ? 'bg-amber-500/25 border-amber-400 text-amber-300 shadow-md shadow-amber-500/20'
      : 'bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-500';
    const badge = isSelected
      ? '<span class="absolute -top-1.5 -right-1.5 text-[10px] bg-amber-400 text-slate-950 font-black px-1.5 rounded">✓</span>'
      : '';
    html += `
      <button onclick="toggleWheelBall('${b}')" class="relative py-2.5 rounded-xl border font-num font-bold text-sm transition active:scale-95 ${cls}">
        ${b}${badge}
      </button>
    `;
  }
  grid.innerHTML = html;

  const count = wheelSelectedBalls.size;
  const badgeEl = document.getElementById('wheelSelectedCountBadge');
  if (badgeEl) {
    if (count >= 6) {
      const nums = Array.from(wheelSelectedBalls).map(Number).sort((a, b) => a - b);
      const z = calcZones(nums);
      const oddCnt = nums.filter(x => x % 2 === 1).length;
      badgeEl.textContent = `已選 ${count} / 12 碼 · 三區 ${z.label} · 奇偶 ${oddCnt}:${count - oddCnt}`;
    } else {
      badgeEl.textContent = `已選 ${count} / 12 碼`;
    }
  }

  const chipsEl = document.getElementById('wheelSelectedChips');
  if (chipsEl) {
    if (count === 0) {
      chipsEl.innerHTML = '尚未選取號碼（請點選上方 6～12 顆球）';
    } else {
      chipsEl.innerHTML = Array.from(wheelSelectedBalls).sort().map(b => `
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 font-num font-bold text-xs">
          ${b}
        </span>
      `).join('');
    }
  }
}

window.toggleWheelBall = function(b) {
  if (wheelSelectedBalls.has(b)) {
    wheelSelectedBalls.delete(b);
  } else {
    if (wheelSelectedBalls.size >= 12) {
      alert('旋轉矩陣最多支援挑選 12 顆心水號碼喔！');
      return;
    }
    wheelSelectedBalls.add(b);
  }
  renderWheelNumberGrid();
  renderWheelResult();
};

window.clearWheelSelection = function() {
  wheelSelectedBalls.clear();
  renderWheelNumberGrid();
  renderWheelResult();
};

window.setWheelGuarantee = function(mode) {
  wheelGuaranteeMode = mode;
  document.querySelectorAll('.wheel-gmode-btn').forEach(btn => {
    if (btn.dataset.gmode === mode) {
      btn.className = 'wheel-gmode-btn active py-2.5 px-2 rounded-xl text-xs font-bold border border-amber-500 bg-amber-500/20 text-amber-300 transition';
    } else {
      btn.className = 'wheel-gmode-btn py-2.5 px-2 rounded-xl text-xs font-bold border border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-500 transition';
    }
  });
  renderWheelResult();
};

// 從已排序候選池中篩出結構健康的聰明包牌核心球池（支援物件陣列或純字串陣列）：
// 三區均衡（8碼每區≤3顆、9碼每區≤4顆）、禁止純三連號、熱溫冷三層分層（熱0~3期≤4顆、冷≥10期≤2顆）、奇偶防單邊、同尾數≤2顆、上期連莊≤2顆
function selectBalancedWheelPool(rankedItems, targetCount = 8, latestSet = new Set(), omissionMap = null) {
  if (!Array.isArray(rankedItems) || rankedItems.length <= targetCount) {
    return Array.isArray(rankedItems) ? [...rankedItems] : [];
  }

  const omMap = omissionMap || appData?.stats?.omission || {};
  const getBall = item => (typeof item === 'string' ? item : item.ball);
  const getZoneIdx = num => (num <= 13 ? 0 : (num <= 26 ? 1 : 2));
  const getHwcTier = ball => {
    const om = omMap[ball] ?? 5;
    return om <= 3 ? 0 : (om <= 9 ? 1 : 2); // 0=熱(0~3期), 1=溫(4~9期), 2=冷(>=10期)
  };
  const createsTripleConsec = (numSet, cand) => {
    let run = 1;
    let x = cand - 1;
    while (numSet.has(x)) { run++; x--; }
    x = cand + 1;
    while (numSet.has(x)) { run++; x++; }
    return run >= 3;
  };

  const selected = [];
  const selectedSet = new Set();
  const selectedNums = new Set();
  const zoneCnt = [0, 0, 0];
  const tailCnt = {};
  let oddCnt = 0;
  let evenCnt = 0;
  let repeatCnt = 0;
  let hotCnt = 0;
  let coldCnt = 0;

  const maxPerZone = targetCount <= 8 ? 3 : 4;
  const maxOddEven = targetCount <= 8 ? 5 : 6;
  const maxHot = targetCount <= 8 ? 4 : 5;
  const maxCold = targetCount <= 8 ? 2 : 3;
  const maxRepeat = 2;
  const maxSameTail = 2;

  const tryPass = (opts) => {
    for (const item of rankedItems) {
      if (selected.length >= targetCount) break;
      const b = getBall(item);
      if (selectedSet.has(b)) continue;
      const n = Number(b);
      const z = getZoneIdx(n);
      const t = n % 10;
      const isOdd = n % 2 === 1;
      const isRep = latestSet.has(b);
      const hwc = getHwcTier(b);

      if (opts.zone && zoneCnt[z] >= maxPerZone) continue;
      if (opts.consec && createsTripleConsec(selectedNums, n)) continue;
      if (opts.hwc) {
        if (hwc === 0 && hotCnt >= maxHot) continue;
        if (hwc === 2 && coldCnt >= maxCold) continue;
      }
      if (opts.repeat && isRep && repeatCnt >= maxRepeat) continue;
      if (opts.tail && (tailCnt[t] || 0) >= maxSameTail) continue;
      if (opts.oddEven) {
        if (isOdd && oddCnt >= maxOddEven) continue;
        if (!isOdd && evenCnt >= maxOddEven) continue;
      }

      selected.push(item);
      selectedSet.add(b);
      selectedNums.add(n);
      zoneCnt[z]++;
      tailCnt[t] = (tailCnt[t] || 0) + 1;
      if (isOdd) oddCnt++;
      else evenCnt++;
      if (isRep) repeatCnt++;
      if (hwc === 0) hotCnt++;
      else if (hwc === 2) coldCnt++;
    }
  };

  // 分層放寬補齊，確保一定湊滿 targetCount 顆
  tryPass({ zone: true, consec: true, hwc: true, repeat: true, tail: true, oddEven: true });
  if (selected.length < targetCount) {
    tryPass({ zone: true, consec: true, hwc: true, repeat: true, tail: false, oddEven: true });
  }
  if (selected.length < targetCount) {
    tryPass({ zone: true, consec: true, hwc: false, repeat: false, tail: false, oddEven: false });
  }
  if (selected.length < targetCount) {
    tryPass({ zone: false, consec: false, hwc: false, repeat: false, tail: false, oddEven: false });
  }

  return selected;
}

// 旋轉矩陣小／大／中三層交錯映射：
// 數學覆蓋保證 100% 等價不變，且避免 [0,1,2,3,4] 全部押到最小號、[5,6,7,8,9] 全部押到最大號
function interleaveWheelBalls(sortedBalls) {
  const n = sortedBalls.length;
  const c1 = Math.floor((n + 2) / 3);
  const c2 = Math.floor((2 * n + 2) / 3);
  const low = sortedBalls.slice(0, c1);
  const mid = sortedBalls.slice(c1, c2);
  const high = sortedBalls.slice(c2);
  const result = [];
  const maxLen = Math.max(low.length, mid.length, high.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < low.length) result.push(low[i]);
    if (i < high.length) result.push(high[i]);
    if (i < mid.length) result.push(mid[i]);
  }
  return result;
}

window.autoFillWheelBalls = function(preset) {
  if (!appData) return;
  const allBalls = Array.from({ length: 39 }, (_, i) => pad2(i + 1));
  const stats = appData.stats;
  const latestSet = new Set(appData.latest?.numbers_str || []);
  wheelSelectedBalls.clear();

  if (preset === 'hot8') {
    const sorted = [...allBalls].sort((a, b) => (stats.freq_30[b] || 0) - (stats.freq_30[a] || 0) || a.localeCompare(b));
    selectBalancedWheelPool(sorted, 8, latestSet).forEach(b => wheelSelectedBalls.add(b));
  } else if (preset === 'golden9') {
    const dragMap = {};
    stats.drag_top6.forEach(d => { dragMap[d.ball] = d.score; });
    const sorted = [...allBalls].sort((a, b) => {
      const sa = (stats.freq_30[a] || 0) * 1.5 + Math.min(stats.omission[a] || 0, 12) + (dragMap[a] || 0);
      const sb = (stats.freq_30[b] || 0) * 1.5 + Math.min(stats.omission[b] || 0, 12) + (dragMap[b] || 0);
      return sb - sa || a.localeCompare(b);
    });
    selectBalancedWheelPool(sorted, 9, latestSet).forEach(b => wheelSelectedBalls.add(b));
  } else if (preset === 'drag8') {
    const ordered = [];
    const seen = new Set();
    const pushUnique = b => {
      if (!seen.has(b)) {
        seen.add(b);
        ordered.push(b);
      }
    };
    (stats.sandwichBalls || []).forEach(pushUnique);
    (stats.obliqueBalls || []).forEach(pushUnique);
    (stats.drag_top6 || []).forEach(d => pushUnique(d.ball));
    const hotSorted = [...allBalls].sort((a, b) => (stats.freq_30[b] || 0) - (stats.freq_30[a] || 0) || a.localeCompare(b));
    hotSorted.forEach(pushUnique);
    selectBalancedWheelPool(ordered, 8, latestSet).forEach(b => wheelSelectedBalls.add(b));
  }

  renderWheelNumberGrid();
  renderWheelResult();
};

function renderWheelResult() {
  const sortedBalls = Array.from(wheelSelectedBalls).sort();
  const n = sortedBalls.length;
  const fullCostEl = document.getElementById('wheelFullCost');
  const reducedCostEl = document.getElementById('wheelReducedCost');
  const savedCostEl = document.getElementById('wheelSavedCost');
  const noteEl = document.getElementById('wheelGuaranteeNote');
  const listEl = document.getElementById('wheelTicketsList');

  if (!listEl) return;

  if (n < 6) {
    currentWheelTickets = [];
    saveWheelState();
    fullCostEl.textContent = '0 注 / $0';
    reducedCostEl.textContent = '0 注 / $0';
    savedCostEl.textContent = '現省 $0';
    noteEl.textContent = `還差 ${6 - n} 顆號碼（需選 6～12 碼）`;
    listEl.innerHTML = `
      <div class="h-36 flex items-center justify-center text-xs text-slate-500 bg-slate-950/60 rounded-xl border border-slate-800/80 text-center px-4">
        目前已選 ${n} 顆，請再選滿至少 6 顆（最多 12 顆）即可啟動旋轉矩陣縮水包牌！
      </div>
    `;
    return;
  }

  const templates = WHEEL_TEMPLATES[n]?.[wheelGuaranteeMode] || [];
  const mappedBalls = interleaveWheelBalls(sortedBalls);
  let rawTickets = templates.map(idxArr => idxArr.map(i => mappedBalls[i]).sort());

  const useAiFilter = document.getElementById('wheelAiFilterToggle')?.checked ?? false;
  let filteredCount = 0;
  if (useAiFilter && rawTickets.length > 1) {
    const kept = rawTickets.filter(t => {
      const nums = t.map(Number);
      const sum = nums.reduce((a, b) => a + b, 0);
      const pd = analyzePrimeAndDigitSum(nums);
      return sum >= 65 && sum <= 145 && pd.isValidPrime;
    });
    if (kept.length >= 1) {
      filteredCount = rawTickets.length - kept.length;
      rawTickets = kept;
    }
  }

  currentWheelTickets = rawTickets;
  saveWheelState();

  const fullBets = nCr(n, 5);
  const fullMoney = fullBets * 50;
  const reducedBets = rawTickets.length;
  const reducedMoney = reducedBets * 50;
  const savedMoney = Math.max(0, fullMoney - reducedMoney);

  fullCostEl.textContent = `${fullBets} 注 / $${fullMoney.toLocaleString()}`;
  reducedCostEl.textContent = `${reducedBets} 注 / $${reducedMoney.toLocaleString()}`;
  savedCostEl.textContent = `現省 $${savedMoney.toLocaleString()}`;

  const modeDescMap = {
    '5to3': `選 ${n} 碼若開出 5 碼，保證至少 1 注中 3 碼（參獎）`,
    '4to3': `選 ${n} 碼只要中 4 碼，保證至少 1 注中 3 碼（參獎）`,
    '5to4': `選 ${n} 碼若開出 5 碼，保證至少 1 注中 4 碼（貳獎2萬）`
  };
  noteEl.textContent = modeDescMap[wheelGuaranteeMode] + ' · 已套用三區交錯配號' + (filteredCount > 0 ? `（AI濾水再省 ${filteredCount} 注）` : '');

  listEl.innerHTML = rawTickets.map((ticket, idx) => {
    const nums = ticket.map(Number);
    const sum = nums.reduce((a, b) => a + b, 0);
    const pd = analyzePrimeAndDigitSum(nums);
    const ac = calcACValue(nums);
    const zones = calcZones(nums);
    return `
      <div class="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950/85 border border-slate-800/90">
        <div class="flex items-center gap-1.5">
          <span class="text-[11px] font-bold text-slate-400 w-9">第${pad2(idx + 1)}注</span>
          ${ticket.map(b => `
            <span class="w-7 h-7 rounded-full ball-gold flex items-center justify-center font-num font-black text-xs">${b}</span>
          `).join('')}
        </div>
        <div class="text-[11px] text-slate-400 font-num">
          和:${sum} · 三區:${zones.label} · 質合:${pd.primeRatio} · AC:${ac}
        </div>
      </div>
    `;
  }).join('');
}

window.copyWheelTickets = function() {
  if (!currentWheelTickets.length) {
    alert('請先選滿 6～12 顆心水號碼產生包牌注單！');
    return;
  }
  const baseNums = Array.from(wheelSelectedBalls).sort().join('、');
  const modeLabel = { '5to3': '中5保3', '4to3': '中4保3', '5to4': '中5保4' }[wheelGuaranteeMode];
  const lines = [
    `🧮【今彩539 聰明包牌旋轉矩陣】`,
    `心水 ${wheelSelectedBalls.size} 碼（${modeLabel}）：${baseNums}`,
    `共縮水為 ${currentWheelTickets.length} 注（總計 $${currentWheelTickets.length * 50} 元）：`,
    ...currentWheelTickets.map((t, i) => `第${pad2(i + 1)}注：${t.join('、')}`)
  ];
  navigator.clipboard.writeText(lines.join('\n')).then(() => {
    const btn = document.getElementById('copyWheelTicketsBtn');
    btn.textContent = '✅ 已複製全部注單！';
    setTimeout(() => btn.textContent = '📋 一鍵複製全部注單', 1800);
  });
};

window.sendWheelToCommunity = function() {
  if (!currentWheelTickets.length) {
    alert('請先選滿 6～12 顆心水號碼產生包牌注單！');
    return;
  }
  const baseNums = Array.from(wheelSelectedBalls).sort().join('、');
  const modeLabel = { '5to3': '中5保3', '4to3': '中4保3', '5to4': '中5保4' }[wheelGuaranteeMode];
  const lines = [
    `🧮【今彩539 聰明包牌合牌單】`,
    `🎯 心水 ${wheelSelectedBalls.size} 碼（${modeLabel}）：${baseNums}`,
    `💡 旋轉矩陣精簡 ${currentWheelTickets.length} 注（現省 $${(nCr(wheelSelectedBalls.size, 5) - currentWheelTickets.length) * 50} 元）：`,
    ...currentWheelTickets.map((t, i) => `第${pad2(i + 1)}注：${t.join('、')}`),
    `👉 免費聰明包牌／大數據分析：https://kokko-travel.com/539/`
  ];
  sessionStorage.setItem(STORAGE_KEYS.pendingShareText, lines.join('\n'));
  switchTab('community');
};


// =========================================================================
// 🏆 跨維度共識總決選引擎（不含遺漏期、破紀錄雷達與馬可夫鏈）
// =========================================================================
let consensusTop8List = [];
let consensusFullRanked = [];
let consensusFinal5 = [];

function calibrateIndicatorWeights(records) {
  const windowSize = Math.min(100, records.length - 2);
  const totalCombos539 = nCr(39, 5); // 575,757
  // 計算當期候選池大小為 k 顆時，純隨機至少命中 1 顆的精確理論機率
  const expectedHitProb = k => {
    if (k <= 0) return 0;
    if (k >= 35) return 1;
    return 1 - (nCr(39 - k, 5) / totalCombos539);
  };

  const counters = {
    sandwich: { hits: 0, draws: 0, expectedHits: 0, label: '夾號焦點' },
    oblique:  { hits: 0, draws: 0, expectedHits: 0, label: '斜連延伸' },
    neighbor: { hits: 0, draws: 0, expectedHits: 0, label: '上期鄰號' },
    skipOne:  { hits: 0, draws: 0, expectedHits: 0, label: '隔期跳開' },
    hot30:    { hits: 0, draws: 0, expectedHits: 0, label: '近期熱門' },
    coldRoad: { hits: 0, draws: 0, expectedHits: 0, label: '偏冷012路' }
  };

  if (windowSize >= 5) {
    const allBalls = Array.from({ length: 39 }, (_, i) => pad2(i + 1));
    for (let i = 0; i < windowSize; i++) {
      const targetSet = new Set(records[i].numbers_str);
      const prev1 = records[i + 1];
      const prev2 = records[i + 2];

      const sand = [];
      for (let k = 0; k < prev1.numbers.length - 1; k++) {
        if (prev1.numbers[k + 1] - prev1.numbers[k] === 2) sand.push(pad2(prev1.numbers[k] + 1));
      }
      if (sand.length) {
        counters.sandwich.draws++;
        counters.sandwich.expectedHits += expectedHitProb(sand.length);
        if (sand.some(b => targetSet.has(b))) counters.sandwich.hits++;
      }

      const ob = new Set();
      const p1Set = new Set(prev1.numbers);
      prev2.numbers.forEach(n => {
        if (p1Set.has(n + 1) && n + 2 <= 39) ob.add(pad2(n + 2));
        if (p1Set.has(n - 1) && n - 2 >= 1) ob.add(pad2(n - 2));
      });
      if (ob.size) {
        counters.oblique.draws++;
        counters.oblique.expectedHits += expectedHitProb(ob.size);
        if (Array.from(ob).some(b => targetSet.has(b))) counters.oblique.hits++;
      }

      const nb = new Set();
      prev1.numbers.forEach(n => {
        if (n - 1 >= 1 && !p1Set.has(n - 1)) nb.add(pad2(n - 1));
        if (n + 1 <= 39 && !p1Set.has(n + 1)) nb.add(pad2(n + 1));
      });
      if (nb.size) {
        counters.neighbor.draws++;
        counters.neighbor.expectedHits += expectedHitProb(nb.size);
        if (Array.from(nb).some(b => targetSet.has(b))) counters.neighbor.hits++;
      }

      const sk = prev2.numbers.filter(n => !p1Set.has(n)).map(pad2);
      if (sk.length) {
        counters.skipOne.draws++;
        counters.skipOne.expectedHits += expectedHitProb(sk.length);
        if (sk.some(b => targetSet.has(b))) counters.skipOne.hits++;
      }

      // 統一使用近 30 期視窗回測，與實戰 stats.freq_30 保持一致
      const sliceHist = records.slice(i + 1, i + 31);
      const fMap = {};
      allBalls.forEach(b => fMap[b] = 0);
      sliceHist.forEach(r => r.numbers_str.forEach(b => fMap[b]++));
      const topHot = [...allBalls].sort((a, b) => fMap[b] - fMap[a]).slice(0, 8);
      counters.hot30.draws++;
      counters.hot30.expectedHits += expectedHitProb(topHot.length);
      if (topHot.some(b => targetSet.has(b))) counters.hot30.hits++;

      const rCnt = [0, 0, 0];
      records.slice(i + 1, i + 11).forEach(r => r.numbers.forEach(n => rCnt[n % 3]++));
      const minMod = rCnt.indexOf(Math.min(...rCnt));
      counters.coldRoad.draws++;
      counters.coldRoad.expectedHits += expectedHitProb(13); // 0/1/2 路各 13 顆球
      if (records[i].numbers.some(n => n % 3 === minMod)) counters.coldRoad.hits++;
    }
  }

  const rates = {};
  const expectedRates = {};
  const lifts = {};
  const ranking = [];
  Object.entries(counters).forEach(([key, obj]) => {
    const rate = obj.draws > 0 ? Math.round((obj.hits / obj.draws) * 100) : 0;
    const expectedRate = obj.draws > 0 ? Math.round((obj.expectedHits / obj.draws) * 100) : 0;
    const lift = obj.expectedHits > 0 ? Math.round((obj.hits / obj.expectedHits) * 100) / 100 : 1.0;
    rates[key] = rate;
    expectedRates[key] = expectedRate;
    lifts[key] = lift;
    ranking.push({ key, label: obj.label, rate, expectedRate, lift, hits: obj.hits, draws: obj.draws });
  });

  // 依超額勝率 Lift 排序（避免候選球數多的指標佔盡便宜）
  ranking.sort((a, b) => b.lift - a.lift || b.rate - a.rate);
  return { rates, expectedRates, lifts, ranking, windowSize };
}

function computeConsensusEngine() {
  if (!appData) return;
  const stats = appData.stats;
  const allBalls = Array.from({ length: 39 }, (_, i) => pad2(i + 1));

  const cal = calibrateIndicatorWeights(appData.history);
  const latestSet = new Set(appData.latest?.numbers_str || []);
  const calBar = document.getElementById('dynamicCalibrationBar');
  if (calBar && cal.ranking.length) {
    const top3 = cal.ranking.slice(0, 3);
    calBar.innerHTML = `
      <span class="px-2 py-0.5 rounded bg-sky-500/20 border border-sky-500/40 text-sky-300 font-bold">⚖️ 近${cal.windowSize}期超額勝率(Lift)校準：</span>
      ${top3.map((item, idx) => `
        <span class="px-2 py-0.5 rounded ${idx === 0 ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold' : 'bg-slate-900 border border-slate-700 text-slate-300'}">
          ${idx === 0 ? '👑 ' : ''}${item.label} ${item.lift.toFixed(2)}x (${item.rate}% / 基準${item.expectedRate}%)
        </span>
      `).join('')}
      <span class="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/35 text-amber-300 font-bold">🔁 連莊 ≤ 1・拖牌 ≤ 2・熱溫冷分層・TOP 12 決選</span>
    `;
  }

  // 以超額勝率 Lift 公平調權（1.0x 為隨機基準，限制在 0.70x ～ 1.35x 防止小樣本過度擬合）
  const liftMult = key => {
    const lift = cal.lifts?.[key] ?? 1.0;
    return Math.max(0.7, Math.min(1.35, 1 + (lift - 1) * 1.25));
  };

  const dragMap = {};
  (stats.drag_top6 || []).forEach((d, idx) => {
    dragMap[d.ball] = { rank: idx + 1, score: d.score };
  });

  const twinSet = new Set();
  (stats.top_twins || []).slice(0, 3).forEach(t => {
    twinSet.add(t.b1);
    twinSet.add(t.b2);
  });

  const sandwichSet = new Set(stats.sandwichBalls || []);
  const obliqueSet = new Set(stats.obliqueBalls || []);
  const neighborSet = new Set(stats.neighborBalls || []);
  const skipOneSet = new Set(stats.skipOneBalls || []);

  const todayDow = new Date().getDay();
  const targetDow = (todayDow >= 1 && todayDow <= 6) ? todayDow : 1;
  const weekdaySet = new Set((stats.weekdayTop5[targetDow] || []).map(x => x.ball));

  const roads = stats.roadCounts || [0, 0, 0];
  const minRoadVal = Math.min(...roads);
  const coldRoadMod = roads.indexOf(minRoadVal);

  const hotTop8Set = new Set(
    [...allBalls]
      .sort((a, b) => (stats.freq_30[b] || 0) - (stats.freq_30[a] || 0))
      .slice(0, 8)
  );

  const scoredBalls = allBalls.map(b => {
    const num = Number(b);
    let score = 0;
    const reasons = [];

    if (dragMap[b]) {
      // 調降至與其他核心指標同量級（約 17.2 ～ 23.2 分），避免單項過度主導
      const dragRankBoost = Math.max(0, (7 - dragMap[b].rank) * 1.2);
      score += 16 + dragRankBoost;
      reasons.push(`拖牌TOP${dragMap[b].rank}★`);
    }
    if (sandwichSet.has(b)) {
      score += 18 * liftMult('sandwich');
      reasons.push(`夾號(${cal.lifts.sandwich.toFixed(2)}x)`);
    }
    if (obliqueSet.has(b)) {
      score += 17 * liftMult('oblique');
      reasons.push(`斜連(${cal.lifts.oblique.toFixed(2)}x)`);
    }

    if (twinSet.has(b)) {
      score += 15;
      reasons.push('雙星伴侶');
    }
    if (weekdaySet.has(b)) {
      score += 14;
      reasons.push('星期旺號');
    }
    if (hotTop8Set.has(b)) {
      score += 15 * liftMult('hot30');
      reasons.push(`近期熱(${stats.freq_30[b]}次)`);
    }

    if (neighborSet.has(b)) {
      score += 15 * liftMult('neighbor');
      reasons.push(`鄰號(${cal.lifts.neighbor.toFixed(2)}x)`);
    }
    if (skipOneSet.has(b)) {
      score += 14 * liftMult('skipOne');
      reasons.push(`隔期(${cal.lifts.skipOne.toFixed(2)}x)`);
    }
    if (num % 3 === coldRoadMod) {
      const r0Mult = (num % 3 === 0 && stats.road0NeedsBoost) ? 1.25 : 1.0;
      score += 14 * liftMult('coldRoad') * r0Mult;
      reasons.push((num % 3 === 0 && stats.road0NeedsBoost) ? `0路<14顆加重` : `${coldRoadMod}路待補`);
    }

    const overlapCount = reasons.length;
    if (overlapCount >= 4) {
      score += (overlapCount - 2) * 5.0;
    } else if (overlapCount === 3) {
      score += 4.0;
    }

    score += (stats.freq_30[b] || 0) * 0.5;

    return {
      ball: b,
      score: Math.round(score * 10) / 10,
      hitCount: reasons.length,
      isLastDraw: latestSet.has(b),
      reasons
    };
  });

  // 統一排序標準：TOP 8 套用三區均衡、熱溫冷三層分層與防純三連號（讓 8 碼聰明包牌結構更健康）
  scoredBalls.sort((a, b) => b.score - a.score || b.hitCount - a.hitCount || a.ball.localeCompare(b.ball));
  consensusFullRanked = scoredBalls;
  consensusTop8List = selectBalancedWheelPool(scoredBalls, 8, latestSet, stats.omission);

  renderConsensusTop8();
  pickFilteredConsensus5(scoredBalls.slice(0, 12));
}

function renderConsensusTop8() {
  const grid = document.getElementById('consensusTop8Grid');
  if (!grid || !consensusTop8List.length) return;

  grid.innerHTML = consensusTop8List.map((item, idx) => {
    const isTop3 = idx < 3;
    const ballCls = isTop3 ? 'ball-gold ring-2 ring-amber-300/70' : 'ball-red';
    const tagsHtml = item.reasons.slice(0, 2).map(r =>
      `<span class="inline-block px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 border border-slate-700/80 truncate max-w-full">${r}</span>`
    ).join('');
    const repeatBadge = item.isLastDraw
      ? `<span class="inline-block px-1.5 py-0.5 rounded bg-amber-500/20 text-[10px] text-amber-300 border border-amber-500/40 font-bold">上期號</span>`
      : '';
    const extraCount = item.reasons.length > 2 ? `<span class="text-[10px] text-amber-400 font-bold">+${item.reasons.length - 2}項</span>` : '';

    return `
      <div class="p-2.5 rounded-xl bg-slate-900/90 border ${isTop3 ? 'border-amber-500/45' : 'border-slate-800'} flex flex-col justify-between gap-2">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-black ${isTop3 ? 'text-amber-300' : 'text-slate-400'}">NO.${idx + 1}</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-bold">中 ${item.hitCount} 指標</span>
        </div>
        <div class="flex items-center justify-center my-0.5">
          <button onclick="addSingleBallToFixed('${item.ball}')" title="點擊設為 AI 選號定膽（共識總分 ${item.score}）" class="w-10 h-10 rounded-full ${ballCls} flex items-center justify-center font-num font-black text-base hover:scale-105 transition">
            ${item.ball}
          </button>
        </div>
        <div class="flex flex-wrap items-center justify-center gap-1 min-h-[22px]">
          ${repeatBadge}${tagsHtml}${extraCount}
        </div>
      </div>
    `;
  }).join('');
}

function pickFilteredConsensus5(candidatePool, randomizeTop = false) {
  if (!candidatePool || candidatePool.length < 5) return;
  const latestSet = new Set(appData?.latest?.numbers_str || []);
  const dragSet = new Set((appData?.stats?.drag_top6 || []).map(d => d.ball));
  const omMap = appData?.stats?.omission || {};

  // 取前 12 名不重複高分候選球（C(12,5) = 792 組，集中前段高分球且運算 < 1ms）
  const seen = new Set();
  const ordered = [...candidatePool]
    .sort((a, b) => b.score - a.score || (b.hitCount || 0) - (a.hitCount || 0) || a.ball.localeCompare(b.ball))
    .filter(item => {
      if (seen.has(item.ball)) return false;
      seen.add(item.ball);
      return true;
    })
    .slice(0, 12);

  if (ordered.length < 5) return;

  const evalCombo = items => {
    const balls = items.map(x => x.ball).sort();
    const nums = balls.map(Number);
    const sum = nums.reduce((acc, v) => acc + v, 0);
    const odd = nums.filter(v => v % 2 === 1).length;
    const ac = calcACValue(nums);
    const span = nums[4] - nums[0];
    const zones = calcZones(nums);
    const maxZone = Math.max(zones.z1, zones.z2, zones.z3);
    const pd = analyzePrimeAndDigitSum(nums);

    let maxConsecRun = 1;
    let curRun = 1;
    let consecPairs = 0;
    for (let i = 0; i < nums.length - 1; i++) {
      if (nums[i + 1] - nums[i] === 1) {
        consecPairs++;
        curRun++;
        if (curRun > maxConsecRun) maxConsecRun = curRun;
      } else {
        curRun = 1;
      }
    }

    let repeatUsed = 0;
    let dragUsed = 0;
    let hotCnt = 0;
    let warmCnt = 0;
    let coldCnt = 0;
    let totalScore = 0;
    items.forEach(x => {
      totalScore += (x.score || 0);
      if (latestSet.has(x.ball)) repeatUsed++;
      if (dragSet.has(x.ball)) dragUsed++;
      const om = omMap[x.ball] ?? 5;
      if (om <= 3) hotCnt++;
      else if (om <= 9) warmCnt++;
      else coldCnt++;
    });

    return {
      balls,
      key: balls.join(','),
      sum,
      odd,
      ac,
      span,
      zones,
      maxZone,
      maxConsecRun,
      consecPairs,
      hotCnt,
      warmCnt,
      coldCnt,
      hwcLabel: `${hotCnt}-${warmCnt}-${coldCnt}`,
      pd,
      repeatUsed,
      dragUsed,
      totalScore: Math.round(totalScore * 10) / 10
    };
  };

  // 分層防呆池（經 100/200/300/500 期盲測勝出定案版）：
  // tier1（完整防極端＋熱溫冷分層）：連莊≤1、拖牌≤2、熱(0~3期)1~3顆、溫(4~9期)1~3顆、冷(≥10期)0~2顆、禁全奇全偶(1:4~4:1)、禁純三連號且最多1組二連號、單區≤3顆、和值65~140、AC≥4
  // tier2（放寬和值/AC/熱溫冷，保留禁全奇全偶、防純三連號與單區≤3顆）
  // tier3（僅保留連莊≤1、拖牌≤2）
  // tier4（保底全組合）
  const tier1 = [];
  const tier2 = [];
  const tier3 = [];
  const tier4 = [];

  const n = ordered.length;
  for (let a = 0; a < n - 4; a++) {
    for (let b = a + 1; b < n - 3; b++) {
      for (let c = b + 1; c < n - 2; c++) {
        for (let d = c + 1; d < n - 1; d++) {
          for (let e = d + 1; e < n; e++) {
            const combo = evalCombo([ordered[a], ordered[b], ordered[c], ordered[d], ordered[e]]);
            const passCaps = combo.repeatUsed <= 1 && combo.dragUsed <= 2;
            const passNoAllOddEven = combo.odd >= 1 && combo.odd <= 4;
            const passNoClump = combo.maxConsecRun <= 2 && combo.maxZone <= 3 && passNoAllOddEven;
            const passHwc = combo.hotCnt >= 1 && combo.hotCnt <= 3 && combo.warmCnt >= 1 && combo.warmCnt <= 3 && combo.coldCnt <= 2;
            const passFullGuard = passCaps && passNoClump && passHwc && combo.consecPairs <= 1 && combo.sum >= 65 && combo.sum <= 140 && combo.ac >= 4;

            if (passFullGuard) {
              tier1.push(combo);
            } else if (passCaps && passNoClump) {
              tier2.push(combo);
            } else if (passCaps) {
              tier3.push(combo);
            } else {
              tier4.push(combo);
            }
          }
        }
      }
    }
  }

  const activeTier = tier1.length ? tier1 : (tier2.length ? tier2 : (tier3.length ? tier3 : tier4));
  activeTier.sort((a, b) => b.totalScore - a.totalScore || b.ac - a.ac || a.key.localeCompare(b.key));

  let chosen = activeTier[0];
  if (randomizeTop && activeTier.length > 1) {
    const prevKey = consensusFinal5.join(',');
    const topSlice = activeTier.slice(0, Math.min(20, activeTier.length));
    const altPool = topSlice.filter(x => x.key !== prevKey);
    const pickFrom = altPool.length ? altPool : topSlice;
    chosen = pickFrom[Math.floor(Math.random() * pickFrom.length)];
  }

  consensusFinal5 = chosen.balls;
  const ballsEl = document.getElementById('consensusFinalBalls');
  if (ballsEl) {
    ballsEl.innerHTML = chosen.balls.map((b, idx) => `
      <div style="animation-delay: ${idx * 50}ms" class="animate-pop w-10 h-10 sm:w-11 sm:h-11 rounded-full ball-gold flex items-center justify-center font-num font-black text-base sm:text-lg shadow-lg">
        ${b}
      </div>
    `).join('');
  }

  const metaEl = document.getElementById('consensusFinalMeta');
  if (metaEl) {
    metaEl.textContent = `和值:${chosen.sum} · 奇偶:${chosen.odd}:${5 - chosen.odd} · 熱溫冷:${chosen.hwcLabel} · 三區:${chosen.zones.label} · AC:${chosen.ac} · 跨:${chosen.span} · 連莊:${chosen.repeatUsed} · 拖牌:${chosen.dragUsed}`;
  }
}

window.rerollConsensusCombo = function() {
  if (!appData || !consensusTop8List.length) return;
  const pool = consensusFullRanked.length >= 12 ? consensusFullRanked.slice(0, 12) : (consensusFullRanked.length >= 5 ? consensusFullRanked : consensusTop8List);
  pickFilteredConsensus5(pool, true);
};

window.copyConsensusCombo = function() {
  if (!consensusFinal5.length) return;
  const top8Str = consensusTop8List.map(x => x.ball).join('、');
  const text = [
    `🏆【今彩539 AI 跨維度共識決選】`,
    `🎯 本期精選 5 碼（Lift 超額勝率排序・連莊≤1・拖牌≤2・防擠塞）：${consensusFinal5.join('、')}`,
    `🔥 綜合指標 TOP 8 焦點池：${top8Str}`,
    `👉 免費查牌路／回測：https://kokko-travel.com/539/`
  ].join('\n');
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copyConsensusBtn');
    btn.textContent = '✅ 已複製共識組合！';
    setTimeout(() => btn.textContent = '📋 複製共識 5 碼', 1800);
  });
};

window.sendConsensusToBacktest = function() {
  if (!consensusFinal5.length) return;
  sessionStorage.setItem(STORAGE_KEYS.pendingBacktest, JSON.stringify(consensusFinal5));
  switchTab('backtest');
};

window.sendTop8ToWheel = function() {
  if (!consensusTop8List.length) return;
  wheelSelectedBalls.clear();
  consensusTop8List.forEach(item => wheelSelectedBalls.add(item.ball));
  saveWheelState();
  switchTab('picker', 'sub=wheel');
};


// =========================================================================
// 🧾 多注批量對獎機互動函式
// =========================================================================
window.switchBacktestSubTab = function(subName) {
  const singlePanel = document.getElementById('backtest-sub-single');
  const batchPanel = document.getElementById('backtest-sub-batch');
  document.querySelectorAll('.bt-sub-btn').forEach(btn => {
    if (btn.dataset.btsub === subName) {
      btn.className = 'bt-sub-btn active px-3 py-1.5 rounded-lg text-xs sm:text-sm font-black bg-purple-600 text-white transition';
    } else {
      btn.className = 'bt-sub-btn px-3 py-1.5 rounded-lg text-xs sm:text-sm font-black text-slate-300 hover:text-white transition';
    }
  });

  if (subName === 'batch') {
    singlePanel.classList.add('hidden');
    batchPanel.classList.remove('hidden');
    populateBatchPeriodSelect();
  } else {
    batchPanel.classList.add('hidden');
    singlePanel.classList.remove('hidden');
  }
};

function populateBatchPeriodSelect() {
  const sel = document.getElementById('batchTargetPeriod');
  if (!sel || !appData || !appData.history) return;
  const recent30 = appData.history.slice(0, 30);
  sel.innerHTML = recent30.map((draw, idx) => `
    <option value="${idx}">
      ${idx === 0 ? '【最新】' : ''}${draw.date} 第${draw.period}期 (${draw.numbers_str.join(',')})
    </option>
  `).join('');
}

window.clearBatchInput = function() {
  const box = document.getElementById('batchTicketsInput');
  if (box) box.value = '';
};

window.importWheelToBatch = function() {
  if (!currentWheelTickets || currentWheelTickets.length === 0) {
    alert('目前「聰明包牌縮水」尚未產生注單！請先至 AI 選號 → 聰明包牌縮水 挑選號碼。');
    return;
  }
  const box = document.getElementById('batchTicketsInput');
  box.value = currentWheelTickets.map((t, i) => `第${pad2(i + 1)}注：${t.join('、')}`).join('\n');
  runBatchCheck();
};

window.sendWheelToBatchCheck = function() {
  if (!currentWheelTickets || currentWheelTickets.length === 0) {
    alert('請先選滿 6～12 顆心水號碼產生包牌注單！');
    return;
  }
  saveWheelState();
  sessionStorage.setItem(STORAGE_KEYS.autoImportWheel, '1');
  switchTab('backtest', 'sub=batch');
};

window.runBatchCheck = function() {
  if (!appData || !appData.history.length) return;
  const rawText = document.getElementById('batchTicketsInput')?.value || '';
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const tickets = [];
  lines.forEach(line => {
    const cleaned = line.replace(/^第?\s*\d+\s*[注組號\.\):：、-]+\s*/i, '');
    const nums = (cleaned.match(/\d{1,2}/g) || [])
      .map(Number)
      .filter(n => n >= 1 && n <= 39);
    const unique = Array.from(new Set(nums.map(pad2)));
    if (unique.length === 5) {
      tickets.push(unique.sort());
    }
  });

  if (tickets.length === 0) {
    alert('解析不到有效的 5 碼組合！請確認每行包含 5 個不重複的 01～39 號碼。');
    return;
  }

  const periodIdx = Number(document.getElementById('batchTargetPeriod')?.value || 0);
  const targetDraw = appData.history[periodIdx] || appData.history[0];
  const winSet = new Set(targetDraw.numbers_str);

  document.getElementById('batchDrawInfoTag').textContent = `${targetDraw.date} 第${targetDraw.period}期`;
  document.getElementById('batchOfficialBalls').innerHTML = targetDraw.numbers_str.map(b => `
    <span class="w-6 h-6 rounded-full ball-gold flex items-center justify-center text-[11px] font-black">${b}</span>
  `).join('');

  let c5 = 0, c4 = 0, c3 = 0, c2 = 0, totalPrize = 0;

  const rowsHtml = tickets.map((ticket, idx) => {
    const hitCount = ticket.filter(b => winSet.has(b)).length;
    let prize = 0;
    let rankTag = '<span class="text-slate-500">未中獎</span>';
    let rowBorder = 'border-slate-800/80 bg-slate-950/70';

    if (hitCount === 5) {
      c5++; prize = 8000000;
      rankTag = '<span class="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-black">🏆 頭獎 $800萬</span>';
      rowBorder = 'border-amber-400 bg-amber-950/30';
    } else if (hitCount === 4) {
      c4++; prize = 20000;
      rankTag = '<span class="px-2 py-0.5 rounded bg-red-500 text-white font-black">🎉 貳獎 $20,000</span>';
      rowBorder = 'border-red-500/60 bg-red-950/25';
    } else if (hitCount === 3) {
      c3++; prize = 300;
      rankTag = '<span class="px-2 py-0.5 rounded bg-sky-500/25 text-sky-300 border border-sky-500/40 font-bold">✨ 參獎 $300</span>';
      rowBorder = 'border-sky-500/40 bg-sky-950/20';
    } else if (hitCount === 2) {
      c2++; prize = 50;
      rankTag = '<span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">💰 肆獎 $50</span>';
      rowBorder = 'border-emerald-500/35 bg-emerald-950/15';
    }
    totalPrize += prize;

    const ballsHtml = ticket.map(b => {
      const isHit = winSet.has(b);
      const cls = isHit
        ? 'ball-gold ring-2 ring-amber-300 scale-105'
        : 'bg-slate-800 text-slate-400 border border-slate-700';
      return `<span class="w-6 h-6 rounded-full ${cls} flex items-center justify-center font-num font-bold text-[11px]">${b}</span>`;
    }).join('');

    return `
      <div class="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl border ${rowBorder}">
        <div class="flex items-center gap-1.5">
          <span class="text-[11px] font-bold text-slate-400 w-9">第${pad2(idx + 1)}注</span>
          ${ballsHtml}
        </div>
        <div>${rankTag}</div>
      </div>
    `;
  }).join('');

  const totalCost = tickets.length * 50;
  const net = totalPrize - totalCost;

  document.getElementById('batchTotalCost').textContent = `${tickets.length} 注 / $${totalCost.toLocaleString()}`;
  document.getElementById('batchTotalPrize').textContent = `$${totalPrize.toLocaleString()}`;
  const netEl = document.getElementById('batchNetProfit');
  netEl.textContent = `${net >= 0 ? '+' : '-'}$${Math.abs(net).toLocaleString()}`;
  netEl.className = `font-num text-sm sm:text-base font-black mt-0.5 ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;

  document.getElementById('batchC5').textContent = `${c5} 注`;
  document.getElementById('batchC4').textContent = `${c4} 注`;
  document.getElementById('batchC3').textContent = `${c3} 注`;
  document.getElementById('batchC2').textContent = `${c2} 注`;
  document.getElementById('batchResultsList').innerHTML = rowsHtml;
};

loadPickerState();
loadWheelState();
applySocialLinks();
highlightActiveNav();

if (CURRENT_PAGE === 'picker') {
  scheduleTabAd('lucky_ad_last_shown', 10000, 'lucky');
} else if (CURRENT_PAGE === 'stats') {
  scheduleTabAd('klook_ad_last_shown', 10000, 'klook');
}

initApp(false);
