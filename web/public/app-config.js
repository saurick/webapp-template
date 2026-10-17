// 派生项目可在部署时替换本文件；不要在这里放密钥或把功能开关当作权限校验。
window.__WEBAPP_CONFIG__ = window.__WEBAPP_CONFIG__ || {
  branding: {
    // 留空时继续使用构建期 VITE_APP_TITLE；部署期需要免重编译改名时再填写。
    productName: '',
    shortName: 'Workspace',
    adminName: 'Admin Preset',
    adminSubtitle: 'basic RBAC',
  },
  features: {
    adminGuide: true,
    mobileWorkQueue: false,
    auditLog: false,
    businessAttachments: false,
    printWorkspace: false,
    historyCenter: false,
  },
}
