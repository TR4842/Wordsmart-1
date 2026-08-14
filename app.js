(() => {
  'use strict';
  const words = window.WORDS || [];
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const todayKey = new Date().toISOString().slice(0, 10);
  const STORE = 'wordsmart-progress-v1';
  let state = loadState();
  let activeWord = 0;
  let studyDeck = [...Array(words.length).keys()];
  let studyIndex = 0;
  let sessionSeen = 0;
  let sessionKnown = 0;
  let libraryLimit = 40;
  let alphaFilter = 'all';
  let quiz = null;

  function loadState() {
    const base = { ratings: {}, saved: [], daily: {}, quizCorrect: 0, quizTotal: 0, bestScore: null, activity: [] };
    try { return { ...base, ...JSON.parse(localStorage.getItem(STORE) || '{}') }; } catch { return base; }
  }
  function saveState() { localStorage.setItem(STORE, JSON.stringify(state)); updateStats(); }
  function escapeHtml(s = '') { return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function wordId(w) { return w.word.toLowerCase(); }
  function speak(text) {
    if (!('speechSynthesis' in window)) return toast('Pronunciation is not available in this browser.');
    speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'en-US'; utterance.rate = .84; speechSynthesis.speak(utterance);
  }
  function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 1900); }
  function randomIndex() { return Math.floor(Math.random() * words.length); }
  function sample(array, count) { const a = [...array]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, count); }
  function dayIndex() { return Math.abs([...todayKey].reduce((n, c) => ((n * 31) + c.charCodeAt(0)) | 0, 7)) % words.length; }

  function showView(name) {
    $$('.view').forEach(v => v.classList.toggle('active', v.id === `${name}-view`));
    $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === name));
    if (name === 'browse') renderLibrary();
    if (name === 'saved') renderSaved();
    if (name === 'study') renderFlashcard();
    if (name === 'quiz' && !quiz) startQuiz();
    history.replaceState(null, '', `#${name}`); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateStats() {
    const known = Object.values(state.ratings).filter(x => x === 'known').length;
    const review = Object.values(state.ratings).filter(x => x === 'again' || x === 'learning').length;
    const done = state.daily[todayKey] || 0;
    const percent = Math.min(100, Math.round(done / 10 * 100));
    $('#daily-done').textContent = Math.min(done, 10); $('#goal-percent').textContent = `${percent}%`; $('#goal-orbit').style.setProperty('--progress', percent);
    $('#goal-message').textContent = done >= 10 ? 'Daily goal complete. Beautiful work!' : done ? 'Nice progress. Keep the momentum going.' : 'Start with one word. Momentum will follow.';
    $('#learned-stat').textContent = known; $('#review-stat').textContent = review;
    $('#accuracy-stat').textContent = state.quizTotal ? `${Math.round(state.quizCorrect / state.quizTotal * 100)}%` : '—';
    const streak = getStreak(); $('#header-streak').textContent = streak; $('#streak-count').textContent = streak;
    const best = Math.max(Number(localStorage.getItem('wordsmart-best-streak') || 0), streak); localStorage.setItem('wordsmart-best-streak', best); $('#best-streak').textContent = best;
    $('#best-score').textContent = state.bestScore == null ? '—' : `${state.bestScore}/10`;
    renderWeek();
  }
  function getStreak() {
    let count = 0, d = new Date();
    if (!state.daily[todayKey]) d.setDate(d.getDate() - 1);
    while (state.daily[d.toISOString().slice(0, 10)]) { count++; d.setDate(d.getDate() - 1); }
    return count;
  }
  function renderWeek() {
    const row = $('#week-row'); row.innerHTML = '';
    const now = new Date(); const day = now.getDay();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now); d.setDate(now.getDate() - day + i);
      const key = d.toISOString().slice(0, 10); const el = document.createElement('div');
      el.className = `week-day ${state.daily[key] ? 'done' : ''} ${key === todayKey ? 'today' : ''}`;
      el.innerHTML = `<span>${state.daily[key] ? '✓' : d.getDate()}</span><small>${d.toLocaleDateString('en', {weekday:'short'}).slice(0,1)}</small>`; row.appendChild(el);
    }
  }

  function renderFeature(index) {
    activeWord = index; const w = words[index], saved = state.saved.includes(wordId(w));
    $('#word-feature').innerHTML = `<div class="word-main"><span class="eyebrow">${w.word.slice(0,1).toUpperCase()} · WORD ${index + 1}</span><h3>${escapeHtml(w.word)}</h3><span class="pronunciation">English vocabulary</span></div><div class="word-definition"><strong>${escapeHtml(w.meaning)}</strong><p class="bangla" lang="bn">${escapeHtml(w.bangla)}</p><blockquote>“${escapeHtml(w.example)}”</blockquote></div><div class="feature-actions"><button class="sound-button" aria-label="Pronounce ${escapeHtml(w.word)}">◖))</button><button class="save-button ${saved ? 'saved' : ''}" aria-label="${saved ? 'Unsave' : 'Save'} ${escapeHtml(w.word)}">${saved ? '♥' : '♡'}</button></div>`;
    $('.sound-button', $('#word-feature')).onclick = () => speak(w.word);
    $('.save-button', $('#word-feature')).onclick = () => toggleSaved(w, () => renderFeature(index));
  }
  function toggleSaved(w, callback) {
    const id = wordId(w), i = state.saved.indexOf(id);
    if (i >= 0) { state.saved.splice(i, 1); toast(`${w.word} removed from saved words`); } else { state.saved.push(id); toast(`${w.word} saved for later`); }
    saveState(); callback?.();
  }

  function buildStudyDeck() {
    const mode = $('#study-mode').value;
    studyDeck = words.map((w,i) => i).filter(i => {
      const r = state.ratings[wordId(words[i])];
      return mode === 'all' || (mode === 'unlearned' && r !== 'known') || (mode === 'review' && (r === 'again' || r === 'learning')) || (mode === 'saved' && state.saved.includes(wordId(words[i])));
    });
    if (!studyDeck.length) { toast('No words in this practice group yet.'); $('#study-mode').value = 'all'; studyDeck = words.map((w,i)=>i); }
    studyIndex = 0; renderFlashcard();
  }
  function renderFlashcard() {
    if (!studyDeck.length) buildStudyDeck(); const idx = studyDeck[studyIndex % studyDeck.length], w = words[idx]; activeWord = idx;
    $('#flash-word').textContent = w.word; $('#flash-back-word').textContent = w.word; $('#flash-meaning').textContent = w.meaning; $('#flash-bangla').textContent = w.bangla; $('#flash-example').textContent = `“${w.example}”`; $('#study-position').textContent = studyIndex + 1;
    $('#flashcard').classList.remove('revealed'); $('#rating-area').hidden = true;
  }
  function revealCard() { const card = $('#flashcard'); card.classList.toggle('revealed'); $('#rating-area').hidden = !card.classList.contains('revealed'); }
  function rateWord(rating) {
    const w = words[studyDeck[studyIndex % studyDeck.length]]; state.ratings[wordId(w)] = rating; state.daily[todayKey] = (state.daily[todayKey] || 0) + 1; state.activity.push(todayKey); sessionSeen++; if (rating === 'known') sessionKnown++; saveState();
    $('#session-seen').textContent = sessionSeen; $('#session-known').textContent = sessionKnown; $('#session-bar-fill').style.width = `${Math.min(100,sessionSeen/10*100)}%`; studyIndex = (studyIndex + 1) % studyDeck.length; setTimeout(renderFlashcard, 120);
  }

  function wordRow(w) {
    const saved = state.saved.includes(wordId(w));
    return `<article class="word-row" data-id="${escapeHtml(wordId(w))}"><h3>${escapeHtml(w.word)}</h3><p>${escapeHtml(w.meaning)}</p><p class="row-bangla" lang="bn">${escapeHtml(w.bangla)}</p><div class="word-row-actions"><button class="sound-button" data-action="speak" aria-label="Pronounce ${escapeHtml(w.word)}">◖))</button><button class="save-button ${saved?'saved':''}" data-action="save" aria-label="Save ${escapeHtml(w.word)}">${saved?'♥':'♡'}</button></div></article>`;
  }
  function filteredWords(savedOnly = false) {
    const q = ($('#library-search')?.value || '').trim().toLowerCase(); const filter = $('#library-filter')?.value || 'all';
    return words.filter(w => {
      const id = wordId(w), rating = state.ratings[id];
      return (!savedOnly || state.saved.includes(id)) && (alphaFilter === 'all' || id.startsWith(alphaFilter)) && (!q || `${w.word} ${w.meaning} ${w.bangla}`.toLowerCase().includes(q)) && (filter === 'all' || (filter === 'saved' && state.saved.includes(id)) || (filter === 'known' && rating === 'known') || (filter === 'learning' && rating && rating !== 'known'));
    });
  }
  function bindRows(root) {
    root.onclick = e => { const btn = e.target.closest('button'); if (!btn) return; const row = btn.closest('.word-row'), w = words.find(x => wordId(x) === row.dataset.id); if (btn.dataset.action === 'speak') speak(w.word); else toggleSaved(w, () => { if (root.id === 'saved-list') renderSaved(); else renderLibrary(); }); };
  }
  function renderLibrary() {
    const list = filteredWords(); $('#word-list').innerHTML = list.slice(0, libraryLimit).map(wordRow).join('') || '<div class="empty-state">No words found. Try a different search or filter.</div>';
    $('#load-more').hidden = list.length <= libraryLimit;
  }
  function renderSaved() {
    const list = words.filter(w => state.saved.includes(wordId(w))); $('#saved-list').innerHTML = list.map(wordRow).join('') || '<div class="empty-state"><h3>No saved words yet</h3><p>Tap the heart beside a word to keep it here.</p></div>';
  }

  function startQuiz() {
    quiz = { questions: sample(words.map((w,i)=>i), 10), current: 0, score: 0, answered: false }; renderQuiz();
  }
  function renderQuiz() {
    if (quiz.current >= 10) return finishQuiz();
    quiz.answered = false; const w = words[quiz.questions[quiz.current]]; activeWord = quiz.questions[quiz.current];
    const distractors = sample(words.filter(x => x !== w && x.meaning !== w.meaning), 3); const options = sample([w, ...distractors], 4);
    $('#quiz-progress').innerHTML = Array.from({length:10},(_,i)=>`<span class="${i < quiz.current ? 'done' : ''}"></span>`).join(''); $('#quiz-number').textContent = `QUESTION ${quiz.current + 1} OF 10`; $('#quiz-word').textContent = w.word; $('#quiz-feedback').textContent = ''; $('#next-question').hidden = true;
    $('#quiz-options').innerHTML = options.map(x => `<button class="quiz-option" data-correct="${x===w}">${escapeHtml(x.meaning)}</button>`).join('');
  }
  function answerQuiz(btn) {
    if (quiz.answered) return; quiz.answered = true; const correct = btn.dataset.correct === 'true'; if (correct) quiz.score++;
    $$('.quiz-option').forEach(x => { x.disabled = true; if (x.dataset.correct === 'true') x.classList.add('correct'); }); if (!correct) btn.classList.add('wrong');
    $('#quiz-feedback').textContent = correct ? '✓ Correct — nicely done!' : `Not quite — “${words[activeWord].meaning}”`; $('#quiz-feedback').style.color = correct ? 'var(--green)' : 'var(--orange)'; $('#next-question').hidden = false;
  }
  function finishQuiz() {
    state.quizCorrect += quiz.score; state.quizTotal += 10; state.bestScore = Math.max(state.bestScore || 0, quiz.score); saveState();
    const message = quiz.score >= 8 ? 'Excellent work!' : quiz.score >= 5 ? 'Good progress!' : 'Every round builds recall.';
    $('#quiz-shell').innerHTML = `<div class="quiz-result"><p class="eyebrow">QUIZ COMPLETE</p><h2>${quiz.score}/10</h2><h3>${message}</h3><p>You can come back anytime for ten fresh words.</p><button id="restart-quiz" class="primary-button">Try another quiz ↻</button></div>`;
    $('#restart-quiz').onclick = () => { location.reload(); location.hash = '#quiz'; };
  }

  function setup() {
    const now = new Date(), hour = now.getHours(); $('#day-part').textContent = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'; $('#today').textContent = now.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'}); renderFeature(dayIndex()); updateStats();
    $$('[data-view]').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
    $('#another-word').onclick = () => renderFeature(randomIndex()); $('#random-word').onclick = () => { renderFeature(randomIndex()); showView('home'); };
    $('#flashcard').onclick = e => { if (!e.target.closest('.study-sound')) revealCard(); }; $$('.study-sound').forEach(b => b.onclick = e => { e.stopPropagation(); speak(words[activeWord].word); });
    $$('.rate-button').forEach(b => b.onclick = () => rateWord(b.dataset.rating)); $('#study-mode').onchange = buildStudyDeck; $('#shuffle-study').onclick = () => { studyDeck = sample(studyDeck, studyDeck.length); studyIndex=0; renderFlashcard(); toast('Cards shuffled'); };
    $('#alphabet').innerHTML = `<button class="alpha-button active" data-letter="all">All</button>` + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l=>`<button class="alpha-button" data-letter="${l.toLowerCase()}">${l}</button>`).join('');
    $('#alphabet').onclick = e => { const b=e.target.closest('button'); if(!b)return; $$('.alpha-button').forEach(x=>x.classList.remove('active'));b.classList.add('active');alphaFilter=b.dataset.letter;libraryLimit=40;renderLibrary(); };
    $('#library-search').oninput = () => { libraryLimit=40;renderLibrary(); }; $('#library-filter').onchange = renderLibrary; $('#load-more').onclick = () => { libraryLimit += 40;renderLibrary(); }; bindRows($('#word-list')); bindRows($('#saved-list'));
    $('#quiz-options').onclick = e => { const b=e.target.closest('.quiz-option');if(b)answerQuiz(b); }; $('#quiz-sound').onclick = () => speak(words[activeWord].word); $('#next-question').onclick = () => {quiz.current++;renderQuiz();};
    const gs=$('#global-search'), results=$('#search-results'); gs.oninput=()=>{const q=gs.value.trim().toLowerCase();if(!q){results.hidden=true;return;}const found=words.filter(w=>`${w.word} ${w.meaning} ${w.bangla}`.toLowerCase().includes(q)).slice(0,7);results.innerHTML=found.map(w=>`<button class="search-result" data-id="${wordId(w)}"><b>${escapeHtml(w.word)}</b><span>${escapeHtml(w.meaning)}</span></button>`).join('')||'<p class="empty-state">No match found</p>';results.hidden=false;};
    results.onclick=e=>{const b=e.target.closest('.search-result');if(!b)return;const i=words.findIndex(w=>wordId(w)===b.dataset.id);renderFeature(i);results.hidden=true;gs.value='';showView('home');}; document.addEventListener('click',e=>{if(!e.target.closest('.search-wrap'))results.hidden=true;});
    document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();gs.focus();}if(e.target.matches('input,select'))return;if(e.code==='Space'&&$('#study-view').classList.contains('active')){e.preventDefault();revealCard();}if(!$('#rating-area').hidden&&['1','2','3'].includes(e.key))rateWord(['again','learning','known'][Number(e.key)-1]);});
    renderLibrary(); renderSaved(); const initial=location.hash.slice(1); if(['home','study','browse','quiz','saved'].includes(initial))showView(initial);
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }
  setup();
})();
