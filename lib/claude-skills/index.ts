import { promises as fs } from "node:fs";
import path from "node:path";

import type {
  ClaudeSkillDefinition,
  ClaudeSkillSummary,
  RawClaudeSkillDefinition,
  RawClaudeSkillInstructions,
  ClaudeSkillArgumentSchema,
  ClaudeSkillPrimitive,
} from "./types";

const SKILLS_DIRECTORY = path.join(process.cwd(), "claude-skills");
const JSON_EXTENSIONS = new Set([".json"]);

export async function listClaudeSkillSummaries(): Promise<ClaudeSkillSummary[]> {
  const skills = await loadAllSkills();
  return skills.map(({ instructions: _instructions, sourcePath: _sourcePath, ...rest }) => rest);
}

export async function loadClaudeSkill(
  slug: string
): Promise<ClaudeSkillDefinition | null> {
  if (!slug) {
    return null;
  }

  const skills = await loadAllSkills();
  const normalizedSlug = slug.toLowerCase();
  return (
    skills.find((skill) => skill.slug.toLowerCase() === normalizedSlug) ?? null
  );
}

async function loadAllSkills(): Promise<ClaudeSkillDefinition[]> {
  const entries = await safeReadDir(SKILLS_DIRECTORY);
  if (entries.length === 0) {
    return [];
  }

  const skills: ClaudeSkillDefinition[] = [];
  await Promise.all(
    entries.map(async (entry) => {
      if (!entry.isFile()) {
        return;
      }

      const extension = path.extname(entry.name).toLowerCase();
      if (!JSON_EXTENSIONS.has(extension)) {
        return;
      }

      const fullPath = path.join(SKILLS_DIRECTORY, entry.name);
      try {
        const content = await fs.readFile(fullPath, "utf8");
        const parsed = JSON.parse(content) as RawClaudeSkillDefinition;
        const skill = normalizeSkillDefinition(parsed, fullPath);
        if (skill) {
          skills.push(skill);
        }
      } catch (error) {
        console.warn(
          `[claude-skills] Failed to read skill from ${fullPath}:`,
          error
        );
      }
    })
  );

  skills.sort((a, b) => a.title.localeCompare(b.title));
  return skills;
}

async function safeReadDir(
  dirPath: string
): Promise<import("node:fs").Dirent[]> {
  try {
    return await fs.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn(`[claude-skills] Unable to read directory ${dirPath}:`, error);
    }
    return [];
  }
}

function normalizeSkillDefinition(
  raw: RawClaudeSkillDefinition,
  sourcePath: string
): ClaudeSkillDefinition | null {
  const slug = normalizeSlug(raw, sourcePath);
  const title = normalizeTitle(raw, slug);
  const description = typeof raw.description === "string" ? raw.description.trim() : "";
  const instructions = normalizeInstructions(raw.instructions);
  const argumentSchemas = normalizeArguments(raw.arguments);
  const examples = Array.isArray(raw.examples)
    ? raw.examples.filter(
        (entry): entry is NonNullable<ClaudeSkillDefinition["examples"]>[number] => {
          if (!entry || typeof entry !== "object") {
            return false;
          }
          const typed = entry as Record<string, unknown>;
          if (
            typed.description !== undefined &&
            typeof typed.description !== "string"
          ) {
            return false;
          }
          if (
            typed.arguments !== undefined &&
            (typeof typed.arguments !== "object" ||
              typed.arguments === null ||
              Array.isArray(typed.arguments))
          ) {
            return false;
          }
          if (
            typed.responseSummary !== undefined &&
            typeof typed.responseSummary !== "string"
          ) {
            return false;
          }
          return true;
        }
      )
    : undefined;

  if (!slug || !title || !description || !instructions) {
    return null;
  }

  return {
    slug,
    title,
    description,
    instructions,
    arguments: argumentSchemas,
    metadata: raw.metadata,
    version: raw.version,
    examples,
    sourcePath,
  };
}

function normalizeSlug(
  raw: RawClaudeSkillDefinition,
  sourcePath: string
): string {
  if (typeof raw.slug === "string" && raw.slug.trim()) {
    return raw.slug.trim();
  }

  const basename = path.basename(sourcePath);
  const withoutExt = basename.replace(path.extname(basename), "");
  return withoutExt.replace(/\s+/g, "-").toLowerCase();
}

function normalizeTitle(raw: RawClaudeSkillDefinition, slug: string): string {
  if (typeof raw.title === "string" && raw.title.trim()) {
    return raw.title.trim();
  }
  return slug
    .split(/[-_]/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeInstructions(
  instructions: RawClaudeSkillInstructions | undefined
): string {
  if (!instructions) {
    return "";
  }
  if (typeof instructions === "string") {
    return instructions.trim();
  }
  if (Array.isArray(instructions)) {
    return instructions.map((line) => String(line ?? "").trim()).join("\n");
  }
  if (typeof instructions === "object" && instructions.body) {
    return String(instructions.body).trim();
  }
  return "";
}

function normalizeArguments(
  raw: Record<string, unknown> | undefined
): Record<string, ClaudeSkillArgumentSchema> | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const result: Record<string, ClaudeSkillArgumentSchema> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      continue;
    }
    const schema = value as Record<string, unknown>;
    const type = schema.type;
    if (type !== "string" && type !== "number" && type !== "boolean") {
      continue;
    }
    const description =
      typeof schema.description === "string" ? schema.description.trim() : "";
    if (!description) {
      continue;
    }
    const normalized: ClaudeSkillArgumentSchema = {
      type,
      description,
    };
    if (typeof schema.required === "boolean") {
      normalized.required = schema.required;
    }
    if (schema.default !== undefined && isPrimitive(schema.default)) {
      normalized.default = schema.default as ClaudeSkillPrimitive;
    }
    if (Array.isArray(schema.enum) && schema.enum.every(isPrimitive)) {
      normalized.enum = schema.enum as ClaudeSkillPrimitive[];
    }
    if (typeof schema.minimum === "number") {
      normalized.minimum = schema.minimum;
    }
    if (typeof schema.maximum === "number") {
      normalized.maximum = schema.maximum;
    }
    if (typeof schema.pattern === "string" && schema.pattern) {
      normalized.pattern = schema.pattern;
    }
    result[key] = normalized;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function isPrimitive(value: unknown): value is ClaudeSkillPrimitive {
  return (
    typeof value === "string" ||
    (typeof value === "number" && Number.isFinite(value)) ||
    typeof value === "boolean"
  );
}
