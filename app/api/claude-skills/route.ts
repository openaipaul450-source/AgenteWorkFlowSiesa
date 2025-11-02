import { NextResponse } from "next/server";

import {
  listClaudeSkillSummaries,
  loadClaudeSkill,
} from "@/lib/claude-skills";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");

  try {
    if (slug) {
      const skill = await loadClaudeSkill(slug);
      if (!skill) {
        return jsonResponse({ error: `Skill \"${slug}\" not found` }, 404);
      }
      return jsonResponse({ skill }, 200);
    }

    const skills = await listClaudeSkillSummaries();
    return jsonResponse({ skills }, 200);
  } catch (error) {
    console.error("[claude-skills] Failed to handle request", error);
    return jsonResponse({ error: "Failed to load Claude skills" }, 500);
  }
}

function jsonResponse(payload: unknown, status: number): Response {
  return new NextResponse(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "s-maxage=30",
    },
  });
}
