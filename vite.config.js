import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Repo tên `username.github.io` hoặc custom domain → base '/'.
// Nếu dùng repo thường (username.github.io/repo/) thì đổi thành '/repo/'.
export default defineConfig({
  plugins: [react()],
  base: '/',
})
