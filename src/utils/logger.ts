/**
 * 구조화된 로깅 시스템
 * 레벨별 로깅 및 향후 에러 추적 서비스 연동 준비
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: any
}

/**
 * 구조화된 로거 클래스
 * 
 * @example
 * logger.info('키워드 수집 시작', { seed: '봉천동맛집' })
 * logger.error('API 호출 실패', error, { statusCode: 500 })
 */
class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error) {
    const logEntry = {
      level,
      message,
      context,
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : undefined,
      timestamp: new Date().toISOString()
    }

    switch (level) {
      case 'debug':
        if (this.isDevelopment) {
          console.debug('🐛', logEntry)
        }
        break
      case 'info':
        console.info('ℹ️', logEntry)
        break
      case 'warn':
        console.warn('⚠️', logEntry)
        break
      case 'error':
        console.error('❌', logEntry)
        // 프로덕션에서는 에러 추적 서비스로 전송
        // TODO: if (process.env.NODE_ENV === 'production') {
        //   errorTrackingService.captureException(error, { extra: context })
        // }
        break
    }
  }

  /**
   * 디버그 로그 (개발 모드에서만 표시)
   */
  debug(message: string, context?: LogContext) {
    this.log('debug', message, context)
  }

  /**
   * 정보 로그
   */
  info(message: string, context?: LogContext) {
    this.log('info', message, context)
  }

  /**
   * 경고 로그
   */
  warn(message: string, context?: LogContext) {
    this.log('warn', message, context)
  }

  /**
   * 에러 로그
   */
  error(message: string, error?: Error, context?: LogContext) {
    this.log('error', message, context, error)
  }
}

export const logger = new Logger()

