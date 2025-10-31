-- 클라우드플레어 D1 데이터베이스 스키마
-- 키워드 테이블
CREATE TABLE IF NOT EXISTS keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT NOT NULL UNIQUE,
  seed_keyword_text TEXT NOT NULL,
  monthly_search_pc INTEGER DEFAULT 0,
  monthly_search_mob INTEGER DEFAULT 0,
  avg_monthly_search INTEGER DEFAULT 0,
  cpc REAL DEFAULT 0,
  comp_index INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 키워드 메트릭 테이블
CREATE TABLE IF NOT EXISTS keyword_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword_id INTEGER NOT NULL,
  monthly_click_pc INTEGER DEFAULT 0,
  monthly_click_mobile INTEGER DEFAULT 0,
  ctr_pc REAL DEFAULT 0,
  ctr_mobile REAL DEFAULT 0,
  ad_count INTEGER DEFAULT 0,
  FOREIGN KEY (keyword_id) REFERENCES keywords(id) ON DELETE CASCADE
);

-- 네이버 문서 수 테이블
CREATE TABLE IF NOT EXISTS naver_doc_counts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword_id INTEGER NOT NULL,
  blog_total INTEGER DEFAULT 0,
  cafe_total INTEGER DEFAULT 0,
  web_total INTEGER DEFAULT 0,
  news_total INTEGER DEFAULT 0,
  collected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (keyword_id) REFERENCES keywords(id) ON DELETE CASCADE
);

-- 시드 키워드 사용 기록 테이블
CREATE TABLE IF NOT EXISTS auto_seed_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seed TEXT NOT NULL UNIQUE,
  last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
  usage_count INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 수집 로그 테이블
CREATE TABLE IF NOT EXISTS collect_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 시스템 성능 모니터링 테이블
CREATE TABLE IF NOT EXISTS system_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_type TEXT NOT NULL, -- 'api_success_rate', 'db_performance', 'memory_usage', 'rate_limit'
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  metadata TEXT, -- JSON 형식으로 추가 정보 저장
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- API 호출 로그 테이블 (성공/실패 추적용)
CREATE TABLE IF NOT EXISTS api_call_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_type TEXT NOT NULL, -- 'searchad', 'openapi'
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  api_key_index INTEGER, -- 사용한 API 키 인덱스
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_keywords_seed ON keywords(seed_keyword_text);
CREATE INDEX IF NOT EXISTS idx_keywords_search_volume ON keywords(avg_monthly_search);
CREATE INDEX IF NOT EXISTS idx_keywords_created_at ON keywords(created_at);
CREATE INDEX IF NOT EXISTS idx_auto_seed_usage_seed ON auto_seed_usage(seed);
CREATE INDEX IF NOT EXISTS idx_collect_logs_created_at ON collect_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_system_metrics_type ON system_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_system_metrics_created_at ON system_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_api_call_logs_type ON api_call_logs(api_type);
CREATE INDEX IF NOT EXISTS idx_api_call_logs_created_at ON api_call_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_api_call_logs_success ON api_call_logs(success);
