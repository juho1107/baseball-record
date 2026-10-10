import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DUGOUT — 사회인야구 통합 기록",
  description: "흩어진 사회인야구 기록을 한눈에 확인하는 선수 기록 대시보드",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
