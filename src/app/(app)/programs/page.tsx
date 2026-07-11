"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Badge, Modal, Field, inputCls, PrimaryButton, ConfirmDialog } from "@/components/ui";

type Program = {
  id: number;
  name: string;
  code: string;
  mode: "ONLINE" | "OFFLINE" | "HYBRID";
  start_date: string;
  end_date: string;
  fee: string;
  coordinator: string;
  status: "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  createdBy?: { name: string };
  _count?: { registrations: number };
};

const emptyForm = {
  name: "",
  code: "",
  mode: "ONLINE",
  start_date: "",
  end_date: "",
  fee: "",
  coordinator: "",
  status: "DRAFT",
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const inr = (n: string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(n));

export default function ProgramsPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const canWrite = role === "ADMIN" || role === "PROGRAM_MANAGER";
  const canDelete = role === "ADMIN";

  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // filters
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // form modal
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const [form, setForm] = useState<Record<string, string>>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  // delete
  const [deleting, setDeleting] = useState<Program | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (mode) params.set("mode", mode);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const res = await fetch(`/api/programs?${params}`);
    const json = await res.json();
    if (json.success) setPrograms(json.data);
    else setBanner({ type: "err", text: json.message });
    setLoading(false);
  }, [q, status, mode, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFieldErrors({});
    setFormOpen(true);
  }

  function openEdit(p: Program) {
    setEditing(p);
    setForm({
      name: p.name,
      code: p.code,
      mode: p.mode,
      start_date: p.start_date.slice(0, 10),
      end_date: p.end_date.slice(0, 10),
      fee: String(p.fee),
      coordinator: p.coordinator,
      status: p.status,
    });
    setFieldErrors({});
    setFormOpen(true);
  }

  async function save() {
    setSaving(true);
    setFieldErrors({});
    const res = await fetch(editing ? `/api/programs/${editing.id}` : "/api/programs", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setSaving(false);
    if (json.success) {
      setFormOpen(false);
      setBanner({ type: "ok", text: editing ? "Program updated." : "Program created." });
      load();
    } else {
      if (json.errors) setFieldErrors(json.errors);
      else setBanner({ type: "err", text: json.message });
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    const res = await fetch(`/api/programs/${deleting.id}`, { method: "DELETE" });
    const json = await res.json();
    setDeleteBusy(false);
    setDeleting(null);
    if (json.success) {
      setBanner({ type: "ok", text: "Program deleted." });
      load();
    } else {
      setBanner({ type: "err", text: json.message });
    }
  }

  const err = (k: string) => fieldErrors[k]?.[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Programs</h1>
          <p className="text-sm text-slate-500">Program master — create, edit and track programs</p>
        </div>
        {canWrite && <PrimaryButton onClick={openCreate}>+ New program</PrimaryButton>}
      </div>

      {banner && (
        <div
          className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm ${
            banner.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          {banner.text}
          <button onClick={() => setBanner(null)} className="ml-4 opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-2 gap-3 rounded-xl bg-white p-4 shadow-sm md:grid-cols-6">
        <input
          className={inputCls}
          placeholder="Search name, code, coordinator…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select className={inputCls} value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="">All modes</option>
          {["ONLINE", "OFFLINE", "HYBRID"].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} title="Starts from" />
        <input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} title="Starts until" />
        <button
          onClick={() => { setQ(""); setStatus(""); setMode(""); setFrom(""); setTo(""); }}
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
              <th className="px-5 py-3">Program</th>
              <th className="px-5 py-3">Mode</th>
              <th className="px-5 py-3">Dates</th>
              <th className="px-5 py-3">Fee</th>
              <th className="px-5 py-3">Coordinator</th>
              <th className="px-5 py-3">Regs</th>
              <th className="px-5 py-3">Status</th>
              {canWrite && <th className="px-5 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={8} className="px-5 py-10 text-center text-slate-400">Loading programs…</td></tr>
            ) : programs.length === 0 ? (
              <tr><td colSpan={8} className="px-5 py-10 text-center text-slate-400">
                No programs match these filters.
              </td></tr>
            ) : (
              programs.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-700">{p.name}</div>
                    <div className="text-xs text-slate-400">{p.code}</div>
                  </td>
                  <td className="px-5 py-3"><Badge value={p.mode} /></td>
                  <td className="px-5 py-3 text-slate-600">
                    {fmtDate(p.start_date)} → {fmtDate(p.end_date)}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{inr(p.fee)}</td>
                  <td className="px-5 py-3 text-slate-600">{p.coordinator}</td>
                  <td className="px-5 py-3 text-slate-600">{p._count?.registrations ?? 0}</td>
                  <td className="px-5 py-3"><Badge value={p.status} /></td>
                  {canWrite && (
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => openEdit(p)} className="mr-3 text-brand-500 hover:underline">Edit</button>
                      {canDelete && (
                        <button onClick={() => setDeleting(p)} className="text-rose-600 hover:underline">Delete</button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create / edit modal */}
      <Modal title={editing ? `Edit ${editing.code}` : "New program"} open={formOpen} onClose={() => setFormOpen(false)}>
        <div className="space-y-4">
          <Field label="Program name" error={err("name")}>
            <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Code (e.g. EO-ADS-2026)" error={err("code")}>
              <input className={inputCls} value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Mode" error={err("mode")}>
              <select className={inputCls} value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                {["ONLINE", "OFFLINE", "HYBRID"].map((m) => <option key={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Start date" error={err("start_date")}>
              <input type="date" className={inputCls} value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </Field>
            <Field label="End date" error={err("end_date")}>
              <input type="date" className={inputCls} value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </Field>
            <Field label="Fee (₹)" error={err("fee")}>
              <input type="number" min="0" className={inputCls} value={form.fee}
                onChange={(e) => setForm({ ...form, fee: e.target.value })} />
            </Field>
            <Field label="Status" error={err("status")}>
              <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Coordinator" error={err("coordinator")}>
            <input className={inputCls} value={form.coordinator}
              onChange={(e) => setForm({ ...form, coordinator: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setFormOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <PrimaryButton onClick={save} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Create program"}
            </PrimaryButton>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete program?"
        message={`This permanently deletes "${deleting?.name}" (${deleting?.code}). Programs with registrations cannot be deleted.`}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={deleteBusy}
      />
    </div>
  );
}
