"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: "▦" },
  { href: "/programs", label: "Programs", icon: "◫" },
  { href: "/registrations", label: "Registrations", icon: "☰" },
];

export function AppShell({
  user,
  children,
}: {
  user: { name: string; email: string; role: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 flex w-60 flex-col bg-brand-700 text-white">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 text-sm font-bold">
            EO
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Program Ops</div>
            <div className="text-[11px] text-white/60">IIT Bombay · EO</div>
          </div>
        </div>

        <nav className="mt-2 flex-1 space-y-1 px-3">
          {nav.map((item) => {
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
          <div className="mb-3 text-[11px] text-white/60">
            {user.role.replace("_", " ")}
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full rounded-lg bg-white/10 py-2 text-xs font-medium hover:bg-white/20"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="ml-60 flex-1 p-8">{children}</main>
    </div>
  );
}
