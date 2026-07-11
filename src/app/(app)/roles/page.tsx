"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal, Field, inputCls, PrimaryButton, ConfirmDialog } from "@/components/ui";

type Permission = { id: number; key: string; label: string; module: string };
type RoleRow = {
  id: number;
  name: string;
  description: string | null;
  is_system: boolean;
  permissions: { permission: Permission }[];
  _count: { users: number };
};

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [catalog, setCatalog] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<RoleRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [rolesRes, permsRes] = await Promise.all([
      fetch("/api/roles").then((r) => r.json()),
      fetch("/api/permissions").then((r) => r.json()),
    ]);
    if (rolesRes.success) setRoles(rolesRes.data);
    else setBanner({ type: "err", text: rolesRes.message });
    if (permsRes.success) setCatalog(permsRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const modules = Array.from(new Set(catalog.map((p) => p.module)));

  function openCreate() {
    setEditing(null);
    setName("");
    setDescription("");
    setSelected(new Set());
    setFieldErrors({});
    setFormOpen(true);
  }

  function openEdit(r: RoleRow) {
    setEditing(r);
    setName(r.name);
    setDescription(r.description ?? "");
    setSelected(new Set(r.permissions.map((rp) => rp.permission.id)));
    setFieldErrors({});
    setFormOpen(true);
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleModule(module: string) {
    const ids = catalog.filter((p) => p.module === module).map((p) => p.id);
    const allOn = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (allOn ? next.delete(id) : next.add(id)));
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setFieldErrors({});
    const payload = { name, description, permission_ids: Array.from(selected) };
    const res = await fetch(editing ? `/api/roles/${editing.id}` : "/api/roles", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setSaving(false);
    if (json.success) {
      setFormOpen(false);
      setBanner({
        type: "ok",
        text: editing
          ? "Role updated. Permission changes apply to its users immediately."
          : "Role created.",
      });
      load();
    } else {
      if (json.errors) setFieldErrors(json.errors);
      else setBanner({ type: "err", text: json.message });
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    const res = await fetch(`/api/roles/${deleting.id}`, { method: "DELETE" });
    const json = await res.json();
    setDeleteBusy(false);
    setDeleting(null);
    if (json.success) {
      setBanner({ type: "ok", text: "Role deleted." });
      load();
    } else {
      setBanner({ type: "err", text: json.message });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Role Master</h1>
          <p className="text-sm text-slate-500">
            Define roles and their module permissions — enforced by the API on every request
          </p>
        </div>
        <PrimaryButton onClick={openCreate}>+ New role</PrimaryButton>
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

      {loading ? (
        <div className="rounded-xl bg-white p-10 text-center text-slate-400 shadow-sm">Loading roles…</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {roles.map((r) => (
            <div key={r.id} className="rounded-xl bg-white p-5 shadow-sm">
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">{r.name}</span>
                    {r.is_system && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                        System
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500">{r.description}</p>
                </div>
                <div className="whitespace-nowrap text-right text-xs text-slate-400">
                  {r._count.users} user{r._count.users === 1 ? "" : "s"}
                </div>
              </div>
              <div className="mb-4 flex flex-wrap gap-1.5">
                {r.permissions.map((rp) => (
                  <span key={rp.permission.id}
                    className="rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-600">
                    {rp.permission.key}
                  </span>
                ))}
              </div>
              <div className="flex gap-4 text-sm">
                <button onClick={() => openEdit(r)} className="text-brand-500 hover:underline">
                  Edit permissions
                </button>
                {!r.is_system && (
                  <button onClick={() => setDeleting(r)} className="text-rose-600 hover:underline">
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal title={editing ? `Edit role — ${editing.name}` : "New role"} open={formOpen} onClose={() => setFormOpen(false)}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <Field label="Role name" error={fieldErrors.name?.[0]}>
              <input className={inputCls} value={name} disabled={editing?.is_system}
                onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Description" error={fieldErrors.description?.[0]}>
              <input className={inputCls} value={description}
                onChange={(e) => setDescription(e.target.value)} />
            </Field>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-600">Permissions</span>
              {fieldErrors.permission_ids && (
                <span className="text-xs text-rose-600">{fieldErrors.permission_ids[0]}</span>
              )}
            </div>
            <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg border border-slate-200 p-3">
              {modules.map((module) => {
                const perms = catalog.filter((p) => p.module === module);
                const allOn = perms.every((p) => selected.has(p.id));
                return (
                  <div key={module}>
                    <button
                      type="button"
                      onClick={() => toggleModule(module)}
                      className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-brand-500"
                      title="Toggle all in this module"
                    >
                      {module} {allOn ? "✓" : ""}
                    </button>
                    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                      {perms.map((p) => (
                        <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-slate-700 hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={selected.has(p.id)}
                            onChange={() => toggle(p.id)}
                            className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                          />
                          {p.label}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button onClick={() => setFormOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <PrimaryButton onClick={save} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save role" : "Create role"}
            </PrimaryButton>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete role?"
        message={`This permanently deletes the "${deleting?.name}" role. Roles assigned to users cannot be deleted.`}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={deleteBusy}
      />
    </div>
  );
}
