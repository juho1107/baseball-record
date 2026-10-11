import type { Metadata } from "next";
import "./globals.css";

const siteUrl = "https://baseball-record-nu.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "DUGOUT — 사회인야구 통합 기록",
  description: "썬볼과 레드포니즈의 선수·팀 기록을 한곳에서 확인하세요.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "/",
    siteName: "DUGOUT",
    title: "DUGOUT — 사회인야구 통합 기록",
    description: "썬볼과 레드포니즈의 선수·팀 기록을 한곳에서 확인하세요.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "DUGOUT 사회인야구 통합 기록" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "DUGOUT — 사회인야구 통합 기록",
    description: "썬볼과 레드포니즈의 선수·팀 기록을 한곳에서 확인하세요.",
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
