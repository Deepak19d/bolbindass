// Deterministic checks for common Hindi-English (Indian English) learner
// mistakes. They run fully offline, never invent sentences (every hit quotes
// a learner sentence), and also power "Basic practice mode" when no local AI
// is running. They intentionally favour precision over recall: the local AI
// catches the rest.

import { matchCase, splitSentences } from "./text";
import type { MistakeCategory } from "./types";

export interface RuleHit {
  ruleId: string;
  category: MistakeCategory;
  original: string;
  corrected: string;
  explanation: string;
  alternative?: string;
}

interface RuleResult {
  corrected: string;
  explanation?: string;
  alternative?: string;
}

interface Rule {
  id: string;
  category: MistakeCategory;
  explanation: string;
  apply(sentence: string): RuleResult | null;
}

// ── Verb tables ────────────────────────────────────────────────────────────

/** base → simple past */
export const PAST_FORMS: Record<string, string> = {
  go: "went", eat: "ate", see: "saw", meet: "met", buy: "bought", come: "came",
  take: "took", make: "made", do: "did", have: "had", get: "got", give: "gave",
  tell: "told", say: "said", think: "thought", write: "wrote", speak: "spoke",
  leave: "left", find: "found", feel: "felt", know: "knew", begin: "began",
  run: "ran", sit: "sat", stand: "stood", bring: "brought", teach: "taught",
  sleep: "slept", drive: "drove", become: "became", build: "built", send: "sent",
  spend: "spent", lose: "lost", win: "won", pay: "paid", forget: "forgot",
  understand: "understood", wake: "woke", watch: "watched", play: "played",
  work: "worked", visit: "visited", call: "called", finish: "finished",
  start: "started", attend: "attended", complete: "completed", join: "joined",
  talk: "talked", travel: "travelled", learn: "learned", study: "studied",
  try: "tried", want: "wanted", need: "needed", ask: "asked", help: "helped",
  use: "used", live: "lived", move: "moved", decide: "decided", enjoy: "enjoyed",
  cook: "cooked", clean: "cleaned", stay: "stayed", fix: "fixed", deploy: "deployed",
  create: "created", develop: "developed", present: "presented", explain: "explained",
  celebrate: "celebrated", reach: "reached", return: "returned", receive: "received",
  submit: "submitted", plan: "planned", stop: "stopped", walk: "walked",
  listen: "listened", like: "liked", love: "loved",
};

/** past participle (when different from simple past) → simple past */
const PARTICIPLE_TO_PAST: Record<string, string> = {
  gone: "went", done: "did", seen: "saw", eaten: "ate", taken: "took",
  given: "gave", written: "wrote", spoken: "spoke", known: "knew", begun: "began",
  driven: "drove", woken: "woke", forgotten: "forgot",
};

export function thirdPerson(base: string): string {
  if (base === "have") return "has";
  if (base === "go" || base === "do") return `${base}es`;
  if (/(s|sh|ch|x|z)$/.test(base)) return `${base}es`;
  if (/[^aeiou]y$/.test(base)) return `${base.slice(0, -1)}ies`;
  return `${base}s`;
}

const BASE_BY_FORM: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const base of Object.keys(PAST_FORMS)) {
    m.set(base, base);
    m.set(thirdPerson(base), base);
  }
  return m;
})();

const BASE_BY_PAST: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const [base, past] of Object.entries(PAST_FORMS)) {
    if (past !== base) m.set(past, base);
  }
  return m;
})();

const PAST_VALUES = new Set(Object.values(PAST_FORMS));

// ── Time markers ───────────────────────────────────────────────────────────

const NUM = "(?:\\d+|a few|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|few|many|several|couple of)";
const DAY = "(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)";
const MONTHS = "(?:january|february|march|april|may|june|july|august|september|october|november|december)";

export const PAST_TIME_RE = new RegExp(
  `\\b(yesterday|last\\s+(?:night|week|weekend|month|year|time|summer|winter|semester|${DAY})|${NUM}\\s+(?:days?|weeks?|months?|years?|hours?)\\s+ago|the\\s+other\\s+day)\\b`,
  "i",
);
const FUTURE_OR_HABIT_RE = /\b(will|won't|going to|gonna|tomorrow|next\s+\w+|usually|always|every|often|generally|daily)\b/i;

const SINCE_DURATION_RE = new RegExp(
  `\\bsince\\s+((?:the\\s+)?(?:last\\s+|past\\s+)?${NUM}\\s+(?:years?|months?|weeks?|days?|hours?))\\b`,
  "i",
);
const SINCE_POINT_RE = new RegExp(
  `\\bsince\\s+((?:19|20)\\d{2}|last\\s+(?:year|month|week|${DAY})|childhood|my\\s+(?:childhood|college|school|graduation|first\\s+job)|${MONTHS}|then|the\\s+beginning)\\b`,
  "i",
);
const FROM_POINT_RE = new RegExp(
  `\\bfrom\\s+((?:19|20)\\d{2}|last\\s+(?:year|month|week|${DAY})|${MONTHS})\\b`,
  "i",
);

const MODAL_BEFORE = new Set([
  "will", "would", "can", "could", "should", "must", "might", "may", "to",
  "did", "didn't", "didnt", "don't", "dont", "do", "does", "doesn't", "let",
  "not", "never", "shall", "won't", "cannot", "can't",
]);

// ── Helpers ────────────────────────────────────────────────────────────────

function hasPastForm(sentence: string): boolean {
  return sentence
    .toLowerCase()
    .split(/[^a-z']+/)
    .some((w) => PAST_VALUES.has(w) || /^(was|were|had|did|didn't)$/.test(w));
}

const CLAUSE_BREAK_RE = /[,;:]|\b(?:and|but|so|because|when|what|that|which|who|where|if|while)\b/gi;

/** [start, end) of the clause containing `index`. */
function clauseAround(sentence: string, index: number): [number, number] {
  let start = 0;
  let end = sentence.length;
  for (const m of sentence.matchAll(CLAUSE_BREAK_RE)) {
    const at = m.index ?? 0;
    if (at <= index) start = at + m[0].length;
    else {
      end = at;
      break;
    }
  }
  return [start, end];
}

function replaceAt(sentence: string, index: number, length: number, replacement: string): string {
  const original = sentence.slice(index, index + length);
  return sentence.slice(0, index) + matchCase(replacement, original) + sentence.slice(index + length);
}

function article(nextWord: string): "a" | "an" {
  return /^[aeio]/i.test(nextWord) || /^(hour|honest|heir)/i.test(nextWord) ? "an" : "a";
}

const PRESENT_CONTINUOUS_RE =
  /\b(?:(?:I|we|you|they)\s+(?:am|are)|(?:I|we|you|they)(?:'m|'re)|(?:he|she|it)\s+is|(?:he|she|it)'s)\s+(?:\w+ing|here|there)\b|\b(?:I|we|you|they)\s+know\b/i;

/** "I am working" → "I have been working" (and he/she/it → has been). */
function continuousToPerfect(sentence: string): string {
  return sentence
    .replace(/\b(I|we|you|they)\s+(?:am|are)\s+(\w+ing|here|there)\b/gi, (_m, s: string, v: string) => `${s} have been ${v}`)
    .replace(/\b(I|we|you|they)(?:'m|'re)\s+(\w+ing|here|there)\b/gi, (_m, s: string, v: string) => `${s}'ve been ${v}`)
    .replace(/\b(he|she|it)\s+is\s+(\w+ing|here|there)\b/gi, (_m, s: string, v: string) => `${s} has been ${v}`)
    .replace(/\b(he|she|it)'s\s+(\w+ing|here|there)\b/gi, (_m, s: string, v: string) => `${s}'s been ${v}`)
    .replace(/\b(I|we|you|they)\s+know\b/gi, (_m, s: string) => `${s} have known`);
}

const SUBJECT_HAVE: Record<string, string> = {
  i: "have", we: "have", you: "have", they: "have", he: "has", she: "has", it: "has",
};

// ── Rules ──────────────────────────────────────────────────────────────────

const RULES: Rule[] = [
  {
    id: "past-time-present-verb",
    category: "past-tense",
    explanation: "This happened in the past, so use the past tense.",
    apply(sentence) {
      const marker = PAST_TIME_RE.exec(sentence);
      if (!marker) return null;
      // Only the clause that contains the time word is checked, so "I want to
      // tell you what I did yesterday" or "…and it was fun" stay untouched.
      const [start, clauseEnd] = clauseAround(sentence, marker.index);
      let end = clauseEnd;
      // "Yesterday, I go…": the time word stands alone before a comma.
      if (!/\p{L}+\s+\p{L}+/u.test(sentence.slice(start, end).replace(marker[0], "")) && end < sentence.length) {
        end = clauseAround(sentence, end + 1)[1];
      }
      const clause = sentence.slice(start, end);
      if (FUTURE_OR_HABIT_RE.test(clause) || hasPastForm(clause)) return null;
      const re = /\b(I|we|you|they|he|she|it|(?:my|our|his|her|their|the|this|that)\s+[A-Za-z]+)\s+((?:also|just|then|first|finally|again|only)\s+)?([A-Za-z]+)\b/g;
      const matches: RegExpExecArray[] = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(clause))) matches.push(m);
      let out = sentence;
      let first: { from: string; to: string } | null = null;
      // Right-to-left so earlier indexes stay valid while replacing.
      for (const match of matches.reverse()) {
        const verb = match[3];
        const base = BASE_BY_FORM.get(verb.toLowerCase());
        if (!base) continue;
        const before = clause.slice(0, match.index).trim().split(/\s+/).pop()?.toLowerCase() ?? "";
        if (MODAL_BEFORE.has(before)) continue;
        const past = PAST_FORMS[base];
        out = replaceAt(out, start + match.index + match[0].length - verb.length, verb.length, past);
        first = { from: verb, to: past };
      }
      if (!first) return null;
      return {
        corrected: out,
        explanation: `“${marker[1]}” shows the action is finished, so use the past tense: “${first.to}”, not “${first.from}”.`,
      };
    },
  },
  {
    id: "perfect-with-finished-time",
    category: "past-tense",
    explanation: "With a finished time, use the simple past instead of have/has + verb.",
    apply(sentence) {
      // "in 2021" is a finished time for present-perfect purposes ("I have joined in 2021").
      const marker = sentence.match(PAST_TIME_RE) ?? sentence.match(/\bin\s+((?:19|20)\d{2})\b/i);
      if (!marker || /\b(since|for)\b/i.test(sentence)) return null;
      // "'s" is excluded on purpose: "it's done" is usually passive, not perfect.
      const m = sentence.match(/\b(have|has|'ve)\s+(?:already\s+|just\s+)?([A-Za-z]+)\b/i);
      if (!m || m.index === undefined) return null;
      const word = m[2].toLowerCase();
      const past = PARTICIPLE_TO_PAST[word] ?? (PAST_VALUES.has(word) ? word : null);
      if (!past) return null;
      const contracted = m[1].startsWith("'");
      const corrected = (
        sentence.slice(0, m.index) +
        (contracted ? " " : "") +
        matchCase(past, contracted ? m[2] : m[1]) +
        sentence.slice(m.index + m[0].length)
      )
        .replace(/\s{2,}/g, " ")
        .replace(/\s+([,.!?])/g, "$1");
      return {
        corrected,
        explanation: `With a finished time like “${marker[1]}”, use the simple past (“${past}”), not “${m[1].replace("'", "")} ${m[2]}”.`,
      };
    },
  },
  {
    id: "did-plus-past",
    category: "verb-forms",
    explanation: "After did / didn't, use the base verb.",
    apply(sentence) {
      const m = sentence.match(/\b(did|didn't|didnt|did not)\s+([A-Za-z]+)\b/i);
      if (!m || m.index === undefined) return null;
      const base = BASE_BY_PAST.get(m[2].toLowerCase());
      if (!base) return null;
      return {
        corrected: replaceAt(sentence, m.index + m[0].length - m[2].length, m[2].length, base),
        explanation: `After “${m[1]}”, use the base verb: “${m[1]} ${base}”, not “${m[1]} ${m[2]}”.`,
      };
    },
  },
  {
    id: "does-plus-s",
    category: "verb-forms",
    explanation: "After does / doesn't, use the base verb without -s.",
    apply(sentence) {
      const m = sentence.match(/\b(does|doesn't|doesnt|does not)\s+([A-Za-z]+)\b/i);
      if (!m || m.index === undefined) return null;
      const word = m[2].toLowerCase();
      const base = BASE_BY_FORM.get(word);
      if (!base || base === word) return null;
      return {
        corrected: replaceAt(sentence, m.index + m[0].length - m[2].length, m[2].length, base),
        explanation: `After “${m[1]}”, the verb stays in its base form: “${base}”, not “${m[2]}”.`,
      };
    },
  },
  {
    id: "since-with-duration",
    category: "present-perfect",
    explanation: "Use “for” with a length of time and “since” with a starting point.",
    apply(sentence) {
      if (!SINCE_DURATION_RE.test(sentence)) return null;
      let corrected = sentence.replace(SINCE_DURATION_RE, (_x, rest: string) =>
        /^(last|past)\s/i.test(rest) ? `for the ${rest}` : `for ${rest}`,
      );
      corrected = corrected.replace(/^for\b/, "For");
      const usedContinuous = PRESENT_CONTINUOUS_RE.test(corrected);
      corrected = continuousToPerfect(corrected);
      return {
        corrected,
        explanation: usedContinuous
          ? "Use “for” with a length of time (for two years). For something that started in the past and is still true, use “have been + -ing”."
          : "Use “for” with a length of time (for two years) and “since” with a starting point (since 2022).",
      };
    },
  },
  {
    id: "continuous-with-since-point",
    category: "present-perfect",
    explanation: "For actions that started in the past and continue now, use have been + -ing.",
    apply(sentence) {
      // "since 5 years" is handled by the duration rule above.
      if (SINCE_DURATION_RE.test(sentence) || !PRESENT_CONTINUOUS_RE.test(sentence)) return null;
      const since = sentence.match(SINCE_POINT_RE);
      const from = since ? null : sentence.match(FROM_POINT_RE);
      const point = since ?? from;
      if (!point || point.index === undefined) return null;
      if (from && /\b(to|till|until)\b/i.test(sentence.slice(point.index + point[0].length))) return null;
      let corrected = continuousToPerfect(sentence);
      if (from) corrected = corrected.replace(FROM_POINT_RE, (_x, p: string) => `since ${p}`);
      if (corrected === sentence) return null;
      return {
        corrected,
        explanation: `For something that started in the past and is still going on, use “have been + -ing” with “since ${point[1]}”.`,
      };
    },
  },
  {
    id: "discuss-about",
    category: "redundant-words",
    explanation: "“Discuss” already means “talk about”, so don't add “about”.",
    apply(sentence) {
      const re = /\b(discuss(?:ed|es|ing)?)\s+about\b/i;
      if (!re.test(sentence)) return null;
      return {
        corrected: sentence.replace(re, "$1"),
        alternative: sentence.replace(re, (_x, d: string) => {
          const talk = d.replace(/discusses/i, "talks").replace(/discuss/i, "talk");
          return `${talk} about`;
        }),
      };
    },
  },
  {
    id: "redundant-back-again",
    category: "redundant-words",
    explanation: "The extra word repeats the meaning, so you can drop it.",
    apply(sentence) {
      let corrected = sentence
        .replace(/\b(return(?:ed|s|ing)?|reply|replied|replies|replying)\s+back\b/gi, "$1")
        .replace(/\b(repeat(?:ed|s|ing)?)\s+again\b/gi, "$1")
        .replace(/\b(cope|coped|copes|coping)\s+up\s+with\b/gi, "$1 with");
      corrected = corrected.replace(/\b(revert|reverted|reverts|reverting)\s+back\b/gi, (_m, w: string) => {
        const map: Record<string, string> = {
          revert: "get back", reverted: "got back", reverts: "gets back", reverting: "getting back",
        };
        return matchCase(map[w.toLowerCase()], w);
      });
      if (corrected === sentence) return null;
      return { corrected };
    },
  },
  {
    id: "double-comparative",
    category: "comparatives",
    explanation: "Use either “more” or “-er”, not both.",
    apply(sentence) {
      const re = /\b(more|most)\s+(better|worse|bigger|smaller|easier|harder|faster|slower|cheaper|higher|lower|greater|longer|shorter|simpler|happier|busier|best|worst|biggest|easiest)\b/i;
      const m = sentence.match(re);
      if (!m) return null;
      return {
        corrected: sentence.replace(re, "$2"),
        alternative: m[1].toLowerCase() === "more" ? sentence.replace(re, "much $2") : undefined,
        explanation: `“${m[2]}” is already a comparison, so drop “${m[1]}”.`,
      };
    },
  },
  {
    id: "uncountable-plural",
    category: "uncountable-nouns",
    explanation: "This noun is uncountable in English, so it has no plural and no “a/an”.",
    apply(sentence) {
      const plural: Record<string, string> = {
        informations: "information", advices: "advice", furnitures: "furniture",
        equipments: "equipment", knowledges: "knowledge", feedbacks: "feedback",
        luggages: "luggage", baggages: "baggage", homeworks: "homework",
        softwares: "software", stuffs: "stuff", jewelleries: "jewellery", sceneries: "scenery",
      };
      const singular: Record<string, string> = {
        advice: "a piece of advice", information: "a piece of information",
        feedback: "some feedback", equipment: "a piece of equipment", homework: "some homework",
        furniture: "a piece of furniture", knowledge: "some knowledge",
      };
      const found: { word?: string } = {};
      let corrected = sentence.replace(
        /\b(informations|advices|furnitures|equipments|knowledges|feedbacks|luggages|baggages|homeworks|softwares|stuffs|jewelleries|sceneries)\b/gi,
        (w: string) => {
          found.word ??= w;
          return matchCase(plural[w.toLowerCase()], w);
        },
      );
      corrected = corrected.replace(
        /\b(a|an)\s+(advice|information|feedback|equipment|homework|furniture|knowledge)\b/gi,
        (m: string, _a: string, n: string) => {
          found.word ??= m;
          return matchCase(singular[n.toLowerCase()], m);
        },
      );
      corrected = corrected.replace(
        /\bmany\s+(information|advice|feedback|equipment|furniture|knowledge|luggage|homework|software)\b/gi,
        (m: string, n: string) => matchCase(`a lot of ${n}`, m),
      );
      if (!found.word || corrected === sentence) return null;
      return {
        corrected,
        explanation: `“${found.word}”: words like information, advice and feedback are uncountable, so no plural and no “a/an”.`,
      };
    },
  },
  {
    id: "third-person-dont",
    category: "subject-verb-agreement",
    explanation: "With he / she / it, use “doesn't”, not “don't”.",
    apply(sentence) {
      const re = /\b(he|she|it|my\s+(?:manager|friend|brother|sister|father|mother|boss|colleague|teacher|team\s+lead)|this\s+(?:app|code|feature|project|tool|model))\s+(don't|dont|do not)\b/i;
      if (!re.test(sentence)) return null;
      return {
        corrected: sentence.replace(re, (_x, s: string, d: string) => `${s} ${d.toLowerCase() === "do not" ? "does not" : "doesn't"}`),
      };
    },
  },
  {
    id: "third-person-have",
    category: "subject-verb-agreement",
    explanation: "With he / she / it, use “has”, not “have”.",
    apply(sentence) {
      const re = /(?<!\b(?:does|doesn't|did|didn't|will|would|can|could|should|must|might|may|to|let|make|made|help|not)\s)\b(he|she|it)\s+have\b/i;
      if (!re.test(sentence)) return null;
      return { corrected: sentence.replace(re, "$1 has") };
    },
  },
  {
    id: "stative-having",
    category: "stative-verbs",
    explanation: "When “have” means own / possess, don't use “having”.",
    apply(sentence) {
      const re = new RegExp(
        `\\b(I|we|you|they|he|she|it)(?:\\s+(?:am|are|is)|'m|'re|'s)\\s+having\\s+(?=(?:${NUM}\\s+(?:\\w+\\s+)?(?:years?|months?|brothers?|sisters?|siblings?|kids?|children|sons?|daughters?|cars?|bikes?|laptops?|houses?|phones?|experience)|experience|knowledge)\\b)`,
        "i",
      );
      const m = sentence.match(re);
      if (!m) return null;
      const subj = m[1];
      return {
        corrected: sentence.replace(re, `${subj} ${SUBJECT_HAVE[subj.toLowerCase()]} `),
        explanation: "When “have” means you own or possess something (experience, siblings, a car), don't use “having”: say “I have…”.",
      };
    },
  },
  {
    id: "stative-continuous",
    category: "stative-verbs",
    explanation: "Verbs like know, understand and belong are not usually used with -ing.",
    apply(sentence) {
      const notUnderstanding = /\b(I|we|you|they|he|she)(?:\s+(?:am|are|is)|'m|'re|'s)\s+not\s+understanding\b/i;
      const m1 = sentence.match(notUnderstanding);
      if (m1) {
        const third = /^(he|she)$/i.test(m1[1]);
        return { corrected: sentence.replace(notUnderstanding, `${m1[1]} ${third ? "doesn't" : "don't"} understand`) };
      }
      const re = /\b(I|we|you|they|he|she|it)(?:\s+(?:am|are|is)|'m|'re|'s)\s+(knowing|owning|belonging|preferring)\b/i;
      const m = sentence.match(re);
      if (!m) return null;
      const base = m[2].toLowerCase() === "preferring" ? "prefer" : m[2].toLowerCase().replace(/ing$/, "");
      const verb = /^(he|she|it)$/i.test(m[1]) ? thirdPerson(base) : base;
      return { corrected: sentence.replace(re, `${m[1]} ${verb}`) };
    },
  },
  {
    id: "today-morning",
    category: "hindi-translation",
    explanation: "In English we say “this morning / this evening” and “last night”.",
    apply(sentence) {
      const corrected = sentence
        .replace(/\btoday\s+(morning|afternoon|evening)\b/gi, (m: string, p: string) => matchCase(`this ${p}`, m))
        .replace(/\btoday\s+night\b/gi, (m: string) => matchCase("tonight", m))
        .replace(/\byesterday\s+night\b/gi, (m: string) => matchCase("last night", m));
      if (corrected === sentence) return null;
      return { corrected };
    },
  },
  {
    id: "myself-intro",
    category: "hindi-translation",
    explanation: "“Myself Rahul” is a direct translation. Say “I am Rahul” or “My name is Rahul”.",
    apply(sentence) {
      const m = sentence.match(/^(\s*(?:hi|hello|good\s+(?:morning|afternoon|evening))?[,!.\s]*)myself\s+(?:is\s+)?([A-Za-z]+)/i);
      if (!m) return null;
      const name = m[2];
      if (/^(also|too|only|am|feel|think|believe|have|was|will|can|and|i|the|a|very|not|alone|personally|do|did|want|like)$/i.test(name)) {
        return null;
      }
      const rest = sentence.slice(m[0].length);
      return {
        corrected: `${m[1]}I am ${name}${rest}`,
        alternative: `${m[1]}My name is ${name}${rest}`,
        explanation: `“Myself ${name}” is a direct translation. Say “I am ${name}” or “My name is ${name}”.`,
      };
    },
  },
  {
    id: "explain-me",
    category: "prepositions",
    explanation: "We explain something to someone: “explain to me”.",
    apply(sentence) {
      const corrected = sentence
        .replace(/\b(explain(?:ed|s|ing)?)\s+(me|him|her|us|them)\b/gi, "$1 to $2")
        .replace(/\bmarried\s+with\b/gi, "married to")
        .replace(/\b(angry|upset)\s+on\s+(me|him|her|us|them|my|his)\b/gi, "$1 with $2");
      if (corrected === sentence) return null;
      let explanation = "We explain something to someone: “explain to me”.";
      if (/married\s+with/i.test(sentence)) explanation = "In English we say “married to” someone.";
      else if (/(angry|upset)\s+on/i.test(sentence)) explanation = "In English we are “angry with” someone, not “angry on”.";
      return { corrected, explanation };
    },
  },
  {
    id: "can-able-to",
    category: "verb-forms",
    explanation: "Use “can” or “be able to”, not both together.",
    apply(sentence) {
      const re = /\b(can|could)\s+(?:be\s+)?able\s+to\b/i;
      const m = sentence.match(re);
      if (!m) return null;
      return {
        corrected: sentence.replace(re, "$1"),
        alternative: m[1].toLowerCase() === "can" ? sentence.replace(re, "will be able to") : undefined,
      };
    },
  },
  {
    id: "be-agree",
    category: "verb-forms",
    explanation: "“Agree” is a verb, so it doesn't need am / is / are.",
    apply(sentence) {
      const re = /\b(I|we|you|they|he|she)(?:\s+(?:am|are|is)|'m|'re|'s)\s+(agree|disagree)\b/i;
      const m = sentence.match(re);
      if (!m) return null;
      const verb = /^(he|she)$/i.test(m[1]) ? `${m[2]}s` : m[2];
      return { corrected: sentence.replace(re, `${m[1]} ${verb}`) };
    },
  },
  {
    id: "question-word-order",
    category: "question-form",
    explanation: "In a direct question, put the helping verb before the subject.",
    apply(sentence) {
      if (!sentence.trim().endsWith("?")) return null;
      const re = /^(\s*)(what|where|why|how|when|which|who)\s+(you|he|she|they|we|it|I)\s+(are|is|am|were|was|can|will|have|has|should|would|could)\b/i;
      const m = sentence.match(re);
      if (!m) return null;
      return {
        corrected: sentence.replace(re, (_x, sp: string, wh: string, subj: string, aux: string) => `${sp}${wh} ${aux.toLowerCase()} ${subj}`),
        explanation: `In a direct question, say “${m[2]} ${m[4].toLowerCase()} ${m[3]}…?”, not “${m[2]} ${m[3]} ${m[4]}…?”.`,
      };
    },
  },
  {
    id: "missing-article-job",
    category: "articles",
    explanation: "Use “a / an” before a single job or role.",
    apply(sentence) {
      const re = /\b(I am|I'm|he is|he's|she is|she's|working as|work as|worked as|joined as)\s+(?!a\b|an\b|the\b|my\b|your\b|his\b|her\b|our\b)((?:(?:software|web|data|mechanical|civil|electrical|full[- ]stack|front[- ]end|back[- ]end|frontend|backend|java|python|android|ios|ml|ai|junior|senior|qa|test|business|engineering|final[- ]year|college|team|computer|science|it|hr|sales|marketing|product|project)\s+)*)(engineer|developer|student|teacher|doctor|manager|designer|tester|analyst|programmer|consultant|fresher|intern|lead|architect)\b/i;
      const m = sentence.match(re);
      if (!m) return null;
      const first = (m[2].trim() || m[3]).split(/\s+/)[0];
      const art = article(first);
      return {
        corrected: sentence.replace(re, (_x, lead: string, pre: string, job: string) => `${lead} ${art} ${pre}${job}`),
        explanation: `Use “${art}” before a single job or role: “${m[1]} ${art} ${(m[2] + m[3]).trim()}”.`,
      };
    },
  },
];

export const RULE_IDS = RULES.map((r) => r.id);

/** Run all rules over the learner's text. Each hit quotes a real learner sentence. */
export function checkGrammar(text: string): RuleHit[] {
  const hits: RuleHit[] = [];
  for (const sentence of splitSentences(text)) {
    for (const rule of RULES) {
      const res = rule.apply(sentence);
      if (!res || res.corrected.trim() === sentence.trim()) continue;
      hits.push({
        ruleId: rule.id,
        category: rule.category,
        original: sentence,
        corrected: res.corrected,
        explanation: res.explanation ?? rule.explanation,
        alternative: res.alternative && res.alternative !== res.corrected ? res.alternative : undefined,
      });
    }
  }
  return hits;
}

// ── Improvement evidence ───────────────────────────────────────────────────

export interface CorrectUsage {
  category: MistakeCategory;
  sentence: string;
}

const EVIDENCE: { category: MistakeCategory; test(sentence: string): boolean }[] = [
  {
    category: "past-tense",
    test(s) {
      if (!PAST_TIME_RE.test(s) || FUTURE_OR_HABIT_RE.test(s)) return false;
      const m = s.match(/\b(I|we|you|they|he|she|it)\s+(?:also\s+|just\s+|then\s+|first\s+|finally\s+)?([A-Za-z']+)\b/i);
      if (!m) return false;
      const w = m[2].toLowerCase();
      return PAST_VALUES.has(w) || /^(was|were|had|didn't)$/.test(w);
    },
  },
  {
    category: "present-perfect",
    test: (s) => /\b(have|has|'ve)\s+(been\s+\w+ing|been|known|worked|lived|studied|used)\b.*\b(for|since)\b/i.test(s),
  },
  {
    category: "redundant-words",
    test: (s) => /\bdiscuss(?:ed|es|ing)?\s+(?!about\b)(the|my|our|this|that|it|a|an|your|his|her|their|these|those)\b/i.test(s),
  },
  {
    category: "uncountable-nouns",
    // "software" is left out: "software engineer" is not an uncountable-noun use.
    test: (s) => /\b(information|advice|feedback|equipment|furniture|knowledge|luggage|homework)\b/i.test(s),
  },
  {
    category: "subject-verb-agreement",
    test: (s) => /\b(he|she|it)\s+(doesn't|does not|has)\b/i.test(s),
  },
  {
    category: "stative-verbs",
    test: (s) =>
      /\b(I|we|they)\s+have\s+(?:(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|a|an)\s+)?(?:\w+\s+)?(years?|experience|knowledge)\b/i.test(s) ||
      /\b(I|we|they)\s+don't\s+understand\b/i.test(s),
  },
  {
    category: "hindi-translation",
    test: (s) => /\b(this morning|this evening|last night|tonight|my name is)\b/i.test(s),
  },
  {
    category: "articles",
    test: (s) =>
      /\b(I am|I'm|working as|work as|worked as)\s+(a|an)\s+(?:\w+\s+){0,3}(engineer|developer|student|teacher|doctor|manager|designer|tester|analyst|programmer|consultant|fresher|intern|lead|architect)\b/i.test(s),
  },
  {
    category: "verb-forms",
    test: (s) => {
      const m = s.match(/\b(?:did|didn't|did not|does|doesn't|does not)\s+([A-Za-z]+)\b/i);
      return Boolean(m && m[1].toLowerCase() in PAST_FORMS);
    },
  },
];

/**
 * Sentences where the learner used a tracked structure correctly. A sentence
 * that also triggered a rule in the same category never counts as evidence.
 */
export function detectCorrectUsage(text: string): CorrectUsage[] {
  const out: CorrectUsage[] = [];
  for (const sentence of splitSentences(text)) {
    const wrong = new Set(checkGrammar(sentence).map((h) => h.category));
    for (const e of EVIDENCE) {
      if (!wrong.has(e.category) && e.test(sentence)) out.push({ category: e.category, sentence });
    }
  }
  return out;
}
