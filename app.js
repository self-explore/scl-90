// ============================================================
//  SCL-90 症状自评量表 · 逻辑层
//  封面 → 90 题作答 → 计算 → 结果（总分/均分/阳性项目数/十因子/雷达图/解读/建议）
//  合规：全程明确「不能作为医学结论」，重度档附危机干预热线
// ============================================================

const Q_N = SCL90_Q.length;          // 90
let answers = new Array(Q_N).fill(0); // 0 = 未作答
let cur = 0;
let lastResult = null;

const ENCOURAGE = [
  '按最近一周的真实感受选，不用反复斟酌。',
  '没有标准答案，只有你的答案。',
  '已经过半了，继续。',
  '剩下的不多了，坚持一下。',
  '最后一小段，很快就好。'
];

const ABBR = { '人际关系敏感': '人际敏感' };
function abbr(n) { return ABBR[n] || n.replace('症状', ''); }

// ---------- 页面切换 ----------
function show(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  // 答题页开启压缩模式：收起大页头、压缩间距，保证手机一屏放下
  document.body.classList.toggle('quiz-mode', id === 'page-test');
  window.scrollTo(0, 0);
}

// ---------- 封面渲染 ----------
function renderIntro() {
  const grid = document.getElementById('factorGrid');
  grid.innerHTML = SCL90_FACTORS.map(f => `
    <div class="factor-cell">
      <div class="fc-name">${f.name}<span class="fc-n">${f.indices.length} 题</span></div>
      <div class="fc-desc">${f.desc}</div>
    </div>`).join('');

  const legend = `
    <span class="legend-item"><span class="legend-dot normal"></span>正常 (0–1.5)</span>
    <span class="legend-item"><span class="legend-dot mild"></span>轻度 (1.5–2.5)</span>
    <span class="legend-item"><span class="legend-dot moderate"></span>中度 (2.5–3.5)</span>
    <span class="legend-item"><span class="legend-dot severe"></span>重度 (3.5–5)</span>`;
  document.getElementById('legend').innerHTML = legend;
  document.getElementById('legend2').innerHTML = legend;
}

// ---------- 答题 ----------
function startTest() {
  answers = new Array(Q_N).fill(0);
  cur = 0;
  show('page-test');
  renderQ();
}

function renderQ() {
  const i = cur;
  document.getElementById('qNow').textContent = i + 1;
  document.getElementById('qText').textContent = SCL90_Q[i];
  document.getElementById('progressBar').style.width = ((i) / Q_N * 100) + '%';
  document.getElementById('encourage').textContent =
    ENCOURAGE[Math.min(Math.floor(i / (Q_N / ENCOURAGE.length)), ENCOURAGE.length - 1)];

  document.getElementById('optList').innerHTML = SCL90_OPT.map(o => `
    <button class="opt${answers[i] === o.value ? ' on' : ''}" onclick="pick(${o.value})">
      <span class="opt-k">${o.label}</span><span>${o.text}</span>
    </button>`).join('');

  document.getElementById('prevBtn').disabled = (i === 0);
  const nb = document.getElementById('nextBtn');
  nb.textContent = answers[i] ? '下一题' : '跳过';
}

function pick(v) {
  answers[cur] = v;
  renderQ();
  if (cur < Q_N - 1) {
    setTimeout(() => { cur++; renderQ(); }, 240);
  } else {
    setTimeout(finish, 320);
  }
}

function prevQ() { if (cur > 0) { cur--; renderQ(); } }
function nextQ() {
  if (cur < Q_N - 1) { cur++; renderQ(); }
  else finish();
}

function finish() {
  show('page-loading');
  setTimeout(() => {
    lastResult = compute();
    renderResult(lastResult);
    show('page-result');
  }, 1100);
}

// ---------- 计分 ----------
function levelOfFactor(avg) {
  if (avg <= SCL90_FACTOR_CUT.normal) return 'normal';
  if (avg <= SCL90_FACTOR_CUT.mild) return 'mild';
  if (avg <= SCL90_FACTOR_CUT.moderate) return 'moderate';
  return 'severe';
}
function levelOfTotal(total) {
  if (total <= SCL90_TOTAL_CUT.normal) return 'normal';
  if (total <= SCL90_TOTAL_CUT.mild) return 'mild';
  if (total <= SCL90_TOTAL_CUT.moderate) return 'moderate';
  return 'severe';
}

function compute() {
  const total = answers.reduce((s, v) => s + (v || 1), 0);   // 未作答按 1 分计
  const avg = total / Q_N;
  const posCount = answers.filter(v => (v || 1) > 1).length;
  const negCount = Q_N - posCount;
  const posAvg = posCount > 0 ? (total - negCount) / posCount : 0;

  const factors = SCL90_FACTORS.map(f => {
    const sum = f.indices.reduce((s, i) => s + (answers[i] || 1), 0);
    const favg = sum / f.indices.length;
    const level = levelOfFactor(favg);
    return {
      key: f.key, name: f.name, short: f.short, desc: f.desc,
      abbr: abbr(f.name),
      count: f.indices.length,
      sum, avg: favg, level,
      levelName: SCL90_LEVEL_NAME[level],
      levelText: f.levels[level],
      advice: f.advice
    };
  });

  let top = factors[0];
  factors.forEach(f => { if (f.avg > top.avg) top = f; });

  return {
    total, avg, posCount, posAvg,
    totalLevel: levelOfTotal(total),
    factors, top
  };
}

// ---------- 结果渲染 ----------
function renderResult(r) {
  const sev = 'sev-' + r.totalLevel;
  document.getElementById('totalScore').textContent = r.total;
  document.getElementById('totalScore').className = 'score-num ' + sev;
  const badge = document.getElementById('totalBadge');
  badge.textContent = SCL90_LEVEL_NAME[r.totalLevel];
  badge.className = 'score-badge ' + sev;
  document.getElementById('avgScore').textContent = r.avg.toFixed(2);
  document.getElementById('posCount').textContent = r.posCount;
  document.getElementById('posAvg').textContent = r.posCount ? r.posAvg.toFixed(2) : '—';

  // 因子表
  document.getElementById('factorTable').innerHTML = `
    <tr><th>因子</th><th>题数</th><th>总分</th><th>均分</th><th>程度</th></tr>
    ${r.factors.map(f => `
      <tr>
        <td>${f.name}</td>
        <td class="num">${f.count}</td>
        <td class="num">${f.sum}</td>
        <td class="num">${f.avg.toFixed(2)}</td>
        <td><span class="badge-sm sev-${f.level}">${f.levelName}</span></td>
      </tr>`).join('')}`;

  // 因子逐项解读
  document.getElementById('factorDetails').innerHTML = r.factors.map(f => `
    <div class="fd-card" style="border-top-color:var(--${f.level})">
      <div class="fd-head">
        <div class="fd-name">${f.name}</div>
        <div class="fd-score sev-${f.level}">${f.avg.toFixed(2)} 分 · ${f.levelName}</div>
      </div>
      <div class="fd-desc">${f.desc}</div>
      <div class="fd-level">${f.levelText}</div>
    </div>`).join('');

  // 最高因子专属建议
  // 若所有因子都在正常范围，不推行动建议，避免把「正常」读成「有问题」
  const top = r.top;
  document.getElementById('topAdvice').innerHTML = top.level === 'normal'
    ? `<div class="advice-card">
        <div class="advice-who">十个因子全部在正常范围</div>
        <div class="advice-block">
          <div class="fd-level">你得分相对最高的是「${top.name}」${top.avg.toFixed(2)} 分，但它仍在正常区间内：${top.levelText}</div>
        </div>
        <div class="advice-one">
          <div class="advice-one-lab">现在可以做的</div>
          <div class="advice-one-txt">把这次结果存下来当基线。以后状态有变化时重测一次，有对比才看得出变化。</div>
        </div>
      </div>`
    : `<div class="advice-card">
        <div class="advice-who">你的最高因子：${top.name} · ${top.avg.toFixed(2)} 分（${top.levelName}）</div>
        <div class="advice-block">
          <div class="advice-lab go">立刻开始做</div>
          <div class="advice-list">
            ${top.advice.start.map((x, i) => `
              <div class="advice-item go"><span class="advice-n">${i + 1}</span><span class="advice-t">${x}</span></div>`).join('')}
          </div>
        </div>
        <div class="advice-block">
          <div class="advice-lab halt">立刻停止</div>
          <div class="advice-list">
            ${top.advice.stop.map(x => `
              <div class="advice-item halt"><span class="advice-n">×</span><span class="advice-t">${x}</span></div>`).join('')}
          </div>
        </div>
        <div class="advice-one">
          <div class="advice-one-lab">如果只做一件</div>
          <div class="advice-one-txt">${top.advice.one}</div>
        </div>
      </div>`;

  // 整体建议
  const ta = SCL90_TOTAL_ADVICE[r.totalLevel];
  document.getElementById('totalAdvice').innerHTML = `
    <div class="total-card">
      <div class="total-title">${ta.title}</div>
      <div class="total-sum">${ta.summary}</div>
      ${ta.items.map((it, i) => `
        <div class="rec-item${it.alert ? ' alert' : ''}">
          <span class="rec-i">${it.alert ? '!' : i + 1}</span>
          <div>
            <div class="rec-t">${it.t}</div>
            <div class="rec-d">${it.d}</div>
          </div>
        </div>`).join('')}
    </div>`;

  drawRadar('radarCanvas', r.factors);
}

// ---------- 十因子雷达图（原生 canvas，无外部依赖）----------
function drawRadar(canvasId, factors) {
  const c = document.getElementById(canvasId);
  if (!c) return;
  const box = c.parentElement;
  const size = Math.min(box.clientWidth || 320, 360);
  const dpr = window.devicePixelRatio || 1;
  c.width = size * dpr; c.height = size * dpr;
  c.style.width = size + 'px'; c.style.height = size + 'px';
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, size, size);

  const cx = size / 2, cy = size / 2 + 4;
  const R = size * 0.30;
  const N = factors.length;
  const MAX = 5;
  const ang = i => -Math.PI / 2 + i * 2 * Math.PI / N;

  // 网格环
  for (let r = 1; r <= 4; r++) {
    g.beginPath();
    for (let i = 0; i < N; i++) {
      const rr = R * r / 4;
      const x = cx + Math.cos(ang(i)) * rr, y = cy + Math.sin(ang(i)) * rr;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath();
    g.strokeStyle = 'rgba(120,160,210,0.26)';
    g.lineWidth = 1; g.stroke();
  }
  // 轴线
  for (let i = 0; i < N; i++) {
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(ang(i)) * R, cy + Math.sin(ang(i)) * R);
    g.strokeStyle = 'rgba(120,160,210,0.2)';
    g.stroke();
  }
  // 数据多边形
  g.beginPath();
  for (let i = 0; i < N; i++) {
    const rr = R * Math.min(factors[i].avg, MAX) / MAX;
    const x = cx + Math.cos(ang(i)) * rr, y = cy + Math.sin(ang(i)) * rr;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.closePath();
  const grd = g.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
  grd.addColorStop(0, 'rgba(107,163,224,0.42)');
  grd.addColorStop(1, 'rgba(58,95,158,0.34)');
  g.fillStyle = grd; g.fill();
  g.strokeStyle = '#4f7fc4'; g.lineWidth = 2; g.stroke();

  // 数据点
  for (let i = 0; i < N; i++) {
    const rr = R * Math.min(factors[i].avg, MAX) / MAX;
    const x = cx + Math.cos(ang(i)) * rr, y = cy + Math.sin(ang(i)) * rr;
    g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2);
    g.fillStyle = '#4f7fc4'; g.fill();
  }
  // 标签
  g.fillStyle = '#55687f';
  g.font = '600 11px "Noto Sans SC", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < N; i++) {
    const a = ang(i);
    const lx = cx + Math.cos(a) * (R + 20);
    const ly = cy + Math.sin(a) * (R + 16);
    g.fillText(factors[i].abbr, lx, ly);
    g.fillStyle = '#8798ad';
    g.font = '500 10px "Noto Sans SC", sans-serif';
    g.fillText(factors[i].avg.toFixed(1), lx, ly + 13);
    g.fillStyle = '#55687f';
    g.font = '600 11px "Noto Sans SC", sans-serif';
  }
}

// ---------- 收尾 ----------
function restart() { show('page-intro'); window.scrollTo(0, 0); }
function shareResult() {
  if (!lastResult) return;
  const r = lastResult;
  const txt = `我刚做了 SCL-90 心理健康自评：总分 ${r.total}（${SCL90_LEVEL_NAME[r.totalLevel]}），最高因子是「${r.top.name}」${r.top.avg.toFixed(2)} 分。来测测你的状态？`;
  if (navigator.share) navigator.share({ title: 'SCL-90 心理健康自评量表', text: txt, url: location.href }).catch(() => {});
  else { alert('链接已复制，去分享给朋友吧！\n' + location.href); }
}

window.addEventListener('resize', () => { if (lastResult) drawRadar('radarCanvas', lastResult.factors); });
renderIntro();
