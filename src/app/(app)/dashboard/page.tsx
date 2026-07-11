"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Badge } from "@/components/ui";

type Metrics = {
  activePrograms: number;
  totalRegistrations: number;
  pendingPayments: { count: number; amount: string | number };
  upcomingPrograms: {
    id: number; name: string; code: string; start_date: string; mode: string;
    _count: { registrations: number };
  }[];
  breakdown: { program: string; name: string; registrations: number; paid: number; pending: number }[];
  statusCounts: { status: string; count: number }[];
};

const inr = (n: string | number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
    .format(Number(n));

export default function DashboardPage() {
  const [data, setData] = useState<Metrics | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setData(json.data);
        else setError(json.message ?? "Could not load metrics.");
      })
      .catch(() => setError("Could not load metrics. Check your connection and refresh."));
  }, []);

  if (error) {
    return <div className="rounded-lg bg-rose-50 p-4 text-sm text-rose-700">{error}</div>;
  }
  if (!data) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-200" />
        ))}
      </div>
    );
  }

  const cards = [
    { label: "Active programs", value: data.activePrograms },
    { label: "Total registrations", value: data.totalRegistrations },
    { label: "Pending payments", value: data.pendingPayments.count },
    { label: "Amount outstanding", value: inr(data.pendingPayments.amount) },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-500">Operational overview across all programs</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">{c.label}</div>
            <div className="mt-2 text-3xl font-semibold text-brand-600">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="rounded-xl bg-white p-6 shadow-sm lg:col-span-3">
          <h2 className="mb-4 font-semibold text-slate-700">
            Program-wise registrations (active programs)
          </h2>
          {data.breakdown.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              No active programs yet. Create one under Programs.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.breakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="program" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="paid" name="Paid" stackId="a" fill="#1f4e8c" />
                <Bar dataKey="pending" name="Payment pending" stackId="a" fill="#93b4dd" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="mb-4 font-semibold text-slate-700">Starting in the next 30 days</h2>
          {data.upcomingPrograms.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              No programs start in the next 30 days.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.upcomingPrograms.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm font-medium text-slate-700">{p.name}</div>
                    <div className="text-xs text-slate-400">
                      {p.code} · {new Date(p.start_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      {" · "}{p._count.registrations} registered
                    </div>
                  </div>
                  <Badge value={p.mode} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-slate-700">Registrations by status</h2>
        <div className="flex flex-wrap gap-6">
          {data.statusCounts.map((s) => (
            <div key={s.status} className="flex items-center gap-2">
              <Badge value={s.status} />
              <span className="text-lg font-semibold text-slate-700">{s.count}</span>
            </div>
          ))}
          {data.statusCounts.length === 0 && (
            <p className="text-sm text-slate-400">No registrations recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
