import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Providers } from "@/components/Providers";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  return (
    <Providers>
      <AppShell
        user={{
          name: session.user.name,
          email: session.user.email,
          role: session.user.role,
        }}
      >
        {children}
      </AppShell>
    </Providers>
  );
}
