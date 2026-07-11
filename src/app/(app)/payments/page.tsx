"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, inputCls } from "@/components/ui";

type PaymentRow = {
  id: number;
  amount: string;
  reference_no: string;
  paid_on: string;
  status: "SUCCESS" | "FAILED" | "REFUNDED";
  created_at: string;
  registration: {
    id: number;
    learner_name: string;
    learner_email: string;
    program: { id: number; name: string; code: string };
  };
};

type Summary = {
  totalInitiated: number;
  totalCollected: string | number;
  byStatus: { status: string; count: number; amount: string | number }[];
};

const inr = (n: string | number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(n));

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function PaymentsPage() {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // filters
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const res = await fetch(`/api/payments?${params}`);
    const json = await res.json();
    if (json.success) {
      setRows(json.data.payments);
      setSummary(json.data.summary);
    } else {
      setError(json.message ?? "Could not load payments.");
    }
    setLoading(false);
  }, [q, status, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const statusCount = (s: string) =>
    summary?.byStatus.find((b) => b.status === s)?.count ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Payments</h1>
        <p className="text-sm text-slate-500">
          Every payment initiated across programs, with collection totals
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Payments initiated</div>
          <div className="mt-2 text-xl font-semibold text-brand-600 md:text-3xl">
            {summary?.totalInitiated ?? "—"}
          </div>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Amount collected</div>
          <div className="mt-2 text-xl font-semibold text-emerald-600 md:text-3xl">
            {summary ? inr(summary.totalCollected) : "—"}
          </div>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Successful</div>
          <div className="mt-2 text-xl font-semibold text-slate-700 md:text-3xl">
            {summary ? statusCount("SUCCESS") : "—"}
          </div>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Failed / refunded</div>
          <div className="mt-2 text-xl font-semibold text-slate-700 md:text-3xl">
            {summary ? statusCount("FAILED") + statusCount("REFUNDED") : "—"}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 gap-3 rounded-xl bg-white p-4 shadow-sm sm:grid-cols-3 lg:grid-cols-5">
        <input
          className={`${inputCls} col-span-2 sm:col-span-3 lg:col-span-1`}
          placeholder="Search reference, learner…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {["SUCCESS", "FAILED", "REFUNDED"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} title="Paid from" />
        <input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} title="Paid until" />
        <button
          onClick={() => { setQ(""); setStatus(""); setFrom(""); setTo(""); }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          Clear filters
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-5 py-3">Reference</th>
              <th className="px-5 py-3">Learner</th>
              <th className="px-5 py-3">Program</th>
              <th className="px-5 py-3">Amount</th>
              <th className="px-5 py-3">Paid on</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">Loading payments…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                No payments match these filters.
              </td></tr>
            ) : (
              rows.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3 font-medium text-slate-700">{p.reference_no}</td>
                  <td className="px-5 py-3">
                    <div className="text-slate-700">{p.registration.learner_name}</div>
                    <div className="text-xs text-slate-400">{p.registration.learner_email}</div>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{p.registration.program.code}</td>
                  <td className="px-5 py-3 text-slate-600">{inr(p.amount)}</td>
                  <td className="px-5 py-3 text-slate-600">{fmtDate(p.paid_on)}</td>
                  <td className="px-5 py-3"><Badge value={p.status} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
