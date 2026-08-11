import type { Metadata } from "next";
import { DM_Sans, Instrument_Serif } from "next/font/google";
import "./globals.css";
const sans = DM_Sans({ variable: "--font-sans", subsets: ["latin"] });
const serif = Instrument_Serif({ variable: "--font-serif", subsets: ["latin"], weight: "400" });
export const metadata: Metadata = { title: "Wornly — Shop what’s heating up", description: "Fashion discovery powered by social proof." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body className={`${sans.variable} ${serif.variable}`}>{children}</body></html>; }
