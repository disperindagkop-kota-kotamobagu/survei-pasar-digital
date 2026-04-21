'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { supabase, Market } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/authContext';
import { ShieldAlert, Info } from 'lucide-react';

// Import MapPicker dynamically to avoid SSR errors
const MapPicker = dynamic(() => import('@/components/MapPicker'), {
  ssr: false,
  loading: () => <div style={{ height: '300px', background: 'var(--bg-card-2)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Memuat peta...</div>
});

export default function MarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMarket, setEditingMarket] = useState<Market | null>(null);
  
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    lat: '',
    long: '',
  });

  const [toast, setToast] = useState<{ type: 'success' | 'danger'; msg: string } | null>(null);
  
  const isDemoUser = user?.id.includes('demo');

  useEffect(() => {
    fetchMarkets();
  }, []);

  const fetchMarkets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('markets')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setMarkets(data || []);
    } catch (err: any) {
      console.error('Error fetching markets:', err.message);
      showToast('danger', 'Gagal memuat daftar pasar.');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (type: 'success' | 'danger', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const openModal = (market: Market | null = null) => {
    setEditingMarket(market);
    if (market) {
      setFormData({
        name: market.name,
        lat: market.lat.toString(),
        long: market.long.toString(),
      });
    } else {
      // Default to Kotamobagu center if new
      setFormData({ name: '', lat: '0.74', long: '124.31' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingMarket(null);
    setFormData({ name: '', lat: '', long: '' });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);

    const latVal = parseFloat(formData.lat);
    const longVal = parseFloat(formData.long);

    if (!formData.name.trim()) {
      showToast('danger', 'Nama pasar harus diisi.');
      setProcessing(false);
      return;
    }

    if (isNaN(latVal) || isNaN(longVal)) {
      showToast('danger', 'Koordinat lat/long tidak valid.');
      setProcessing(false);
      return;
    }

    const payload = {
      name: formData.name.trim(),
      lat: latVal,
      long: longVal,
    };

    if (isDemoUser) {
      showToast('danger', 'Gagal: Akun Demo tidak diizinkan mengubah database asli.');
      setProcessing(false);
      return;
    }

    try {
      console.log('Menyimpan data pasar...', payload);
      
      // Ensure we have a valid Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session && !isDemoUser) {
         throw new Error('Sesi kedaluwarsa. Silakan login ulang.');
      }

      if (editingMarket) {
        const { error } = await supabase
          .from('markets')
          .update(payload)
          .eq('id', editingMarket.id);
        if (error) throw error;
        showToast('success', 'Pasar berhasil diperbarui.');
      } else {
        const { error } = await supabase
          .from('markets')
          .insert([payload]);
        if (error) {
          if (error.code === '23505') throw new Error('Nama pasar sudah ada.');
          if (error.code === '42501') throw new Error('Izin ditolak (RLS). Pastikan Anda login dengan akun Admin asli.');
          throw error;
        }
        showToast('success', 'Pasar berhasil ditambahkan.');
      }
      fetchMarkets();
      closeModal();
    } catch (err: any) {
      console.error('Save error details:', err);
      showToast('danger', 'Gagal menyimpan: ' + (err.message || 'Error tidak diketahui'));
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus pasar ini?')) return;
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('markets')
        .delete()
        .eq('id', id);
      if (error) throw error;
      showToast('success', 'Pasar berhasil dihapus.');
      fetchMarkets();
    } catch (err: any) {
      showToast('danger', 'Gagal menghapus pasar.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Kelola Pasar</h1>
          <p className="page-subtitle">Atur lokasi dan data pasar untuk pemantauan geofencing</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Tambah Pasar
        </button>
      </div>

      {toast && (
        <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 9999 }}>
          <div className={`alert alert-${toast.type}`} style={{ boxShadow: 'var(--shadow-lg)', minWidth: 260 }}>
            <span style={{ marginRight: 8 }}>{toast.type === 'success' ? '✅' : '❌'}</span>
            {toast.msg}
          </div>
        </div>
      )}

      {isDemoUser && (
        <div className="alert alert-warning mb-6" style={{ margin: '0 32px 24px', borderRadius: 16 }}>
          <ShieldAlert size={20} />
          <div>
            <p className="font-bold">Mode Simulasi (Demo)</p>
            <p className="text-xs">Anda sedang menggunakan akun demo. Anda dapat melihat data, tapi **tidak bisa** menyimpan perubahan ke database Supabase.</p>
          </div>
        </div>
      )}

      <div className="page-body">
        {loading ? (
          <div className="flex-center" style={{ minHeight: 400 }}>
             <div className="spinner" style={{ width: 40, height: 40, borderTopColor: 'var(--primary)' }} />
          </div>
        ) : markets.length === 0 ? (
          <div className="card text-center" style={{ padding: '80px 24px' }}>
            <div style={{ 
              width: 80, height: 80, borderRadius: '50%', background: 'rgba(99,102,241,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px'
            }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5">
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" x2="8" y1="2" y2="18"/><line x1="16" x2="16" y1="6" y2="22"/>
              </svg>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Belum Ada Pasar</h2>
            <p className="text-muted" style={{ marginBottom: 24 }}>Daftar pasar yang Anda tambahkan akan muncul di sini.</p>
            <button className="btn btn-primary" onClick={() => openModal()}>Tambah Pasar Pertama</button>
          </div>
        ) : (
          <div className="grid-3" style={{ gap: 20 }}>
            {markets.map(market => (
              <div key={market.id} className="card hover-scale" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Visual Header */}
                <div style={{ 
                  height: 100, background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                   <div style={{ 
                     width: 48, height: 48, borderRadius: 12, background: 'white',
                     boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                   }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                      </svg>
                   </div>
                </div>

                <div style={{ padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{market.name}</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        <span className="text-xs text-muted">
                          {market.lat.toFixed(4)}, {market.long.toFixed(4)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button 
                      className="btn btn-secondary btn-sm" 
                      style={{ flex: 1 }}
                      onClick={() => openModal(market)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 6 }}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Edit
                    </button>
                    <button 
                      className="btn btn-ghost btn-sm" 
                      style={{ color: 'var(--danger)', padding: '0 10px' }}
                      onClick={() => handleDelete(market.id)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal} style={{ backdropFilter: 'blur(4px)', background: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-container" onClick={e => e.stopPropagation()} style={{ maxWidth: 800, width: '90vw' }}>
            <div className="modal-header">
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800 }}>{editingMarket ? 'Edit Data Pasar' : 'Tambah Pasar Baru'}</h2>
                <p className="text-xs text-muted" style={{ marginTop: 2 }}>Pilih lokasi pasar pada peta untuk akurasi geofencing</p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={closeModal} style={{ padding: 4 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>
              </button>
            </div>
            
            <form onSubmit={handleSave}>
              <div className="modal-body" style={{ padding: 24 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  
                  {/* Market Name */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Nama Pasar</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Contoh: Pasar Tradisional Kotamobagu"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      required
                      style={{ fontSize: 15 }}
                    />
                  </div>

                  <div className="grid-2-map" style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24 }}>
                    {/* Map Selection */}
                    <div>
                      <label className="form-label">Pilih Lokasi di Peta</label>
                      <MapPicker 
                        lat={parseFloat(formData.lat)} 
                        long={parseFloat(formData.long)} 
                        onChange={(lat, long) => setFormData({ ...formData, lat: lat.toString(), long: long.toString() })}
                      />
                      <p className="text-xs text-muted mt-2">
                         💡 Anda bisa mengklik peta atau menyeret marker biru untuk menentukan lokasi pasar.
                      </p>
                    </div>

                    {/* Coordinate Inputs */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Latitude</label>
                        <input 
                          type="number" 
                          step="any"
                          className="form-input" 
                          value={formData.lat}
                          onChange={e => setFormData({ ...formData, lat: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Longitude</label>
                        <input 
                          type="number" 
                          step="any"
                          className="form-input" 
                          value={formData.long}
                          onChange={e => setFormData({ ...formData, long: e.target.value })}
                          required
                        />
                      </div>
                      <div style={{ 
                        marginTop: 'auto', padding: 12, borderRadius: 12, background: 'rgba(99,102,241,0.05)',
                        border: '1px dashed rgba(99,102,241,0.2)'
                      }}>
                        <p className="text-xs text-secondary" style={{ lineHeight: 1.5 }}>
                          Koordinat ini digunakan untuk membatasi radius input survei oleh surveyor lapangan.
                        </p>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              <div className="modal-footer" style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border)', padding: '16px 24px' }}>
                <button type="button" className="btn btn-secondary" onClick={closeModal} disabled={processing}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={processing} style={{ minWidth: 140 }}>
                  {processing ? <span className="spinner" /> : (editingMarket ? 'Simpan Perubahan' : 'Tambah Pasar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .grid-2-map {
          @media (max-width: 768px) {
            grid-template-columns: 1fr !important;
          }
        }
        .hover-scale {
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .hover-scale:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-lg);
        }
      `}</style>
    </>
  );
}
