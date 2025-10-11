"use client";

import { ChangeEvent, FormEvent, useCallback, useMemo, useState } from "react";
import { ResultTable, type TableField } from "@/app/components/ResultTable";

type SqlResult = {
  fields: TableField[];
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  truncated?: boolean;
};

type CatalogEntry = {
  table_name: string;
  columns: string;
  rows: number;
};

type IngestResponse = {
  ok: boolean;
  tables: CatalogEntry[];
  error?: string;
};

type SqlResponse = {
  ok?: boolean;
  fields?: Array<{ name: string; type?: string | null }>;
  rows?: Array<Record<string, unknown>>;
  rowCount?: number;
  truncated?: boolean;
  error?: string;
  details?: string;
};

const DEFAULT_SQL = "SELECT * FROM \"_catalog\" ORDER BY table_name LIMIT 50;";

export default function DataPage(): JSX.Element {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [catalogResult, setCatalogResult] = useState<SqlResult | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [manualSql, setManualSql] = useState(DEFAULT_SQL);
  const [manualResult, setManualResult] = useState<SqlResult | null>(null);
  const [manualError, setManualError] = useState<string | null>(null);
  const [runningManualSql, setRunningManualSql] = useState(false);

  const uploadTablesList = useMemo(() => {
    if (!catalogResult?.rows?.length) {
      return [] as CatalogEntry[];
    }
    return catalogResult.rows
      .map((row) => ({
        table_name: String(row.table_name ?? ""),
        columns: String(row.columns ?? ""),
        rows: Number(row.rows ?? 0),
      }))
      .filter((entry) => entry.table_name);
  }, [catalogResult]);

  const normalizeSqlResponse = useCallback((payload: SqlResponse): SqlResult => {
    return {
      fields: (payload.fields ?? []).map((field) => ({
        name: field.name,
        type: field.type ?? undefined,
      })),
      rows: payload.rows ?? [],
      rowCount: payload.rowCount ?? (payload.rows?.length ?? 0),
      truncated: payload.truncated ?? false,
    };
  }, []);

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    setUploadMessage(null);
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
  }, []);

  const handleUpload = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!selectedFile) {
        setUploadError("Choose a .zip file to upload.");
        return;
      }

      const formData = new FormData();
      formData.append("zip", selectedFile);

      setUploading(true);
      setUploadError(null);
      setUploadMessage("Uploading and processing... This may take a moment for large files.");

      try {
        const response = await fetch("/api/ingest", {
          method: "POST",
          body: formData,
        });

        const json = (await response.json().catch(() => ({}))) as IngestResponse;
        if (!response.ok || !json.ok) {
          const message = json.error ?? "Ingest failed.";
          throw new Error(message);
        }

        const catalog = normalizeSqlResponse({
          fields: [
            { name: "table_name" },
            { name: "columns" },
            { name: "rows" },
          ],
          rows: json.tables.map((entry) => ({
            table_name: entry.table_name,
            columns: entry.columns,
            rows: entry.rows,
          })),
          rowCount: json.tables.length,
          truncated: false,
        });

        setCatalogResult(catalog);
        setCatalogError(null);
        setManualResult(null);
        setManualError(null);
        setUploadMessage(`Loaded ${json.tables.length} table${json.tables.length === 1 ? "" : "s"}.`);
      } catch (error) {
        console.error("Failed to upload analytics zip", error);
        setUploadError(error instanceof Error ? error.message : "Unexpected upload error.");
      } finally {
        setUploading(false);
      }
    },
    [normalizeSqlResponse, selectedFile]
  );

  const handleRefreshCatalog = useCallback(async () => {
    setCatalogError(null);
    try {
      const response = await fetch("/api/sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: 'SELECT table_name, columns, rows FROM "_catalog" ORDER BY table_name' }),
      });
      const json = (await response.json().catch(() => ({}))) as SqlResponse;
      if (!response.ok || json.error) {
        throw new Error(json.error ?? "Failed to refresh catalog");
      }
      setCatalogResult(normalizeSqlResponse(json));
    } catch (error) {
      console.error("Refresh catalog failed", error);
      setCatalogError(error instanceof Error ? error.message : "Unable to refresh catalog.");
    }
  }, [normalizeSqlResponse]);

  const handleRunManualSql = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = manualSql.trim();
      if (!trimmed) {
        setManualError("Enter a query to run.");
        return;
      }

      setRunningManualSql(true);
      setManualError(null);

      try {
        const response = await fetch("/api/sql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sql: manualSql }),
        });
        const json = (await response.json().catch(() => ({}))) as SqlResponse;
        if (!response.ok || json.error) {
          throw new Error(json.error ?? json.details ?? "Query failed");
        }
        setManualResult(normalizeSqlResponse(json));
      } catch (error) {
        console.error("Manual SQL failed", error);
        setManualError(error instanceof Error ? error.message : "Unable to run query.");
      } finally {
        setRunningManualSql(false);
      }
    },
    [manualSql, normalizeSqlResponse]
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Analytics Data</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Upload a .zip of Excel workbooks, inspect the catalog, and run ad-hoc read-only SQL.
        </p>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Upload source files</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          All sheets will be imported as VARCHAR columns. Upload limit is roughly two million rows per ingest.
        </p>
        <form className="mt-4 flex flex-col gap-4" onSubmit={handleUpload}>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            Zip file (.zip)
            <input
              type="file"
              accept=".zip"
              onChange={handleFileChange}
              className="rounded border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            disabled={uploading || !selectedFile}
          >
            {uploading ? "Uploading..." : "Upload and ingest"}
          </button>
        </form>
        {uploadMessage && !uploadError ? (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{uploadMessage}</p>
        ) : null}
        {uploadError ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{uploadError}</p>
        ) : null}
        {uploadTablesList.length ? (
          <div className="mt-4 text-sm text-slate-700 dark:text-slate-200">
            <p className="font-medium">Tables</p>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {uploadTablesList.map((table) => (
                <li key={table.table_name} className="rounded border border-slate-200 px-3 py-2 dark:border-slate-700">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{table.table_name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{table.rows.toLocaleString()} rows</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{table.columns}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Catalog</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">Snapshot of ingested tables and column lists.</p>
          </div>
          <button
            type="button"
            onClick={handleRefreshCatalog}
            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Refresh catalog
          </button>
        </div>
        {catalogError ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{catalogError}</p>
        ) : null}
        {catalogResult ? (
          <div className="mt-4">
            <ResultTable
              fields={catalogResult.fields}
              rows={catalogResult.rows}
              truncated={catalogResult.truncated}
              caption={catalogResult.rowCount ? `${catalogResult.rowCount} tables` : undefined}
              emptyMessage="No tables ingested yet."
            />
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">Upload data to populate the catalog.</p>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Run SQL</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Use this for quick read-only checks. Queries are limited to 50k rows and a 10 second timeout.
        </p>
        <form className="mt-4 flex flex-col gap-4" onSubmit={handleRunManualSql}>
          <textarea
            value={manualSql}
            onChange={(event) => setManualSql(event.target.value)}
            rows={5}
            className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            placeholder={'SELECT * FROM "_catalog" LIMIT 10;'}
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            disabled={runningManualSql}
          >
            {runningManualSql ? "Running..." : "Run query"}
          </button>
        </form>
        {manualError ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{manualError}</p>
        ) : null}
        {manualResult ? (
          <div className="mt-4">
            <ResultTable
              fields={manualResult.fields}
              rows={manualResult.rows}
              truncated={manualResult.truncated}
              caption={`${manualResult.rowCount.toLocaleString()} row${manualResult.rowCount === 1 ? "" : "s"}`}
            />
          </div>
        ) : null}
      </section>
    </main>
  );
}
