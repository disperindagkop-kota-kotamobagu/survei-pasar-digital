'use client';
import { DEMO_MARKETS } from '@/lib/mockData';

export default function MarketsPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Kelola Pasar</h1>
          <p className="page-subtitle">Daftar pasar yang terdaftar dalam sistem pemantauan</p>
        </div>
        <button className="btn btn-primary">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Tambah Pasar
        </button>
      </div>

      <div className="page-body">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Nama Pasar</th>
                <th>Koordinat Lat</th>
                <th>Koordinat Long</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_MARKETS.map(market => (
                <tr key={market.id}>
                  <td><span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{market.name}</span></td>
                  <td className="text-secondary">{market.lat}</td>
                  <td className="text-secondary">{market.long}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--primary-light)' }}>Edit</button>
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
