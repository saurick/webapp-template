/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}', // 扫描src目录下的所有文件
  ],
  theme: {
    extend: {}, // 扩展主题
  },
  plugins: [
    require('@tailwindcss/forms'), // 常用表单样式优化
    require('@tailwindcss/typography'), // 文章内容优化（prose）
    require('@tailwindcss/aspect-ratio'), // 支持 aspect-ratio 工具
  ],
}
