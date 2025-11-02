import { StartScreenPrompt } from "@openai/chatkit";

export const WORKFLOW_ID = process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_ID?.trim() ?? "";

export const CREATE_SESSION_ENDPOINT = "/api/create-session";

export const CLAUDE_SKILLS_ENDPOINT = "/api/claude-skills";

export const CLAUDE_SKILL_TOOL_NAMES = {
  list: "list_claude_skills",
  load: "load_claude_skill",
} as const;

export type ClaudeSkillToolName =
  (typeof CLAUDE_SKILL_TOOL_NAMES)[keyof typeof CLAUDE_SKILL_TOOL_NAMES];

export const STARTER_PROMPTS: StartScreenPrompt[] = [
  {
    label: "What can you do?",
    prompt: "What can you do?",
    icon: "circle-question",
  },
];

export const PLACEHOLDER_INPUT = "Ask anything...";

export const GREETING = "How can I help you today?";
