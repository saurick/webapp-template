import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // 读取 .env.* 文件
  const env = loadEnv(mode, process.cwd(), '')

  const isProd = mode === 'production'
  const isDev = mode === 'development'

  // 只在开发环境打印调试信息，避免打包时报一堆东西
  if (!isProd) {
    console.log('env =', env)
    console.log('command =', command)  // 'serve' | 'build'
    console.log('mode =', mode)        // 'development' | 'production' | 自定义的mode
  }

  return {
    base: isDev ? '/' : (env.VITE_BASE_URL || '/'),   // dev 在根，构建/预览在子路径

    plugins: [
      react(),  // 处理react
    ],

    /**
     * 用 esbuild 在【生产环境】移除所有 console / debugger
     *  - 只影响打包产物，不影响开发环境
     */
    esbuild: {
      drop: isProd ? ['console', 'debugger'] : [],
    },

    reportCompressedSize: false,  // 报告压缩大小

    build: {
      outDir: 'build',       // 输出目录
      assetsDir: 'assets',   // 资源目录
      sourcemap: !isProd,    // 生产关闭 sourcemap
      minify: 'esbuild',
      cssMinify: 'esbuild',
      target: 'es2018',
      rollupOptions: {
        output: {
          // 对齐 webpack 的命名风格
          entryFileNames: 'assets/[name].[hash].js',
          chunkFileNames: 'assets/[name].[hash].js',
          assetFileNames: 'assets/[name].[hash].[ext]',

          // 粗粒度拆分：react 等进 vendors，其余 node_modules 进 vendor
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (
                /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|antd|mobx)/.test(
                  id
                )
              ) {
                return 'vendors'
              }
              return 'vendor'
            }
          },
        },
      },
    },

    resolve: {
      alias: {
        '@': resolve(__dirname, './src'), // 别名
      },
      extensions: [
        '.js',
        '.jsx',
        '.ts',
        '.tsx',
        '.json',
        '.css',
        '.scss',
        '.sass',
      ],
    },

    // 缓存目录：dev 放到 /tmp，prod 放到构建目录下
    cacheDir: mode === 'development' ? '/tmp/.vite-cache' : 'build/.vite-cache',

    server: {
      port: 5173,
      open: true,
      proxy: {
        // 前端发 /rpc/... → 直接转到 Kratos http://localhost:8000/rpc/...
        '/rpc': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
      },
      // 如果挂 NAS / WSL / Docker 卷，再打开下面这个
      // watch: {
      //   usePolling: true,
      //   interval: 100,
      // },
    },

    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        'react-helmet-async',
      ],
    },
  }
})