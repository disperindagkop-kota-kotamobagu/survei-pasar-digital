'use client';
import { useState, useEffect, useCallback } from 'react';
import { Submission } from '@/lib/supabaseClient';
import { Check, X, Camera, MapPin, Scan, Filter, Zap, Clock, Info } from 'lucide-react';

export default function CheckerPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'danger'; msg: string } | null>(null);

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    try {
      const { supabase } = await import('@/lib/supabaseClient');
      const { data, error } = await supabase
        .from('submissions')
        .select(`
          *,
          surveyor:profiles(full_name),
          market:markets(name)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Fetch error:', error);
        return;
      }

      const transformed: Submission[] = data.map((s: any) => ({
        ...s,
        surveyor_name: s.surveyor?.full_name || 'Surveyor Tidak Dikenal',
        market_name: s.market?.name || 'Pasar Tidak Dikenal'
      }));

      setSubmissions(transformed);
    } catch (e) {
      console.error('Connection error:', e);
    }
  };

  const showToast = (type: 'success' | 'danger', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAutoApprove = async () => {
    const qualifying = submissions.filter(s => 
      s.status === 'pending' && 
      s.is_geofence_valid && 
      s.ocr_amount_detect && Math.abs(s.ocr_amount_detect - s.amount) < 1
    );

    if (qualifying.length === 0) {
      showToast('danger', 'Tidak ada data valid yang memenuhi kriteria otomatis.');
      return;
    }

    if (!confirm(`Setujui otomatis ${qualifying.length} data yang valid?`)) return;

    setProcessing('auto');
    let successCount = 0;
    
    for (const sub of qualifying) {
      try {
        const { supabase } = await import('@/lib/supabaseClient');
        const { error } = await supabase
          .from('submissions')
          .update({ status: 'approved' })
          .eq('id', sub.id);
        
        if (!error) {
          await fetch('/api/recap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sub),
          });
          successCount++;
        }
      } catch (e) {
        console.error('Auto-approve error:', e);
      }
    }

    showToast('success', `${successCount} data berhasil disetujui otomatis.`);
    fetchSubmissions();
    setProcessing(null);
  };

  const handleAction = useCallback(async (id: string, action: 'approved' | 'rejected') => {
    setProcessing(id);
    try {
      const { supabase } = await import('@/lib/supabaseClient');
      const { error } = await supabase
        .from('submissions')
        .update({ status: action })
        .eq('id', id);
      
      if (error) {
        showToast('danger', 'Gagal memperbarui status.');
        setProcessing(null);
        return;
      }

      if (action === 'approved') {
        const sub = submissions.find(s => s.id === id);
        if (sub) {
          showToast('success', 'Data disetujui. Mengunggah ke Google...');
          const res = await fetch('/api/recap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sub),
          });
          const result = await res.json();
          if (result.success) {
            showToast('success', 'Berhasil tersinkron ke Google!');
          } else {
            showToast('danger', 'Gagal rekap Google: ' + result.error);
          }
        }
      } else {
        showToast('danger', 'Data telah ditolak.');
      }

      setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status: action } : s));
    } catch (e) {
      showToast('danger', 'Terjadi kesalahan teknis.');
    } finally {
      setProcessing(null);
    }
  }, [submissions]);

  const filtered = filter === 'all' ? submissions : submissions.filter(s => s.status === filter);
  const counts = {
    all: submissions.length,
    pending: submissions.filter(s => s.status === 'pending').length,
    approved: submissions.filter(s => s.status === 'approved').length,
    rejected: submissions.filter(s => s.status === 'rejected').length,
  };

  const autoApprovableCount = submissions.filter(s => s.status === 'pending' && s.is_geofence_valid && s.ocr_amount_detect && Math.abs(s.ocr_amount_detect - s.amount) < 1).length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Verifikasi Data</h1>
          <p className="page-subtitle">Validasi dan setujui laporan survei pasar harian</p>
        </div>
        {counts.pending > 0 && (
          <div className="pulse-container">
             <div className="pulse-badge">
                <span className="pulse-dot" />
                {counts.pending} Perlu Verifikasi
             </div>
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 9999 }}>
          <div className={`alert alert-${toast.type} floating-toast`}>
            {toast.msg}
          </div>
        </div>
      )}

      <div className="page-body">
        {/* Info & Auto Approve Area */}
        <div className="card mb-6" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.05), rgba(139,92,246,0.05))', border: '1px solid var(--primary-light)', padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                <Zap size={20} fill="white" />
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: 15 }}>Asisten Verifikasi Otomatis</p>
                <p className="text-xs text-muted">Sistem mendeteksi {autoApprovableCount} data dengan GPS & OCR yang cocok sempurna.</p>
              </div>
            </div>
            <button 
              className="btn btn-primary" 
              onClick={handleAutoApprove}
              disabled={processing === 'auto' || autoApprovableCount === 0}
              style={{ background: autoApprovableCount > 0 ? 'var(--primary)' : 'var(--border)', minWidth: 160 }}
            >
              {processing === 'auto' ? <span className="spinner" /> : <Check size={16} strokeWidth={3} style={{ marginRight: 8 }} />}
              Setujui {autoApprovableCount} Data
            </button>
          </div>
        </div>

        {/* Filter Navigation */}
        <div className="filter-nav mb-6">
          {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`filter-tab ${filter === f ? 'active' : ''}`}
            >
              {f === 'all' ? 'Semua Data' : f === 'pending' ? 'Menunggu' : f === 'approved' ? 'Disetujui' : 'Ditolak'}
              <span className="count-tag">{counts[f]}</span>
            </button>
          ))}
        </div>

        {/* Submissions List */}
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📂</div>
            <h3>Tidak ada data</h3>
            <p className="text-muted">Semua data dalam kategori {filter} sudah diproses.</p>
          </div>
        ) : (
          <div className="submission-list">
            {filtered.map(sub => (
              <div key={sub.id} className="modern-card">
                <div className="card-photo-section">
                  {sub.photo_url ? (
                    <div className="photo-container" onClick={() => setSelectedPhoto(sub.photo_url)}>
                      <img src={sub.photo_url} alt="Bukti" />
                      <div className="photo-overlay">
                        <Camera size={20} color="white" />
                        <span>Lihat Foto</span>
                      </div>
                    </div>
                  ) : (
                    <div className="no-photo">
                      <Camera size={32} color="var(--text-muted)" />
                      <p>Sinyal Lemah</p>
                    </div>
                  )}
                </div>

                <div className="card-content-section">
                  <div className="content-header">
                    <div>
                      <h3 className="market-name">{sub.market_name || 'Pasar Tidak Dikenal'}</h3>
                      <div className="surveyor-info">
                         <div className="avatar-mini">{(sub.surveyor_name || '?').charAt(0)}</div>
                         <span>{sub.surveyor_name || 'Tidak Ada Nama'}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                       <div className={`status-badge ${sub.status}`}>{sub.status.toUpperCase()}</div>
                       <p className="time-info"><Clock size={12} style={{ marginRight: 4 }} /> {new Date(sub.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>

                  <div className="validation-grid">
                    <div className={`valid-item ${sub.is_geofence_valid ? 'success' : 'danger'}`}>
                      <MapPin size={14} />
                      <span>GPS: {sub.is_geofence_valid ? 'BERADA DI LOKASI' : 'DI LUAR RADIUS'}</span>
                    </div>
                    {sub.ocr_amount_detect && (
                      <div className={`valid-item ${Math.abs(sub.ocr_amount_detect - sub.amount) < 1 ? 'success' : 'warning'}`}>
                        <Scan size={14} />
                        <span>OCR: {Math.abs(sub.ocr_amount_detect - sub.amount) < 1 ? 'NOMINAL COCOK' : `BEDA: ${sub.ocr_amount_detect.toLocaleString('id')}`}</span>
                      </div>
                    )}
                  </div>

                  <div className="amount-section">
                    <p className="amount-val">Rp {sub.amount.toLocaleString('id-ID')}</p>
                    {sub.notes && <p className="notes-val"><Info size={14} style={{ marginRight: 6 }} /> {sub.notes}</p>}
                  </div>

                  {sub.status === 'pending' && (
                    <div className="action-footer">
                      <button
                        className="btn-action approve"
                        disabled={!!processing}
                        onClick={() => handleAction(sub.id, 'approved')}
                      >
                        {processing === sub.id ? <span className="spinner-mini" /> : <Check size={18} strokeWidth={3} />}
                        Setujui Data
                      </button>
                      <button
                        className="btn-action reject"
                        disabled={!!processing}
                        onClick={() => handleAction(sub.id, 'rejected')}
                      >
                        <X size={18} strokeWidth={3} />
                        Tolak
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {selectedPhoto && (
        <div className="lightbox-overlay" onClick={() => setSelectedPhoto(null)}>
          <div className="lightbox-content" onClick={e => e.stopPropagation()}>
            <img src={selectedPhoto} alt="Bukti Terpilih" />
            <button className="lightbox-close" onClick={() => setSelectedPhoto(null)}>✕</button>
          </div>
        </div>
      )}

      <style jsx>{`
        .pulse-container {
          display: flex;
          align-items: center;
        }
        .pulse-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(99,102,241,0.1);
          color: var(--primary-light);
          padding: 6px 14px;
          border-radius: 20px;
          font-weight: 700;
          font-size: 13px;
        }
        .pulse-dot {
          width: 8px;
          height: 8px;
          background: #10b981;
          border-radius: 50%;
          box-shadow: 0 0 0 rgba(16,185,129, 0.4);
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(16,185,129, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(16,185,129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16,185,129, 0); }
        }

        .filter-nav {
          display: flex;
          gap: 12px;
          border-bottom: 2px solid var(--border);
          padding-bottom: 0;
          overflow-x: auto;
        }
        .filter-tab {
          padding: 12px 20px;
          background: none;
          border: none;
          border-bottom: 3px solid transparent;
          color: var(--text-muted);
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
        }
        .filter-tab.active {
          color: var(--primary-light);
          border-bottom-color: var(--primary);
        }
        .count-tag {
          background: rgba(99,102,241,0.1);
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 11px;
        }
        .active .count-tag {
          background: var(--primary);
          color: white;
        }

        .submission-list {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .modern-card {
          display: flex;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow: hidden;
          transition: transform 0.2s, box-shadow 0.2s;
          box-shadow: var(--shadow-sm);
        }
        .modern-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-lg);
        }

        .card-photo-section {
          width: 180px;
          min-height: 180px;
          background: var(--bg-card-2);
          flex-shrink: 0;
        }
        .photo-container {
          width: 100%;
          height: 100%;
          position: relative;
          cursor: pointer;
        }
        .photo-container img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .photo-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          opacity: 0;
          transition: opacity 0.2s;
          color: white;
          font-size: 12px;
          font-weight: 600;
        }
        .photo-container:hover .photo-overlay {
          opacity: 1;
        }
        .no-photo {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .card-content-section {
          flex: 1;
          padding: 20px 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .content-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .market-name {
          font-size: 18px;
          font-weight: 800;
          color: var(--text-primary);
        }
        .surveyor-info {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 4px;
          font-size: 13px;
          color: var(--text-muted);
        }
        .avatar-mini {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--primary);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
        }
        .status-badge {
          font-size: 10px;
          font-weight: 800;
          padding: 4px 10px;
          border-radius: 6px;
        }
        .status-badge.pending { background: rgba(245,158,11,0.1); color: #f59e0b; }
        .status-badge.approved { background: rgba(16,185,129,0.1); color: #10b981; }
        .status-badge.rejected { background: rgba(239,68,68,0.1); color: #ef4444; }
        
        .time-info {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          font-size: 11px;
          color: var(--text-muted);
          margin-top: 4px;
        }

        .validation-grid {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .valid-item {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 700;
          border: 1px solid transparent;
        }
        .valid-item.success { background: rgba(16,185,129,0.05); color: #10b981; border-color: rgba(16,185,129,0.2); }
        .valid-item.danger { background: rgba(239,68,68,0.05); color: #ef4444; border-color: rgba(239,68,68,0.2); }
        .valid-item.warning { background: rgba(245,158,11,0.05); color: #f59e0b; border-color: rgba(245,158,11,0.2); }

        .amount-val {
          font-size: 24px;
          font-weight: 900;
          color: #10b981;
        }
        .notes-val {
          display: flex;
          align-items: flex-start;
          font-size: 13px;
          color: var(--text-secondary);
          background: var(--bg-card-2);
          padding: 10px;
          border-radius: 10px;
          margin-top: 8px;
        }

        .action-footer {
          display: flex;
          gap: 12px;
          margin-top: auto;
        }
        .btn-action {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }
        .approve { background: var(--primary); color: white; }
        .approve:hover { background: var(--primary-light); box-shadow: 0 4px 12px rgba(99,102,241, 0.3); }
        .reject { background: rgba(239,68,68,0.1); color: #ef4444; }
        .reject:hover { background: rgba(239,68,68,0.2); }

        .lightbox-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.85);
          backdrop-filter: blur(10px);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
        }
        .lightbox-content {
          position: relative;
          max-width: 90vw;
          max-height: 90vh;
        }
        .lightbox-content img {
          max-width: 100%;
          max-height: 90vh;
          border-radius: 16px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        }
        .lightbox-close {
          position: absolute;
          top: -30px;
          right: -30px;
          background: white;
          border: none;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          font-size: 20px;
          cursor: pointer;
        }

        @media (max-width: 640px) {
          .modern-card { flex-direction: column; }
          .card-photo-section { width: 100%; height: 200px; }
        }
      `}</style>
    </>
  );
}
