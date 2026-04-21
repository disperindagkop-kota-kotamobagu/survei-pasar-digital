'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { getAllLocalSubmissions, PendingSubmission } from '@/lib/dexieDb';

export default function RiwayatPage() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<PendingSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    getAllLocalSubmissions().then(data => {
      setSubmissions(data.filter(s => s.surveyor_id === user?.id));
      setLoading(false);
    });
  }, [user]);

  if (loading) return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">Riwayat Saya</h1></div>
      </div>
      <div className="page-body flex-center" style={{ minHeight: 300 }}>
        <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
      </div>
    </>
  );

  const totalAmount = submissions.reduce((s, d) => s + d.amount, 0);
  const synced = submissions.filter(s => s.synced).length;
  const pending = submissions.filter(s => !s.synced).length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Riwayat Saya</h1>
          <p className="page-subtitle">Data survei yang tersimpan di perangkat ini</p>
        </div>
      </div>
      <div className="page-body">
        {/* Stats */}
        <div className="grid-3 mb-6">
          {[
            { label: 'Total Entri', value: submissions.length, color: '#6366f1' },
            { label: 'Total Nominal', value: `Rp ${totalAmount.toLocaleString('id')}`, color: '#10b981' },
            { label: 'Belum Tersinkron', value: pending, color: '#f59e0b' },
          ].map((s, i) => (
            <div key={i} className="stat-card">
              <p className="stat-label">{s.label}</p>
              <p style={{ fontSize: i === 1 ? 20 : 32, fontWeight: 800, color: s.color, marginTop: 4 }}>{s.value}</p>
            </div>
          ))}
        </div>

        {submissions.length === 0 ? (
          <div className="card text-center" style={{ padding: '60px 24px' }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>📋</p>
            <p className="font-semibold" style={{ marginBottom: 4 }}>Belum ada data survei</p>
            <p className="text-muted text-sm">Mulai input data di halaman Survei.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Pasar</th>
                  <th>Nominal</th>
                  <th>Catatan</th>
                  <th>Foto</th>
                  <th>Waktu</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map(s => (
                  <tr key={s.id}>
                    <td><span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.market_name}</span></td>
                    <td><span style={{ color: '#10b981', fontWeight: 700 }}>Rp {s.amount.toLocaleString('id')}</span></td>
                    <td className="text-sm text-secondary">{s.notes || '-'}</td>
                    <td>
                      {s.photo_base64 ? (
                        <button
                          type="button"
                          onClick={() => setSelectedPhoto(s.photo_base64)}
                          style={{
                            background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                            cursor: 'pointer', padding: 0, overflow: 'hidden', width: 48, height: 36
                          }}
                        >
                          <img src={s.photo_base64} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </button>
                      ) : <span className="text-muted text-xs">—</span>}
                    </td>
                    <td className="text-sm text-muted">
                      {new Date(s.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td>
                      <span className={`badge ${s.synced ? 'badge-synced' : 'badge-offline'}`}>
                        {s.synced ? '✓ Tersinkron' : '⏳ Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Photo Lightbox */}
      {selectedPhoto && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
          }}
          onClick={() => setSelectedPhoto(null)}
        >
          <img src={selectedPhoto} alt="Bukti" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12, objectFit: 'contain' }} />
          <button
            style={{
              position: 'absolute', top: 20, right: 20,
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              color: 'white', fontSize: 18, cursor: 'pointer'
            }}
            onClick={() => setSelectedPhoto(null)}
          >✕</button>
        </div>
      )}
    </>
  );
}
