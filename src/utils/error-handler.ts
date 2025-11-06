/**
 * 통일된 에러 처리 유틸리티
 */

import { logger } from './logger'

export interface ApiError {
  message: string
  code?: string
  statusCode?: number
  details?: unknown
}

export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }
}

/**
 * API 에러 처리
 * 
 * @param {Response} response - Fetch API 응답 객체
 * @returns {Promise<ApiError>} 처리된 에러 정보
 * 
 * @example
 * const response = await fetch('/api/endpoint')
 * if (!response.ok) {
 *   const error = await handleApiError(response)
 *   console.error(error.message)
 * }
 */
export async function handleApiError(response: Response): Promise<ApiError> {
  let errorMessage = '알 수 없는 오류가 발생했습니다.'
  let errorData: unknown = null

  try {
    errorData = await response.json()
    // 타입 가드: errorData가 객체인지 확인
    if (errorData && typeof errorData === 'object') {
      const data = errorData as Record<string, unknown>
      errorMessage = (data.error as string) || (data.message as string) || errorMessage
    }
  } catch {
    errorMessage = `HTTP ${response.status}: ${response.statusText}`
  }

  // 타입 가드: errorData가 객체인지 확인
  const data = errorData && typeof errorData === 'object' ? errorData as Record<string, unknown> : null

  return {
    message: errorMessage,
    code: data?.code as string | undefined,
    statusCode: response.status,
    details: errorData
  }
}

/**
 * 에러 로깅 (구조화된 로거 사용)
 * 
 * @param {Error | AppError} error - 에러 객체
 * @param {Record<string, any>} context - 추가 컨텍스트 정보
 * 
 * @example
 * try {
 *   // 코드...
 * } catch (error) {
 *   logError(error, { userId: 123, action: 'collect' })
 * }
 */
export function logError(error: Error | AppError, context?: Record<string, unknown>) {
  logger.error(error.message, error, context)
}

/**
 * 사용자 친화적인 에러 메시지 생성
 * 
 * @param {Error | ApiError} error - 에러 객체
 * @returns {string} 사용자 친화적인 에러 메시지
 * 
 * @example
 * try {
 *   // 코드...
 * } catch (error) {
 *   const message = getUserFriendlyErrorMessage(error)
 *   setMessage(`❌ ${message}`)
 * }
 */
export function getUserFriendlyErrorMessage(error: Error | ApiError): string {
  if (error instanceof AppError) {
    return error.message
  }

  if ('message' in error) {
    return error.message
  }

  return '알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
}

