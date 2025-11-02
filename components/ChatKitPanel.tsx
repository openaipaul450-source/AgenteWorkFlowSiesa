"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatKit, useChatKit } from "@openai/chatkit-react";
import {
  STARTER_PROMPTS,
  PLACEHOLDER_INPUT,
  GREETING,
  CREATE_SESSION_ENDPOINT,
  WORKFLOW_ID,
  getThemeConfig,
} from "@/lib/config";
import type {
  ClaudeSkillDefinition,
  ClaudeSkillSummary,
  ClaudeSkillArgumentSchema,
  ClaudeSkillPrimitive,
} from "@/lib/claude-skills/types";
import { ErrorOverlay } from "./ErrorOverlay";
import type { ColorScheme } from "@/hooks/useColorScheme";

export type FactAction = {
  type: "save";
  factId: string;
  factText: string;
};

type ChatKitPanelProps = {
  theme: ColorScheme;
  onWidgetAction: (action: FactAction) => Promise<void>;
  onResponseEnd: () => void;
  onThemeRequest: (scheme: ColorScheme) => void;
};

type ErrorState = {
  script: string | null;
  session: string | null;
  integration: string | null;
  retryable: boolean;
};

type ClaudeSkillsListResponse = {
  skills?: ClaudeSkillSummary[];
};

type ClaudeSkillDetailResponse = {
  skill?: ClaudeSkillDefinition;
};

const isBrowser = typeof window !== "undefined";
const isDev = process.env.NODE_ENV !== "production";

const createInitialErrors = (): ErrorState => ({
  script: null,
  session: null,
  integration: null,
  retryable: false,
});

export function ChatKitPanel({
  theme,
  onWidgetAction,
  onResponseEnd,
  onThemeRequest,
}: ChatKitPanelProps) {
  const processedFacts = useRef(new Set<string>());
  const claudeSkillsCache = useRef<{
    summaries: ClaudeSkillSummary[] | null;
    details: Map<string, ClaudeSkillDefinition>;
  }>({ summaries: null, details: new Map() });
  const [errors, setErrors] = useState<ErrorState>(() => createInitialErrors());
  const [isInitializingSession, setIsInitializingSession] = useState(true);
  const isMountedRef = useRef(true);
  const [scriptStatus, setScriptStatus] = useState<
    "pending" | "ready" | "error"
  >(() =>
    isBrowser && window.customElements?.get("openai-chatkit")
      ? "ready"
      : "pending"
  );
  const [widgetInstanceKey, setWidgetInstanceKey] = useState(0);

  const setErrorState = useCallback((updates: Partial<ErrorState>) => {
    setErrors((current) => ({ ...current, ...updates }));
  }, []);

  const fetchClaudeSkillSummaries = useCallback(async () => {
    if (claudeSkillsCache.current.summaries) {
      return claudeSkillsCache.current.summaries;
    }

    const response = await fetch(CLAUDE_SKILLS_ENDPOINT, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to load Claude skills (status ${response.status})`
      );
    }

    const payload = await parseJsonResponse<ClaudeSkillsListResponse>(response);
    const summaries = Array.isArray(payload.skills) ? payload.skills : [];
    claudeSkillsCache.current.summaries = summaries;
    return summaries;
  }, []);

  const fetchClaudeSkillDetail = useCallback(
    async (slug: string) => {
      const trimmed = slug.trim();
      if (!trimmed) {
        throw new Error("Missing Claude skill slug");
      }

      const cached = claudeSkillsCache.current.details.get(trimmed);
      if (cached) {
        return cached;
      }

      const response = await fetch(
        `${CLAUDE_SKILLS_ENDPOINT}?slug=${encodeURIComponent(trimmed)}`,
        {
          headers: { Accept: "application/json" },
        }
      );

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(
          `Failed to load Claude skill (status ${response.status})`
        );
      }

      const payload = await parseJsonResponse<ClaudeSkillDetailResponse>(
        response
      );
      if (!payload.skill) {
        throw new Error("Malformed Claude skill response");
      }

      claudeSkillsCache.current.details.set(trimmed, payload.skill);
      return payload.skill;
    },
    []
  );

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isBrowser) {
      return;
    }

    let timeoutId: number | undefined;

    const handleLoaded = () => {
      if (!isMountedRef.current) {
        return;
      }
      setScriptStatus("ready");
      setErrorState({ script: null });
    };

    const handleError = (event: Event) => {
      console.error("Failed to load chatkit.js for some reason", event);
      if (!isMountedRef.current) {
        return;
      }
      setScriptStatus("error");
      const detail = (event as CustomEvent<unknown>)?.detail ?? "unknown error";
      setErrorState({ script: `Error: ${detail}`, retryable: false });
      setIsInitializingSession(false);
    };

    window.addEventListener("chatkit-script-loaded", handleLoaded);
    window.addEventListener(
      "chatkit-script-error",
      handleError as EventListener
    );

    if (window.customElements?.get("openai-chatkit")) {
      handleLoaded();
    } else if (scriptStatus === "pending") {
      timeoutId = window.setTimeout(() => {
        if (!window.customElements?.get("openai-chatkit")) {
          handleError(
            new CustomEvent("chatkit-script-error", {
              detail:
                "ChatKit web component is unavailable. Verify that the script URL is reachable.",
            })
          );
        }
      }, 5000);
    }

    return () => {
      window.removeEventListener("chatkit-script-loaded", handleLoaded);
      window.removeEventListener(
        "chatkit-script-error",
        handleError as EventListener
      );
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [scriptStatus, setErrorState]);

  const isWorkflowConfigured = Boolean(
    WORKFLOW_ID && !WORKFLOW_ID.startsWith("wf_replace")
  );

  useEffect(() => {
    if (!isWorkflowConfigured && isMountedRef.current) {
      setErrorState({
        session: "Set NEXT_PUBLIC_CHATKIT_WORKFLOW_ID in your .env.local file.",
        retryable: false,
      });
      setIsInitializingSession(false);
    }
  }, [isWorkflowConfigured, setErrorState]);

  const handleResetChat = useCallback(() => {
    processedFacts.current.clear();
    claudeSkillsCache.current.summaries = null;
    claudeSkillsCache.current.details.clear();
    if (isBrowser) {
      setScriptStatus(
        window.customElements?.get("openai-chatkit") ? "ready" : "pending"
      );
    }
    setIsInitializingSession(true);
    setErrors(createInitialErrors());
    setWidgetInstanceKey((prev) => prev + 1);
  }, []);

  const getClientSecret = useCallback(
    async (currentSecret: string | null) => {
      if (isDev) {
        console.info("[ChatKitPanel] getClientSecret invoked", {
          currentSecretPresent: Boolean(currentSecret),
          workflowId: WORKFLOW_ID,
          endpoint: CREATE_SESSION_ENDPOINT,
        });
      }

      if (!isWorkflowConfigured) {
        const detail =
          "Set NEXT_PUBLIC_CHATKIT_WORKFLOW_ID in your .env.local file.";
        if (isMountedRef.current) {
          setErrorState({ session: detail, retryable: false });
          setIsInitializingSession(false);
        }
        throw new Error(detail);
      }

      if (isMountedRef.current) {
        if (!currentSecret) {
          setIsInitializingSession(true);
        }
        setErrorState({ session: null, integration: null, retryable: false });
      }

      try {
        const response = await fetch(CREATE_SESSION_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            workflow: { id: WORKFLOW_ID },
            chatkit_configuration: {
              // enable attachments
              file_upload: {
                enabled: true,
              },
            },
          }),
        });

        const raw = await response.text();

        if (isDev) {
          console.info("[ChatKitPanel] createSession response", {
            status: response.status,
            ok: response.ok,
            bodyPreview: raw.slice(0, 1600),
          });
        }

        let data: Record<string, unknown> = {};
        if (raw) {
          try {
            data = JSON.parse(raw) as Record<string, unknown>;
          } catch (parseError) {
            console.error(
              "Failed to parse create-session response",
              parseError
            );
          }
        }

        if (!response.ok) {
          const detail = extractErrorDetail(data, response.statusText);
          console.error("Create session request failed", {
            status: response.status,
            body: data,
          });
          throw new Error(detail);
        }

        const clientSecret = data?.client_secret as string | undefined;
        if (!clientSecret) {
          throw new Error("Missing client secret in response");
        }

        if (isMountedRef.current) {
          setErrorState({ session: null, integration: null });
        }

        return clientSecret;
      } catch (error) {
        console.error("Failed to create ChatKit session", error);
        const detail =
          error instanceof Error
            ? error.message
            : "Unable to start ChatKit session.";
        if (isMountedRef.current) {
          setErrorState({ session: detail, retryable: false });
        }
        throw error instanceof Error ? error : new Error(detail);
      } finally {
        if (isMountedRef.current && !currentSecret) {
          setIsInitializingSession(false);
        }
      }
    },
    [isWorkflowConfigured, setErrorState]
  );

  const chatkit = useChatKit({
    api: { getClientSecret },
    theme: {
      colorScheme: theme,
      ...getThemeConfig(theme),
    },
    startScreen: {
      greeting: GREETING,
      prompts: STARTER_PROMPTS,
    },
    composer: {
      placeholder: PLACEHOLDER_INPUT,
      attachments: {
        // Enable attachments
        enabled: true,
      },
    },
    threadItemActions: {
      feedback: false,
    },
    onClientTool: async (invocation: {
      name: string;
      params: Record<string, unknown>;
    }) => {
      if (invocation.name === CLAUDE_SKILL_TOOL_NAMES.list) {
        try {
          const skills = await fetchClaudeSkillSummaries();
          if (isMountedRef.current) {
            setErrorState({ integration: null, retryable: false });
          }
          return { success: true, skills };
        } catch (error) {
          const detail =
            error instanceof Error
              ? error.message
              : "Unable to load Claude skills.";
          console.error("[ChatKitPanel] list_claude_skills failed", error);
          if (isMountedRef.current) {
            setErrorState({ integration: detail, retryable: false });
          }
          return { success: false, error: detail };
        }
      }

      if (invocation.name === CLAUDE_SKILL_TOOL_NAMES.load) {
        const slug = String(invocation.params.slug ?? "");
        try {
          const skill = await fetchClaudeSkillDetail(slug);
          if (!skill) {
            const detail = `Claude skill \"${slug}\" was not found.`;
            if (isMountedRef.current) {
              setErrorState({ integration: detail, retryable: false });
            }
            return { success: false, error: detail };
          }

          const validation = validateClaudeSkillArguments(
            skill,
            invocation.params.arguments
          );
          if (!validation.ok) {
            return { success: false, error: validation.error };
          }

          if (isMountedRef.current) {
            setErrorState({ integration: null, retryable: false });
          }

          return {
            success: true,
            skill,
            arguments: validation.arguments,
          };
        } catch (error) {
          const detail =
            error instanceof Error
              ? error.message
              : "Unable to load Claude skill.";
          console.error("[ChatKitPanel] load_claude_skill failed", error);
          if (isMountedRef.current) {
            setErrorState({ integration: detail, retryable: false });
          }
          return { success: false, error: detail };
        }
      }

      if (invocation.name === "switch_theme") {
        const requested = invocation.params.theme;
        if (requested === "light" || requested === "dark") {
          if (isDev) {
            console.debug("[ChatKitPanel] switch_theme", requested);
          }
          onThemeRequest(requested);
          return { success: true };
        }
        return { success: false };
      }

      if (invocation.name === "record_fact") {
        const id = String(invocation.params.fact_id ?? "");
        const text = String(invocation.params.fact_text ?? "");
        if (!id || processedFacts.current.has(id)) {
          return { success: true };
        }
        processedFacts.current.add(id);
        void onWidgetAction({
          type: "save",
          factId: id,
          factText: text.replace(/\s+/g, " ").trim(),
        });
        return { success: true };
      }

      return { success: false };
    },
    onResponseEnd: () => {
      onResponseEnd();
    },
    onResponseStart: () => {
      setErrorState({ integration: null, retryable: false });
    },
    onThreadChange: () => {
      processedFacts.current.clear();
    },
    onError: ({ error }: { error: unknown }) => {
      // Note that Chatkit UI handles errors for your users.
      // Thus, your app code doesn't need to display errors on UI.
      console.error("ChatKit error", error);
    },
  });

  const blockingError = errors.script ?? errors.session;
  const inlineIntegrationError =
    !blockingError && errors.integration ? errors.integration : null;

  if (isDev) {
    console.debug("[ChatKitPanel] render state", {
      isInitializingSession,
      hasControl: Boolean(chatkit.control),
      scriptStatus,
      hasError: Boolean(blockingError),
      workflowId: WORKFLOW_ID,
    });
  }

  return (
    <div className="relative pb-8 flex h-[90vh] w-full rounded-2xl flex-col overflow-hidden bg-white shadow-sm transition-colors dark:bg-slate-900">
      <ChatKit
        key={widgetInstanceKey}
        control={chatkit.control}
        className={
          blockingError || isInitializingSession
            ? "pointer-events-none opacity-0"
            : "block h-full w-full"
        }
      />
      <ErrorOverlay
        error={blockingError}
        fallbackMessage={
          blockingError || !isInitializingSession
            ? null
            : "Loading assistant session..."
        }
        onRetry={blockingError && errors.retryable ? handleResetChat : null}
        retryLabel="Restart chat"
      />
      {inlineIntegrationError ? (
        <div className="pointer-events-none absolute left-1/2 top-4 z-10 w-[min(90%,28rem)] -translate-x-1/2 rounded-lg border border-amber-200 bg-amber-50/95 px-4 py-3 text-sm font-medium text-amber-900 shadow-sm dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100" role="status" aria-live="polite">
          <div className="pointer-events-auto">{inlineIntegrationError}</div>
        </div>
      ) : null}
    </div>
  );
}

function extractErrorDetail(
  payload: Record<string, unknown> | undefined,
  fallback: string
): string {
  if (!payload) {
    return fallback;
  }

  const error = payload.error;
  if (typeof error === "string") {
    return error;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  const details = payload.details;
  if (typeof details === "string") {
    return details;
  }

  if (details && typeof details === "object" && "error" in details) {
    const nestedError = (details as { error?: unknown }).error;
    if (typeof nestedError === "string") {
      return nestedError;
    }
    if (
      nestedError &&
      typeof nestedError === "object" &&
      "message" in nestedError &&
      typeof (nestedError as { message?: unknown }).message === "string"
    ) {
      return (nestedError as { message: string }).message;
    }
  }

  if (typeof payload.message === "string") {
    return payload.message;
  }

  return fallback;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const raw = await response.text();
  if (!raw) {
    return {} as T;
  }
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new Error("Failed to parse Claude skills response");
  }
}

type SkillArgumentValidationResult =
  | { ok: true; arguments: Record<string, ClaudeSkillPrimitive> }
  | { ok: false; error: string };

function validateClaudeSkillArguments(
  skill: ClaudeSkillDefinition,
  raw: unknown
): SkillArgumentValidationResult {
  const schemas = skill.arguments;
  const providedObject =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null;

  if (!schemas || Object.keys(schemas).length === 0) {
    if (providedObject && Object.keys(providedObject).length > 0) {
      return { ok: false, error: "This skill does not accept arguments." };
    }
    return { ok: true, arguments: {} };
  }

  const provided = providedObject ?? {};

  const resolved: Record<string, ClaudeSkillPrimitive> = {};

  for (const [name, schema] of Object.entries(schemas)) {
    const hasExplicitValue = Object.prototype.hasOwnProperty.call(
      provided,
      name
    );
    const value = hasExplicitValue ? provided[name] : schema.default;

    if (value === undefined || value === null) {
      if (schema.required) {
        return { ok: false, error: `Missing required argument \"${name}\".` };
      }
      continue;
    }

    const normalized = coerceClaudeSkillValue(schema, value);
    if (normalized === undefined) {
      return {
        ok: false,
        error: `Argument \"${name}\" must be a ${schema.type}.`,
      };
    }

    if (schema.enum && !schema.enum.includes(normalized)) {
      return {
        ok: false,
        error: `Argument \"${name}\" must be one of: ${schema.enum
          .map(String)
          .join(", ")}.`,
      };
    }

    if (schema.type === "number" && typeof normalized === "number") {
      if (typeof schema.minimum === "number" && normalized < schema.minimum) {
        return {
          ok: false,
          error: `Argument \"${name}\" must be greater than or equal to ${schema.minimum}.`,
        };
      }
      if (typeof schema.maximum === "number" && normalized > schema.maximum) {
        return {
          ok: false,
          error: `Argument \"${name}\" must be less than or equal to ${schema.maximum}.`,
        };
      }
    }

    if (schema.type === "string" && typeof normalized === "string") {
      if (schema.pattern) {
        const regex = new RegExp(schema.pattern);
        if (!regex.test(normalized)) {
          return {
            ok: false,
            error: `Argument \"${name}\" must match pattern ${schema.pattern}.`,
          };
        }
      }
      if (schema.required && normalized.trim() === "") {
        return {
          ok: false,
          error: `Argument \"${name}\" cannot be empty.`,
        };
      }
    }

    resolved[name] = normalized;
  }

  for (const key of Object.keys(provided)) {
    if (!schemas[key]) {
      console.warn(
        `[ChatKitPanel] Ignoring unknown Claude skill argument: ${key}`
      );
    }
  }

  return { ok: true, arguments: resolved };
}

function coerceClaudeSkillValue(
  schema: ClaudeSkillArgumentSchema,
  value: unknown
): ClaudeSkillPrimitive | undefined {
  if (schema.type === "string") {
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    return undefined;
  }

  if (schema.type === "number") {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  }

  if (schema.type === "boolean") {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes", "y"].includes(normalized)) {
        return true;
      }
      if (["false", "0", "no", "n"].includes(normalized)) {
        return false;
      }
      return undefined;
    }
    if (typeof value === "number") {
      if (value === 1) {
        return true;
      }
      if (value === 0) {
        return false;
      }
      return undefined;
    }
    return undefined;
  }

  return undefined;
}
