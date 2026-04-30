/**
 * Similarmetal Quiz Kit - Quiz App
 *
 * カテゴリ → 資格 → 問題 の3階層で資格学習を管理。
 * Active Recall + SM-2 簡易版 SRS アルゴリズムによる学習管理。
 *
 * データソース:
 *   - data/exams/*.json : 資格メタデータ
 *   - data/questions/{exam}/{domain}.json : 問題セット
 *   - localStorage : 進捗データ
 */

const QuizApp = (() => {
  const STORAGE_KEY = 'similarmetal-quiz-progress-v1';
  const STORAGE_SESSION_KEY = 'similarmetal-quiz-session-v1';

  // ===== Storage helpers =====
  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultProgress();
      return JSON.parse(raw);
    } catch (e) {
      console.error('Failed to load progress:', e);
      return defaultProgress();
    }
  }

  function saveProgress(progress) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (e) {
      console.error('Failed to save progress:', e);
    }
  }

  function defaultProgress() {
    return {
      version: '1.0',
      exams: {},
      streak: { count: 0, last_date: null },
      total_solved: 0,
      created_at: new Date().toISOString()
    };
  }

  // ===== Today helper (timezone-aware) =====
  function todayString() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split('T')[0];
  }

  function addDays(dateStr, days) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  // ===== SRS Algorithm (SM-2 simplified) =====
  /**
   * @param {object} state - { ease_factor, interval_days, repetition }
   * @param {number} quality - 0=forgot, 1=hard, 2=good, 3=easy
   * @returns {object} updated state with due_date
   */
  function updateSRS(state, quality) {
    state = { ease_factor: 2.5, interval_days: 0, repetition: 0, ...state };

    if (quality < 2) {
      // Forgot or hard - reset
      state.repetition = 0;
      state.interval_days = 1;
      state.ease_factor = Math.max(1.3, state.ease_factor - 0.2);
    } else {
      state.repetition += 1;

      if (state.repetition === 1) {
        state.interval_days = 1;
      } else if (state.repetition === 2) {
        state.interval_days = 3;
      } else if (state.repetition === 3) {
        state.interval_days = 7;
      } else if (state.repetition === 4) {
        state.interval_days = 14;
      } else {
        state.interval_days = Math.ceil(state.interval_days * state.ease_factor);
      }

      if (quality === 3) {
        state.ease_factor = Math.min(2.5, state.ease_factor + 0.1);
      }
    }

    state.due_date = addDays(todayString(), state.interval_days);
    return state;
  }

  // ===== Category & Exam loading =====
  // data/categories.json をカテゴリ・資格マニフェストの単一の真実の源とする。
  // 新カテゴリを追加するには data/categories.json に1ブロック追加するだけ。
  async function loadCategories() {
    try {
      const res = await fetch('data/categories.json');
      if (!res.ok) return [];
      const data = await res.json();
      const categories = (data.categories || []).slice().sort((a, b) =>
        (a.order ?? 999) - (b.order ?? 999)
      );

      // 各カテゴリ配下の exam JSON を並列で取得
      await Promise.all(categories.map(async (cat) => {
        const codes = cat.exam_codes || [];
        const exams = [];
        for (const code of codes) {
          try {
            const r = await fetch(`data/exams/${code}.json`);
            if (r.ok) {
              const exam = await r.json();
              exam._category_id = cat.id;
              exams.push(exam);
            }
          } catch (e) {
            // skip silently
          }
        }
        cat.exams = exams;
      }));

      return categories;
    } catch (e) {
      console.error('Failed to load categories:', e);
      return [];
    }
  }

  // 後方互換: 全カテゴリの全資格をフラットに返す
  async function loadExamCatalog() {
    const categories = await loadCategories();
    return categories.flatMap(c => c.exams || []);
  }

  async function loadQuestionsForExam(examCode) {
    const exam = await fetch(`data/exams/${examCode}.json`).then(r => r.ok ? r.json() : null);
    if (!exam) return [];

    const allQuestions = [];
    for (const domain of (exam.domains || [])) {
      try {
        const res = await fetch(`data/questions/${examCode}/${domain.id}.json`);
        if (res.ok) {
          const set = await res.json();
          allQuestions.push(...(set.questions || []));
        }
      } catch (e) {
        // skip
      }
    }
    return allQuestions;
  }

  // ===== Question selection (which to show next) =====
  function selectNextQuestion(allQuestions, examProgress) {
    const today = todayString();
    const history = examProgress.history || {};

    // Categorize
    const overdue = [];
    const dueToday = [];
    const newQuestions = [];

    for (const q of allQuestions) {
      const h = history[q.id];
      if (!h) {
        newQuestions.push(q);
      } else if (h.due_date < today) {
        overdue.push(q);
      } else if (h.due_date === today) {
        dueToday.push(q);
      }
    }

    // Priority: overdue > due today > new
    if (overdue.length > 0) return pickRandom(overdue);
    if (dueToday.length > 0) return pickRandom(dueToday);
    if (newQuestions.length > 0) return pickRandom(newQuestions);
    return null; // nothing due
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ===== Streak management =====
  function updateStreak(progress) {
    const today = todayString();
    const yesterday = addDays(today, -1);

    if (!progress.streak.last_date) {
      progress.streak = { count: 1, last_date: today };
    } else if (progress.streak.last_date === today) {
      // already counted today
    } else if (progress.streak.last_date === yesterday) {
      progress.streak.count += 1;
      progress.streak.last_date = today;
    } else {
      // gap, reset
      progress.streak = { count: 1, last_date: today };
    }
  }

  // ===== UI: Home =====
  async function renderHome() {
    const progress = loadProgress();
    document.getElementById('total-count').innerHTML = `${progress.total_solved}<span class="unit">問</span>`;
    document.getElementById('streak-count').innerHTML = `${progress.streak.count}<span class="unit">日</span>`;

    const categories = await loadCategories();
    const examList = document.getElementById('exam-list');

    const populated = categories.filter(c => (c.exams || []).length > 0);
    if (populated.length === 0) {
      document.getElementById('due-count').innerHTML = `0<span class="unit">問</span>`;
      return;
    }

    examList.innerHTML = '';
    let totalDue = 0;
    let totalQuestionCount = 0;

    // カテゴリ単位でセクションをレンダリング
    for (const cat of populated) {
      const section = document.createElement('section');
      section.className = 'category-section';

      const examCount = cat.exams.length;
      const totalQ = cat.exams.reduce((sum, e) => sum + (e.total_questions || 0), 0);

      section.innerHTML = `
        <div class="category-header">
          <h3 class="category-title">
            ${escapeHtml(cat.name)}
            <span class="category-count">${examCount} 試験 · ${totalQ} 問</span>
          </h3>
          <p class="category-desc">${escapeHtml(cat.description || '')}</p>
        </div>
        <div class="card-grid-3 category-exams" data-cat="${escapeHtml(cat.id)}"></div>
      `;
      const grid = section.querySelector('.category-exams');

      for (const exam of cat.exams) {
        const examProgress = progress.exams[exam.exam_code] || { history: {} };
        const questions = await loadQuestionsForExam(exam.exam_code);
        const today = todayString();

        let due = 0;
        let mastered = 0;
        for (const q of questions) {
          const h = examProgress.history[q.id];
          if (h && h.due_date <= today) due += 1;
          if (h && h.repetition >= 4) mastered += 1;
        }
        totalDue += due;
        totalQuestionCount += questions.length;

        const card = document.createElement('a');
        card.className = 'exam-card';
        card.href = `quiz.html?exam=${encodeURIComponent(exam.exam_code)}`;
        card.innerHTML = `
          <div class="exam-card-code">${escapeHtml(exam.exam_code.toUpperCase())}</div>
          <div class="exam-card-name">${escapeHtml(exam.exam_name)}</div>
          <div class="exam-card-meta">
            <span>${questions.length}問</span>
            <span>復習: ${due}問</span>
            <span>習熟: ${mastered}問</span>
          </div>
        `;
        grid.appendChild(card);
      }

      examList.appendChild(section);
    }

    document.getElementById('due-count').innerHTML = `${totalDue}<span class="unit">問</span>`;
  }

  // ===== UI: Quiz =====
  let currentSession = null;

  async function renderQuiz() {
    const params = new URLSearchParams(window.location.search);
    const examCode = params.get('exam');

    if (!examCode) {
      return; // empty state shown
    }

    const exam = await fetch(`data/exams/${examCode}.json`).then(r => r.ok ? r.json() : null);
    if (!exam) {
      document.getElementById('quiz-container').innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">~</div>
          <p>資格データが見つかりません: ${examCode}</p>
          <a href="index.html" class="btn">Home</a>
        </div>`;
      return;
    }

    document.getElementById('quiz-exam-name').textContent = exam.exam_name;

    const allQuestions = await loadQuestionsForExam(examCode);
    if (allQuestions.length === 0) {
      document.getElementById('quiz-container').innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">~</div>
          <p>この資格の問題がまだ生成されていません。</p>
          <p style="font-size:12px;margin-top:8px;">02-prompts/10-question-generation/${examCode}.md を Claude Code に渡してください。</p>
        </div>`;
      return;
    }

    currentSession = {
      examCode,
      examName: exam.exam_name,
      allQuestions,
      correct: 0,
      incorrect: 0,
      answered: 0,
      currentQuestion: null,
      currentAnswer: null
    };

    showNextQuestion();
  }

  function showNextQuestion() {
    const progress = loadProgress();
    const examProgress = progress.exams[currentSession.examCode] || { history: {} };

    const q = selectNextQuestion(currentSession.allQuestions, examProgress);
    if (!q) {
      showSessionComplete();
      return;
    }

    currentSession.currentQuestion = q;
    currentSession.currentAnswer = null;

    updateProgressBar();
    renderQuestion(q);
  }

  function updateProgressBar() {
    const total = currentSession.allQuestions.length;
    const answered = currentSession.answered;
    const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
    document.getElementById('progress-fill').style.width = `${pct}%`;
    document.getElementById('progress-text').textContent = `${answered} / ${total}`;
    document.getElementById('session-stats').textContent =
      `正解: ${currentSession.correct}  /  不正解: ${currentSession.incorrect}`;
  }

  function renderQuestion(q) {
    const container = document.getElementById('quiz-container');
    container.innerHTML = `
      <div class="quiz-card">
        <div class="quiz-meta">
          <span>${escapeHtml(q.domain?.name || q.domain || '')}</span>
          <span>${escapeHtml(q.topic || '')}</span>
          <span>${q.cognitive_level || ''} · ${q.difficulty || ''}</span>
        </div>
        <div class="quiz-stem">${escapeHtml(q.stem)}</div>
        <div class="quiz-options" id="quiz-options"></div>
        <div class="quiz-explanation" id="quiz-explanation">
          <h4>総合解説</h4>
          <p id="quiz-explanation-text"></p>
          <div id="quiz-references"></div>
          <div id="quiz-common-mistakes"></div>
        </div>
        <div class="quiz-actions" id="quiz-actions"></div>
      </div>
    `;

    const optsEl = document.getElementById('quiz-options');
    for (const opt of q.options) {
      const div = document.createElement('div');
      div.className = 'quiz-option';
      div.dataset.optionId = opt.id;
      div.innerHTML = `
        <div class="quiz-option-id">${opt.id}</div>
        <div class="quiz-option-text">
          ${escapeHtml(opt.text)}
          ${opt.explanation ? `<div class="quiz-option-explain">${escapeHtml(opt.explanation)}</div>` : ''}
        </div>
      `;
      div.addEventListener('click', () => selectOption(opt.id));
      optsEl.appendChild(div);
    }
  }

  function selectOption(optionId) {
    if (currentSession.currentAnswer !== null) return; // already answered

    currentSession.currentAnswer = optionId;
    const q = currentSession.currentQuestion;
    const correctOpt = q.options.find(o => o.is_correct);
    const isCorrect = optionId === correctOpt.id;

    // Update UI
    const opts = document.querySelectorAll('.quiz-option');
    opts.forEach(el => {
      const oid = el.dataset.optionId;
      const opt = q.options.find(o => o.id === oid);
      if (opt.is_correct) {
        el.classList.add('correct', 'show-explain');
      } else if (oid === optionId) {
        el.classList.add('incorrect', 'show-explain');
      } else {
        el.classList.add('show-explain');
      }
    });

    // Show overall explanation
    const explainEl = document.getElementById('quiz-explanation');
    document.getElementById('quiz-explanation-text').textContent = q.explanation || '';

    // References
    const refsEl = document.getElementById('quiz-references');
    if (q.references && q.references.length > 0) {
      refsEl.innerHTML = '<h4 style="margin-top:14px;">参考</h4>' +
        q.references.map(r => `<p>📖 <a href="${safeUrl(r.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.title)}</a></p>`).join('');
    } else {
      refsEl.innerHTML = '';
    }

    // Common mistakes
    const cmEl = document.getElementById('quiz-common-mistakes');
    if (q.common_mistakes && q.common_mistakes.length > 0) {
      cmEl.innerHTML = '<h4 style="margin-top:14px;">よくある間違い</h4><ul style="padding-left:20px;font-size:14px;">' +
        q.common_mistakes.map(m => `<li style="margin-bottom:4px;">${escapeHtml(m)}</li>`).join('') + '</ul>';
    } else {
      cmEl.innerHTML = '';
    }

    explainEl.classList.add('show');

    // Update stats
    if (isCorrect) {
      currentSession.correct += 1;
    } else {
      currentSession.incorrect += 1;
    }
    currentSession.answered += 1;

    // Render quality rating buttons (CSP-safe: addEventListener で onclick を回避)
    const actionsEl = document.getElementById('quiz-actions');
    actionsEl.innerHTML = `
      <div style="width:100%;">
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:10px;font-family:'JetBrains Mono',monospace;letter-spacing:0.1em;text-transform:uppercase;">
          ${isCorrect ? '✓ 正解' : '✗ 不正解'} - 自己評価を選んでください
        </p>
        <div class="quality-rating">
          <div class="quality-btn q-0" data-q="0">忘れていた</div>
          <div class="quality-btn q-1" data-q="1">なんとか</div>
          <div class="quality-btn q-2" data-q="2">普通に正解</div>
          <div class="quality-btn q-3" data-q="3">楽勝</div>
        </div>
      </div>
    `;
    actionsEl.querySelectorAll('.quality-btn').forEach(btn => {
      btn.addEventListener('click', () => recordAnswer(Number(btn.dataset.q)));
    });
  }

  function recordAnswer(quality) {
    const q = currentSession.currentQuestion;
    const examCode = currentSession.examCode;

    const progress = loadProgress();
    if (!progress.exams[examCode]) {
      progress.exams[examCode] = { history: {} };
    }

    const prevState = progress.exams[examCode].history[q.id] || {};
    const newState = updateSRS(prevState, quality);

    progress.exams[examCode].history[q.id] = {
      ...newState,
      last_answered: new Date().toISOString(),
      total_attempts: (prevState.total_attempts || 0) + 1,
      correct_attempts: (prevState.correct_attempts || 0) + (quality >= 2 ? 1 : 0)
    };

    progress.total_solved += 1;
    updateStreak(progress);
    saveProgress(progress);

    // Move to next
    setTimeout(() => showNextQuestion(), 400);
  }

  function showSessionComplete() {
    const total = currentSession.correct + currentSession.incorrect;
    const accuracy = total > 0 ? Math.round((currentSession.correct / total) * 100) : 0;
    document.getElementById('quiz-container').innerHTML = `
      <div class="quiz-card" style="text-align:center;padding:64px 36px;">
        <div style="font-size:64px;margin-bottom:8px;">🎉</div>
        <h2 style="margin:8px 0 0 0;color:var(--text);font-size:13px;">SESSION COMPLETE</h2>
        <div style="font-size:32px;font-weight:800;color:var(--text);margin:8px 0 24px;letter-spacing:-0.02em;">お疲れさまでした</div>
        <div style="display:flex;gap:24px;justify-content:center;margin:24px 0 32px;flex-wrap:wrap;">
          <div>
            <div style="font-size:36px;font-weight:800;color:var(--green);line-height:1;">${currentSession.correct}</div>
            <div style="font-size:11px;color:var(--text-muted);font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin-top:4px;">CORRECT</div>
          </div>
          <div>
            <div style="font-size:36px;font-weight:800;color:var(--red);line-height:1;">${currentSession.incorrect}</div>
            <div style="font-size:11px;color:var(--text-muted);font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin-top:4px;">INCORRECT</div>
          </div>
          <div>
            <div style="font-size:36px;font-weight:800;color:var(--accent);line-height:1;">${accuracy}<span style="font-size:18px;">%</span></div>
            <div style="font-size:11px;color:var(--text-muted);font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin-top:4px;">ACCURACY</div>
          </div>
        </div>
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:24px;">SRSアルゴリズムが次の最適なタイミングで復習を促します。</p>
        <a href="index.html" class="btn">Home に戻る</a>
        <a href="stats.html" class="btn secondary" style="margin-left:8px;">統計を見る</a>
      </div>
    `;
  }

  // ===== UI: Stats =====
  async function renderStats() {
    const progress = loadProgress();
    const exams = await loadExamCatalog();
    const container = document.getElementById('stats-container');

    if (Object.keys(progress.exams).length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">~</div>
          <p>まだ学習データがありません。</p>
          <a href="index.html" class="btn" style="margin-top:20px;">学習を始める</a>
        </div>`;
      return;
    }

    let html = `
      <h2>I ─ Overview</h2>
      <div class="h2-sub">全体の進捗。</div>
      <div class="card-grid-4">
        <div class="metric-card"><div class="metric-label">Total Solved</div><div class="metric-value">${progress.total_solved}<span class="unit">問</span></div></div>
        <div class="metric-card"><div class="metric-label">Streak</div><div class="metric-value">${progress.streak.count}<span class="unit">日</span></div></div>
        <div class="metric-card"><div class="metric-label">Active Exams</div><div class="metric-value">${Object.keys(progress.exams).length}<span class="unit">資格</span></div></div>
        <div class="metric-card"><div class="metric-label">Started</div><div class="metric-value" style="font-size:18px;">${formatDate(progress.created_at)}</div></div>
      </div>

      <h2>II ─ By Exam</h2>
      <div class="h2-sub">資格別の学習状況。</div>
    `;

    html += '<table class="data"><thead><tr><th>資格</th><th>解答数</th><th>正答率</th><th>習熟度</th><th>次の復習</th></tr></thead><tbody>';

    for (const examCode of Object.keys(progress.exams)) {
      const ep = progress.exams[examCode];
      const exam = exams.find(e => e.exam_code === examCode);
      const examName = exam ? exam.exam_name : examCode;

      const history = ep.history || {};
      const entries = Object.values(history);
      const totalAttempts = entries.reduce((a, b) => a + (b.total_attempts || 0), 0);
      const correctAttempts = entries.reduce((a, b) => a + (b.correct_attempts || 0), 0);
      const accuracy = totalAttempts > 0 ? Math.round(correctAttempts / totalAttempts * 100) : 0;
      const mastered = entries.filter(e => (e.repetition || 0) >= 4).length;
      const totalQuestions = exam ? (exam.total_questions || entries.length) : entries.length;
      const masteryPct = totalQuestions > 0 ? Math.round(mastered / totalQuestions * 100) : 0;

      const today = todayString();
      const dueDates = entries.map(e => e.due_date).filter(Boolean).sort();
      const nextDue = dueDates.find(d => d >= today) || '-';

      html += `<tr>
        <td style="color:var(--text);font-weight:700;">${escapeHtml(examName)}</td>
        <td>${totalAttempts}回</td>
        <td>${accuracy}%</td>
        <td>${mastered}/${totalQuestions} (${masteryPct}%)</td>
        <td>${nextDue}</td>
      </tr>`;
    }
    html += '</tbody></table>';

    container.innerHTML = html;
  }

  // ===== Data management =====
  function exportData() {
    const progress = loadProgress();
    const blob = new Blob([JSON.stringify(progress, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quiz-progress-${todayString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // 進捗データの厳密検証 (DoS / 不正データ対策)
  const MAX_IMPORT_SIZE = 5 * 1024 * 1024; // 5 MB
  function isValidProgressShape(data) {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;
    if (typeof data.version !== 'string') return false;
    if (typeof data.exams !== 'object' || data.exams === null || Array.isArray(data.exams)) return false;
    // streak / total_solved は任意（旧フォーマット互換）
    if (data.streak !== undefined) {
      if (typeof data.streak !== 'object' || data.streak === null) return false;
      if (data.streak.count !== undefined && typeof data.streak.count !== 'number') return false;
    }
    if (data.total_solved !== undefined && typeof data.total_solved !== 'number') return false;
    // exams 配下の各 exam も最低限チェック
    for (const code of Object.keys(data.exams)) {
      const exam = data.exams[code];
      if (typeof exam !== 'object' || exam === null) return false;
      if (exam.history !== undefined && (typeof exam.history !== 'object' || exam.history === null)) return false;
    }
    return true;
  }

  function importData(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > MAX_IMPORT_SIZE) {
      alert(`ファイルサイズが大きすぎます (${(file.size / 1024 / 1024).toFixed(1)} MB)。最大 ${MAX_IMPORT_SIZE / 1024 / 1024} MB まで。`);
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (!isValidProgressShape(data)) {
          alert('無効なファイル形式です。Quiz Kit からエクスポートした JSON を選択してください。');
          input.value = '';
          return;
        }
        if (confirm('既存データを上書きします。よろしいですか？')) {
          saveProgress(data);
          alert('インポート完了しました。');
          location.reload();
        } else {
          input.value = '';
        }
      } catch (err) {
        alert('JSONの解析に失敗しました: ' + err.message);
        input.value = '';
      }
    };
    reader.onerror = () => {
      alert('ファイルの読み込みに失敗しました。');
      input.value = '';
    };
    reader.readAsText(file);
  }

  function resetData() {
    if (!confirm('全ての学習データを削除します。本当によろしいですか？')) return;
    if (!confirm('この操作は元に戻せません。本当に削除しますか？')) return;
    localStorage.removeItem(STORAGE_KEY);
    alert('リセット完了しました。');
    location.reload();
  }

  // ===== Utility =====
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // 安全な URL のみ許可する (XSS hardening)。
  // javascript: / data: / vbscript: などを拒否し、http(s) と mailto のみ通す。
  function safeUrl(url) {
    if (!url || typeof url !== 'string') return '#';
    const trimmed = url.trim();
    // 相対パスは許可（同一オリジン参照）
    if (/^[a-zA-Z0-9./?#_-]/.test(trimmed) && !trimmed.includes(':')) {
      return escapeHtml(trimmed);
    }
    // 絶対 URL は http/https/mailto のみ許可
    try {
      const u = new URL(trimmed);
      if (u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'mailto:') {
        return escapeHtml(trimmed);
      }
    } catch (e) {
      // URL parse failure
    }
    return '#';
  }

  function formatDate(iso) {
    if (!iso) return '-';
    return iso.split('T')[0];
  }

  // ===== Public API =====
  return {
    renderHome,
    renderQuiz,
    renderStats,
    recordAnswer,
    exportData,
    importData,
    resetData,
    // Expose for debugging
    loadProgress,
    saveProgress,
    updateSRS
  };
})();

// ===== Auto-bootstrap =====
// CSP (script-src 'self') 配下では inline script / inline onclick が使えないため、
// 各ページの DOM ID で自動ディスパッチし、ボタンも addEventListener で接続する。
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('exam-list')) {
    QuizApp.renderHome();
  } else if (document.getElementById('quiz-container')) {
    QuizApp.renderQuiz();
  } else if (document.getElementById('stats-container')) {
    QuizApp.renderStats();
  }

  // stats.html の操作ボタン (CSP 配下では onclick 属性が動かないため明示接続)
  const btnExport = document.getElementById('btn-export');
  if (btnExport) btnExport.addEventListener('click', QuizApp.exportData);

  const btnImport = document.getElementById('btn-import');
  const importFile = document.getElementById('import-file');
  if (btnImport && importFile) {
    btnImport.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', (e) => QuizApp.importData(e.target));
  }

  const btnReset = document.getElementById('btn-reset');
  if (btnReset) btnReset.addEventListener('click', QuizApp.resetData);
});
