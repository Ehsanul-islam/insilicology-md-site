import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DashboardNav } from "../../components/md/dashboard/DashboardNav";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · Dashboard" },
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <DashboardNav />
      {children}
    </>
  );
}
