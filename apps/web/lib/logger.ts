const isDevelopment = process.env.NODE_ENV === 'development'

export const logger = {
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
  error: (...args: any[]) => {
    if (isDevelopment) {
      console.error('❌ [ERROR]:', ...args)
    }
  },
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info('ℹ️ [INFO]:', ...args)
    }
  },
}

// 하위 호환성을 위한 alias
export const devLogger = logger
