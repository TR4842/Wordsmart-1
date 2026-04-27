import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { getOrganizedData, vocabData, type VocabWord, type VocabCategory } from "./data/vocabData";
import * as XLSX from "xlsx";

const ALL_CATEGORIES = "All Categories";

const PART_OF_SPEECH_COLORS: Record<string, string> = {
  noun:       "bg-violet-100 text-violet-700 border-violet-200",
  verb:       "bg-emerald-100 text-emerald-700 border-emerald-200",
  adj:        "bg-sky-100 text-sky-700 border-sky-200",
  adjective:  "bg-sky-100 text-sky-700 border-sky-200",
  adv:        "bg-amber-100 text-amber-700 border-amber-200",
  adverb:     "bg-amber-100 text-amber-700 border-amber-200",
  "noun/verb":"bg-rose-100 text-rose-700 border-rose-200",
  "verb/noun":"bg-rose-100 text-rose-700 border-rose-200",
  "adj/noun": "bg-teal-100 text-teal-700 border-teal-200",
  "noun/adj": "bg-teal-100 text-teal-700 border-teal-200",
};

function getPosColor(pos: string) {
  const key = pos.toLowerCase().trim();
  return PART_OF_SPEECH_COLORS[key] || "bg-stone-100 text-stone-600 border-stone-200";
}

/* ── XLSX FETCH HOOK ── */
function useXLSXFetch() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [fetchedWords, setFetchedWords] = useState<VocabWord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tryFetch = async () => {
    setStatus("loading");
    try {
      const rawUrl =
        "https://raw.githubusercontent.com/TR4842/Wordsmart-1/main/WordSmart1_Complete_850Words.xlsx";
      const response = await fetch(rawUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, string>[];
      if (json.length > 0) {
        const keys = Object.keys(json[0]);
        const mapped: VocabWord[] = json
          .map((row, i) => ({
            id: i + 1,
            word: String(
              row["Word"] ?? row["word"] ?? row["WORD"] ?? row[keys[0]] ?? ""
            ).trim(),
            partOfSpeech: String(
              row["Part of Speech"] ?? row["POS"] ?? row["pos"] ?? row["Type"] ?? row[keys[1]] ?? ""
            ).trim(),
            englishMeaning: String(
              row["Meaning"] ?? row["meaning"] ?? row["Definition"] ?? row["English"] ?? row[keys[2]] ?? ""
            ).trim(),
            banglaMeaning: String(
              row["Bangla"] ?? row["bangla"] ?? row["Bengali"] ?? row["বাংলা"] ?? ""
            ).trim(),
            exampleSentence: String(
              row["Example"] ?? row["example"] ?? row["Example Sentence"] ?? row["Sentence"] ?? row[keys[3]] ?? ""
            ).trim(),
            category: String(
              row["Category"] ?? row["category"] ?? row["Group"] ?? row["Theme"] ?? "Vocabulary"
            ).trim(),
          }))
          .filter(w => w.word !== "");
        setFetchedWords(mapped);
      }
      setStatus("done");
    } catch (e) {
      setError(String(e));
      setStatus("error");
    }
  };

  return { status, fetchedWords, error, tryFetch };
}

/* ── WORD OF THE DAY HOOK ── */
function useWordOfDay(words: VocabWord[]) {
  return useMemo(() => {
    if (!words.length) return null;
    const dayIndex = Math.floor(Date.now() / 86_400_000) % words.length;
    return words[dayIndex];
  }, [words]);
}

/* ── HIGHLIGHT HELPER ── */
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-amber-200 text-amber-900 rounded-sm px-0.5 not-italic">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

/* ── WORD CARD ── */
function WordCard({ word, highlight }: { word: VocabWord; highlight: string }) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      className="relative cursor-pointer select-none group"
      style={{ perspective: "1000px", minHeight: "210px" }}
      onClick={() => setFlipped(f => !f)}
      role="button"
      aria-label={`Vocabulary card for ${word.word}`}
    >
      <div
        className="relative w-full h-full transition-transform duration-500 ease-in-out"
        style={{
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          minHeight: "210px",
        }}
      >
        {/* ── FRONT ── */}
        <div
          className="absolute inset-0 rounded-2xl border border-white/70 shadow-md bg-white/85 backdrop-blur-sm p-5 flex flex-col justify-between group-hover:shadow-xl group-hover:-translate-y-0.5 transition-all duration-200"
          style={{ backfaceVisibility: "hidden" }}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold text-cappuccino-800 font-playfair leading-tight tracking-tight">
                <Highlight text={word.word} query={highlight} />
              </h3>
              {word.partOfSpeech && (
                <span
                  className={`inline-block mt-1.5 text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full border ${getPosColor(word.partOfSpeech)}`}
                >
                  {word.partOfSpeech}
                </span>
              )}
            </div>
            <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-amber-100 to-orange-200 flex items-center justify-center text-base shadow-sm">
              📖
            </div>
          </div>

          {/* Body */}
          <div className="mt-3 space-y-2 flex-1">
            <p className="text-sm text-cappuccino-700 leading-relaxed">
              <Highlight text={word.englishMeaning} query={highlight} />
            </p>
            <div className="flex items-start gap-2 bg-rose-50/80 rounded-xl px-3 py-2 border border-rose-100">
              <span className="text-xs font-bold text-rose-400 uppercase tracking-wider shrink-0 mt-0.5">বাংলা</span>
              <p className="text-sm text-rose-700 font-semibold leading-snug">
                {word.banglaMeaning || "—"}
              </p>
            </div>
          </div>

          {/* Footer hint */}
          <div className="mt-2 pt-2 border-t border-cappuccino-100 flex items-center justify-end gap-1.5">
            <svg className="w-3 h-3 text-cappuccino-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <p className="text-[10px] text-cappuccino-300 font-medium">Tap for example</p>
          </div>
        </div>

        {/* ── BACK ── */}
        <div
          className="absolute inset-0 rounded-2xl border border-amber-200 shadow-md bg-gradient-to-br from-amber-50 to-orange-50 p-5 flex flex-col justify-between"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <div className="flex items-start gap-1.5 mb-2">
            <span className="text-lg shrink-0">💬</span>
            <h4 className="text-base font-bold text-cappuccino-700 font-playfair">{word.word}</h4>
          </div>
          <div className="flex-1 flex items-center">
            <p className="text-sm text-cappuccino-700 leading-relaxed italic">
              "<Highlight text={word.exampleSentence || "No example available."} query={highlight} />"
            </p>
          </div>
          <div className="mt-2 pt-2 border-t border-amber-200 flex items-center justify-end gap-1.5">
            <svg className="w-3 h-3 text-cappuccino-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <p className="text-[10px] text-cappuccino-300 font-medium">Tap to flip back</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── WORD OF THE DAY CARD ── */
function WordOfTheDay({ word }: { word: VocabWord }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div className="max-w-5xl mx-auto px-4 mt-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-700 via-orange-700 to-rose-700 p-1 shadow-xl">
        <div className="rounded-[22px] bg-white/95 backdrop-blur-sm p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">⭐</span>
            <span className="text-xs font-bold uppercase tracking-widest text-amber-600">Word of the Day</span>
          </div>
          <div
            className="relative cursor-pointer"
            style={{ perspective: "800px", minHeight: "130px" }}
            onClick={() => setFlipped(f => !f)}
          >
            <div
              className="relative w-full transition-transform duration-500"
              style={{
                transformStyle: "preserve-3d",
                transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
                minHeight: "130px",
              }}
            >
              {/* Front */}
              <div className="absolute inset-0" style={{ backfaceVisibility: "hidden" }}>
                <h2 className="text-4xl sm:text-5xl font-bold text-cappuccino-800 font-playfair mb-2">{word.word}</h2>
                {word.partOfSpeech && (
                  <span className={`inline-block text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full border mb-3 ${getPosColor(word.partOfSpeech)}`}>
                    {word.partOfSpeech}
                  </span>
                )}
                <p className="text-base text-cappuccino-600 leading-relaxed mb-2">{word.englishMeaning}</p>
                <p className="text-rose-600 font-semibold text-sm">{word.banglaMeaning}</p>
                <p className="text-xs text-cappuccino-300 mt-3">Tap for example sentence →</p>
              </div>
              {/* Back */}
              <div
                className="absolute inset-0"
                style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
              >
                <h2 className="text-2xl font-bold text-cappuccino-800 font-playfair mb-3">{word.word}</h2>
                <p className="text-cappuccino-600 italic leading-relaxed text-sm sm:text-base">
                  "{word.exampleSentence}"
                </p>
                <p className="text-xs text-cappuccino-300 mt-3">← Tap to flip back</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── CATEGORY SECTION ── */
function CategorySection({
  category,
  searchQuery,
  isExpanded,
  onToggle,
}: {
  category: VocabCategory;
  searchQuery: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const displayWords = searchQuery
    ? category.words.filter(
        w =>
          w.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
          w.englishMeaning.toLowerCase().includes(searchQuery.toLowerCase()) ||
          w.banglaMeaning.toLowerCase().includes(searchQuery.toLowerCase()) ||
          w.exampleSentence.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : category.words;

  if (displayWords.length === 0) return null;

  return (
    <section className="mb-5">
      {/* Section header (toggle button) */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-white/75 backdrop-blur-sm border border-white/70 shadow-sm hover:shadow-md hover:bg-white/90 transition-all duration-200 text-left group"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl leading-none">{category.emoji}</span>
          <div>
            <h2 className="font-bold text-cappuccino-800 text-base sm:text-lg font-playfair leading-tight">
              {category.name}
            </h2>
            <p className="text-[11px] text-cappuccino-400 mt-0.5 font-medium">
              {displayWords.length} word{displayWords.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Progress dots */}
          <div className="hidden sm:flex gap-0.5">
            {Array.from({ length: Math.min(displayWords.length, 10) }).map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-amber-300" />
            ))}
            {displayWords.length > 10 && (
              <span className="text-[10px] text-cappuccino-400 ml-1">+{displayWords.length - 10}</span>
            )}
          </div>
          <span className={`text-cappuccino-400 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </div>
      </button>

      {/* Word cards grid */}
      {isExpanded && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {displayWords.map(word => (
            <WordCard key={word.id} word={word} highlight={searchQuery} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ══════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════ */
export default function App() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showFetchBanner, setShowFetchBanner] = useState(true);
  const [viewMode, setViewMode] = useState<"browse" | "quiz">("browse");
  const searchRef = useRef<HTMLInputElement>(null);
  const categoryScrollRef = useRef<HTMLDivElement>(null);

  const { status, fetchedWords, error, tryFetch } = useXLSXFetch();

  /* Build base data */
  const baseData = useMemo(() => {
    if (fetchedWords && fetchedWords.length > 0) {
      const emojis = ["🧠","💬","⭐","🔥","💚","⚔️","📚","🌸","👑","🌿","⚖️","🌱","⏳","💰","🔄","🌊","🏜️","🪨","⚡","😴","😰","☀️","🌧️"];
      const categoryMap: Record<string, VocabWord[]> = {};
      fetchedWords.forEach(word => {
        const cat = word.category || "Vocabulary";
        if (!categoryMap[cat]) categoryMap[cat] = [];
        categoryMap[cat].push(word);
      });
      return Object.entries(categoryMap).map(([name, words], i) => ({
        name,
        emoji: emojis[i % emojis.length],
        color: "from-violet-100 to-purple-100 border-violet-200",
        words,
      }));
    }
    return getOrganizedData();
  }, [fetchedWords]);

  const wordOfDay = useWordOfDay(vocabData);

  const allCategoryNames = useMemo(
    () => [ALL_CATEGORIES, ...baseData.map(c => c.name)],
    [baseData]
  );

  /* Filtered data */
  const filteredData = useMemo(() => {
    let data = baseData;
    if (selectedCategory !== ALL_CATEGORIES)
      data = data.filter(c => c.name === selectedCategory);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data
        .map(cat => ({
          ...cat,
          words: cat.words.filter(
            w =>
              w.word.toLowerCase().includes(q) ||
              w.englishMeaning.toLowerCase().includes(q) ||
              w.banglaMeaning.toLowerCase().includes(q) ||
              w.exampleSentence.toLowerCase().includes(q)
          ),
        }))
        .filter(cat => cat.words.length > 0);
    }
    return data;
  }, [baseData, searchQuery, selectedCategory]);

  const totalWords = useMemo(
    () => filteredData.reduce((s, c) => s + c.words.length, 0),
    [filteredData]
  );

  const toggleCategory = useCallback((name: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const expandAll = () => setExpandedCategories(new Set(filteredData.map(c => c.name)));
  const collapseAll = () => setExpandedCategories(new Set());

  /* Auto-expand when searching */
  useEffect(() => {
    if (searchQuery) setExpandedCategories(new Set(filteredData.map(c => c.name)));
  }, [searchQuery]);

  /* ── QUIZ MODE ── */
  const allFilteredWords = useMemo(
    () => filteredData.flatMap(c => c.words),
    [filteredData]
  );
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizFlipped, setQuizFlipped] = useState(false);
  const currentQuizWord = allFilteredWords[quizIndex % Math.max(allFilteredWords.length, 1)];

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg,#fdf8f3 0%,#fef3e2 50%,#fdf0ec 100%)" }}>

      {/* ══ HEADER ══ */}
      <header
        className="relative overflow-hidden text-white"
        style={{
          backgroundImage: "url('/vocab-hero.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-amber-900/82 via-amber-800/78 to-orange-900/85" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-10 -left-10 w-72 h-72 rounded-full bg-white/30 blur-3xl" />
          <div className="absolute -bottom-10 -right-10 w-80 h-80 rounded-full bg-amber-200/30 blur-3xl" />
        </div>
        <div className="relative max-w-5xl mx-auto px-4 py-10 sm:py-16 text-center">
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-4 py-1.5 mb-5 text-xs font-semibold text-amber-200 tracking-widest uppercase border border-white/20">
            ✨ Vocabulary Builder
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold font-playfair mb-4 leading-none tracking-tight drop-shadow-lg">
            Word<span className="text-amber-300">Smart</span>
          </h1>
          <p className="text-amber-100 text-base sm:text-lg max-w-lg mx-auto leading-relaxed mb-8">
            Master essential English words with meanings in{" "}
            <span className="font-bold text-white">English & বাংলা</span>,
            grouped by theme. Tap any card to flip!
          </p>

          {/* Stats */}
          <div className="flex items-center justify-center gap-8">
            {[
              { value: baseData.reduce((s, c) => s + c.words.length, 0) + "+", label: "Words" },
              { value: baseData.length, label: "Themes" },
              { value: "2", label: "Languages" },
            ].map(({ value, label }) => (
              <div key={label}>
                <p className="text-2xl sm:text-3xl font-bold text-amber-200 font-playfair">{value}</p>
                <p className="text-[11px] text-amber-300 uppercase tracking-widest font-semibold">{label}</p>
              </div>
            ))}
          </div>

          {/* Mode toggle */}
          <div className="flex items-center justify-center mt-8 gap-2">
            <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-1 flex gap-1 border border-white/20">
              <button
                onClick={() => setViewMode("browse")}
                className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  viewMode === "browse"
                    ? "bg-white text-amber-800 shadow-md"
                    : "text-amber-200 hover:text-white"
                }`}
              >
                📚 Browse
              </button>
              <button
                onClick={() => { setViewMode("quiz"); setQuizIndex(0); setQuizFlipped(false); }}
                className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  viewMode === "quiz"
                    ? "bg-white text-amber-800 shadow-md"
                    : "text-amber-200 hover:text-white"
                }`}
              >
                🎯 Quiz Mode
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ══ FETCH BANNER ══ */}
      {showFetchBanner && status !== "done" && (
        <div className="max-w-5xl mx-auto px-4 mt-5">
          <div className="bg-white/85 backdrop-blur-sm border border-amber-200 rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 shadow-sm">
            <span className="text-2xl">📥</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-cappuccino-800">Load full dataset from GitHub</p>
              <p className="text-xs text-cappuccino-500 mt-0.5 leading-relaxed">
                {status === "loading"
                  ? "⏳ Fetching your Excel file from GitHub…"
                  : status === "error"
                  ? `❌ Could not fetch: ${error}. Showing built-in vocabulary instead.`
                  : "Click to load all 850 words directly from your GitHub repository (WordSmart1_Complete_850Words.xlsx)."}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {status === "idle" && (
                <button
                  onClick={tryFetch}
                  className="bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors shadow-sm"
                >
                  Load from GitHub
                </button>
              )}
              {status === "loading" && (
                <div className="flex items-center gap-2 text-amber-700 text-xs font-bold px-3">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Loading…
                </div>
              )}
              {status === "error" && (
                <button onClick={tryFetch} className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors">
                  Retry
                </button>
              )}
              <button
                onClick={() => setShowFetchBanner(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-cappuccino-400 hover:text-cappuccino-700 hover:bg-cappuccino-100 transition-colors text-lg"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {status === "done" && fetchedWords && (
        <div className="max-w-5xl mx-auto px-4 mt-5">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-3 flex items-center gap-3 shadow-sm">
            <span className="text-xl">✅</span>
            <p className="text-sm font-bold text-emerald-700">
              Loaded {fetchedWords.length} words from GitHub!
            </p>
          </div>
        </div>
      )}

      {/* ══ WORD OF THE DAY ══ */}
      {wordOfDay && viewMode === "browse" && (
        <WordOfTheDay word={wordOfDay} />
      )}

      {/* ══ SEARCH + FILTER BAR ══ */}
      {viewMode === "browse" && (
        <div className="max-w-5xl mx-auto px-4 mt-5 sticky top-0 z-20 pb-3">
          <div className="bg-white/88 backdrop-blur-lg border border-white/70 rounded-2xl shadow-lg p-3 sm:p-4">
            {/* Search input */}
            <div className="relative mb-3">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <svg className="w-4 h-4 text-cappuccino-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
                </svg>
              </div>
              <input
                ref={searchRef}
                type="text"
                placeholder="Search words, meanings, or বাংলা…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-10 py-3 rounded-xl border text-cappuccino-800 placeholder-cappuccino-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
                style={{ background: "rgba(254,243,226,0.8)", borderColor: "#e6b97a" }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-3 flex items-center text-cappuccino-400 hover:text-cappuccino-700"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Category filter pills */}
            <div ref={categoryScrollRef} className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
              {allCategoryNames.map(cat => {
                const catObj = baseData.find(c => c.name === cat);
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 border ${
                      selectedCategory === cat
                        ? "bg-amber-700 text-white border-amber-700 shadow-md scale-105"
                        : "bg-white text-cappuccino-600 border-cappuccino-200 hover:border-amber-400 hover:text-amber-700"
                    }`}
                  >
                    {cat === ALL_CATEGORIES ? "🗂 All" : `${catObj?.emoji ?? ""} ${cat}`}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══ RESULTS BAR ══ */}
      {viewMode === "browse" && (
        <div className="max-w-5xl mx-auto px-4 mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-cappuccino-500 font-medium">
            {searchQuery
              ? `${totalWords} result${totalWords !== 1 ? "s" : ""} for "${searchQuery}"`
              : `${totalWords} words · ${filteredData.length} categories`}
          </p>
          <div className="flex gap-2 text-xs font-semibold">
            <button onClick={expandAll} className="text-amber-700 hover:underline">
              Expand All
            </button>
            <span className="text-cappuccino-300">|</span>
            <button onClick={collapseAll} className="text-cappuccino-500 hover:underline">
              Collapse All
            </button>
          </div>
        </div>
      )}

      {/* ══ MAIN CONTENT ══ */}
      <main className="max-w-5xl mx-auto px-4 py-5">

        {/* ── BROWSE MODE ── */}
        {viewMode === "browse" && (
          filteredData.length === 0 ? (
            <div className="text-center py-24">
              <p className="text-6xl mb-4">🔍</p>
              <p className="text-cappuccino-700 font-bold text-xl font-playfair">No words found</p>
              <p className="text-cappuccino-400 text-sm mt-1">Try a different search term or category</p>
              <button
                onClick={() => { setSearchQuery(""); setSelectedCategory(ALL_CATEGORIES); }}
                className="mt-5 bg-amber-700 text-white text-sm font-bold px-6 py-2.5 rounded-xl hover:bg-amber-800 transition shadow-md"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            filteredData.map(category => (
              <CategorySection
                key={category.name}
                category={category}
                searchQuery={searchQuery}
                isExpanded={expandedCategories.has(category.name)}
                onToggle={() => toggleCategory(category.name)}
              />
            ))
          )
        )}

        {/* ── QUIZ MODE ── */}
        {viewMode === "quiz" && (
          <div className="max-w-lg mx-auto">
            {allFilteredWords.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-5xl mb-3">📭</p>
                <p className="text-cappuccino-600 font-semibold">No words to quiz!</p>
              </div>
            ) : (
              <div>
                {/* Progress */}
                <div className="mb-4 flex items-center justify-between text-xs text-cappuccino-500 font-medium">
                  <span>Card {(quizIndex % allFilteredWords.length) + 1} of {allFilteredWords.length}</span>
                  <span className="text-amber-600 font-semibold">{currentQuizWord.category}</span>
                </div>
                <div className="mb-5 h-2 bg-cappuccino-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-300"
                    style={{ width: `${((quizIndex % allFilteredWords.length) + 1) / allFilteredWords.length * 100}%` }}
                  />
                </div>

                {/* Quiz Card */}
                <div
                  className="relative cursor-pointer"
                  style={{ perspective: "1000px", minHeight: "300px" }}
                  onClick={() => setQuizFlipped(f => !f)}
                >
                  <div
                    className="relative w-full transition-transform duration-500"
                    style={{
                      transformStyle: "preserve-3d",
                      transform: quizFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                      minHeight: "300px",
                    }}
                  >
                    {/* Quiz Front */}
                    <div
                      className="absolute inset-0 rounded-3xl bg-white/90 border border-white/70 shadow-2xl p-8 flex flex-col items-center justify-center text-center"
                      style={{ backfaceVisibility: "hidden" }}
                    >
                      <p className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-4">What does this word mean?</p>
                      <h2 className="text-4xl sm:text-5xl font-bold text-cappuccino-800 font-playfair mb-3">
                        {currentQuizWord.word}
                      </h2>
                      {currentQuizWord.partOfSpeech && (
                        <span className={`text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full border ${getPosColor(currentQuizWord.partOfSpeech)}`}>
                          {currentQuizWord.partOfSpeech}
                        </span>
                      )}
                      <p className="text-cappuccino-400 text-sm mt-8">Tap to reveal meaning</p>
                    </div>

                    {/* Quiz Back */}
                    <div
                      className="absolute inset-0 rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 shadow-2xl p-8 flex flex-col justify-between"
                      style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                    >
                      <div className="text-center">
                        <h2 className="text-3xl font-bold text-cappuccino-800 font-playfair mb-4">{currentQuizWord.word}</h2>
                        <p className="text-cappuccino-700 leading-relaxed mb-3">{currentQuizWord.englishMeaning}</p>
                        <div className="bg-rose-50 border border-rose-100 rounded-xl px-4 py-2 inline-block mb-4">
                          <p className="text-rose-700 font-semibold">{currentQuizWord.banglaMeaning}</p>
                        </div>
                        <p className="text-cappuccino-500 text-sm italic">"{currentQuizWord.exampleSentence}"</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-center gap-4 mt-6">
                  <button
                    onClick={() => { setQuizIndex(i => Math.max(0, i - 1)); setQuizFlipped(false); }}
                    disabled={quizIndex === 0}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white border border-cappuccino-200 text-cappuccino-600 text-sm font-semibold hover:bg-cappuccino-50 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={() => { setQuizIndex(i => (i + 1) % allFilteredWords.length); setQuizFlipped(false); }}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-700 text-white text-sm font-bold hover:bg-amber-800 transition shadow-md"
                  >
                    Next →
                  </button>
                </div>

                <p className="text-center text-xs text-cappuccino-400 mt-4">
                  Tap the card to flip • Use filters in Browse mode to narrow words
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ══ FOOTER ══ */}
      <footer className="border-t border-cappuccino-100 bg-white/50 text-center py-8 px-4 mt-6">
        <p className="text-sm font-semibold text-cappuccino-600 font-playfair mb-1">WordSmart 850</p>
        <p className="text-xs text-cappuccino-400 mb-2">
          Source:{" "}
          <a
            href="https://github.com/TR4842/Wordsmart-1"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-700 font-semibold hover:underline"
          >
            TR4842/Wordsmart-1
          </a>{" "}
          on GitHub
        </p>
        <p className="text-xs text-cappuccino-300">
          📖 Browse mode: tap cards to flip · 🎯 Quiz mode: test your knowledge
        </p>
      </footer>
    </div>
  );
}
