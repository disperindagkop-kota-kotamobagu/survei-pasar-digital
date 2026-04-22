'use client';
import { useState, useEffect } from 'react';
import { supabase, Profile, Role } from '@/lib/supabaseClient';
import { UserPlus, Search, UserCheck, Shield, ClipboardList, MoreVertical, Trash2, Edit2, X, Check } from 'lucide-react';

export default function UsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'surveyor' as Role
  });

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

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const result = await res.json();
      
      if (!res.ok) throw new Error(result.error || 'Gagal membuat user');
      
      showToast('success', 'User baru berhasil ditambahkan.');
      setIsAddModalOpen(false);
      setFormData({ email: '', password: '', full_name: '', role: 'surveyor' });
      fetchUsers();
    } catch (err: any) {
      showToast('danger', err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setProcessing(true);
    try {
      const res = await fetch('/api/admin/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingUser.id,
          email: formData.email,
          password: formData.password || undefined,
          full_name: formData.full_name,
          role: formData.role
        })
      });
      
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Gagal update user');
      
      showToast('success', 'Data user berhasil diperbarui.');
      setIsEditModalOpen(false);
      setFormData({ email: '', password: '', full_name: '', role: 'surveyor' });
      fetchUsers();
    } catch (err: any) {
      showToast('danger', err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (!confirm(`Hapus user ${name} secara permanen? Akun auth juga akan dihapus.`)) return;
    setProcessing(true);
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const result = await res.json();
      
      if (!res.ok) throw new Error(result.error || 'Gagal menghapus user');
      
      showToast('success', 'User berhasil dihapus.');
      fetchUsers();
    } catch (err: any) {
      showToast('danger', err.message);
    } finally {
      setProcessing(false);
    }
  };

  const openEditModal = (user: Profile) => {
    setEditingUser(user);
    setFormData({ 
      email: '', // Email not in profile, can be left blank if not changing
      password: '',
      role: user.role,
      full_name: user.full_name || ''
    });
    setIsEditModalOpen(true);
  };

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield size={16} />;
      case 'checker': return <UserCheck size={16} />;
      default: return <ClipboardList size={16} />;
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin': return 'badge-approved';
      case 'checker': return 'badge-pending';
      default: return 'badge-secondary';
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Manajemen User</h1>
          <p className="page-subtitle">Kelola hak akses dan akun petugas lapangan</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}>
          <UserPlus size={18} style={{ marginRight: 8 }} />
          Tambah User
        </button>
      </div>

      {toast && (
        <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 9999 }}>
          <div className={`alert alert-${toast.type} floating-toast`}>
            {toast.msg}
          </div>
        </div>
      )}

      <div className="page-body">
        {/* Search & Stats */}
        <div className="flex-between mb-6" style={{ flexWrap: 'wrap', gap: 16 }}>
          <div className="search-bar" style={{ flex: 1, maxWidth: 400 }}>
            <Search size={18} className="search-icon" />
            <input 
              type="text" 
              placeholder="Cari nama atau role..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="text-sm text-muted">
             Menampilkan <strong>{filteredUsers.length}</strong> dari {users.length} user
          </div>
        </div>

        {loading ? (
          <div className="flex-center" style={{ minHeight: 300 }}>
             <span className="spinner" style={{ width: 40, height: 40, borderTopColor: 'var(--primary)' }} />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="card text-center" style={{ padding: '60px 24px' }}>
             <p className="text-muted">Tidak ada user yang ditemukan.</p>
          </div>
        ) : (
          <div className="user-grid">
            {filteredUsers.map(user => (
              <div key={user.id} className="user-card card hover-scale">
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                  <div className="user-avatar-large">
                    {user.full_name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700 }}>{user.full_name || 'Tanpa Nama'}</h3>
                    <div className={`badge ${getRoleBadgeClass(user.role)}`} style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {getRoleIcon(user.role)}
                      {user.role.toUpperCase()}
                    </div>
                  </div>
                </div>

                <div className="user-card-footer">
                  <button className="btn btn-ghost btn-sm" onClick={() => openEditModal(user)}>
                    <Edit2 size={14} style={{ marginRight: 6 }} /> Edit User
                  </button>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteUser(user.id, user.full_name)}>
                    <Trash2 size={14} style={{ marginRight: 6 }} /> Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div className="modal-container" style={{ maxWidth: 450 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: 18, fontWeight: 800 }}>Tambah Petugas Baru</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsAddModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddUser}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nama Lengkap</label>
                  <input 
                    type="text" className="form-input" required 
                    value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input 
                    type="email" className="form-input" required 
                    value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Password Setup</label>
                  <input 
                    type="password" className="form-input" required placeholder="Min. 6 karakter"
                    value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Role Akses</label>
                  <select 
                    className="form-select" value={formData.role} 
                    onChange={e => setFormData({...formData, role: e.target.value as Role})}
                  >
                    <option value="surveyor">Surveyor (Input Lapangan)</option>
                    <option value="checker">Checker (Verifikator)</option>
                    <option value="admin">Admin (Manajer)</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={processing}>
                  {processing ? <span className="spinner" /> : 'Buat Akun Petugas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {isEditModalOpen && editingUser && (
        <div className="modal-overlay" onClick={() => setIsEditModalOpen(false)}>
          <div className="modal-container" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: 18, fontWeight: 800 }}>Edit Data User</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsEditModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdateUser}>
              <div className="modal-body">
                <p className="text-sm text-muted mb-4">Mengubah informasi untuk akun petugas.</p>
                
                <div className="form-group">
                  <label className="form-label">Nama Lengkap</label>
                  <input 
                    type="text" className="form-input" required 
                    value={formData.full_name} 
                    onChange={e => setFormData({...formData, full_name: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Baru (Opsional)</label>
                  <input 
                    type="email" className="form-input"
                    placeholder="Biarkan kosong jika tidak diubah"
                    value={formData.email} 
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Password Baru (Opsional)</label>
                  <input 
                    type="password" className="form-input"
                    placeholder="Min. 6 karakter"
                    value={formData.password} 
                    onChange={e => setFormData({...formData, password: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Hak Akses (Role)</label>
                  <select 
                    className="form-select" value={formData.role} 
                    onChange={e => setFormData({...formData, role: e.target.value as Role})}
                  >
                    <option value="surveyor">Surveyor</option>
                    <option value="checker">Checker</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsEditModalOpen(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={processing}>
                  {processing ? <span className="spinner" /> : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .user-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }
        .user-card {
          padding: 20px;
          display: flex;
          flex-direction: column;
        }
        .user-avatar-large {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          background: linear-gradient(135deg, var(--primary), var(--primary-light));
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: 800;
          box-shadow: 0 4px 12px rgba(99,102,241,0.2);
        }
        .user-card-footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: auto;
          padding-top: 16px;
          border-top: 1px solid var(--border);
        }
        .search-bar {
          position: relative;
        }
        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
        }
        .search-bar input {
          width: 100%;
          padding: 10px 12px 10px 40px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--bg-card);
          color: var(--text-primary);
          font-size: 14px;
        }
        .search-bar input:focus {
          border-color: var(--primary);
          outline: none;
        }
      `}</style>
    </>
  );
}
