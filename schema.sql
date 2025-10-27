-- 황금키워드 찾기 서비스 D1 데이터베이스 스키마

-- 키워드 테이블
CREATE TABLE keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seed TEXT NOT NULL,
  keyword TEXT NOT NULL,
  source TEXT DEFAULT 'naver-ads',
  last_related_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(seed, keyword)
);

-- 키워드 메트릭 테이블
CREATE TABLE keyword_metrics (
  keyword_id INTEGER NOT NULL REFERENCES keywords(id),
  monthly_search_pc INTEGER,
  monthly_search_mob INTEGER,
  avg_monthly_search INTEGER GENERATED ALWAYS AS (COALESCE(monthly_search_pc,0)+COALESCE(monthly_search_mob,0)) VIRTUAL,
  cpc REAL,
  comp_index REAL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(keyword_id)
);

-- 네이버 문서수 테이블
CREATE TABLE naver_doc_counts (
  keyword_id INTEGER NOT NULL REFERENCES keywords(id),
  blog_total INTEGER DEFAULT 0,
  cafe_total INTEGER DEFAULT 0,
  web_total INTEGER DEFAULT 0,
  news_total INTEGER DEFAULT 0,
  all_total INTEGER GENERATED ALWAYS AS (COALESCE(blog_total,0)+COALESCE(cafe_total,0)+COALESCE(web_total,0)+COALESCE(news_total,0)) VIRTUAL,
  collected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(keyword_id)
);

-- 자동수집 사용 기록 테이블
CREATE TABLE auto_seed_usage (
  seed TEXT PRIMARY KEY,
  last_auto_collect_at DATETIME NOT NULL,
  depth INTEGER DEFAULT 1,
  note TEXT
);

-- 수집 로그 테이블
CREATE TABLE collect_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT,
  type TEXT,
  status TEXT,
  message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX idx_doc_cafe ON naver_doc_counts(cafe_total, all_total);
CREATE INDEX idx_metrics_avg ON keyword_metrics(avg_monthly_search);
CREATE INDEX idx_keywords_created ON keywords(created_at);
CREATE INDEX idx_keywords_seed ON keywords(seed);
CREATE INDEX idx_auto_usage_date ON auto_seed_usage(last_auto_collect_at);
CREATE INDEX idx_logs_created ON collect_logs(created_at);
CREATE INDEX idx_logs_type ON collect_logs(type);

-- 초기 데이터 삽입 (개발용)
INSERT INTO keywords (seed, keyword, source, created_at) VALUES 
('블로그 마케팅', '블로그 마케팅 방법', 'naver-ads', datetime('now', '-1 day')),
('블로그 마케팅', '블로그 마케팅 가이드', 'naver-ads', datetime('now', '-1 day')),
('SEO 최적화', 'SEO 최적화 기법', 'naver-ads', datetime('now', '-2 days')),
('SEO 최적화', 'SEO 최적화 도구', 'naver-ads', datetime('now', '-2 days')),
('콘텐츠 마케팅', '콘텐츠 마케팅 전략', 'naver-ads', datetime('now', '-3 days')),
('콘텐츠 마케팅', '콘텐츠 마케팅 사례', 'naver-ads', datetime('now', '-3 days'));

-- 키워드 메트릭 초기 데이터
INSERT INTO keyword_metrics (keyword_id, monthly_search_pc, monthly_search_mob, cpc, comp_index, updated_at) VALUES 
(1, 1200, 800, 500, 80, datetime('now', '-1 day')),
(2, 900, 600, 450, 75, datetime('now', '-1 day')),
(3, 700, 500, 400, 70, datetime('now', '-2 days')),
(4, 600, 400, 350, 65, datetime('now', '-2 days')),
(5, 500, 350, 300, 60, datetime('now', '-3 days')),
(6, 400, 300, 250, 55, datetime('now', '-3 days'));

-- 네이버 문서수 초기 데이터
INSERT INTO naver_doc_counts (keyword_id, blog_total, cafe_total, web_total, news_total, collected_at) VALUES 
(1, 150, 50, 300, 20, datetime('now', '-1 day')),
(2, 200, 80, 400, 25, datetime('now', '-1 day')),
(3, 100, 30, 250, 15, datetime('now', '-2 days')),
(4, 80, 20, 200, 10, datetime('now', '-2 days')),
(5, 120, 40, 280, 18, datetime('now', '-3 days')),
(6, 90, 25, 220, 12, datetime('now', '-3 days'));
