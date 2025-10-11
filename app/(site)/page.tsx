"use client";

import { useEffect, useRef } from "react";
import App from "../App";

type SqlApiResponse = {
  ok?: boolean;
  fields?: Array<{ name: string; type?: string | null }>;
  rows?: Array<Record<string, unknown>>;
  rowCount?: number;
  truncated?: boolean;
  error?: string;
  details?: string;
};

type VegaLiteSpec = Record<string, unknown>;

type VegaEmbedModule = typeof import("vega-embed");

type CleanupFn = () => void;

type SqlResult = {
  fields: Array<{ name: string; type?: string | null }>;
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  truncated: boolean;
};

export default function ChatPage(): JSX.Element {
  const vegaModuleRef = useRef<Promise<VegaEmbedModule> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let disposed = false;
    let hostObserver: MutationObserver | null = null;
    let contentObserver: MutationObserver | null = null;
    const cleanupFns: CleanupFn[] = [];
    const vegaDisposers = new Map<HTMLElement, CleanupFn>();

    const ensureVegaModule = () => {
      if (!vegaModuleRef.current) {
        vegaModuleRef.current = import("vega-embed");
      }
      return vegaModuleRef.current;
    };

    const cleanupAll = () => {
      cleanupFns.splice(0).forEach((fn) => {
        try {
          fn();
        } catch (error) {
          console.warn("Failed to run cleanup", error);
        }
      });
      vegaDisposers.forEach((dispose) => {
        try {
          dispose();
        } catch (error) {
          console.warn("Failed to dispose vega view", error);
        }
      });
      vegaDisposers.clear();
      contentObserver?.disconnect();
      hostObserver?.disconnect();
    };

    const formatValue = (value: unknown): string => {
      if (value === null || value === undefined) {
        return "";
      }
      if (typeof value === "string") {
        return value;
      }
      if (typeof value === "number" || typeof value === "bigint") {
        return String(value);
      }
      if (typeof value === "boolean") {
        return value ? "true" : "false";
      }
      if (value instanceof Date) {
        return value.toISOString();
      }
      if (Array.isArray(value)) {
        return value.map(formatValue).join(", ");
      }
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    };

    const applyContainerStyles = (container: HTMLElement) => {
      container.style.marginTop = "12px";
      container.style.border = "1px solid var(--ck-color-border, #e2e8f0)";
      container.style.borderRadius = "10px";
      container.style.padding = "10px";
      container.style.background = "var(--ck-color-surface, #ffffff)";
      container.style.fontFamily =
        'var(--ck-font-family-sans, "Inter", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)';
      container.style.fontSize = "12px";
      container.style.color = "var(--ck-color-text, #111827)";
      container.style.lineHeight = "1.4";
      container.style.overflowX = "auto";
      container.style.boxSizing = "border-box";
    };

    const ensureExtensionContainer = (codeEl: HTMLElement): HTMLElement | null => {
      const pre = codeEl.closest("pre") ?? codeEl.parentElement;
      if (!pre || !pre.parentElement) {
        return null;
      }
      const sibling = pre.nextElementSibling;
      if (sibling instanceof HTMLElement && sibling.dataset.analyticsExtension === "true") {
        applyContainerStyles(sibling);
        return sibling;
      }
      const container = document.createElement("div");
      container.dataset.analyticsExtension = "true";
      applyContainerStyles(container);
      pre.insertAdjacentElement("afterend", container);
      return container;
    };

    const detectLanguage = (element: HTMLElement): "sql" | "vega-lite" | null => {
      const dataLanguage = element.getAttribute("data-language") ?? element.getAttribute("data-lang") ?? "";
      const className = element.className ?? "";
      const combined = `${dataLanguage} ${className}`.toLowerCase();
      if (combined.includes("sql")) {
        return "sql";
      }
      if (combined.includes("vega-lite") || combined.includes("vegalite")) {
        return "vega-lite";
      }
      return null;
    };

    const renderSqlResult = (container: HTMLElement, result: SqlResult) => {
      container.replaceChildren();

      const summary = document.createElement("div");
      summary.textContent = `Rows: ${result.rowCount.toLocaleString()}${
        result.truncated ? " (showing first 50,000)" : ""
      }`;
      summary.style.fontWeight = "600";
      summary.style.fontSize = "12px";
      summary.style.marginBottom = "6px";
      summary.style.color = "var(--ck-color-text-secondary, #475569)";
      container.append(summary);

      const table = document.createElement("table");
      table.style.width = "100%";
      table.style.borderCollapse = "collapse";
      table.style.fontSize = "12px";
      table.style.boxSizing = "border-box";

      const thead = document.createElement("thead");
      thead.style.position = "sticky";
      thead.style.top = "0";
      thead.style.background = "var(--ck-color-surface-strong, #f8fafc)";

      const headerRow = document.createElement("tr");
      result.fields.forEach((field) => {
        const th = document.createElement("th");
        th.textContent = field.name;
        th.style.textAlign = "left";
        th.style.padding = "4px 6px";
        th.style.borderBottom = "1px solid var(--ck-color-border, #e2e8f0)";
        th.style.fontWeight = "600";
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = document.createElement("tbody");
      result.rows.forEach((row, index) => {
        const tr = document.createElement("tr");
        if (index % 2 === 1) {
          tr.style.background = "var(--ck-color-surface-muted, rgba(148, 163, 184, 0.16))";
        }
        result.fields.forEach((field) => {
          const td = document.createElement("td");
          td.textContent = formatValue(row[field.name]);
          td.style.padding = "4px 6px";
          td.style.borderBottom = "1px solid var(--ck-color-border-muted, rgba(148, 163, 184, 0.35))";
          td.style.verticalAlign = "top";
          td.style.whiteSpace = "pre-wrap";
          td.style.wordBreak = "break-word";
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });

      table.appendChild(tbody);
      container.appendChild(table);

      if (result.truncated) {
        const note = document.createElement("div");
        note.textContent = "Results truncated at 50,000 rows. Add a LIMIT for smaller responses.";
        note.style.marginTop = "6px";
        note.style.fontSize = "11px";
        note.style.color = "var(--ck-color-text-secondary, #475569)";
        container.appendChild(note);
      }
    };

    const handleSqlBlock = async (codeEl: HTMLElement) => {
      const container = ensureExtensionContainer(codeEl);
      if (!container) {
        return;
      }
      container.textContent = "Running SQL query...";
      container.style.color = "var(--ck-color-text-secondary, #475569)";

      const sql = (codeEl.textContent ?? "").trim();
      if (!sql) {
        container.textContent = "SQL block is empty.";
        return;
      }

      try {
        const response = await fetch("/api/sql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sql }),
        });
        const json = (await response.json().catch(() => ({}))) as SqlApiResponse;
        if (!response.ok || json.error) {
          const message = json.error ?? json.details ?? "Query failed";
          container.textContent = message;
          container.style.color = "#dc2626";
          return;
        }

        const result: SqlResult = {
          fields: (json.fields ?? []).map((field) => ({ name: field.name, type: field.type ?? undefined })),
          rows: json.rows ?? [],
          rowCount: json.rowCount ?? (json.rows?.length ?? 0),
          truncated: json.truncated ?? false,
        };
        renderSqlResult(container, result);
      } catch (error) {
        console.error("Failed to execute SQL block", error);
        container.textContent = error instanceof Error ? error.message : "Failed to run query.";
        container.style.color = "#dc2626";
      }
    };

    const handleVegaLiteBlock = async (codeEl: HTMLElement) => {
      const container = ensureExtensionContainer(codeEl);
      if (!container) {
        return;
      }
      container.textContent = "Rendering chart...";
      container.style.color = "var(--ck-color-text-secondary, #475569)";

      const text = (codeEl.textContent ?? "").trim();
      if (!text) {
        container.textContent = "Vega-Lite block is empty.";
        return;
      }

      try {
        const spec = JSON.parse(text) as VegaLiteSpec;
        const embed = (await ensureVegaModule()).default;
        vegaDisposers.get(container)?.();
        const result = await embed(container, spec, { actions: false });
        vegaDisposers.set(container, () => {
          result.view?.finalize?.();
        });
      } catch (error) {
        console.error("Failed to render Vega-Lite block", error);
        container.textContent = error instanceof Error ? error.message : "Unable to render Vega-Lite spec.";
        container.style.color = "#dc2626";
      }
    };

    const processCodeBlock = (codeEl: HTMLElement) => {
      if (codeEl.dataset.analyticsProcessed === "true") {
        return;
      }
      const language = detectLanguage(codeEl);
      if (!language) {
        return;
      }
      codeEl.dataset.analyticsProcessed = "true";
      if (language === "sql") {
        void handleSqlBlock(codeEl);
      } else if (language === "vega-lite") {
        void handleVegaLiteBlock(codeEl);
      }
    };

    const scanNode = (node: ParentNode | null) => {
      if (!node) {
        return;
      }
      const elements: HTMLElement[] = [];
      if (node instanceof HTMLElement || node instanceof DocumentFragment) {
        const selector = "pre code, code[data-language], code[data-lang]";
        const matches = (node as Element).querySelectorAll?.(selector) ?? [];
        matches.forEach((match) => {
          if (match instanceof HTMLElement) {
            elements.push(match);
          }
        });
      }
      elements.forEach(processCodeBlock);
    };

    const attachToChatKit = (element: HTMLElement) => {
      if (disposed) {
        return;
      }
      const targetRoot: ParentNode | null = element.shadowRoot ?? element;
      if (!targetRoot) {
        return;
      }

      scanNode(targetRoot);

      contentObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement || node instanceof DocumentFragment) {
              scanNode(node as ParentNode);
            }
          });
        });
      });
      contentObserver.observe(targetRoot, { childList: true, subtree: true });
    };

    const existing = document.querySelector("openai-chatkit") as HTMLElement | null;
    if (existing) {
      attachToChatKit(existing);
    } else {
      hostObserver = new MutationObserver(() => {
        const found = document.querySelector("openai-chatkit") as HTMLElement | null;
        if (found) {
          hostObserver?.disconnect();
          attachToChatKit(found);
        }
      });
      if (document.body) {
        hostObserver.observe(document.body, { childList: true, subtree: true });
      }
    }

    cleanupFns.push(() => {
      vegaDisposers.forEach((dispose) => {
        try {
          dispose();
        } catch {
          /* noop */
        }
      });
      vegaDisposers.clear();
    });

    return () => {
      disposed = true;
      cleanupAll();
    };
  }, []);

  return <App />;
}
