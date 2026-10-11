import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Assessly — Online Assessments", description: "Create, share and review online examinations." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
