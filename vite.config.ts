import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// 빌드마다 바뀌는 버전 식별자 — 실행 중 번들이 최신 배포본과 다른지 비교하는 데 쓴다.
//  • 번들에 __APP_VERSION__ 로 주입(실행 중 버전) + dist/version.json 으로도 발행(서버 최신 버전).
//  • 앱이 둘을 비교해 다르면 자동 새로고침 → 트레이 위젯처럼 오래 떠 있는 창도 최신 코드로 전환.
const buildId = String(Date.now())

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'emit-version-json',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ v: buildId }) })
      },
    },
  ],
  define: { __APP_VERSION__: JSON.stringify(buildId) },
  base: '/',
})
