"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: "▦", permission: "dashboard.view" },
  { href: "/programs", label: "Programs", icon: "◫", permission: "programs.view" },
  { href: "/registrations", label: "Registrations", icon: "☰", permission: "registrations.view" },
  { href: "/payments", label: "Payments", icon: "₹", permission: "payments.view" },
  { href: "/users", label: "User Master", icon: "◉", permission: "users.manage" },
  { href: "/roles", label: "Role Master", icon: "⛨", permission: "roles.manage" },
];

export function AppShell({
  user,
  children,
}: {
  user: { name: string; email: string; role: string; permissions: string[] };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const visible = nav.filter((item) => user.permissions.includes(item.permission));

  // Close the drawer whenever the route changes (mobile nav tap)
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen">
      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 bg-brand-700 px-4 text-white lg:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="rounded-lg p-2 text-xl leading-none hover:bg-white/10"
        >
          ☰
        </button>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-xs font-bold">
          EO
        </div>
        <div className="text-sm font-semibold">Program Ops</div>
      </header>

      {/* Backdrop (mobile, drawer open) */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar: drawer on mobile, fixed on desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-brand-700 text-white transition-transform duration-200 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 text-sm font-bold">
            EO
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Program Ops</div>
            <div className="text-[11px] text-white/60">IIT Bombay · EO</div>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="ml-auto rounded-lg p-1.5 text-white/70 hover:bg-white/10 lg:hidden"
          >
            ✕
          </button>
        </div>

        <nav className="mt-2 flex-1 space-y-1 overflow-y-auto px-3">
          {visible.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                  active
                    ? "bg-white/15 font-medium text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span aria-hidden>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-5 py-4">
          <div className="text-sm font-medium">{user.name}</div>
          <div className="mb-3 text-[11px] text-white/60">{user.role}</div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full rounded-lg bg-white/10 py-2 text-xs font-medium hover:bg-white/20"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Content: clears the top bar on mobile, the sidebar on desktop */}
      <main className="min-w-0 px-4 pb-8 pt-[4.5rem] lg:ml-60 lg:px-8 lg:pt-8">
        {children}
      </main>
    </div>
  );
}
