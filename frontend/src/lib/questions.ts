// Starter questions (grouped by topic for the sidebar) and a follow-up pool.
// Wording is chosen to land on the runtime's keyword intents
// (project / skills / resume / jd_match / architecture).

export type TopicId = "projects" | "skills" | "experience" | "jd_match";

export interface Topic {
  id: TopicId;
  label: string;
  questions: string[];
}

export const TOPICS: Topic[] = [
  {
    id: "projects",
    label: "Projects",
    questions: [
      "Walk me through your most complex project",
      "What systems have you built?",
      "Explain your RAG platform architecture",
    ],
  },
  {
    id: "skills",
    label: "Skills",
    questions: [
      "What's your tech stack?",
      "How deep is your LangGraph experience?",
      "Which tools do you work with daily?",
    ],
  },
  {
    id: "experience",
    label: "Experience",
    questions: [
      "Tell me about yourself",
      "Walk me through your work history",
      "What's your engineering background?",
    ],
  },
  {
    id: "jd_match",
    label: "Job fit",
    questions: [
      "Are you a fit for a Senior AI Engineer role?",
      "What kind of roles are you targeting?",
      "Paste a job description to check the fit",
    ],
  },
];

// A flat, de-duplicated set of the strongest openers — used for the Hero example
// chips and the mobile empty-state suggestions.
export const FEATURED_QUESTIONS: string[] = [
  "Tell me about yourself",
  "Walk me through your most complex project",
  "What's your tech stack?",
];

// Contextual-ish next questions surfaced under each answer. Client-side for now;
// a backend follow-up generator can replace this later without touching the UI.
export const FOLLOWUP_POOL: string[] = [
  "What was the hardest technical challenge?",
  "How did you handle scaling?",
  "Which technologies did you choose, and why?",
  "What measurable impact did that have?",
  "How do you approach system design?",
  "What's your experience with production reliability?",
  "What are you most proud of building?",
  "How do you keep AI systems from hallucinating?",
];

// Pick up to `count` follow-ups that haven't already been asked this session.
export function pickFollowUps(asked: Set<string>, count = 3): string[] {
  const fresh = FOLLOWUP_POOL.filter((q) => !asked.has(q.toLowerCase()));
  const pool = fresh.length >= count ? fresh : FOLLOWUP_POOL;
  return pool.slice(0, count);
}
