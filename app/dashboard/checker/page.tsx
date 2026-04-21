'use client';
import { useState, useEffect, useCallback } from 'react';
import { Submission } from '@/lib/supabaseClient';
import { DEMO_SUBMISSIONS } from '@/lib/mockData';

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
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder')) {
          console.error('Fetch error:', error);
        }
        setSubmissions(DEMO_SUBMISSIONS);
        return;
      }

      // Transform join data to match Submission interface
      const transformed: Submission[] = data.map((s: any) => ({
        ...s,
        surveyor_name: s.surveyor?.full_name || 'Surveyor Tidak Dikenal',
        market_name: s.market?.name || 'Pasar Tidak Dikenal'
      }));

      setSubmissions(transformed);
    } catch (e) {
      setSubmissions(DEMO_SUBMISSIONS);
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
      showToast('danger', 'Tidak ada data valid yang memenuhi kriteria otomatis (GPS OK + OCR Cocok).');
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
          // Trigger recap for each
          await fetch('/api/recap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sub),
          });
          successCount++;
        }
      } catch (e) {
        console.error('Auto-approve sub error:', e);
      }
    }

    showToast('success', `${successCount} data berhasil disetujui otomatis.`);
    fetchSubmissions();
    setProcessing(null);
  };

  const handleAction = useCallback(async (id: string, action: 'approved' | 'rejected') => {
    setProcessing(id);
    
    // 1. Update Supabase
    try {
      const { supabase } = await import('@/lib/supabaseClient');
      const { error } = await supabase
        .from('submissions')
        .update({ status: action })
        .eq('id', id);
      
      if (error && !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder')) {
        showToast('danger', 'Gagal memperbarui status di database.');
        setProcessing(null);
        return;
      }
    } catch (e) {
      console.log('Supabase update skipped or failed (Demo Mode?)');
    }

    // 2. If approved, recap to Google
    if (action === 'approved') {
      const sub = submissions.find(s => s.id === id);
      if (sub) {
        showToast('success', 'Data disetujui. Mengunggah ke Google...');
        try {
          const res = await fetch('/api/recap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sub),
          });
          const result = await res.json();
          if (result.success) {
            showToast('success', 'Berhasil! Data & Foto telah tersimpan di Drive/Sheets.');
          } else {
            console.error('Google Recap Error:', result.error);
            showToast('danger', 'Gagal mengunggah ke Google: ' + result.error);
          }
        } catch (e) {
          showToast('danger', 'Gagal menghubungi server rekap.');
        }
      }
    } else {
      showToast('danger', 'Data telah ditolak.');
    }

    setSubmissions(prev =>
      prev.map(s => s.id === id ? { ...s, status: action } : s)
    );
    setProcessing(null);
  }, [submissions]);

  const filtered = filter === 'all' ? submissions : submissions.filter(s => s.status === filter);
  const counts = {
    all: submissions.length,
    pending: submissions.filter(s => s.status === 'pending').length,
    approved: submissions.filter(s => s.status === 'approved').length,
    rejected: submissions.filter(s => s.status === 'rejected').length,
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Verifikasi Data</h1>
          <p className="page-subtitle">Periksa dan setujui data survei dari lapangan</p>
        </div>
        {counts.pending > 0 && (
          <div className="badge badge-pending" style={{ fontSize: 13, padding: '6px 14px' }}>
            {counts.pending} menunggu verifikasi
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 9999 }}>
          <div className={`alert alert-${toast.type}`} style={{ boxShadow: 'var(--shadow-lg)', minWidth: 260 }}>
            {toast.msg}
          </div>
        </div>
      )}

      <div className="page-body">
        {/* Filter tabs */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 8 }}>
            {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
              >
                {f === 'all' ? 'Semua' : f === 'pending' ? 'Menunggu' : f === 'approved' ? 'Disetujui' : 'Ditolak'}
                <span style={{
                  background: filter === f ? 'rgba(255,255,255,0.2)' : 'rgba(99,102,241,0.15)',
                  borderRadius: 20, padding: '0 6px', fontSize: 11, fontWeight: 700, marginLeft: 6
                }}>{counts[f]}</span>
              </button>
            ))}
          </div>

          {filter === 'pending' && counts.pending > 0 && (
            <button 
              className="btn btn-primary" 
              onClick={handleAutoApprove}
              disabled={processing === 'auto'}
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none' }}
            >
              {processing === 'auto' ? <span className="spinner" /> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 8 }}><polyline points="20 6 9 17 4 12"/></svg>}
              Setujui Otomatis ({submissions.filter(s => s.status === 'pending' && s.is_geofence_valid && s.ocr_amount_detect && Math.abs(s.ocr_amount_detect - s.amount) < 1).length} Valid)
            </button>
          )}
        </div>

        {/* Submission cards grid */}
        {filtered.length === 0 ? (
          <div className="card text-center" style={{ padding: '60px 24px' }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>✅</p>
            <p className="font-semibold" style={{ marginBottom: 4 }}>Tidak ada data</p>
            <p className="text-muted text-sm">
              {filter === 'pending' ? 'Semua data sudah diverifikasi!' : 'Tidak ada data dalam kategori ini.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {filtered.map(sub => (
              <div key={sub.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', gap: 0 }}>
                  {/* Photo area */}
                  <div
                    style={{
                      width: 140, flexShrink: 0,
                      background: 'var(--bg-card-2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRight: '1px solid var(--border)', cursor: sub.photo_url ? 'pointer' : 'default',
                      minHeight: 120, position: 'relative'
                    }}
                    onClick={() => sub.photo_url && setSelectedPhoto(sub.photo_url)}
                  >
                    {sub.photo_url ? (
                      <img src={sub.photo_url} alt="Bukti" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ textAlign: 'center', padding: 12 }}>
                        <p style={{ fontSize: 28, marginBottom: 4 }}>🖼️</p>
                        <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>Demo Mode<br/>No Photo</p>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{sub.market_name}</p>
                        <p className="text-sm text-muted">oleh {sub.surveyor_name}</p>
                      </div>
                      <span className={`badge badge-${sub.status}`}>{
                        sub.status === 'pending' ? '⏳ Menunggu' :
                        sub.status === 'approved' ? '✓ Disetujui' : '✗ Ditolak'
                      }</span>
                    </div>

                    <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                      <span style={{ 
                        fontSize: 10, padding: '2px 8px', borderRadius: 6, fontWeight: 700,
                        background: sub.is_geofence_valid ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                        color: sub.is_geofence_valid ? '#10b981' : '#ef4444',
                        border: `1px solid ${sub.is_geofence_valid ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`
                      }}>
                        GPS: {sub.is_geofence_valid ? '✓ VALID' : '✗ LUAR RADIUS'}
                      </span>
                      {sub.ocr_amount_detect && (
                        <span style={{ 
                          fontSize: 10, padding: '2px 8px', borderRadius: 6, fontWeight: 700,
                          background: Math.abs(sub.ocr_amount_detect - sub.amount) < 1 ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                          color: Math.abs(sub.ocr_amount_detect - sub.amount) < 1 ? '#10b981' : '#f59e0b',
                          border: `1px solid ${Math.abs(sub.ocr_amount_detect - sub.amount) < 1 ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`
                        }}>
                          OCR: {Math.abs(sub.ocr_amount_detect - sub.amount) < 1 ? `✓ MATCH (Rp ${sub.amount.toLocaleString()})` : `⚠ BEDA (Read: ${sub.ocr_amount_detect.toLocaleString()})`}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div>
                        <p className="text-xs text-muted">Nominal</p>
                        <p style={{ fontSize: 22, fontWeight: 800, color: '#10b981' }}>
                          Rp {sub.amount.toLocaleString('id-ID')}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted">Waktu</p>
                        <p className="text-sm text-secondary">
                          {new Date(sub.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>

                    {sub.notes && (
                      <p className="text-sm text-secondary" style={{
                        background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: 6,
                        borderLeft: '3px solid var(--primary)'
                      }}>
                        {sub.notes}
                      </p>
                    )}

                    {sub.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <button
                          className="btn btn-success btn-sm"
                          disabled={processing === sub.id}
                          onClick={() => handleAction(sub.id, 'approved')}
                        >
                          {processing === sub.id
                            ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                          }
                          Setujui
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          disabled={processing === sub.id}
                          onClick={() => handleAction(sub.id, 'rejected')}
                        >
                          {processing === sub.id
                            ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
                          }
                          Tolak
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Photo lightbox */}
      {selectedPhoto && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setSelectedPhoto(null)}
        >
          <img src={selectedPhoto} alt="Bukti" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12 }} />
          <button style={{ position: 'absolute', top: 20, right: 20, width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', fontSize: 18, cursor: 'pointer' }} onClick={() => setSelectedPhoto(null)}>✕</button>
        </div>
      )}
    </>
  );
}
