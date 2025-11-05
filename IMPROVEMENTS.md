# 🔧 개선 제안서 (Improvements)

> **MCP 도구를 활용한 코드베이스 분석 결과**  
> **작성일**: 2025년 1월  
> **분석 도구**: Exa Search, Codebase Search

---

## 📊 개선 우선순위

### 🔴 높음 (Critical)
1. **Error Boundary 부재** - React 에러 처리 미흡
2. **타입 안전성** - `any` 타입 남용
3. **입력 검증 부족** - XSS/Injection 취약점 가능성

### 🟡 중간 (Important)
4. **에러 처리 일관성** - 일부 페이지만 try-catch 사용
5. **성능 최적화** - 불필요한 리렌더링 방지
6. **로깅 시스템** - 구조화된 에러 로깅 부족

### 🟢 낮음 (Nice to Have)
7. **접근성 개선** - ARIA 속성 추가
8. **코드 중복 제거** - 공통 유틸 함수 추출
9. **테스트 코드** - 단위 테스트 부재

---

## 🔴 1. Error Boundary 추가 (Critical)

### 문제점
- React 컴포넌트 에러 발생 시 전체 앱이 크래시됨
- 사용자에게 친화적인 에러 메시지 없음
- 에러 추적 불가능

### 해결 방법

**파일**: `src/components/ErrorBoundary.tsx` (신규 생성)

```typescript
'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

/**
 * React Error Boundary 컴포넌트
 * 컴포넌트 트리에서 발생한 에러를 캐치하여 처리
 * 
 * @example
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 에러 로깅 (향후 에러 추적 서비스 연동 가능)
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    
    this.setState({
      error,
      errorInfo
    })

    // TODO: 에러 추적 서비스로 전송 (예: Sentry, LogRocket)
    // logErrorToService(error, errorInfo)
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
              문제가 발생했습니다
            </h2>
            <p className="text-gray-600 text-center mb-4">
              예기치 않은 오류가 발생했습니다. 페이지를 새로고침하거나 다시 시도해주세요.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-4">
                <summary className="text-sm text-gray-500 cursor-pointer mb-2">
                  에러 상세 정보 (개발 모드)
                </summary>
                <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-40">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            <div className="flex gap-2">
              <button
                onClick={this.handleReset}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
              >
                다시 시도
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 transition-colors"
              >
                페이지 새로고침
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
```

**적용 위치**: `src/app/layout.tsx`

```typescript
import ErrorBoundary from '@/components/ErrorBoundary'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <ErrorBoundary>
          <div className="min-h-screen bg-gray-50">
            {/* 기존 네비게이션 및 메인 컨텐츠 */}
          </div>
        </ErrorBoundary>
      </body>
    </html>
  )
}
```

**예상 효과**:
- ✅ 컴포넌트 에러 발생 시 전체 앱 크래시 방지
- ✅ 사용자 친화적인 에러 메시지 제공
- ✅ 개발 모드에서 에러 상세 정보 표시

---

## 🔴 2. 타입 안전성 개선 (Critical)

### 문제점
- `any` 타입 남용으로 타입 안전성 저하
- 런타임 에러 가능성 증가
- IDE 자동완성 기능 제한

### 해결 방법

**파일**: `src/types/api.ts` (신규 생성)

```typescript
/**
 * API 응답 타입 정의
 */

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  timestamp?: string
}

export interface KeywordData {
  keyword: string
  avg_monthly_search: number
  blog_total?: number
  cafe_total?: number
  web_total?: number
  news_total?: number
  monthly_click_pc?: number
  monthly_click_mo?: number
  ctr_pc?: number
  ctr_mo?: number
  ad_count?: number
  pc_search: number
  mobile_search: number
  created_at?: string
  updated_at?: string
}

export interface CollectNaverResponse extends ApiResponse {
  seed: string
  totalCollected: number
  totalSavedOrUpdated: number
  savedCount: number
  updatedCount: number
  failedCount: number
  skippedCount: number
  totalAttempted: number
  keywords: KeywordData[]
  failedSamples: Array<{
    keyword: string
    error: string
  }>
  version: string
}

export interface KeywordsResponse extends ApiResponse {
  keywords: KeywordData[]
  total: number
  page: number
  pageSize: number
}

export interface AutoCollectResponse extends ApiResponse {
  processed: number
  processedSeeds: string[]
  remaining: number
  totalKeywords: number
  usedSeeds: number
  unlimited: boolean
  concurrentLimit: number
  totalKeywordsCollected: number
  totalKeywordsSaved: number
  totalNewKeywords: number
  targetKeywords: number
  targetReached: boolean
  message: string
}
```

**적용 예시**: `functions/api/collect-naver.ts`

```typescript
// 기존
export async function onRequest(context: any) { ... }

// 개선
import type { PagesFunction } from '@cloudflare/pages-types'

export async function onRequest(context: PagesFunction<{ DB: D1Database }>) {
  const { request, env } = context
  // 타입 안전성 보장
}
```

**예상 효과**:
- ✅ 컴파일 타임 에러 감지
- ✅ IDE 자동완성 개선
- ✅ 코드 가독성 향상

---

## 🔴 3. 입력 검증 강화 (Critical)

### 문제점
- 사용자 입력 검증 부족
- SQL Injection 가능성 (D1은 파라미터화 쿼리 사용하지만 추가 검증 필요)
- XSS 취약점 가능성

### 해결 방법

**파일**: `src/utils/validation.ts` (신규 생성)

```typescript
/**
 * 입력 검증 유틸리티
 */

export interface ValidationResult {
  isValid: boolean
  error?: string
}

/**
 * 시드 키워드 검증
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
  const dangerousChars = /[;'"\\<>]/g
  if (dangerousChars.test(trimmed)) {
    return { isValid: false, error: '시드 키워드에 특수문자를 사용할 수 없습니다.' }
  }

  return { isValid: true }
}

/**
 * 숫자 입력 검증
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
```

**적용 예시**: `src/app/page.tsx`

```typescript
import { validateSeedKeyword } from '@/utils/validation'

const handleCollect = async () => {
  // 검증 추가
  const validation = validateSeedKeyword(seed)
  if (!validation.isValid) {
    setMessage(`❌ ${validation.error}`)
    return
  }

  // 기존 로직...
}
```

**예상 효과**:
- ✅ SQL Injection 방지
- ✅ XSS 공격 방지
- ✅ 사용자 입력 오류 사전 차단

---

## 🟡 4. 에러 처리 일관성 개선 (Important)

### 문제점
- 일부 페이지에서만 try-catch 사용
- 에러 메시지 형식 불일치
- 에러 로깅 방식이 일관되지 않음

### 해결 방법

**파일**: `src/utils/error-handler.ts` (신규 생성)

```typescript
/**
 * 통일된 에러 처리 유틸리티
 */

export interface ApiError {
  message: string
  code?: string
  statusCode?: number
  details?: any
}

export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message)
    this.name = 'AppError'
  }
}

/**
 * API 에러 처리
 */
export async function handleApiError(response: Response): Promise<ApiError> {
  let errorMessage = '알 수 없는 오류가 발생했습니다.'
  let errorData: any = null

  try {
    errorData = await response.json()
    errorMessage = errorData.error || errorData.message || errorMessage
  } catch {
    errorMessage = `HTTP ${response.status}: ${response.statusText}`
  }

  return {
    message: errorMessage,
    code: errorData?.code,
    statusCode: response.status,
    details: errorData
  }
}

/**
 * 에러 로깅 (향후 에러 추적 서비스 연동)
 */
export function logError(error: Error | AppError, context?: Record<string, any>) {
  const errorInfo = {
    message: error.message,
    name: error.name,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString()
  }

  console.error('🚨 Error:', errorInfo)

  // TODO: 에러 추적 서비스로 전송
  // if (process.env.NODE_ENV === 'production') {
  //   errorTrackingService.captureException(error, { extra: context })
  // }
}

/**
 * 사용자 친화적인 에러 메시지 생성
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
```

**적용 예시**: 모든 API 호출 부분

```typescript
import { handleApiError, logError, getUserFriendlyErrorMessage } from '@/utils/error-handler'

try {
  const response = await fetch('/api/collect-naver', { ... })
  
  if (!response.ok) {
    const apiError = await handleApiError(response)
    setMessage(`❌ ${apiError.message}`)
    logError(new Error(apiError.message), { apiError })
    return
  }

  const data = await response.json()
  // 성공 처리...
} catch (error) {
  const message = getUserFriendlyErrorMessage(error as Error)
  setMessage(`❌ ${message}`)
  logError(error as Error, { seed })
}
```

---

## 🟡 5. 성능 최적화 (Important)

### 문제점
- 불필요한 리렌더링 발생 가능
- 큰 데이터셋 처리 시 성능 저하
- 메모이제이션 미적용 구간 존재

### 해결 방법

**1. React.memo 적절한 사용**

```typescript
// 이미 적용된 부분: KeywordRow는 memo 사용 중 ✅
// 추가 개선: 큰 리스트에서 가상 스크롤링 고려
```

**2. useMemo/useCallback 최적화**

```typescript
// src/app/data/page.tsx
const filteredKeywords = useMemo(() => {
  return keywords.filter(k => {
    // 필터링 로직
  })
}, [keywords, filters])

const handlePageChange = useCallback((page: number) => {
  loadKeywords(page)
}, [loadKeywords])
```

**3. 코드 스플리팅**

```typescript
// src/app/insights/page.tsx
import dynamic from 'next/dynamic'

const InsightsChart = dynamic(() => import('@/components/InsightsChart'), {
  loading: () => <div>로딩 중...</div>,
  ssr: false
})
```

---

## 🟡 6. 구조화된 로깅 시스템 (Important)

### 문제점
- console.log 남용
- 로그 레벨 구분 없음
- 프로덕션 환경에서 민감 정보 노출 가능

### 해결 방법

**파일**: `src/utils/logger.ts` (신규 생성)

```typescript
/**
 * 구조화된 로깅 시스템
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: any
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'

  private log(level: LogLevel, message: string, context?: LogContext) {
    const logEntry = {
      level,
      message,
      context,
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
        break
    }
  }

  debug(message: string, context?: LogContext) {
    this.log('debug', message, context)
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context)
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context)
  }

  error(message: string, error?: Error, context?: LogContext) {
    this.log('error', message, {
      ...context,
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : undefined
    })
  }
}

export const logger = new Logger()
```

---

## 🟢 7. 접근성 개선 (Nice to Have)

### 문제점
- ARIA 속성 부족
- 키보드 네비게이션 미지원 구간
- 스크린 리더 호환성 부족

### 해결 방법

```typescript
// 버튼에 aria-label 추가
<button
  onClick={handleCollect}
  aria-label="키워드 수집 시작"
  className="..."
>
  수집
</button>

// 로딩 상태 표시
<div role="status" aria-live="polite" aria-busy={loading}>
  {loading && '로딩 중...'}
</div>

// 에러 메시지
<div role="alert" aria-live="assertive">
  {error && <p>{error}</p>}
</div>
```

---

## 📝 구현 우선순위

### Phase 1 (즉시 구현)
1. ✅ Error Boundary 추가
2. ✅ 입력 검증 강화
3. ✅ 에러 처리 일관성 개선

### Phase 2 (1주일 내)
4. ✅ 타입 안전성 개선
5. ✅ 구조화된 로깅 시스템
6. ✅ 성능 최적화

### Phase 3 (향후)
7. ✅ 접근성 개선
8. ✅ 테스트 코드 작성
9. ✅ 문서화 개선

---

## 🔗 참고 자료

- [Next.js Error Handling](https://nextjs.org/docs/pages/building-your-application/configuring/error-handling)
- [React Error Boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [TypeScript Best Practices](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

---

**문서 작성일**: 2025년 1월  
**다음 리뷰**: 구현 완료 후

