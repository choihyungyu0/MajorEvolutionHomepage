import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { StoreHydrator } from "@/components/app/store-hydrator";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import "./globals.css";

const pretendard = localFont({
  src: "../public/fonts/PretendardVariable.woff2",
  weight: "45 920",
  variable: "--font-pretendard",
  display: "swap",
  preload: true,
});

const title = "전공진화소 - AI 연구·교수 매칭";
const description =
  "전공과 관심사를 연구 아이디어로 확장하고, 공개 근거를 바탕으로 교수님과 첫 실행 계획까지 연결하는 대학생 연구 여정 앱";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title,
  description,
  applicationName: "전공진화소",
  appleWebApp: {
    capable: true,
    title: "전공진화소",
    statusBarStyle: "default",
  },
  keywords: ["전공 탐색", "연구 아이디어", "교수 매칭", "대학생 프로젝트", "AI 연구"],
  openGraph: {
    title,
    description,
    locale: "ko_KR",
    type: "website",
    images: ["/major-evolution-assets/02_EXACT_CROPS/02_splash_hero_composite.png"],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/major-evolution-assets/02_EXACT_CROPS/02_splash_hero_composite.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F7F9FF",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body>
        <StoreHydrator />
        <a href="#main-content" className="skip-link">
          본문으로 건너뛰기
        </a>
        {children}
        <InstallPrompt />
      </body>
    </html>
  );
}
