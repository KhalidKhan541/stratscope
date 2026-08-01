"use client";

// Access & Grants — issue read-only partner credentials, revoke access, and review audited usage for invoicing.

import { useEffect, useState, type FormEvent } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://stratscope-api.khalidkhan.workers.dev";
const API_KEY_STORAGE_KEY = "stratscope_api_key";
const RATE_PER_ROW = 0.001;

interface AccessGrant {
  id: string;
  name: string;
  key_prefix: string;
  agent_ids?: string[];
  status: string;
  requests?: number;
  rows_read?: number;
  created_at: string;
}

interface GrantCredential {
  id: string;
  name: string;
  key_prefix: string;
  credential: string;
  agent_ids: string[];
  status: string;
  created_at: string;
}

interface GrantUsage {
  grant_id: string;
  name: string;
  requests: number;
  rows_read: number;
  agents_read: number;
  first_used: string | null;
  last_used: string | null;
  estimated_fee?: number | null;
}

interface ApiErrorBody {
  error?: { message?: string };
}

async function apiFetch<T>(path: string, apiKey: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    let message: string | undefined;
    try {
      const body = (await response.json()) as ApiErrorBody;
      message = body.error?.message;
    } catch {
      message = undefined;
    }
    throw new Error(message || `API error: ${response.status}`);
  }

  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#EF4444]">
      {message}
    </div>
  );
}

function SkeletonRows({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: 3 }).map((_, rowIndex) => (
        <tr key={rowIndex}>
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <td key={columnIndex} className="px-6 py-4">
              <div className="h-4 bg-[#F1F5F9] rounded animate-pulse w-24" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function IssueGrantForm({ apiKey, onGrantIssued }: { apiKey: string; onGrantIssued: () => void }) {
  const [name, setName] = useState("");
  const [agentIds, setAgentIds] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [granted, setGranted] = useState<GrantCredential | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ids = agentIds.split(/[\s,]+/).map((value) => value.trim()).filter(Boolean);
    if (!name.trim()) {
      setError("Enter a name for this partner.");
      return;
    }
    if (ids.length === 0) {
      setError("Enter at least one agent ID.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setGranted(null);
    setCopied(false);
    try {
      const credential = await apiFetch<GrantCredential>("/v1/access/grants", apiKey, {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), agent_ids: ids }),
      });
      setGranted(credential);
      setName("");
      setAgentIds("");
      onGrantIssued();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to issue grant");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopy() {
    if (!granted) return;
    try {
      await navigator.clipboard.writeText(granted.credential);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
      <h3 className="text-lg font-semibold text-[#0F172A] mb-1">Issue new grant</h3>
      <p className="text-sm text-[#475569] mb-6">Create a read-only credential a partner can use to query your agents.</p>

      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

      {granted && (
        <div className="mb-4 rounded-xl border-2 border-[#4F46E5] bg-[#4F46E5]/5 p-4">
          <p className="text-sm font-semibold text-[#0F172A] mb-2">Credential issued for {granted.name}</p>
          <div className="flex items-center gap-3">
            <code className="flex-1 px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm font-mono text-[#0F172A] break-all">
              {granted.credential}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 px-3 py-2 text-sm font-medium text-[#4F46E5] border border-[#4F46E5] rounded-lg hover:bg-[#4F46E5]/5 transition-colors"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-2 text-sm font-medium text-[#EF4444]">Save this credential — it is shown only once.</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        <div>
          <label htmlFor="grant-name" className="block text-sm font-medium text-[#475569] mb-1">Partner name</label>
          <input
            id="grant-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Magma"
            className="w-full px-4 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20 focus:border-[#4F46E5]"
          />
        </div>
        <div>
          <label htmlFor="grant-agent-ids" className="block text-sm font-medium text-[#475569] mb-1">Agent IDs</label>
          <textarea
            id="grant-agent-ids"
            value={agentIds}
            onChange={(event) => setAgentIds(event.target.value)}
            placeholder="agent_abc123, agent_def456&#10;agent_ghi789"
            rows={3}
            className="w-full px-4 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20 focus:border-[#4F46E5]"
          />
          <p className="mt-1 text-xs text-[#94A3B8]">Comma-separated or one per line.</p>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-[#4F46E5] text-white text-sm font-medium rounded-lg hover:bg-[#4338CA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Issuing..." : "Issue credential"}
        </button>
      </form>
    </div>
  );
}

function GrantList({
  apiKey,
  refreshSignal,
  onRevoked,
}: {
  apiKey: string;
  refreshSignal: number;
  onRevoked: () => void;
}) {
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    async function load() {
      try {
        const response = await apiFetch<{ data: AccessGrant[] }>("/v1/access/grants", apiKey);
        if (!cancelled) setGrants(response.data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load grants");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [apiKey, refreshSignal]);

  async function handleRevoke(grant: AccessGrant) {
    if (!window.confirm(`Revoke access for "${grant.name}"? Its credential (${grant.key_prefix}...) will stop working immediately.`)) return;
    setRevoking(grant.id);
    setError(null);
    try {
      await apiFetch<void>(`/v1/access/grants/${grant.id}`, apiKey, { method: "DELETE" });
      onRevoked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke grant");
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
      <div className="px-6 pt-6">
        <h3 className="text-lg font-semibold text-[#0F172A]">Active grants</h3>
        <p className="text-sm text-[#475569] mt-1">Credentials shared with partners for read-only agent access.</p>
      </div>
      {error && <div className="px-6 pt-4"><ErrorBanner message={error} /></div>}
      <div className="overflow-x-auto mt-4">
        <table className="w-full">
          <thead>
            <tr className="border-t border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <th className="text-left text-xs font-medium text-[#94A3B8] uppercase tracking-wider px-6 py-3">Grant</th>
              <th className="text-left text-xs font-medium text-[#94A3B8] uppercase tracking-wider px-6 py-3">Status</th>
              <th className="text-left text-xs font-medium text-[#94A3B8] uppercase tracking-wider px-6 py-3">Agents</th>
              <th className="text-left text-xs font-medium text-[#94A3B8] uppercase tracking-wider px-6 py-3">Requests</th>
              <th className="text-left text-xs font-medium text-[#94A3B8] uppercase tracking-wider px-6 py-3">Rows read</th>
              <th className="text-left text-xs font-medium text-[#94A3B8] uppercase tracking-wider px-6 py-3">Created</th>
              <th className="text-left text-xs font-medium text-[#94A3B8] uppercase tracking-wider px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0]">
            {loading && grants.length === 0 ? (
              <SkeletonRows columns={7} />
            ) : grants.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center">
                  <h3 className="text-lg font-semibold text-[#0F172A] mb-2">No grants yet</h3>
                  <p className="text-sm text-[#475569]">Issue a read-only credential to start sharing agent access.</p>
                </td>
              </tr>
            ) : (
              grants.map((grant) => (
                <tr key={grant.id} className="hover:bg-[#F8FAFC] transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-[#0F172A]">{grant.name}</div>
                    <div className="text-xs font-mono text-[#94A3B8]">{grant.key_prefix}...</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      grant.status === "active" ? "bg-[#10B981]/10 text-[#10B981]" : "bg-[#94A3B8]/10 text-[#94A3B8]"
                    }`}>
                      {grant.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-[#475569]">{(grant.agent_ids?.length ?? 0).toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm font-mono text-[#475569]">{(grant.requests ?? 0).toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm font-mono text-[#475569]">{(grant.rows_read ?? 0).toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-[#94A3B8]">{new Date(grant.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    {grant.status === "active" && (
                      <button
                        onClick={() => handleRevoke(grant)}
                        disabled={revoking === grant.id}
                        className="px-3 py-1.5 text-sm font-medium text-[#EF4444] border border-[#FECACA] rounded-lg hover:bg-[#FEF2F2] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {revoking === grant.id ? "Revoking..." : "Revoke"}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UsageSummary({ apiKey, refreshSignal }: { apiKey: string; refreshSignal: number }) {
  const [rows, setRows] = useState<GrantUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    async function load() {
      try {
        const response = await apiFetch<{ data: GrantUsage[] }>("/v1/access/audit/summary", apiKey);
        if (!cancelled) setRows(response.data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load usage summary");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [apiKey, refreshSignal]);

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
      <div className="px-6 pt-6">
        <h3 className="text-lg font-semibold text-[#0F172A]">Usage summary (invoicing)</h3>
        <p className="text-sm text-[#475569] mt-1">Audited reads per grant, billed at $0.001 per row.</p>
      </div>
      {error && <div className="px-6 pt-4"><ErrorBanner message={error} /></div>}
      <div className="overflow-x-auto mt-4">
        <table className="w-full">
          <thead>
            <tr className="border-t border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <th className="text-left text-xs font-medium text-[#94A3B8] uppercase tracking-wider px-6 py-3">Grant</th>
              <th className="text-left text-xs font-medium text-[#94A3B8] uppercase tracking-wider px-6 py-3">Requests</th>
              <th className="text-left text-xs font-medium text-[#94A3B8] uppercase tracking-wider px-6 py-3">Rows read</th>
              <th className="text-left text-xs font-medium text-[#94A3B8] uppercase tracking-wider px-6 py-3">Agents read</th>
              <th className="text-left text-xs font-medium text-[#94A3B8] uppercase tracking-wider px-6 py-3">First used</th>
              <th className="text-left text-xs font-medium text-[#94A3B8] uppercase tracking-wider px-6 py-3">Last used</th>
              <th className="text-left text-xs font-medium text-[#94A3B8] uppercase tracking-wider px-6 py-3">Est. fee</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0]">
            {loading && rows.length === 0 ? (
              <SkeletonRows columns={7} />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center">
                  <h3 className="text-lg font-semibold text-[#0F172A] mb-2">No usage yet</h3>
                  <p className="text-sm text-[#475569]">Usage appears here once partners start reading agents.</p>
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const fee = typeof row.estimated_fee === "number" ? row.estimated_fee : row.rows_read * RATE_PER_ROW;
                return (
                  <tr key={row.grant_id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-[#0F172A]">{row.name}</td>
                    <td className="px-6 py-4 text-sm font-mono text-[#475569]">{row.requests.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm font-mono text-[#475569]">{row.rows_read.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm font-mono text-[#475569]">{row.agents_read.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-[#94A3B8]">{row.first_used ? new Date(row.first_used).toLocaleDateString() : "—"}</td>
                    <td className="px-6 py-4 text-sm text-[#94A3B8]">{row.last_used ? new Date(row.last_used).toLocaleDateString() : "—"}</td>
                    <td className="px-6 py-4 text-sm font-mono text-[#0F172A]">${fee.toFixed(3)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AccessPage() {
  const [apiKey, setApiKey] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [refreshSignal, setRefreshSignal] = useState(0);

  useEffect(() => {
    const stored = window.localStorage.getItem(API_KEY_STORAGE_KEY);
    if (stored) {
      setApiKey(stored);
      setKeyInput(stored);
    }
  }, []);

  function handleSaveKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const key = keyInput.trim();
    if (!key) return;
    window.localStorage.setItem(API_KEY_STORAGE_KEY, key);
    setApiKey(key);
  }

  function handleDataChanged() {
    setRefreshSignal((value) => value + 1);
  }

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#0F172A] mb-1">Access & Grants</h2>
        <p className="text-[#475569]">
          Issue read-only credentials to partners like Magma. Every read is audited for invoicing.
        </p>
      </div>

      {apiKey ? (
        <div className="space-y-8">
          <IssueGrantForm apiKey={apiKey} onGrantIssued={handleDataChanged} />
          <GrantList apiKey={apiKey} refreshSignal={refreshSignal} onRevoked={handleDataChanged} />
          <UsageSummary apiKey={apiKey} refreshSignal={refreshSignal} />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 max-w-xl">
          <h3 className="text-lg font-semibold text-[#0F172A] mb-2">Your owner API key</h3>
          <p className="text-sm text-[#475569] mb-4">
            Enter the owner API key used to issue and revoke partner credentials. It is kept only in this browser.
          </p>
          <form onSubmit={handleSaveKey} className="flex gap-3">
            <input
              type="text"
              value={keyInput}
              onChange={(event) => setKeyInput(event.target.value)}
              placeholder="sk_..."
              autoComplete="off"
              className="flex-1 px-4 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20 focus:border-[#4F46E5]"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-[#4F46E5] text-white text-sm font-medium rounded-lg hover:bg-[#4338CA] transition-colors"
            >
              Save key
            </button>
          </form>
        </div>
      )}
    </DashboardLayout>
  );
}
