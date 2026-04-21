'use client';
import { useState, useEffect } from 'react';
import { supabase, Market } from '@/lib/supabaseClient';

export default function MarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMarket, setEditingMarket] = useState<Market | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    lat: '',
    long: '',
  });

  const [toast, setToast] = useState<{ type: 'success' | 'danger'; msg: string } | null>(null);

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
      setFormData({ name: '', lat: '', long: '' });
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

    const payload = {
      name: formData.name,
      lat: parseFloat(formData.lat),
      long: parseFloat(formData.long),
    };

    try {
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
        if (error) throw error;
        showToast('success', 'Pasar berhasil ditambahkan.');
      }
      fetchMarkets();
      closeModal();
    } catch (err: any) {
      showToast('danger', 'Gagal menyimpan data: ' + err.message);
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
          <p className="page-subtitle">Daftar pasar yang terdaftar dalam sistem pemantauan</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Tambah Pasar
        </button>
      </div>

      {toast && (
        <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 9999 }}>
          <div className={`alert alert-${toast.type}`} style={{ boxShadow: 'var(--shadow-lg)', minWidth: 260 }}>
            {toast.msg}
          </div>
        </div>
      )}

      <div className="page-body">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Nama Pasar</th>
                <th>Koordinat Lat</th>
                <th>Koordinat Long</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center" style={{ padding: '40px 0' }}>
                    <span className="spinner" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
                    <p style={{ marginTop: 10, fontSize: 13, color: 'var(--text-secondary)' }}>Memuat data pasar...</p>
                  </td>
                </tr>
              ) : markets.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center" style={{ padding: '40px 0', color: 'var(--text-muted)' }}>
                    Belum ada data pasar.
                  </td>
                </tr>
              ) : (
                markets.map(market => (
                  <tr key={market.id}>
                    <td><span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{market.name}</span></td>
                    <td className="text-secondary">{market.lat}</td>
                    <td className="text-secondary">{market.long}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button 
                          className="btn btn-ghost btn-sm" 
                          style={{ color: 'var(--primary-light)' }}
                          onClick={() => openModal(market)}
                        >
                          Edit
                        </button>
                        <button 
                          className="btn btn-ghost btn-sm" 
                          style={{ color: 'var(--danger)' }}
                          onClick={() => handleDelete(market.id)}
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>{editingMarket ? 'Edit Pasar' : 'Tambah Pasar Baru'}</h2>
              <button className="btn btn-ghost btn-sm" onClick={closeModal} style={{ padding: 4 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nama Pasar</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Contoh: Pasar Sentral"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Latitude</label>
                    <input 
                      type="number" 
                      step="any"
                      className="form-input" 
                      placeholder="-2.xxx"
                      value={formData.lat}
                      onChange={e => setFormData({ ...formData, lat: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Longitude</label>
                    <input 
                      type="number" 
                      step="any"
                      className="form-input" 
                      placeholder="118.xxx"
                      value={formData.long}
                      onChange={e => setFormData({ ...formData, long: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={closeModal} disabled={processing}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={processing}>
                  {processing ? <span className="spinner" /> : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
