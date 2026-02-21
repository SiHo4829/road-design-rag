import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync, mkdirSync } from 'fs'

// PDF.js worker를 public/에 자동 복사하는 플러그인
function copyPdfWorker() {
  return {
    name: 'copy-pdf-worker',
    buildStart() {
      const src = resolve('node_modules/pdfjs-dist/build/pdf.worker.min.mjs')
      const dest = resolve('public/pdf.worker.min.mjs')
      mkdirSync(resolve('public'), { recursive: true })
      copyFileSync(src, dest)
    },
  }
}

export default defineConfig({
  plugins: [react(), copyPdfWorker()],
})
