import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 문제 은행(src/data/questions.ts)은 교사 화면에서만 동적 import 된다.
// 아래 manualChunks 설정으로 항상 별도 파일(question-bank-*.js)로 분리되어
// 학생 화면 번들에는 문제 문장/정답/해설이 포함되지 않는다.
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2019',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('src/data/questions')) return 'question-bank';
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
            return 'firebase';
          }
          return undefined;
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
});
