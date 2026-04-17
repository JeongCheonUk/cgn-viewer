import { useState, useEffect } from 'react';
import { channelApi, dataApi } from '../../api/viewerClient';
import type { Channel, StatsResponse } from '../../types/viewer';
import DataTable from './DataTable';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './ViewerPage.css';

const ViewerPage = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<number | null>(null);
  const [queryMode, setQueryMode] = useState<'single' | 'range'>('single');
  const [selectedDate, setSelectedDate] = useState<string | null>(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState<string | null>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string | null>(new Date().toISOString().split('T')[0]);
  const [isSinglePickerOpen, setIsSinglePickerOpen] = useState(false);
  const [isStartPickerOpen, setIsStartPickerOpen] = useState(false);
  const [isEndPickerOpen, setIsEndPickerOpen] = useState(false);
  const [statsData, setStatsData] = useState<StatsResponse | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => { loadChannels(); }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showUploadModal) { setShowUploadModal(false); return; }
        if (showShortcutHelp) { setShowShortcutHelp(false); return; }
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (showUploadModal) return;
      if (['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        const idx = parseInt(e.key);
        if (channels.length >= idx) setSelectedChannel(channels[idx - 1].id);
        return;
      }
      if (e.key === 'Enter') { e.preventDefault(); const btn = document.querySelector('.excel-download-button') as HTMLButtonElement; if (btn) btn.click(); return; }
      if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); setShowUploadModal(true); return; }
      if (!selectedChannel) return;
      const today = new Date().toISOString().split('T')[0];
      if (queryMode === 'single') {
        const cur = new Date(selectedDate || today);
        if (e.key === 'ArrowLeft') { e.preventDefault(); cur.setDate(cur.getDate() - 1); setSelectedDate(cur.toISOString().split('T')[0]); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); cur.setDate(cur.getDate() + 1); setSelectedDate(cur.toISOString().split('T')[0]); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); cur.setMonth(cur.getMonth() - 1); setSelectedDate(cur.toISOString().split('T')[0]); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); cur.setMonth(cur.getMonth() + 1); setSelectedDate(cur.toISOString().split('T')[0]); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedChannel, queryMode, selectedDate, startDate, endDate, showUploadModal, channels, showShortcutHelp]);

  useEffect(() => { if (channels.length > 0 && !selectedChannel) { const ko = channels.find(ch => ch.name === '한국'); if (ko) setSelectedChannel(ko.id); } }, [channels]);
  useEffect(() => { if (selectedChannel) { setSelectedDate(null); setStatsData(null); } }, [selectedChannel]);
  useEffect(() => {
    if (selectedChannel) {
      if (queryMode === 'single' && selectedDate) loadStats(selectedChannel, selectedDate, null);
      else if (queryMode === 'range' && startDate && endDate) loadStats(selectedChannel, startDate, endDate);
    }
  }, [selectedChannel, selectedDate, startDate, endDate, queryMode]);

  const loadChannels = async () => {
    try { const r = await channelApi.getAll(); setChannels(r.data); }
    catch { showMessage('error', '채널 목록을 불러오는데 실패했습니다.'); }
  };

  const loadStats = async (channelId: number, start: string, end: string | null) => {
    try { setLoading(true); const r = await dataApi.getStats(channelId, start, end); setStatsData(r.data); }
    catch { showMessage('error', '통계 데이터를 불러오는데 실패했습니다.'); }
    finally { setLoading(false); }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files?.[0]?.name.endsWith('.csv')) setUploadFile(files[0]);
    else showMessage('error', 'CSV 파일만 업로드 가능합니다.');
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, '0')}월 ${String(d.getDate()).padStart(2, '0')}일`;
  };

  const changeDate = (type: 'single' | 'start' | 'end', direction: 'prev' | 'next') => {
    const today = new Date().toISOString().split('T')[0];
    const change = (dateStr: string, days: number) => { const d = new Date(dateStr); d.setDate(d.getDate() + days); return d.toISOString().split('T')[0]; };
    if (type === 'single') setSelectedDate(change(selectedDate || today, direction === 'next' ? 1 : -1));
    else if (type === 'start') { const n = change(startDate || today, direction === 'next' ? 1 : -1); if (n <= (endDate || today)) setStartDate(n); else showMessage('error', '시작 날짜는 종료 날짜 이후로 설정할 수 없습니다.'); }
    else if (type === 'end') { const n = change(endDate || today, direction === 'next' ? 1 : -1); if (n >= (startDate || today)) setEndDate(n); else showMessage('error', '종료 날짜는 시작 날짜 이전으로 설정할 수 없습니다.'); }
  };

  const handleReset = () => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedChannel(null); setSelectedDate(today); setStartDate(today); setEndDate(today);
    setStatsData(null); setUploadFile(null); setMessage(null);
    loadChannels();
  };

  const handleUpload = async () => {
    if (!uploadFile) { showMessage('error', '파일을 선택해주세요.'); return; }
    try {
      setLoading(true);
      await dataApi.uploadCSV(uploadFile);
      showMessage('success', '파일이 성공적으로 업로드되었습니다.');
      setUploadFile(null); setShowUploadModal(false);
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      if (selectedChannel && selectedDate) {
        if (queryMode === 'single' && selectedDate) loadStats(selectedChannel, selectedDate, null);
        else if (queryMode === 'range' && startDate && endDate) loadStats(selectedChannel, startDate, endDate);
      }
      loadChannels();
    } catch (error: unknown) {
      let msg = '파일 업로드에 실패했습니다.';
      if (error && typeof error === 'object' && 'response' in error) {
        const r = (error as { response?: { data?: { error?: string } } }).response;
        msg = r?.data?.error || msg;
      }
      showMessage('error', msg);
    } finally { setLoading(false); }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const today = new Date().toISOString().split('T')[0];
  const displayDate = selectedDate || today;
  const displayStartDate = startDate || today;
  const displayEndDate = endDate || today;

  return (
    <div className="viewer-container">
      <header className="viewer-header">
        <div className="viewer-header-content">
          <div className="viewer-header-left">
            <div className="viewer-header-title" onClick={handleReset} style={{ cursor: 'pointer' }}>
              <h1>CGN Viewer</h1>
            </div>
          </div>
          <div className="viewer-header-controls">
            <div className="viewer-control-item">
              <label>채널</label>
              <select value={selectedChannel || ''} onChange={(e) => setSelectedChannel(Number(e.target.value))} className="viewer-select">
                <option value="">선택</option>
                {channels.map((ch) => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
              </select>
            </div>
            <div className="viewer-control-item">
              <label>조회 방식</label>
              <div className="viewer-radio-group">
                <label className="viewer-radio-label">
                  <input type="radio" value="single" checked={queryMode === 'single'} onChange={(e) => setQueryMode(e.target.value as 'single' | 'range')} />
                  <span>당일 조회</span>
                </label>
                <label className="viewer-radio-label">
                  <input type="radio" value="range" checked={queryMode === 'range'} onChange={(e) => setQueryMode(e.target.value as 'single' | 'range')} />
                  <span>기간 조회</span>
                </label>
              </div>
            </div>
            <button onClick={() => setShowUploadModal(true)} className="viewer-csv-btn">CSV 등록</button>
          </div>
        </div>
      </header>

      {message && <div className={`viewer-message ${message.type}`}>{message.text}</div>}
      {loading && <div className="viewer-loading">데이터를 불러오는 중...</div>}

      {selectedChannel && (() => {
        const channelName = channels.find(ch => ch.id === selectedChannel)?.name || '';
        return (
          <div className="viewer-stats-wrapper">
            <div className="viewer-data-info-bar">
              <div className="viewer-info-left"><h2>{channelName} 채널</h2></div>
              <div className="viewer-date-nav">
                {queryMode === 'single' ? (
                  <div className="viewer-date-nav-item">
                    <button onClick={() => changeDate('single', 'prev')} className="viewer-date-btn">◀</button>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <span className="viewer-date-display clickable" onClick={() => setIsSinglePickerOpen(v => !v)}>
                        {formatDate(selectedDate || today)}
                      </span>
                      {isSinglePickerOpen && (
                        <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}>
                          <DatePicker
                            selected={displayDate ? new Date(displayDate) : new Date()}
                            onChange={(date: Date | null) => { if (date) { setSelectedDate(date.toISOString().split('T')[0]); setIsSinglePickerOpen(false); } }}
                            inline
                          />
                        </div>
                      )}
                    </div>
                    <button onClick={() => changeDate('single', 'next')} className="viewer-date-btn">▶</button>
                  </div>
                ) : (
                  <div className="viewer-date-nav-range">
                    <div className="viewer-date-nav-item">
                      <button onClick={() => changeDate('start', 'prev')} className="viewer-date-btn">◀</button>
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <span className="viewer-date-display clickable" onClick={() => { setIsStartPickerOpen(v => !v); setIsEndPickerOpen(false); }}>
                          {formatDate(startDate || today)}
                        </span>
                        {isStartPickerOpen && (
                          <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}>
                            <DatePicker
                              selected={displayStartDate ? new Date(displayStartDate) : new Date()}
                              onChange={(date: Date | null) => { if (date) { const d = date.toISOString().split('T')[0]; if (d <= (endDate || today)) { setStartDate(d); setIsStartPickerOpen(false); } else showMessage('error', '시작 날짜는 종료 날짜 이후로 설정할 수 없습니다.'); } }}
                              inline
                            />
                          </div>
                        )}
                      </div>
                      <button onClick={() => changeDate('start', 'next')} className="viewer-date-btn">▶</button>
                    </div>
                    <span className="viewer-date-sep">~</span>
                    <div className="viewer-date-nav-item">
                      <button onClick={() => changeDate('end', 'prev')} className="viewer-date-btn">◀</button>
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <span className="viewer-date-display clickable" onClick={() => { setIsEndPickerOpen(v => !v); setIsStartPickerOpen(false); }}>
                          {formatDate(endDate || today)}
                        </span>
                        {isEndPickerOpen && (
                          <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}>
                            <DatePicker
                              selected={displayEndDate ? new Date(displayEndDate) : new Date()}
                              onChange={(date: Date | null) => { if (date) { const d = date.toISOString().split('T')[0]; if (d >= (startDate || today)) { setEndDate(d); setIsEndPickerOpen(false); } else showMessage('error', '종료 날짜는 시작 날짜 이전으로 설정할 수 없습니다.'); } }}
                              inline
                            />
                          </div>
                        )}
                      </div>
                      <button onClick={() => changeDate('end', 'next')} className="viewer-date-btn">▶</button>
                    </div>
                  </div>
                )}
              </div>
              <button onClick={() => { const btn = document.querySelector('.excel-download-button') as HTMLButtonElement; if (btn) btn.click(); }} className="viewer-excel-btn">
                엑셀 다운로드
              </button>
            </div>
            {!loading && (
              <div className="viewer-stats-section">
                <DataTable
                  stats={statsData?.stats || []}
                  totalRequests={statsData?.totalRequests || 0}
                  channelName={channelName}
                  dateInfo={queryMode === 'single' ? formatDate(displayDate) : `${formatDate(displayStartDate)} ~ ${formatDate(displayEndDate)}`}
                />
              </div>
            )}
          </div>
        );
      })()}

      {showUploadModal && (
        <div className="viewer-modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="viewer-modal" onClick={(e) => e.stopPropagation()}>
            <div className="viewer-modal-header">
              <h2>CSV 파일 업로드</h2>
              <button className="viewer-modal-close" onClick={() => setShowUploadModal(false)}>✕</button>
            </div>
            <div className="viewer-modal-body">
              <div className={`viewer-upload-area ${isDragging ? 'dragging' : ''}`} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
                <input id="file-upload" type="file" accept=".csv" onChange={(e) => { if (e.target.files?.[0]) setUploadFile(e.target.files[0]); }} className="viewer-file-input" />
                {!uploadFile && <p className="viewer-drag-text">{isDragging ? '파일을 놓으세요' : '파일을 드래그하거나 선택하세요'}</p>}
                {uploadFile && <p className="viewer-file-name">선택된 파일: {uploadFile.name}</p>}
              </div>
            </div>
            <div className="viewer-modal-footer">
              <button onClick={() => setShowUploadModal(false)} className="viewer-btn-cancel">취소</button>
              <button onClick={handleUpload} disabled={!uploadFile || loading} className="viewer-btn-upload">
                {loading ? '업로드 중...' : '업로드'}
              </button>
            </div>
          </div>
        </div>
      )}

      <button className="viewer-shortcut-btn" onClick={() => setShowShortcutHelp(!showShortcutHelp)} title="키보드 단축키">?</button>

      {showShortcutHelp && (
        <div className="viewer-shortcut-panel">
          <div className="viewer-shortcut-header">
            <h3>⌨️ 키보드 단축키</h3>
            <button onClick={() => setShowShortcutHelp(false)}>✕</button>
          </div>
          <div className="viewer-shortcut-content">
            <div className="viewer-shortcut-section">
              <h4>채널 선택</h4>
              {[['1', '한국'], ['2', '중문'], ['3', '일본'], ['4', '미국']].map(([k, v]) => (
                <div key={k} className="viewer-shortcut-item"><kbd>{k}</kbd><span>{v} 채널</span></div>
              ))}
            </div>
            <div className="viewer-shortcut-section">
              <h4>날짜 이동</h4>
              {[['←', '전날'], ['→', '다음날'], ['↑', '이전달'], ['↓', '다음달']].map(([k, v]) => (
                <div key={k} className="viewer-shortcut-item"><kbd>{k}</kbd><span>{v}</span></div>
              ))}
            </div>
            <div className="viewer-shortcut-section">
              <h4>기능</h4>
              <div className="viewer-shortcut-item"><kbd>Space</kbd><span>CSV 업로드</span></div>
              <div className="viewer-shortcut-item"><kbd>Enter</kbd><span>엑셀 다운로드</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewerPage;
