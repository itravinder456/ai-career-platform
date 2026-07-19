// The typed-out greeting on first load is a local animation (no backend call) —
// everything else the chat says comes from the real runtime now.
//
// This is the one and only place the AI disclosure happens — deliberately, so it
// only needs saying once. Every response after this speaks in first person, as
// Ravinder (see services/runtime/app/prompts/career.py), not as a third-party
// assistant describing him.
export const GREETING_TEXT =
  "Hello 👋 I'm an AI trained on Ravinder's real experience, projects, and skills — ask me anything, as if you were talking to him directly. What would you like to know?";
