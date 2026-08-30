"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, MoreVertical, Share, SquarePlus, X } from "lucide-react";

type Mode =
  | "hidden"
  | "android-install" // Chrome에서 beforeinstallprompt 확보 → 원탭 설치
  | "android-menu" // Android Chrome이지만 프롬프트 미확보 → 메뉴 안내
  | "ios" // iOS Safari → 홈 화면에 추가 안내
  | "inapp-android" // 안드로이드 인앱 브라우저 → Chrome으로 열기
  | "inapp-ios"; // iOS 인앱 브라우저 → Safari로 열기

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed-v1";
const FORCE_MODES: Mode[] = ["android-install", "android-menu", "ios", "inapp-android", "inapp-ios"];

type Step = { icon: React.ReactNode; text: React.ReactNode };

export function InstallPrompt() {
  const [mode, setMode] = useState<Mode>("hidden");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // 테스트·미리보기: ?pwa=<mode> 로 특정 안내를 강제 표시
    const forced = new URLSearchParams(window.location.search).get("pwa") as Mode | null;
    if (forced && FORCE_MODES.includes(forced)) {
      setMode(forced);
      setVisible(true);
      return;
    }

    const nav = window.navigator as Navigator & { standalone?: boolean };
    const ua = nav.userAgent || "";
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
    if (standalone) return; // 이미 설치됨

    const isIOS = /iphone|ipad|ipod/i.test(ua) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
    const isAndroid = /android/i.test(ua);
    if (!isIOS && !isAndroid) return; // 모바일에서만 안내

    const inApp = /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|FB_IAB|Line\/|DaumApps|Snapchat|Twitter|; wv\)/i.test(ua);
    setMode(isAndroid && inApp ? "inapp-android" : isIOS && inApp ? "inapp-ios" : isIOS ? "ios" : "android-menu");

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setMode((m) => (m === "android-menu" ? "android-install" : m));
    };
    const onInstalled = () => {
      setVisible(false);
      setMode("hidden");
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);

    let timer = 0;
    if (localStorage.getItem(DISMISS_KEY) !== "1") {
      timer = window.setTimeout(() => {
        // 첫 서비스 진입에서는 메뉴 가이드를 먼저 마치고, 설치 안내는 다음 방문에 제공합니다.
        if (
          document.documentElement.hasAttribute("data-service-nav-guide-open")
          || document.documentElement.hasAttribute("data-service-help-open")
        ) return;
        setVisible(true);
      }, 700);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const close = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    if (choice.outcome === "accepted") {
      setVisible(false);
      setMode("hidden");
    }
  };

  const openInChrome = () => {
    const target = window.location.host + window.location.pathname + window.location.search;
    window.location.href = `intent://${target}#Intent;scheme=https;package=com.android.chrome;end`;
  };

  const content = useMemo<{
    title: string;
    desc: string;
    cta?: { label: string; icon: React.ReactNode; onClick: () => void };
    steps?: Step[];
  } | null>(() => {
    switch (mode) {
      case "android-install":
        return {
          title: "홈 화면에 앱으로 설치",
          desc: "한 번 누르면 너의 교수님은?을 앱처럼 바로 열 수 있어요.",
          cta: { label: "설치하기", icon: <Download size={18} />, onClick: install },
        };
      case "android-menu":
        return {
          title: "홈 화면에 추가하기",
          desc: "Chrome 메뉴에서 앱으로 설치할 수 있어요.",
          steps: [
            { icon: <MoreVertical size={17} />, text: <>오른쪽 위 <b>⋮ 메뉴</b> 열기</> },
            { icon: <SquarePlus size={17} />, text: <><b>앱 설치</b> 또는 <b>홈 화면에 추가</b> 선택</> },
          ],
        };
      case "ios":
        return {
          title: "홈 화면에 추가 (iPhone)",
          desc: "Safari에서 두 단계면 앱처럼 쓸 수 있어요.",
          steps: [
            { icon: <Share size={17} />, text: <>아래 <b>공유 버튼</b>(□↑) 누르기</> },
            { icon: <SquarePlus size={17} />, text: <><b>홈 화면에 추가</b> 선택</> },
          ],
        };
      case "inapp-android":
        return {
          title: "Chrome에서 열어 주세요",
          desc: "지금은 앱 안의 브라우저예요. 설치하려면 Chrome이 필요해요.",
          cta: { label: "Chrome으로 열기", icon: <ExternalLink size={18} />, onClick: openInChrome },
          steps: [{ icon: <MoreVertical size={17} />, text: <>안 되면 <b>⋮ → 다른 브라우저로 열기</b></> }],
        };
      case "inapp-ios":
        return {
          title: "Safari에서 열어 주세요",
          desc: "앱 안 브라우저에서는 설치가 안 돼요.",
          steps: [
            { icon: <ExternalLink size={17} />, text: <>메뉴 → <b>Safari로 열기</b></> },
            { icon: <Share size={17} />, text: <>공유 → <b>홈 화면에 추가</b></> },
          ],
        };
      default:
        return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, deferred]);

  if (!visible || !content) return null;

  return (
    <div className="pwa-root" role="dialog" aria-modal="true" aria-label="앱 설치 안내">
      <button className="pwa-scrim" aria-label="닫기" onClick={close} />
      <div className="pwa-sheet">
        <button className="pwa-sheet__close" onClick={close} aria-label="닫기">
          <X size={18} />
        </button>
        <div className="pwa-sheet__head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" width={52} height={52} />
          <div>
            <strong>{content.title}</strong>
            <p>{content.desc}</p>
          </div>
        </div>

        {content.steps && (
          <ol className="pwa-steps">
            {content.steps.map((s, i) => (
              <li key={i}>
                <span className="pwa-steps__num">{i + 1}</span>
                <span className="pwa-steps__icon">{s.icon}</span>
                <span className="pwa-steps__text">{s.text}</span>
              </li>
            ))}
          </ol>
        )}

        {content.cta && (
          <button className="pwa-cta" onClick={content.cta.onClick}>
            {content.cta.icon} {content.cta.label}
          </button>
        )}

        <button className="pwa-later" onClick={close}>
          나중에 하기
        </button>
      </div>
    </div>
  );
}
