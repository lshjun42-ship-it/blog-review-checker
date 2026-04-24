import React, { useState } from 'react';

export default function Home() {
  const [currentTab, setCurrentTab] = useState('settings');
  const [guidelines, setGuidelines] = useState('');
  const [guidelinesProcessed, setGuidelinesProcessed] = useState(null);
  const [urls, setUrls] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);

  const saveGuidelines = async () => {
    if (!guidelines.trim()) {
      alert('가이드라인을 입력해주세요!');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/process-guidelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guidelines: guidelines.trim() })
      });
      
      const data = await response.json();
      setGuidelinesProcessed(data.processed);
      setCurrentTab('urls');
      alert('가이드라인이 저장되었습니다!');
    } catch (error) {
      alert('오류: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const parseUrls = (text) => {
    return text.split('\n').map(line => line.trim()).filter(line => line.startsWith('http'));
  };

  const startReview = async () => {
    if (!guidelinesProcessed) {
      alert('먼저 가이드라인을 저장해주세요!');
      setCurrentTab('settings');
      return;
    }

    const urlList = parseUrls(urls);
    if (urlList.length === 0) {
      alert('유효한 URL을 입력해주세요!');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/review-blogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: urlList,
          guidelines: guidelinesProcessed
        })
      });

      const data = await response.json();
      setResults(data);
      setCurrentTab('results');
    } catch (error) {
      alert('오류: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadCSV = () => {
    if (!results) return;

    let csv = '번호,URL,판정,공정위,가이드라인,부족항목\n';
    results.reviews.forEach((review, idx) => {
      const status = review.status === 'pass' ? '통과' : review.status === 'warning' ? '경고' : '불통과';
      const ftc = review.ftc.found ? review.ftc.location : '없음';
      const items = review.missing_items.join(' | ');
      csv += `${idx + 1},"${review.url}","${status}","${ftc}","${review.guideline_match}%","${items}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `검수결과_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#fff', padding: '2rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📊 블로그 체험단 검수 시스템</h1>
        <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>필수 항목 중심, 유연한 판단</p>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid #334155', flexWrap: 'wrap' }}>
          {[
            { id: 'settings', label: '⚙️ 설정', disabled: false },
            { id: 'urls', label: '🔗 URL 입력', disabled: !guidelinesProcessed },
            { id: 'results', label: '📈 결과', disabled: !results }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && setCurrentTab(tab.id)}
              style={{
                padding: '1rem 1.5rem',
                background: currentTab === tab.id ? '#3b82f6' : 'transparent',
                color: currentTab === tab.id ? '#fff' : '#94a3b8',
                border: 'none',
                cursor: tab.disabled ? 'not-allowed' : 'pointer',
                opacity: tab.disabled ? 0.5 : 1,
                fontSize: '1rem',
                fontWeight: '500'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {currentTab === 'settings' && (
          <div style={{ background: '#1e293b', borderRadius: '1rem', padding: '2rem' }}>
            <h2 style={{ marginBottom: '1rem' }}>📝 가이드라인 입력</h2>
            <p style={{ color: '#94a3b8', marginBottom: '1rem' }}>자유로운 형식으로 입력하세요. AI가 자동으로 분류합니다.</p>
            
            <textarea
              value={guidelines}
              onChange={(e) => setGuidelines(e.target.value)}
              placeholder="예시:
약사 자격증 명시 필수
공정위 공시 상단에 필수
사진 5장 이상 권장
글자 2000자 이상 권장"
              style={{
                width: '100%',
                minHeight: '300px',
                padding: '1rem',
                background: '#0f172a',
                color: '#fff',
                border: '1px solid #334155',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                fontFamily: 'monospace',
                marginBottom: '1rem',
                boxSizing: 'border-box'
              }}
            />
            
            <button
              onClick={saveGuidelines}
              disabled={isLoading}
              style={{
                padding: '0.75rem 2rem',
                background: '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.7 : 1
              }}
            >
              {isLoading ? '처리 중...' : '✓ 가이드라인 저장'}
            </button>

            {guidelinesProcessed && (
              <div style={{ background: '#064e3b', padding: '1.5rem', borderRadius: '0.5rem', marginTop: '1.5rem', borderLeft: '4px solid #10b981' }}>
                <h3 style={{ marginBottom: '1rem', color: '#d1fae5' }}>✓ 분류된 가이드라인</h3>
                <pre style={{ background: '#0f172a', padding: '1rem', borderRadius: '0.25rem', overflow: 'auto', fontSize: '0.85rem', color: '#d1fae5' }}>
{JSON.stringify(guidelinesProcessed, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {currentTab === 'urls' && (
          <div style={{ background: '#1e293b', borderRadius: '1rem', padding: '2rem' }}>
            <h2 style={{ marginBottom: '1rem' }}>🔗 블로그 URL 입력</h2>
            
            <textarea
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              placeholder="https://blog.naver.com/...
https://blog.naver.com/...
https://blog.naver.com/..."
              style={{
                width: '100%',
                minHeight: '200px',
                padding: '1rem',
                background: '#0f172a',
                color: '#fff',
                border: '1px solid #334155',
                borderRadius: '0.5rem',
                fontSize: '0.95rem',
                fontFamily: 'monospace',
                marginBottom: '1rem',
                boxSizing: 'border-box'
              }}
            />

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button
                onClick={startReview}
                disabled={isLoading || parseUrls(urls).length === 0}
                style={{
                  padding: '0.75rem 2rem',
                  background: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: (isLoading || parseUrls(urls).length === 0) ? 'not-allowed' : 'pointer',
                  opacity: (isLoading || parseUrls(urls).length === 0) ? 0.5 : 1
                }}
              >
                {isLoading ? '검수 중...' : '🚀 검수 시작'}
              </button>
              <span style={{ color: '#94a3b8' }}>
                {parseUrls(urls).length} 개 URL 준비됨
              </span>
            </div>

            {isLoading && (
              <div style={{ marginTop: '2rem', background: '#0f172a', padding: '1.5rem', borderRadius: '0.5rem' }}>
                <p style={{ color: '#94a3b8' }}>검수 중입니다... 잠깐만 기다려주세요!</p>
              </div>
            )}
          </div>
        )}

        {currentTab === 'results' && results && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              {[
                { label: '전체', value: results.reviews.length, color: '#3b82f6' },
                { label: '✓ 통과', value: results.summary.passed, color: '#10b981' },
                { label: '⚠ 경고', value: results.summary.warnings, color: '#f59e0b' },
                { label: '✗ 불통과', value: results.summary.failed, color: '#ef4444' }
              ].map((stat, idx) => (
                <div
                  key={idx}
                  style={{
                    background: '#1e293b',
                    padding: '1.5rem',
                    borderRadius: '0.5rem',
                    borderLeft: `4px solid ${stat.color}`,
                    textAlign: 'center'
                  }}
                >
                  <p style={{ color: '#94a3b8', marginBottom: '0.5rem', fontSize: '0.9rem' }}>{stat.label}</p>
                  <p style={{ fontSize: '2rem', fontWeight: '700', color: stat.color }}>{stat.value}</p>
                </div>
              ))}
            </div>

            <div style={{ background: '#1e293b', borderRadius: '0.5rem', padding: '1.5rem', marginBottom: '2rem' }}>
              {results.reviews.map((review, idx) => (
                <div key={idx} style={{ 
                  borderLeft: `4px solid ${review.status === 'pass' ? '#10b981' : review.status === 'warning' ? '#f59e0b' : '#ef4444'}`,
                  padding: '1rem',
                  marginBottom: '1rem',
                  background: '#0f172a',
                  borderRadius: '0.5rem'
                }}>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>#{idx + 1}</span>
                    <span style={{
                      marginLeft: '1rem',
                      color: review.status === 'pass' ? '#10b981' : review.status === 'warning' ? '#f59e0b' : '#ef4444',
                      fontWeight: '600'
                    }}>
                      {review.status === 'pass' ? '✓ 통과' : review.status === 'warning' ? '⚠ 경고' : '✗ 불통과'}
                    </span>
                  </div>
                  <p style={{ color: '#3b82f6', marginBottom: '0.5rem', wordBreak: 'break-all' }}>
                    <a href={review.url} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'none' }}>
                      {review.url}
                    </a>
                  </p>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                    공정위: {review.ftc.found ? `✅ ${review.ftc.location}` : '❌ 없음'}
                  </p>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                    가이드라인: {review.guideline_match}%
                  </p>
                  {review.missing_items && review.missing_items.length > 0 && (
                    <p style={{ color: '#f87171', fontSize: '0.9rem' }}>
                      부족: {review.missing_items.join(' • ')}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={downloadCSV}
                style={{
                  padding: '0.75rem 2rem',
                  background: '#10b981',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                📥 CSV 다운로드
              </button>
              <button
                onClick={() => {
                  setCurrentTab('settings');
                  setGuidelines('');
                  setGuidelinesProcessed(null);
                  setUrls('');
                  setResults(null);
                }}
                style={{
                  padding: '0.75rem 2rem',
                  background: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                🔄 새 검수 시작
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
