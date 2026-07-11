"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Badge, Modal, Field, inputCls, PrimaryButton } from "@/components/ui";

type UserRow = {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
  createdAt: string;
  role: { id: number; name: string };
};

type RoleOption = { id: number; name: string };

const emptyForm = { name: "", email: "", password: "", role_id: "", is_active: "true" };

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function UsersPage() {
  const { data: session } = useSession();
  const myId = Number(session?.user?.id);

  const [rows, setRows] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState<Record<string, string>>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/users");
    const json = await res.json();
    if (json.success) setRows(json.data);
    else setBanner({ type: "err", text: json.message });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    fetch("/api/roles")
      .then((r) => r.json())
      .then((json) => json.success && setRoles(json.data));
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFieldErrors({});
    setFormOpen(true);
  }

  function openEdit(u: UserRow) {
    setEditing(u);
    setForm({
      name: u.name,
      email: u.email,
      password: "",
      role_id: String(u.role.id),
      is_active: String(u.is_active),
    });
    setFieldErrors({});
    setFormOpen(true);
  }

  async function save() {
    setSaving(true);
    setFieldErrors({});
    const payload = {
      name: form.name,
      email: form.email,
      role_id: form.role_id,
      is_active: form.is_active === "true",
      ...(form.password || !editing ? { password: form.password } : {}),
    };
    const res = await fetch(editing ? `/api/users/${editing.id}` : "/api/users", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setSaving(false);
    if (json.success) {
      setFormOpen(false);
      setBanner({ type: "ok", text: editing ? "User updated." : "User created." });
      load();
    } else {
      if (json.errors) setFieldErrors(json.errors);
      else setBanner({ type: "err", text: json.message });
    }
  }

  const err = (k: string) => fieldErrors[k]?.[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">User Master</h1>
          <p className="text-sm text-slate-500">Create staff accounts and assign roles</p>
        </div>
        <PrimaryButton onClick={openCreate}>+ New user</PrimaryButton>
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

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-5 py-3">User</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Created</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400">Loading users…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400">No users yet.</td></tr>
            ) : (
              rows.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-700">
                      {u.name}{u.id === myId && <span className="ml-2 text-xs text-slate-400">(you)</span>}
                    </div>
                    <div className="text-xs text-slate-400">{u.email}</div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-block rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-600">
                      {u.role.name}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <Badge value={u.is_active ? "ACTIVE" : "CANCELLED"} />
                  </td>
                  <td className="px-5 py-3 text-slate-600">{fmtDate(u.createdAt)}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => openEdit(u)} className="text-brand-500 hover:underline">Edit</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal title={editing ? `Edit ${editing.name}` : "New user"} open={formOpen} onClose={() => setFormOpen(false)}>
        <div className="space-y-4">
          <Field label="Full name" error={err("name")}>
            <input className={inputCls} value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Email" error={err("email")}>
            <input type="email" className={inputCls} value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field
            label={editing ? "New password (leave blank to keep current)" : "Password"}
            error={err("password")}
          >
            <input type="password" className={inputCls} value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Role" error={err("role_id")}>
              <select className={inputCls} value={form.role_id}
                onChange={(e) => setForm({ ...form, role_id: e.target.value })}>
                <option value="">Select a role…</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </Field>
            <Field label="Status" error={err("is_active")}>
              <select
                className={inputCls}
                value={form.is_active}
                disabled={!!editing && editing.id === myId}
                onChange={(e) => setForm({ ...form, is_active: e.target.value })}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </Field>
          </div>
          {editing?.id === myId && (
            <p className="text-xs text-slate-400">
              You cannot deactivate or change the role of your own account.
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setFormOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <PrimaryButton onClick={save} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Create user"}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
