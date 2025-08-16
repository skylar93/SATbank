const isDevelopment = process.env.NODE_ENV === 'development'

export const devLogger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log('🔧 [DEV LOG]:', ...args)
    }
  },
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn('⚠️ [DEV WARN]:', ...args)
    }
  },
  error: console.error,
}
