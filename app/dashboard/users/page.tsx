'use client';
import { DEMO_USERS } from '@/lib/mockData';

export default function UsersPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Manajemen User</h1>
          <p className="page-subtitle">Kelola hak akses petugas surveyor dan checker</p>
        </div>
        <button className="btn btn-primary">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
          Tambah User
        </button>
      </div>

      <div className="page-body">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Nama Lengkap</th>
                <th>Role</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_USERS.map(user => (
                <tr key={user.id}>
                  <td><span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{user.full_name}</span></td>
                  <td>
                    <span className="user-role" style={{ fontSize: '12px' }}>{user.role}</span>
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--primary-light)' }}>Edit Role</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
