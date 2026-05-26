"use client";

import type { ReactNode } from "react";

export default function PageReveal({ children }: { children: ReactNode }) {
  return <div className="page-reveal">{children}</div>;
}
