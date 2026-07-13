"use client";

import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { usePrototypeStore } from "@/store/prototype-store";

export function StoreHydrator() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    void usePrototypeStore.persist.rehydrate();
    const updateNetwork = () => setIsOffline(!navigator.onLine);
    updateNetwork();
    window.addEventListener("online", updateNetwork);
    window.addEventListener("offline", updateNetwork);
    return () => {
      window.removeEventListener("online", updateNetwork);
      window.removeEventListener("offline", updateNetwork);
    };
  }, []);

  if (!isOffline) return null;
  return <div className="offline-notice" role="status"><WifiOff size={16} /><span>오프라인 상태예요. 저장된 화면은 볼 수 있지만 AI 생성은 연결 후 이용해 주세요.</span></div>;
}
