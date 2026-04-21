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
    setSubmissions(DEMO_SUBMISSIONS);
  }, []);

  const showToast = (type: 'success' | 'danger', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAction = useCallback(async (id: string, action: 'approved' | 'rejected') => {
    setProcessing(id);
    await new Promise(r => setTimeout(r, 800)); // Simulate API
    setSubmissions(prev =>
      prev.map(s => s.id === id ? { ...s, status: action } : s)
    );
    setProcessing(null);
    showToast(action === 'approved' ? 'success' : 'danger',
      action === 'approved' ? 'Data berhasil disetujui!' : 'Data telah ditolak.');
  }, []);

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
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
            >
              {f === 'all' ? 'Semua' : f === 'pending' ? 'Menunggu' : f === 'approved' ? 'Disetujui' : 'Ditolak'}
              <span style={{
                background: filter === f ? 'rgba(255,255,255,0.2)' : 'rgba(99,102,241,0.15)',
                borderRadius: 20, padding: '0 6px', fontSize: 11, fontWeight: 700
              }}>{counts[f]}</span>
            </button>
          ))}
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
