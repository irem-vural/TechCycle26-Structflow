import type { Metadata } from "next";
import "./globals.css";
import ThemeController from "./ThemeController";

export const metadata: Metadata = {
  title: "İstinat Duvarı Analiz & Tasarım",
  icons: {
    icon: "./favicon.ico",
  },
  description: "İstinat duvarı stabilite analizi, betonarme tasarımı, metraj ve sürdürülebilirlik yazılımı",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      data-theme="structflow-dark"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: "try{document.documentElement.dataset.theme=localStorage.getItem('structflow:color-scheme')==='structflow-light'?'structflow-light':'structflow-dark'}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col"><ThemeController />{children}</body>
    </html>
  );
}
