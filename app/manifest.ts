import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "전공진화소",
    short_name: "전공진화소",
    description: "전공을 연구 아이디어와 교수님, 첫 실행으로 연결하는 대학생 연구 여정 앱",
    start_url: "/",
    display: "standalone",
    background_color: "#F7F9FF",
    theme_color: "#7658F5",
    lang: "ko-KR",
    orientation: "portrait",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
