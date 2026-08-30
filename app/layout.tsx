import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import { MobileViewportSync } from "@/components/app/mobile-viewport-sync";
import { StoreHydrator } from "@/components/app/store-hydrator";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { brandScene } from "@/lib/brand-assets";
import "./globals.css";

const pretendard = localFont({
  src: "../public/fonts/PretendardVariable.woff2",
  weight: "45 920",
  variable: "--font-pretendard",
  display: "swap",
  preload: true,
});

const title = "너의 교수님은? - 전공과 진로의 첫 대화를 시작하다";
const description =
  "막연한 전공·진로 고민을 정리하고 학교 공식 정보로 지금 대화해 볼 교수를 찾고, 첫 질문과 다음 행동까지 준비하는 대학생 방향 설계 서비스";
const ogImage = brandScene.home.og ?? brandScene.home.w1440;

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title,
  description,
  applicationName: "너의 교수님은?",
  appleWebApp: {
    capable: true,
    title: "너의 교수님은?",
    statusBarStyle: "default",
  },
  keywords: ["교수 찾기", "전공 탐색", "진로 고민", "면담 준비", "대학생 프로젝트"],
  openGraph: {
    title,
    description,
    locale: "ko_KR",
    type: "website",
    images: [ogImage],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [ogImage],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F5F7FC",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={pretendard.variable} data-scroll-behavior="smooth">
      <body>
        <MobileViewportSync />
        <StoreHydrator />
        <a href="#main-content" className="skip-link">
          본문으로 건너뛰기
        </a>
        {children}
        <InstallPrompt />
        {process.env.VERCEL === "1" && <Analytics />}
        <GoogleAnalytics />
      </body>
    </html>
  );
}
