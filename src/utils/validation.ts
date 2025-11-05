/**
 * 입력 검증 유틸리티
 * XSS, SQL Injection 방지 및 데이터 무결성 보장
 */

export interface ValidationResult {
  isValid: boolean
  error?: string
}

/**
 * 시드 키워드 검증
 * 
 * @param {string} seed - 검증할 시드 키워드
 * @returns {ValidationResult} 검증 결과
 * 
 * @example
 * const result = validateSeedKeyword('봉천동맛집')
 * if (!result.isValid) {
 *   console.error(result.error)
 * }
 */
export function validateSeedKeyword(seed: string): ValidationResult {
  if (!seed || typeof seed !== 'string') {
    return { isValid: false, error: '시드 키워드를 입력해주세요.' }
  }

  const trimmed = seed.trim()
  
  if (trimmed.length === 0) {
    return { isValid: false, error: '시드 키워드는 공백일 수 없습니다.' }
  }

  if (trimmed.length > 100) {
    return { isValid: false, error: '시드 키워드는 100자 이하여야 합니다.' }
  }

  // 특수문자 검증 (SQL Injection 방지)
  // 허용: 한글, 영문, 숫자, 공백, 하이픈, 언더스코어
  const allowedPattern = /^[가-힣a-zA-Z0-9\s\-_]+$/
  if (!allowedPattern.test(trimmed)) {
    return { 
      isValid: false, 
      error: '시드 키워드에는 한글, 영문, 숫자, 공백, 하이픈(-), 언더스코어(_)만 사용할 수 있습니다.' 
    }
  }

  return { isValid: true }
}

/**
 * 숫자 입력 검증
 * 
 * @param {string | number | null | undefined} value - 검증할 값
 * @param {number} min - 최소값 (선택적)
 * @param {number} max - 최대값 (선택적)
 * @returns {ValidationResult} 검증 결과
 * 
 * @example
 * const result = validateNumber('100', 0, 1000)
 * if (!result.isValid) {
 *   console.error(result.error)
 * }
 */
export function validateNumber(
  value: string | number | null | undefined,
  min?: number,
  max?: number
): ValidationResult {
  if (value === null || value === undefined || value === '') {
    return { isValid: false, error: '값을 입력해주세요.' }
  }

  const num = typeof value === 'string' ? Number(value) : value

  if (isNaN(num) || !isFinite(num)) {
    return { isValid: false, error: '유효한 숫자를 입력해주세요.' }
  }

  if (min !== undefined && num < min) {
    return { isValid: false, error: `최소값은 ${min}입니다.` }
  }

  if (max !== undefined && num > max) {
    return { isValid: false, error: `최대값은 ${max}입니다.` }
  }

  return { isValid: true }
}

/**
 * XSS 방지를 위한 HTML 이스케이프
 * 
 * @param {string} text - 이스케이프할 텍스트
 * @returns {string} 이스케이프된 텍스트
 * 
 * @example
 * const safeText = escapeHtml('<script>alert("XSS")</script>')
 * // 결과: &lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}

/**
 * URL 검증
 * 
 * @param {string} url - 검증할 URL
 * @returns {ValidationResult} 검증 결과
 */
export function validateUrl(url: string): ValidationResult {
  if (!url || typeof url !== 'string') {
    return { isValid: false, error: 'URL을 입력해주세요.' }
  }

  try {
    const parsedUrl = new URL(url)
    // 허용된 프로토콜만 허용
    const allowedProtocols = ['http:', 'https:']
    if (!allowedProtocols.includes(parsedUrl.protocol)) {
      return { isValid: false, error: 'http 또는 https 프로토콜만 사용할 수 있습니다.' }
    }
    return { isValid: true }
  } catch {
    return { isValid: false, error: '유효한 URL 형식이 아닙니다.' }
  }
}

