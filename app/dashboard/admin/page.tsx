'use client';
import { useState, useEffect } from 'react';
import { DEMO_SUBMISSIONS, DEMO_MARKETS } from '@/lib/mockData';
import { Submission } from '@/lib/supabaseClient';

export default function AdminPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [markets, setMarkets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<string>('');
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [proxyUrl, setProxyUrl] = useState<string>(
    typeof window !== 'undefined' ? localStorage.getItem('proxy_url') || '' : ''
  );
  const [activeTab, setActiveTab] = useState<'overview' | 'log' | 'markets'>('overview');
  const [timeFilter, setTimeFilter] = useState<'day' | 'week' | 'month' | 'all'>('all');

  useEffect(() => {
    fetchData();

    // Setup Realtime Subscription
    let channel: any;
    
    const setupRealtime = async () => {
      const { supabase } = await import('@/lib/supabaseClient');
      channel = supabase
        .channel('admin-realtime')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'submissions' 
        }, () => {
          console.log('Admin: Realtime update detected!');
          fetchData();
        })
        .subscribe();
    };

    setupRealtime();

    return () => {
      if (channel) channel.unsubscribe();
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { supabase } = await import('@/lib/supabaseClient');
      
      // Fetch markets
      const { data: mData } = await supabase.from('markets').select('*');
      if (mData) setMarkets(mData);

      // Fetch submissions
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
        if (!mData) setMarkets(DEMO_MARKETS);
      } else {
        const transformed: Submission[] = data.map((s: any) => ({
          ...s,
          surveyor_name: s.surveyor?.full_name || 'Surveyor Tidak Dikenal',
          market_name: s.market?.name || 'Pasar Tidak Dikenal'
        }));
        setSubmissions(transformed);
      }
    } catch (e) {
      setSubmissions(DEMO_SUBMISSIONS);
      setMarkets(DEMO_MARKETS);
    }
    setLoading(false);
  };

  const filteredSubmissions = submissions.filter(s => {
    if (timeFilter === 'all') return true;
    const date = new Date(s.created_at);
    const now = new Date();
    if (timeFilter === 'day') return date.toDateString() === now.toDateString();
    if (timeFilter === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      return date >= weekAgo;
    }
    if (timeFilter === 'month') return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    return true;
  });

  const stats = {
    total: filteredSubmissions.length,
    pending: filteredSubmissions.filter(s => s.status === 'pending').length,
    approved: filteredSubmissions.filter(s => s.status === 'approved').length,
    rejected: filteredSubmissions.filter(s => s.status === 'rejected').length,
    totalAmount: filteredSubmissions.filter(s => s.status === 'approved').reduce((a, s) => a + Number(s.amount), 0),
    todayCount: submissions.filter(s => {
      const today = new Date().toDateString();
      return new Date(s.created_at).toDateString() === today;
    }).length,
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const { utils, writeFile } = await import('xlsx');

      const wsData = [
        ['No', 'Nama Surveyor', 'Nama Pasar', 'Nominal (Rp)', 'Status', 'Catatan', 'Tanggal'],
        ...submissions.map((s, i) => [
          i + 1,
          s.surveyor_name || '-',
          s.market_name || '-',
          s.amount,
          s.status === 'approved' ? 'Disetujui' : s.status === 'rejected' ? 'Ditolak' : 'Menunggu',
          s.notes || '-',
          new Date(s.created_at).toLocaleString('id-ID'),
        ]),
      ];

      const wb = utils.book_new();
      const ws = utils.aoa_to_sheet(wsData);

      // Column widths
      ws['!cols'] = [
        { wch: 5 }, { wch: 20 }, { wch: 25 }, { wch: 18 }, { wch: 12 }, { wch: 30 }, { wch: 20 }
      ];

      utils.book_append_sheet(wb, ws, 'Data Survei');

      // Summary sheet
      const summaryData = [
        ['REKAPITULASI DATA SURVEI PASAR KTG'],
        [`Periode: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`],
        [],
        ['Statistik', 'Nilai'],
        ['Total Entri', stats.total],
        ['Menunggu Verifikasi', stats.pending],
        ['Disetujui', stats.approved],
        ['Ditolak', stats.rejected],
        ['Total Nominal Disetujui (Rp)', stats.totalAmount],
        ['Entri Hari Ini', stats.todayCount],
        [],
        ...markets.map(m => {
          const mSubs = submissions.filter(s => s.market_id === m.id && s.status === 'approved');
          const total = Number(mSubs.reduce((a, s) => a + Number(s.amount), 0));
          return [m.name, total, mSubs.length + ' transaksi'];
        }),
      ];
      const wsSummary = utils.aoa_to_sheet(summaryData);
      wsSummary['!cols'] = [{ wch: 35 }, { wch: 20 }, { wch: 15 }];
      utils.book_append_sheet(wb, wsSummary, 'Rekap');

      const filename = `Survei_Pasar_KTG_${new Date().toISOString().slice(0, 10)}.xlsx`;
      writeFile(wb, filename);
    } catch (err) {
      alert('Gagal export. Pastikan library xlsx terinstall.');
    }
    setExporting(false);
  };

  const handleDiagnostic = async () => {
    setDiagnosing(true);
    try {
      const { supabase } = await import('@/lib/supabaseClient');
      const { data: { user } } = await supabase.auth.getUser();

      const res = await fetch('/api/recap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'test-diag-' + Date.now(),
          amount: 0,
          market_name: 'DIAGNOSTIK_TEST',
          surveyor_name: user?.email || 'Admin-Test',
          location_type: 'tes_foto',
          photo_base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          created_at: new Date().toISOString(),
          notes: 'Testing connection & PHOTO UPLOAD from dashboard',
          proxyUrl
        }),
      });

      const result = await res.json();
      if (result.success) {
        alert(`✅ SEMUA KONEKSI BERHASIL!\n\nRobot: ${result.serviceEmail}\nFolder: ${result.folderId}\nSheet: ${result.sheetId}\n\nData test sudah masuk ke Drive & Sheets.`);
      } else {
        alert(`❌ KONEKSI GAGAL!\nFase: ${result.phase}\nError: ${result.error}\n\nRobot: ${result.serviceEmail || 'Tidak Terdeteksi'}\nSheet ID: ${result.sheetId || 'Tidak Terdeteksi'}\n\nSaran: Pastikan Robot di atas sudah menjadi EDITOR di file Google Sheets tersebut.`);
      }
    } catch (err: any) {
      alert('❌ ERROR SISTEM: ' + err.message);
    }
    setDiagnosing(false);
  };

  const handleManualSyncAndCleanup = async () => {
    if (!confirm('Apakah Anda ingin menyinkronkan data Approved ke Google Drive dan menghapus foto di Supabase untuk menghemat ruang?')) return;
    
    setCleaning(true);
    setSyncProgress('Inisialisasi...');
    setSyncLogs(['[START] Memulai Audit Sinkronisasi...']);
    
    try {
      const allApproved = submissions.filter(s => s.status === 'approved');
      const toSync = allApproved.filter(s => 
        !s.drive_link || 
        s.drive_link === '-' || 
        !s.drive_link.includes('drive.google.com')
      );
      
      setSyncLogs(prev => [...prev, `[INFO] Total data Disetujui: ${allApproved.length}`]);
      setSyncLogs(prev => [...prev, `[INFO] Data perlu sinkron: ${toSync.length}`]);

      if (allApproved.length > 0 && toSync.length === 0) {
        setSyncLogs(prev => [...prev, `[TIP] Data pertama terdeteksi link: "${allApproved[0].drive_link}"`]);
      }

      if (toSync.length === 0) {
        setSyncProgress('Sudah sinkron.');
        setSyncLogs(prev => [...prev, '[DONE] Semua data sudah tersinkron.']);
      } else {
        for (let i = 0; i < toSync.length; i++) {
          const sub = toSync[i];
          setSyncProgress(`Memproses ${i + 1}/${toSync.length}: ${sub.market_name}...`);
          setSyncLogs(prev => [...prev, `[PROCESSING] Data ${i + 1}: ${sub.market_name} (ID: ${sub.id.slice(-5)})`]);
          
          const recapRes = await fetch('/api/recap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...sub, proxyUrl }),
          });

          const resData = await recapRes.json();
          if (!recapRes.ok) {
            setSyncLogs(prev => [...prev, `[ERROR] Gagal pada Fase ${resData.phase || 'UNKNOWN'}: ${resData.error}`]);
            setSyncLogs(prev => [...prev, `[TIP] Pastikan email ${resData.serviceEmail} sudah jadi Editor di Drive & SHEETS (ID: ${resData.sheetId}).`]);
            throw new Error(`Data ${i + 1} gagal: ${resData.error}`);
          }
          setSyncLogs(prev => [...prev, `[SUCCESS] Data ${i + 1} terkirim ke Drive & Sheets.`]);
        }
      }

      setSyncProgress('Membersihkan Supabase...');
      setSyncLogs(prev => [...prev, '[CLEANUP] Memulai pembersihan foto di Supabase...']);
      const res = await fetch('/api/cleanup');
      const cleanupResult = await res.json();
      
      setSyncLogs(prev => [...prev, `[DONE] ${cleanupResult.message}`]);
      fetchData(); // Refresh UI
    } catch (err: any) {
      setSyncLogs(prev => [...prev, `[HALTED] Proses terhenti: ${err.message}`]);
    }
    setCleaning(false);
    setSyncProgress('');
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard Admin</h1>
          <p className="page-subtitle">Monitoring dan pengelolaan data survei seluruh pasar</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <select 
            className="form-select" 
            style={{ width: 'auto', padding: '0 12px', fontSize: 13 }}
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value as any)}
          >
            <option value="all">Semua Waktu</option>
            <option value="day">Hari Ini</option>
            <option value="week">7 Hari Terakhir</option>
            <option value="month">Bulan Ini</option>
          </select>
          <button
            className="btn btn-primary"
            onClick={exportExcel}
            disabled={exporting}
          >
            {exporting
              ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Mengekspor...</>
              : <>Export Excel</>
            }
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <div className="flex-1 min-w-[300px] flex gap-2">
          <input 
            type="text" 
            placeholder="Tempel URL Apps Script (Proxy) di sini..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            value={proxyUrl}
            onChange={(e) => {
              setProxyUrl(e.target.value);
              localStorage.setItem('proxy_url', e.target.value);
            }}
          />
        </div>
        <button
          onClick={handleManualSyncAndCleanup}
          disabled={cleaning || syncProgress.includes('...') || submissions.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors text-white font-medium shadow-lg"
        >
          <RefreshCw className={`w-4 h-4 ${cleaning ? 'animate-spin' : ''}`} />
          {cleaning ? syncProgress : 'Sync & Bersihkan'}
        </button>
        <button
          onClick={handleDiagnostic}
          disabled={diagnosing}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors text-white font-medium shadow-lg"
        >
          <Settings className="w-4 h-4" />
          {diagnosing ? 'Mengetes...' : 'Cek Koneksi Google'}
        </button>
      </div>

      {syncLogs.length > 0 && (
        <div className="card mb-6" style={{ background: '#000', color: '#10b981', fontFamily: 'monospace', fontSize: 12, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, color: '#fff' }}>
            <strong>Audit Log Sinkronisasi</strong>
            <button onClick={() => setSyncLogs([])} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>Bersihkan</button>
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {syncLogs.map((log, i) => <div key={i} style={{ marginBottom: 4 }}>{log}</div>)}
          </div>
        </div>
      )}

      <div className="page-body">
        {/* Stats Grid */}
        <div className="grid-4 mb-6">
          {[
            { label: 'Total Entri', value: stats.total, icon: '📋', color: '#6366f1' },
            { label: 'Menunggu Verifikasi', value: stats.pending, icon: '⏳', color: '#f59e0b' },
            { label: 'Disetujui', value: stats.approved, icon: '✅', color: '#10b981' },
            { label: 'Ditolak', value: stats.rejected, icon: '❌', color: '#ef4444' },
          ].map((s, i) => (
            <div key={i} className="stat-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 24 }}>{s.icon}</span>
              </div>
              <p style={{ fontSize: 32, fontWeight: 800, color: s.color }}>{s.value}</p>
              <p className="stat-label">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Total Revenue Card */}
        <div className="card mb-6" style={{
          background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(6,182,212,0.1))',
          border: '1px solid rgba(16,185,129,0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <p className="text-sm text-muted" style={{ marginBottom: 4 }}>Total Nominal Kontribusi Disetujui (Minggu Ini)</p>
              <p style={{
                fontSize: 36, fontWeight: 800,
                background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
              }}>
                Rp {stats.totalAmount.toLocaleString('id-ID')}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p className="text-sm text-muted">Hari ini</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>{stats.todayCount} entri</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          {(['overview', 'log', 'markets'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: 600,
                color: activeTab === tab ? 'var(--primary-light)' : 'var(--text-muted)',
                borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
                transition: 'all 0.2s', marginBottom: -1
              }}
            >
              {tab === 'overview' ? '📊 Overview' : tab === 'log' ? '📜 Log Aktivitas' : '🏪 Per Pasar'}
            </button>
          ))}
        </div>

        {/* Tab: Log Aktivitas */}
        {activeTab === 'log' && (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Surveyor</th>
                  <th>Pasar</th>
                  <th>Nominal</th>
                  <th>Status</th>
                  <th>Waktu</th>
                </tr>
              </thead>
              <tbody>
                {[...submissions]
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map((s, i) => (
                  <tr key={s.id}>
                    <td className="text-muted text-sm">{i + 1}</td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.surveyor_name}</td>
                    <td className="text-secondary">
                        <div style={{ fontWeight: 500 }}>{s.market_name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{s.location_type || 'Lapak'}</div>
                    </td>
                    <td style={{ color: '#10b981', fontWeight: 700 }}>
                        <div>Rp {s.amount.toLocaleString('id')}</div>
                        {s.drive_link && (
                            <a href={s.drive_link} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: 'var(--primary-light)' }}>
                                📁 Drive
                            </a>
                        )}
                    </td>
                    <td><span className={`badge badge-${s.status}`}>{
                      s.status === 'pending' ? 'Menunggu' :
                      s.status === 'approved' ? 'Disetujui' : 'Ditolak'
                    }</span></td>
                    <td className="text-sm text-muted">
                        {new Date(s.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab: Per Pasar */}
        {activeTab === 'markets' && (
          <div className="grid-2">
            {markets.map(market => {
              const mSubs = submissions.filter(s => s.market_id === market.id);
              const approved = mSubs.filter(s => s.status === 'approved');
              const pending = mSubs.filter(s => s.status === 'pending');
              const total = approved.reduce((a, s) => a + Number(s.amount), 0);
              return (
                <div key={market.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 15 }}>{market.name}</p>
                      <p className="text-xs text-muted" style={{ marginTop: 2 }}>
                        📍 {market.lat.toFixed(4)}, {market.long.toFixed(4)}
                      </p>
                    </div>
                    <span className="badge badge-synced" style={{ fontSize: 11 }}>{mSubs.length} entri</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                    <div>
                      <p className="text-xs text-muted">Total Diterima ({timeFilter})</p>
                      <p style={{ fontSize: 18, fontWeight: 800, color: '#10b981' }}>Rp {total.toLocaleString('id')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted">Jumlah Data</p>
                      <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{approved.length}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                    {['toko', 'ruko', 'lapak', 'perorangan'].map(type => {
                      const count = mSubs.filter(s => s.location_type === type).length;
                      if (count === 0) return null;
                      return (
                        <span key={type} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                          {type}: {count}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab: Overview chart (visual bars) */}
        {activeTab === 'overview' && (
          <div className="grid-2" style={{ gap: 24, alignItems: 'start' }}>
            {/* Top Markets Chart */}
            <div className="card">
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 20 }}>
                🚀 Kontribusi Per Pasar (Approved)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {markets.slice(0, 5).map(market => {
                  const mSubs = submissions.filter(s => s.market_id === market.id && s.status === 'approved');
                  const total = mSubs.reduce((a, s) => a + Number(s.amount), 0);
                  const maxTotal = Math.max(...markets.map(m =>
                    submissions.filter(s => s.market_id === m.id && s.status === 'approved').reduce((a, s) => a + Number(s.amount), 0)
                  ));
                  const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
                  return (
                    <div key={market.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8 }}>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{market.name}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>
                          Rp {total.toLocaleString('id')}
                        </span>
                      </div>
                      <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${pct}%`,
                          background: 'linear-gradient(90deg, #10b981, #06b6d4)',
                          borderRadius: 10, transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)'
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Activity Mini Log */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
                  ⏱️ Aktivitas Terbaru
                </h3>
                <button onClick={() => setActiveTab('log')} style={{ background: 'none', border: 'none', color: 'var(--primary-light)', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>Lihat Semua</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {submissions.slice(0, 5).map((s, i) => (
                  <div key={s.id} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ 
                      width: 32, height: 32, borderRadius: 8, 
                      background: s.status === 'approved' ? 'rgba(16,185,129,0.1)' : s.status === 'rejected' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14
                    }}>
                      {s.status === 'approved' ? '✅' : s.status === 'rejected' ? '❌' : '⏳'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                         {s.surveyor_name} — {s.market_name}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {new Date(s.created_at).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit' })} • Rp {s.amount.toLocaleString('id')}
                      </p>
                    </div>
                  </div>
                ))}
                {submissions.length === 0 && <p className="text-muted text-sm italic">Belum ada aktivitas hari ini.</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function ExcelIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="8" x2="16" y1="13" y2="13"/>
      <line x1="8" x2="16" y1="17" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}
