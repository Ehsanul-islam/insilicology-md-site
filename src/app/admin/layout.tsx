import type { ReactNode } from "react";

// account pages are private: keep them out of search results
export const metadata = { robots: { index: false, follow: false } };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
