// Shared domain types for BolBindass. Everything here is stored locally
// (IndexedDB / localStorage) — nothing is sent to an external service.

export type LearningLevel =
  | "beginner"
  | "intermediate"
  | "upper-intermediate"
  | "advanced";

export type CorrectionMode = "friendly" | "instant" | "immersion";

/** Language used for explanations when the learner needs extra help. */
export type HelpLanguage = "english" | "hinglish";

export type TopicCategory =
  | "daily-life"
  | "workplace"
  | "ai-software"
  | "projects"
  | "opinions-stories"
  | "interviews"
  | "manager-colleagues";

export type MistakeCategory =
  | "past-tense"
  | "present-perfect"
  | "verb-forms"
  | "subject-verb-agreement"
  | "articles"
  | "prepositions"
  | "redundant-words"
  | "uncountable-nouns"
  | "stative-verbs"
  | "question-form"
  | "word-order"
  | "comparatives"
  | "hindi-translation"
  | "word-choice"
  | "plurals"
  | "pronouns"
  | "other";

export type SpeechLang = "en-IN" | "en-US" | "en-GB";

export interface Settings {
  name: string;
  goal: string;
  level: LearningLevel;
  correctionMode: CorrectionMode;
  helpLanguage: HelpLanguage;
  interests: TopicCategory[];
  /** Selected local Ollama model. Empty string = pick automatically. */
  model: string;
  speechLang: SpeechLang;
  autoSpeak: boolean;
  /** Empty string = choose the best available voice automatically. */
  voiceURI: string;
  speechRate: number;
  /** Start listening again automatically after the coach finishes speaking. */
  handsFree: boolean;
  /** Auto-send after this much silence. 0 = only send when I press "Done". */
  silenceTimeoutMs: number;
  /** Put recognised speech into the text box so I can edit it before sending. */
  reviewBeforeSend: boolean;
  sessionTargetMinutes: number;
}

export type CorrectionSource = "rule" | "ai";

export interface Correction {
  id: string;
  turnId: string;
  /** Exact sentence (or phrase) taken from the learner's own words. */
  original: string;
  corrected: string;
  explanation: string;
  alternative?: string;
  category: MistakeCategory;
  source: CorrectionSource;
  ruleId?: string;
}

export type TurnRole = "coach" | "learner";

/** coach: "ai" (local model) or "basic" (scripted question bank); learner: "voice" or "typed". */
export type TurnSource = "ai" | "basic" | "voice" | "typed";

export type AnalysisState = "pending" | "done" | "failed" | "skipped";

export interface TranscriptTurn {
  id: string;
  role: TurnRole;
  text: string;
  at: number;
  source: TurnSource;
  corrections?: Correction[];
  analysis?: AnalysisState;
  /** Coach turns produced by the "say it simpler" helper. */
  helper?: boolean;
}

export type Engine = "ollama" | "basic";

export interface Strength {
  point: string;
  /** Exact learner words supporting the point, when available. */
  evidence?: string;
}

export interface VocabularyItem {
  word: string;
  meaning: string;
  example?: string;
}

export interface BetterExpression {
  learnerSaid: string;
  natural: string;
}

export interface RecurringMistakeSummary {
  category: MistakeCategory;
  label: string;
  countThisSession: number;
  totalCount: number;
}

export interface SessionStats {
  learnerTurns: number;
  coachTurns: number;
  totalWords: number;
  avgWordsPerTurn: number;
  longestTurnWords: number;
  uniqueWords: number;
  fillerCount: number;
  repeatedWordCount: number;
}

export interface SessionReport {
  generatedAt: number;
  topicTitle: string;
  durationSec: number;
  stats: SessionStats;
  corrections: Correction[];
  recurring: RecurringMistakeSummary[];
  betterExpressions: BetterExpression[];
  vocabulary: VocabularyItem[];
  vocabularySource: "ai" | "topic-list";
  strengths: Strength[];
  improvementGoal: string;
  nextTopic: { id: string; title: string; reason: string } | null;
  aiSummaryUsed: boolean;
  notes: string[];
}

export interface SessionRecord {
  id: string;
  startedAt: number;
  endedAt: number | null;
  durationSec: number;
  topicId: string;
  topicTitle: string;
  topicCategory: TopicCategory;
  topicReason: string;
  focusCategories: MistakeCategory[];
  mode: CorrectionMode;
  engine: Engine;
  model: string | null;
  level: LearningLevel;
  turns: TranscriptTurn[];
  report: SessionReport | null;
}

export interface MistakeExample {
  original: string;
  corrected: string;
  explanation: string;
  sessionId: string;
  at: number;
  source: CorrectionSource;
}

export interface EvidenceItem {
  sentence: string;
  sessionId: string;
  at: number;
}

export type MistakeStatus = "active" | "improving" | "resolved";

export interface MistakeRecord {
  key: string;
  category: MistakeCategory;
  label: string;
  examples: MistakeExample[];
  occurrenceCount: number;
  sessionIds: string[];
  firstSeenAt: number;
  lastSeenAt: number;
  lastPracticedAt: number | null;
  correctUses: EvidenceItem[];
  status: MistakeStatus;
}

export interface ExportBundle {
  app: "bolbindass";
  formatVersion: 1;
  exportedAt: string;
  settings: Settings;
  sessions: SessionRecord[];
  mistakes: MistakeRecord[];
}
