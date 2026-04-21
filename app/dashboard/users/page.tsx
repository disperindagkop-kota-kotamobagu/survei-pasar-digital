'use client';
import { useState, useEffect } from 'react';
import { supabase, Profile, Role } from '@/lib/supabaseClient';

export default function UsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [newRole, setNewRole] = useState<Role>('surveyor');

  const [toast, setToast] = useState<{ type: 'success' | 'danger'; msg: string } | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true });

      if (error) throw error;
      setUsers(data || []);
    } catch (err: any) {
      console.error('Error fetching users:', err.message);
      showToast('danger', 'Gagal memuat daftar pengguna.');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (type: 'success' | 'danger', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const openModal = (user: Profile) => {
    setEditingUser(user);
    setNewRole(user.role);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setProcessing(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', editingUser.id);
        
      if (error) throw error;
      
      showToast('success', `Role ${editingUser.full_name} berhasil diubah menjadi ${newRole}.`);
      fetchUsers();
      closeModal();
    } catch (err: any) {
      showToast('danger', 'Gagal update role: ' + err.message);
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Manajemen User</h1>
          <p className="page-subtitle">Kelola hak akses petugas surveyor dan checker</p>
        </div>
        <div className="badge badge-approved" style={{ fontSize: 12 }}>
          {users.length} Total User
        </div>
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
                <th>Nama Lengkap</th>
                <th>Role Saat Ini</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} className="text-center" style={{ padding: '40px 0' }}>
                    <span className="spinner" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
                    <p style={{ marginTop: 10, fontSize: 13, color: 'var(--text-secondary)' }}>Memuat data pengguna...</p>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center" style={{ padding: '40px 0', color: 'var(--text-muted)' }}>
                    Belum ada data pengguna terdaftar.
                  </td>
                </tr>
              ) : (
                users.map(user => (
                  <tr key={user.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="user-avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                          {user.full_name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{user.full_name || 'Tanpa Nama'}</span>
                      </div>
                    </td>
                    <td>
                      <span className="user-role" style={{ fontSize: '11px' }}>{user.role}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        className="btn btn-ghost btn-sm" 
                        style={{ color: 'var(--primary-light)' }}
                        onClick={() => openModal(user)}
                      >
                        Ubah Role
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        <div className="alert alert-info mt-6">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginTop: 2 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <div>
            <p className="font-semibold">Catatan Administrasi</p>
            <p className="text-sm">Password user tidak dapat diubah di sini. User baru harus mendaftar sendiri melalui halaman registrasi (jika tersedia) atau dibuat via dashboard Auth Supabase.</p>
          </div>
        </div>
      </div>

      {isModalOpen && editingUser && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-container" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>Ubah Role Pengguna</h2>
              <button className="btn btn-ghost btn-sm" onClick={closeModal} style={{ padding: 4 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>
              </button>
            </div>
            <form onSubmit={handleUpdateRole}>
              <div className="modal-body">
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
                  Mengubah hak akses untuk <strong>{editingUser.full_name}</strong>.
                </p>
                <div className="form-group">
                  <label className="form-label">Pilih Role Baru</label>
                  <select 
                    className="form-select"
                    value={newRole}
                    onChange={e => setNewRole(e.target.value as Role)}
                    required
                  >
                    <option value="surveyor">Surveyor (Input Lapangan)</option>
                    <option value="checker">Checker (Verifikator)</option>
                    <option value="admin">Admin (Manajer Sistem)</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={closeModal} disabled={processing}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={processing}>
                  {processing ? <span className="spinner" /> : 'Simpan Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
