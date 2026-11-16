import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";
import type { Plugin } from "vite";

/**
 * 배포본에만 넣는 콘텐츠 보안 정책(CSP). 허용한 곳의 스크립트만 실행하고 허용한 서버에만 접속하게 해서,
 * 악성 코드가 끼어들어도 로그인 정보를 밖으로 보내기 어렵게 한다.
 * 개발 서버는 즉시 반영(HMR)용 스크립트를 넣으므로 적용하지 않는다.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://apis.google.com https://www.gstatic.com",
  "connect-src 'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://apis.google.com",
  "frame-src https://ipo-calculator-e8859.firebaseapp.com https://accounts.google.com https://apis.google.com",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const contentSecurityPolicy = (): Plugin => ({
  name: "content-security-policy",
  apply: "build",
  transformIndexHtml: () => [
    { tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: CSP }, injectTo: "head-prepend" },
  ],
});

export default defineConfig({
  test: { include: ["src/**/*.test.{ts,tsx}"] },
  base: "./", // GitHub Pages의 하위 경로에서도 동작하도록 상대 경로를 쓴다.
  plugins: [
    react(),
    contentSecurityPolicy(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/apple-touch-icon.png"],
      workbox: { globPatterns: ["**/*.{js,css,html,png,svg}"] }, // ipos.json은 앱이 직접 받아 보관한다.
      manifest: {
        name: "공모주 계산기",
        short_name: "공모주",
        description: "공모주 청약 일정과 수익을 기록하는 앱",
        lang: "ko",
        start_url: "./",
        scope: "./",
        display: "standalone",
        orientation: "portrait",
        background_color: "#ffffff",
        theme_color: "#ffffff",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
});
