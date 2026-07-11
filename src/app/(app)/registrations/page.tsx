"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Badge, Modal, Field, inputCls, PrimaryButton, ConfirmDialog } from "@/components/ui";

type Payment = {
  id: number;
  amount: string;
  reference_no: string;
  paid_on: string;
  status: string;
};

type Registration = {
  id: number;
  program_id: number;
  learner_name: string;
  learner_email: string;
  phone: string;
  registration_status: "PENDING" | "CONFIRMED" | "CANCELLED";
  payment_status: "PENDING" | "PARTIAL" | "PAID" | "REFUNDED";
  amount: string;
  created_at: string;
  program: { id: number; name: string; code: string };
  payments: Payment[];
};

type ProgramOption = { id: number; name: string; code: string; fee: string; status: string };

const emptyForm = {
  program_id: "",
  learner_name: "",
  learner_email: "",
  phone: "",
  registration_status: "PENDING",
  amount: "",
};

const inr = (n: string | number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(n));

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function RegistrationsPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const canDelete = role === "ADMIN" || role === "PROGRAM_MANAGER";

  const [rows, setRows] = useState<Registration[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // filters
  const [q, setQ] = useState("");
  const [regStatus, setRegStatus] = useState("");
  const [payStatus, setPayStatus] = useState("");
  const [programFilter, setProgramFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // learner form modal
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Registration | null>(null);
  const [form, setForm] = useState<Record<string, string>>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  // payment modal
  const [payFor, setPayFor] = useState<Registration | null>(null);
  const [payForm, setPayForm] = useState({ amount: "", reference_no: "", paid_on: "" });
  const [payErrors, setPayErrors] = useState<Record<string, string[]>>({});
  const [payBusy, setPayBusy] = useState(false);

  // delete
  const [deleting, setDeleting] = useState<Registration | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (regStatus) params.set("registration_status", regStatus);
    if (payStatus) params.set("payment_status", payStatus);
    if (programFilter) params.set("program_id", programFilter);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const res = await fetch(`/api/registrations?${params}`);
    const json = await res.json();
    if (json.success) setRows(json.data);
    else setBanner({ type: "err", text: json.message });
    setLoading(false);
  }, [q, regStatus, payStatus, programFilter, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/programs")
      .then((r) => r.json())
      .then((json) => json.success && setPrograms(json.data));
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFieldErrors({});
    setFormOpen(true);
  }

  function openEdit(r: Registration) {
    setEditing(r);
    setForm({
      program_id: String(r.program_id),
      learner_name: r.learner_name,
      learner_email: r.learner_email,
      phone: r.phone,
      registration_status: r.registration_status,
      amount: String(r.amount),
    });
    setFieldErrors({});
    setFormOpen(true);
  }

  function onProgramChange(id: string) {
    const p = programs.find((x) => String(x.id) === id);
    // Convenience: default the registration amount to the program fee.
    setForm((f) => ({ ...f, program_id: id, amount: f.amount || (p ? String(p.fee) : "") }));
  }

  async function save() {
    setSaving(true);
    setFieldErrors({});
    const res = await fetch(editing ? `/api/registrations/${editing.id}` : "/api/registrations", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setSaving(false);
    if (json.success) {
      setFormOpen(false);
      setBanner({ type: "ok", text: editing ? "Registration updated." : "Learner registered." });
      load();
    } else {
      if (json.errors) setFieldErrors(json.errors);
      else setBanner({ type: "err", text: json.message });
    }
  }

  function openPayment(r: Registration) {
    setPayFor(r);
    const paid = r.payments
      .filter((p) => p.status === "SUCCESS")
      .reduce((s, p) => s + Number(p.amount), 0);
    const due = Number(r.amount) - paid;
    setPayForm({
      amount: due > 0 ? String(due) : "",
      reference_no: "",
      paid_on: new Date().toISOString().slice(0, 10),
    });
    setPayErrors({});
  }

  async function savePayment() {
    if (!payFor) return;
    setPayBusy(true);
    setPayErrors({});
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payForm, registration_id: payFor.id }),
    });
    const json = await res.json();
    setPayBusy(false);
    if (json.success) {
      setPayFor(null);
      setBanner({ type: "ok", text: "Payment recorded." });
      load();
    } else {
      if (json.errors) setPayErrors(json.errors);
      else setBanner({ type: "err", text: json.message });
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    const res = await fetch(`/api/registrations/${deleting.id}`, { method: "DELETE" });
    const json = await res.json();
    setDeleteBusy(false);
    setDeleting(null);
    if (json.success) {
      setBanner({ type: "ok", text: "Registration deleted." });
      load();
    } else {
      setBanner({ type: "err", text: json.message });
    }
  }

  const err = (k: string) => fieldErrors[k]?.[0];
  const paidSoFar = (r: Registration) =>
    r.payments.filter((p) => p.status === "SUCCESS").reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Registrations</h1>
          <p className="text-sm text-slate-500">Learner master — registrations and payment tracking</p>
        </div>
        <PrimaryButton onClick={openCreate}>+ Register learner</PrimaryButton>
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
      <div className="grid grid-cols-2 gap-3 rounded-xl bg-white p-4 shadow-sm md:grid-cols-7">
        <input className={`${inputCls} col-span-2 md:col-span-1`} placeholder="Search learner…"
          value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={inputCls} value={programFilter} onChange={(e) => setProgramFilter(e.target.value)}>
          <option value="">All programs</option>
          {programs.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
        </select>
        <select className={inputCls} value={regStatus} onChange={(e) => setRegStatus(e.target.value)}>
          <option value="">Reg. status</option>
          {["PENDING", "CONFIRMED", "CANCELLED"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className={inputCls} value={payStatus} onChange={(e) => setPayStatus(e.target.value)}>
          <option value="">Payment status</option>
          {["PENDING", "PARTIAL", "PAID", "REFUNDED"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} title="Registered from" />
        <input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} title="Registered until" />
        <button
          onClick={() => { setQ(""); setRegStatus(""); setPayStatus(""); setProgramFilter(""); setFrom(""); setTo(""); }}
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
              <th className="px-5 py-3">Learner</th>
              <th className="px-5 py-3">Program</th>
              <th className="px-5 py-3">Registered</th>
              <th className="px-5 py-3">Reg. status</th>
              <th className="px-5 py-3">Payment</th>
              <th className="px-5 py-3">Paid / Total</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">Loading registrations…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                No registrations match these filters.
              </td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-700">{r.learner_name}</div>
                    <div className="text-xs text-slate-400">{r.learner_email} · {r.phone}</div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="text-slate-600">{r.program.code}</div>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{fmtDate(r.created_at)}</td>
                  <td className="px-5 py-3"><Badge value={r.registration_status} /></td>
                  <td className="px-5 py-3"><Badge value={r.payment_status} /></td>
                  <td className="px-5 py-3 text-slate-600">
                    {inr(paidSoFar(r))} / {inr(r.amount)}
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    {r.payment_status !== "PAID" && r.registration_status !== "CANCELLED" && (
                      <button onClick={() => openPayment(r)} className="mr-3 text-emerald-600 hover:underline">
                        Record payment
                      </button>
                    )}
                    <button onClick={() => openEdit(r)} className="mr-3 text-brand-500 hover:underline">Edit</button>
                    {canDelete && (
                      <button onClick={() => setDeleting(r)} className="text-rose-600 hover:underline">Delete</button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Learner form modal */}
      <Modal title={editing ? `Edit registration #${editing.id}` : "Register learner"} open={formOpen} onClose={() => setFormOpen(false)}>
        <div className="space-y-4">
          <Field label="Program" error={err("program_id")}>
            <select className={inputCls} value={form.program_id} onChange={(e) => onProgramChange(e.target.value)}>
              <option value="">Select a program…</option>
              {programs
                .filter((p) => p.status === "ACTIVE" || p.status === "DRAFT" || String(p.id) === form.program_id)
                .map((p) => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))}
            </select>
          </Field>
          <Field label="Learner name" error={err("learner_name")}>
            <input className={inputCls} value={form.learner_name}
              onChange={(e) => setForm({ ...form, learner_name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Email" error={err("learner_email")}>
              <input type="email" className={inputCls} value={form.learner_email}
                onChange={(e) => setForm({ ...form, learner_email: e.target.value })} />
            </Field>
            <Field label="Phone" error={err("phone")}>
              <input className={inputCls} value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Registration status" error={err("registration_status")}>
              <select className={inputCls} value={form.registration_status}
                onChange={(e) => setForm({ ...form, registration_status: e.target.value })}>
                {["PENDING", "CONFIRMED", "CANCELLED"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Amount (₹)" error={err("amount")}>
              <input type="number" min="0" className={inputCls} value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </Field>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setFormOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <PrimaryButton onClick={save} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Register"}
            </PrimaryButton>
          </div>
        </div>
      </Modal>

      {/* Record payment modal */}
      <Modal title={payFor ? `Record payment — ${payFor.learner_name}` : ""} open={!!payFor} onClose={() => setPayFor(null)}>
        {payFor && (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {payFor.program.code} · Total {inr(payFor.amount)} · Paid so far {inr(paidSoFar(payFor))}
            </div>
            <Field label="Amount (₹)" error={payErrors.amount?.[0]}>
              <input type="number" min="1" className={inputCls} value={payForm.amount}
                onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Reference no." error={payErrors.reference_no?.[0]}>
                <input className={inputCls} value={payForm.reference_no} placeholder="TXN-…"
                  onChange={(e) => setPayForm({ ...payForm, reference_no: e.target.value })} />
              </Field>
              <Field label="Paid on" error={payErrors.paid_on?.[0]}>
                <input type="date" className={inputCls} value={payForm.paid_on}
                  onChange={(e) => setPayForm({ ...payForm, paid_on: e.target.value })} />
              </Field>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setPayFor(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <PrimaryButton onClick={savePayment} disabled={payBusy}>
                {payBusy ? "Recording…" : "Record payment"}
              </PrimaryButton>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete registration?"
        message={`This permanently deletes ${deleting?.learner_name}'s registration on ${deleting?.program.code}. Registrations with successful payments cannot be deleted.`}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={deleteBusy}
      />
    </div>
  );
}
