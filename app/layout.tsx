import type { Metadata } from "next";
import { Shell } from "@/components/Shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "JARVIS // Life OS",
  description: "Personal AI-native operating system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Apply the saved color theme before first paint — no green flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('jarvis-theme');if(t)document.documentElement.dataset.theme=t;}catch(e){}`,
          }}
        />
      </head>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
