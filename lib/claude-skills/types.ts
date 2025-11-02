export type ClaudeSkillPrimitive = string | number | boolean;

export type ClaudeSkillArgumentType = "string" | "number" | "boolean";

export interface ClaudeSkillArgumentSchema {
  readonly type: ClaudeSkillArgumentType;
  readonly description: string;
  readonly required?: boolean;
  readonly default?: ClaudeSkillPrimitive;
  readonly enum?: readonly ClaudeSkillPrimitive[];
  readonly minimum?: number;
  readonly maximum?: number;
  readonly pattern?: string;
}

export interface ClaudeSkillExample {
  readonly description?: string;
  readonly arguments?: Record<string, ClaudeSkillPrimitive>;
  readonly responseSummary?: string;
}

export interface ClaudeSkillDefinition {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly instructions: string;
  readonly arguments?: Readonly<Record<string, ClaudeSkillArgumentSchema>>;
  readonly examples?: readonly ClaudeSkillExample[];
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly version?: string;
  readonly sourcePath?: string;
}

export interface ClaudeSkillSummary {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly version?: string;
}

export type RawClaudeSkillInstructions =
  | string
  | readonly string[]
  | { readonly format: "markdown" | "text"; readonly body: string };

export interface RawClaudeSkillDefinition {
  readonly slug?: string;
  readonly title?: string;
  readonly description?: string;
  readonly instructions?: RawClaudeSkillInstructions;
  readonly arguments?: Record<string, unknown>;
  readonly examples?: unknown;
  readonly metadata?: Record<string, unknown>;
  readonly version?: string;
}
