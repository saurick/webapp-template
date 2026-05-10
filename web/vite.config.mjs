import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // 读取 .env.* 文件
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8200'

  const isProd = mode === 'production'
  const isDev = mode === 'development'

  // 只在开发环境打印调试信息，避免打包时报一堆东西
  if (!isProd) {
    console.log('env =', env)
    console.log('command =', command) // 'serve' | 'build'
    console.log('mode =', mode) // 'development' | 'production' | 自定义的mode
  }

  return {
    base: isDev ? '/' : env.VITE_BASE_URL || '/', // dev 在根，构建/预览在子路径

    plugins: [
      react(), // 处理react
    ],

    /**
     * 用 esbuild 在【生产环境】移除所有 console / debugger
     *  - 只影响打包产物，不影响开发环境
     */
    esbuild: {
      drop: isProd ? ['console', 'debugger'] : [],
    },

    reportCompressedSize: false, // 报告压缩大小

    build: {
      outDir: 'build', // 输出目录
      assetsDir: 'assets', // 资源目录
      sourcemap: !isProd, // 生产关闭 sourcemap
      minify: 'esbuild',
      cssMinify: 'esbuild',
      target: 'es2018',
      rollupOptions: {
        output: {
          // 对齐 webpack 的命名风格
          entryFileNames: 'assets/[name].[hash].js',
          chunkFileNames: 'assets/[name].[hash].js',
          assetFileNames: 'assets/[name].[hash].[ext]',

          // 后台 preset 的 antd 体积较大，单独拆包，避免用户端首屏默认加载后台依赖。
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (
                /[\\/]node_modules[\\/](antd|@ant-design|rc-[^\\/]+)/.test(id)
              ) {
                return 'admin-vendor'
              }
              if (
                /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|mobx)/.test(
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

    // 开发缓存按仓库隔离，避免多个 Vite 项目共用 /tmp 缓存触发 Outdated Optimize Dep
    cacheDir: resolve(
      __dirname,
      mode === 'development' ? '.vite-cache' : 'build/.vite-cache'
    ),

    server: {
      host: '0.0.0.0', // 监听所有地址，方便局域网测试
      port: 5177,
      strictPort: true,
      open: true,
      proxy: {
        // 默认跟随模板后端 8200；多项目并行时可用 VITE_API_PROXY_TARGET 显式覆盖。
        '/rpc': {
          target: apiProxyTarget,
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
      include: ['react', 'react-dom', 'react-router-dom', 'react-helmet-async'],
    },
  }
})
