"use client";

import { memo } from "react";

export type TableField = {
  name: string;
  type?: string | null;
};

export type ResultTableProps = {
  fields: TableField[];
  rows: Array<Record<string, unknown>>;
  caption?: string;
  truncated?: boolean;
  emptyMessage?: string;
};

function formatValue(value: unknown): string {
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
}

const ResultTableComponent = ({
  fields,
  rows,
  caption,
  truncated,
  emptyMessage = "No rows returned.",
}: ResultTableProps) => {
  if (!rows.length) {
    return (
      <div className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        {caption && <p className="mb-1 font-medium text-slate-800 dark:text-slate-100">{caption}</p>}
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {caption && (
        <div className="border-b border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 dark:border-slate-800 dark:text-slate-100">
          {caption}
        </div>
      )}
      <div className="max-h-96 overflow-auto">
        <table className="min-w-full border-collapse text-left text-sm text-slate-700 dark:text-slate-200">
          <thead className="sticky top-0 bg-slate-100 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <tr>
              {fields.map((field) => (
                <th key={field.name} className="border-b border-slate-200 px-3 py-2 font-semibold dark:border-slate-700">
                  <div className="flex flex-col">
                    <span>{field.name}</span>
                    {field.type ? (
                      <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500">{field.type}</span>
                    ) : null}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={rowIndex % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50 dark:bg-slate-950"}
              >
                {fields.map((field) => (
                  <td key={field.name} className="border-b border-slate-100 px-3 py-2 align-top font-normal dark:border-slate-800">
                    <span className="whitespace-pre-wrap break-words">{formatValue(row[field.name])}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {truncated ? (
        <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          Showing first {MAX_ROWS.toLocaleString()} rows.
        </div>
      ) : null}
    </div>
  );
};

const MAX_ROWS = 50_000;

export const ResultTable = memo(ResultTableComponent);
