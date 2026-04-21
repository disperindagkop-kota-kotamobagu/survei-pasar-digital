'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { DEMO_MARKETS } from '@/lib/mockData';
import { haversineDistance, getUserLocation } from '@/lib/geofence';
import { compressImage, blobToBase64, formatFileSize } from '@/lib/imageCompressor';
import { addPendingSubmission } from '@/lib/dexieDb';

type GeofenceStatus = 'idle' | 'checking' | 'valid' | 'invalid' | 'error';
type OCRStatus = 'idle' | 'loading' | 'done' | 'error';
type CameraMode = 'upload' | 'camera';

interface LocationData {
  lat: number;
  long: number;
  distance: number;
}

export default function SurveyPage() {
  const { user } = useAuth();
  const [markets, setMarkets] = useState<any[]>([]);
  const [selectedMarket, setSelectedMarket] = useState('');
  const [geofenceStatus, setGeofenceStatus] = useState<GeofenceStatus>('idle');
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [geofenceMsg, setGeofenceMsg] = useState('');

  useEffect(() => {
    fetchMarkets();
  }, []);

  const fetchMarkets = async () => {
    try {
      const { supabase } = await import('@/lib/supabaseClient');
      const { data, error } = await supabase.from('markets').select('*').order('name');
      if (error) throw error;
      setMarkets(data || []);
    } catch (e) {
      console.error('Error fetching markets:', e);
      // No fallback to demo data to avoid confusion with live DB
    }
  };

  // Photo & OCR
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [photoSize, setPhotoSize] = useState('');
  const [ocrStatus, setOcrStatus] = useState<OCRStatus>('idle');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrText, setOcrText] = useState('');
  const [ocrAmount, setOcrAmount] = useState('');

  // Camera
  const [cameraMode, setCameraMode] = useState<CameraMode>('upload');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Form
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{type: 'success'|'error', msg: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // History & Edit
  const [history, setHistory] = useState<any[]>([]);
  const [editId, setEditId] = useState<number | null>(null);
  const [editingTempId, setEditingTempId] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const { getAllLocalSubmissions } = await import('@/lib/dexieDb');
      const data = await getAllLocalSubmissions();
      setHistory(data);
    } catch (e) {
      console.error('Error fetching history:', e);
    }
  };

  const clearForm = () => {
    setSelectedMarket('');
    setPhotoPreview('');
    setPhotoBlob(null);
    setOcrText('');
    setOcrAmount('');
    setAmount('');
    setNotes('');
    setGeofenceStatus('idle');
    setLocationData(null);
    setEditId(null);
    setEditingTempId(null);
  };

  const handleEdit = (item: any) => {
    if (item.synced && item.status && item.status !== 'pending') {
      alert('Data sudah disah-kan dan tidak bisa diedit lagi.');
      return;
    }
    setEditId(item.id);
    setEditingTempId(item.tempId);
    setSelectedMarket(item.market_id);
    setAmount(item.amount.toString());
    setNotes(item.notes || '');
    setPhotoPreview(item.photo_base64 || '');
    setGeofenceStatus(item.is_geofence_valid ? 'valid' : 'invalid');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // =========================================
  // GEOFENCING
  // =========================================
  const checkGeofence = useCallback(async () => {
    if (!selectedMarket) return;
    setGeofenceStatus('checking');
    setGeofenceMsg('Mengambil lokasi GPS Anda...');
    try {
      const coords = await getUserLocation();
      const market = markets.find(m => m.id === selectedMarket);
      if (!market) return;
      const dist = haversineDistance(coords.latitude, coords.longitude, market.lat, market.long);
      const distM = Math.round(dist * 1000);
      setLocationData({ lat: coords.latitude, long: coords.longitude, distance: distM });
      if (dist <= 1) {
        setGeofenceStatus('valid');
        setGeofenceMsg(`✅ Anda berada ${distM}m dari ${market.name}. Dalam radius.`);
      } else {
        setGeofenceStatus('invalid');
        setGeofenceMsg(`❌ Anda berada ${distM}m dari ${market.name}. Minimal 1km dari pasar.`);
      }
    } catch (err: any) {
      setGeofenceStatus('error');
      setGeofenceMsg('GPS tidak dapat diakses. Pastikan izin lokasi diaktifkan.');
    }
  }, [selectedMarket]);



  // =========================================
  // KAMERA
  // =========================================
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setCameraStream(stream);
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch {
      alert('Kamera tidak dapat diakses. Pastikan izin kamera diaktifkan.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    cameraStream?.getTracks().forEach(t => t.stop());
    setCameraStream(null);
    setCameraActive(false);
  }, [cameraStream]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      stopCamera();
      await processPhoto(blob);
    }, 'image/jpeg', 0.9);
  }, [stopCamera]);

  // =========================================
  // PHOTO PROCESSING & OCR
  // =========================================
  const processPhoto = useCallback(async (file: File | Blob) => {
    try {
      const compressed = await compressImage(file);
      setPhotoBlob(compressed);
      setPhotoSize(formatFileSize(compressed.size));
      const dataUrl = await blobToBase64(compressed);
      setPhotoPreview(dataUrl);
      
      // Auto-start OCR
      await runOCR(dataUrl);
    } catch (err) {
      console.error('Error processing photo:', err);
    }
  }, []);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processPhoto(file);
    e.target.value = '';
  }, [processPhoto]);

  // Helper to convert dataUrl to grayscale for better OCR
  const preprocessImage = async (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const gray = data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
          data[i] = data[i + 1] = data[i + 2] = gray;
        }
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = dataUrl;
    });
  };

  const runOCR = useCallback(async (imageUrl: string) => {
    setOcrStatus('loading');
    setOcrProgress(0);
    setOcrText('');
    setOcrAmount('');
    try {
      // Pre-process for better accuracy
      const processedUrl = await preprocessImage(imageUrl);

      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('ind', 1, {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100));
          }
        },
      });

      // Optimasi untuk angka
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789.,Rp ',
      });

      const { data: { text } } = await worker.recognize(processedUrl);
      await worker.terminate();
      setOcrText(text.trim());

      // Extract numbers from OCR text
      const extracted = extractAmount(text);
      if (extracted) {
        setOcrAmount(extracted);
        setAmount(extracted);
      }
      setOcrStatus('done');
    } catch (err) {
      console.error('OCR Error:', err);
      setOcrStatus('error');
    }
  }, []);

  // Extract amount from OCR text
  function extractAmount(text: string): string {
    // Cari pola angka besar (nominal uang) — pisahkan titik/koma
    const cleaned = text.replace(/[^\d.,\n]/g, ' ');
    const matches = cleaned.match(/\d[\d.,]{2,}/g) || [];
    // Ambil angka terbesar sebagai nominal
    let biggest = 0;
    let biggestStr = '';
    for (const m of matches) {
      const num = parseFloat(m.replace(/\./g, '').replace(',', '.'));
      if (num > biggest) { biggest = num; biggestStr = m; }
    }
    if (biggest >= 1000) {
      return Math.round(biggest).toString();
    }
    return '';
  }

  // =========================================
  // SAVE SUBMISSION
  // =========================================
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedMarket || !amount) return;
    setSaving(true);
    setSaveResult(null);
    try {
      const { addPendingSubmission, updatePendingSubmission } = await import('@/lib/dexieDb');
      const market = markets.find(m => m.id === selectedMarket);
      
      const payload = {
        tempId: editingTempId || crypto.randomUUID(),
        surveyor_id: user.id,
        market_id: selectedMarket,
        market_name: market?.name || '',
        amount: parseFloat(amount),
        photo_base64: photoPreview,
        notes,
        lat: locationData?.lat || 0,
        long: locationData?.long || 0,
        is_geofence_valid: geofenceStatus === 'valid',
        ocr_amount_detect: ocrAmount ? parseFloat(ocrAmount) : null,
        created_at: new Date().toISOString(),
        synced: false,
      };

      if (editId) {
        await updatePendingSubmission(editId, payload);
        setSaveResult({ type: 'success', msg: 'Data berhasil diperbarui! Sinkronisasi otomatis sedang berjalan.' });
      } else {
        await addPendingSubmission(payload);
        setSaveResult({ type: 'success', msg: 'Data berhasil disimpan! Akan otomatis tersinkron saat online.' });
      }
      
      clearForm();
      fetchHistory();
    } catch (err) {
      console.error('Save error:', err);
      setSaveResult({ type: 'error', msg: 'Gagal menyimpan data ke database lokal.' });
    }
    setSaving(false);
  };

  useEffect(() => {
    return () => { if (cameraStream) cameraStream.getTracks().forEach(t => t.stop()); };
  }, [cameraStream]);

  const market = markets.find(m => m.id === selectedMarket);
  const canSubmit = selectedMarket && amount && photoPreview;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Input Survei</h1>
          <p className="page-subtitle">Rekam data kontribusi pasar dengan foto & validasi lokasi</p>
        </div>
        {geofenceStatus === 'valid' && (
          <div className="badge badge-approved">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
            Lokasi Valid
          </div>
        )}
      </div>

      <div className="page-body">
        {saveResult && (
          <div className={`alert alert-${saveResult.type === 'success' ? 'success' : 'danger'} mb-4`}>
            {saveResult.msg}
          </div>
        )}

        <form onSubmit={handleSave}>
          <div className="grid-2" style={{ alignItems: 'start' }}>
            {/* Left column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Step 1: Pilih Pasar */}
              <div className="card">
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 800, color: 'white', flexShrink: 0
                  }}>1</span>
                  Pilih Pasar
                </h3>
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <select
                    className="form-select"
                    value={selectedMarket}
                    onChange={e => { setSelectedMarket(e.target.value); setGeofenceStatus('idle'); setLocationData(null); }}
                    required
                  >
                    <option value="">-- Pilih pasar --</option>
                    {markets.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                {selectedMarket && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={checkGeofence}
                    disabled={geofenceStatus === 'checking'}
                  >
                    {geofenceStatus === 'checking'
                      ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Mengecek...</>
                      : <><LocIcon /> Cek Lokasi GPS</>
                    }
                  </button>
                )}
                {geofenceStatus !== 'idle' && (
                  <div className={`location-card mt-3 ${
                    geofenceStatus === 'checking' ? 'checking' :
                    geofenceStatus === 'valid' ? 'valid' :
                    geofenceStatus === 'invalid' || geofenceStatus === 'error' ? 'invalid' : 'checking'
                  }`}>
                    <div style={{ fontSize: 13, lineHeight: 1.5 }}>{geofenceMsg}</div>
                  </div>
                )}
              </div>

              {/* Step 2: Nominal & Catatan */}
              <div className="card">
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 800, color: 'white', flexShrink: 0
                  }}>3</span>
                  Nominal & Catatan
                </h3>

                <div className="form-group">
                  <label className="form-label">Nominal Kontribusi (Rp)</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                      color: 'var(--text-muted)', fontSize: 14, fontWeight: 600
                    }}>Rp</span>
                    <input
                      type="number"
                      className="form-input"
                      style={{ paddingLeft: 44 }}
                      placeholder="0"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      required
                      min="0"
                    />
                  </div>
                  {ocrAmount && (
                    <p style={{ fontSize: 12, color: 'var(--accent)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      Auto-fill dari OCR: Rp {parseInt(ocrAmount).toLocaleString('id')}
                    </p>
                  )}
                  {amount && (
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, fontWeight: 600 }}>
                      = Rp {parseInt(amount || '0').toLocaleString('id-ID')}
                    </p>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Catatan (Opsional)</label>
                  <textarea
                    className="form-textarea"
                    placeholder="Contoh: Retribusi harian lapak sayur, area blok B..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    style={{ minHeight: 80 }}
                  />
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="btn btn-primary btn-full btn-lg"
                disabled={!canSubmit || saving || !!(geofenceStatus === 'invalid')}
              >
                {saving
                  ? <><span className="spinner" /> Menyimpan...</>
                  : <><SaveIcon /> Simpan Data Survei</>
                }
              </button>
              {geofenceStatus === 'invalid' && (
                <p className="text-sm text-danger text-center">Anda harus berada dalam radius 1km dari pasar untuk submit.</p>
              )}
            </div>

            {/* Right column — Kamera & OCR */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="card">
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 800, color: 'white', flexShrink: 0
                  }}>2</span>
                  Foto Bukti Bayar + OCR
                </h3>

                {/* Camera mode toggle */}
                <div style={{
                  display: 'flex', gap: 8, marginBottom: 16,
                  background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 4
                }}>
                  {(['upload', 'camera'] as CameraMode[]).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => { stopCamera(); setCameraMode(mode); setCameraActive(false); }}
                      style={{
                        flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                        background: cameraMode === mode ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'transparent',
                        color: cameraMode === mode ? 'white' : 'var(--text-muted)',
                        fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
                      }}
                    >
                      {mode === 'upload' ? '📁 Upload Foto' : '📷 Kamera Langsung'}
                    </button>
                  ))}
                </div>

                {/* Camera Mode */}
                {cameraMode === 'camera' && (
                  <div>
                    {!cameraActive ? (
                      <div
                        className="camera-zone"
                        style={{ cursor: 'pointer', minHeight: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        onClick={startCamera}
                      >
                        <div style={{ textAlign: 'center', padding: 24 }}>
                          <div className="camera-icon-ring" style={{ margin: '0 auto 12px' }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                              <circle cx="12" cy="13" r="4"/>
                            </svg>
                          </div>
                          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Ketuk untuk mengaktifkan kamera</p>
                          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>Arahkan ke bukti pembayaran</p>
                        </div>
                      </div>
                    ) : (
                      <div className="camera-zone active">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="camera-preview"
                          style={{ width: '100%', borderRadius: 12 }}
                        />
                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ flex: 1 }}
                            onClick={capturePhoto}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="currentColor"/>
                            </svg>
                            Ambil Foto
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={stopCamera}
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    )}
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                  </div>
                )}

                {/* Upload Mode */}
                {cameraMode === 'upload' && !photoPreview && (
                  <div
                    className="camera-zone"
                    style={{ minHeight: 200, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={async e => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (file && file.type.startsWith('image/')) await processPhoto(file);
                    }}
                  >
                    <div style={{ textAlign: 'center', padding: 24 }}>
                      <div className="camera-icon-ring" style={{ margin: '0 auto 12px' }}>
                        <UploadIcon />
                      </div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Ketuk atau seret foto di sini</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>JPG, PNG, WEBP — Maks 10MB</p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      style={{ display: 'none' }}
                      onChange={handleFileUpload}
                    />
                  </div>
                )}

                {/* Photo Preview */}
                {photoPreview && (
                  <div className="photo-preview-wrap">
                    <img src={photoPreview} alt="Bukti pembayaran" />
                    <div className="photo-preview-actions">
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ background: 'rgba(15,15,26,0.8)', backdropFilter: 'blur(8px)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 8 }}
                        onClick={() => runOCR(photoPreview)}
                        title="Scan ulang OCR"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15"/></svg>
                        Scan Ulang
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ background: 'rgba(239,68,68,0.8)', border: 'none', color: 'white', borderRadius: 8 }}
                        onClick={() => { setPhotoPreview(''); setPhotoBlob(null); setOcrText(''); setOcrAmount(''); setOcrStatus('idle'); }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                        Hapus
                      </button>
                    </div>
                    {photoSize && (
                      <div style={{
                        position: 'absolute', bottom: 10, left: 10,
                        background: 'rgba(15,15,26,0.8)', backdropFilter: 'blur(8px)',
                        color: 'var(--text-secondary)', fontSize: 11, padding: '3px 8px',
                        borderRadius: 6, border: '1px solid var(--border)'
                      }}>
                        📸 Terkompresi: {photoSize}
                      </div>
                    )}
                  </div>
                )}

                {/* OCR Status & Result */}
                {ocrStatus === 'loading' && (
                  <div className="ocr-result-panel mt-3">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="spinner" style={{ borderTopColor: 'var(--accent)', borderColor: 'rgba(6,182,212,0.2)', width: 18, height: 18, borderWidth: 2 }} />
                      <span style={{ fontSize: 13, color: 'var(--accent)' }}>
                        Membaca teks dari gambar... {ocrProgress}%
                      </span>
                    </div>
                    <div className="ocr-progress mt-2">
                      <div className="ocr-progress-bar" style={{ width: `${ocrProgress}%` }} />
                    </div>
                  </div>
                )}

                {ocrStatus === 'done' && (
                  <div className="ocr-result-panel mt-3">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>Hasil Pembacaan OCR</span>
                    </div>
                    {ocrAmount ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Nominal terdeteksi:</span>
                        <span style={{
                          fontSize: 18, fontWeight: 800,
                          background: 'linear-gradient(135deg, #06b6d4, #6366f1)',
                          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
                        }}>Rp {parseInt(ocrAmount).toLocaleString('id')}</span>
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ marginLeft: 'auto', background: 'rgba(6,182,212,0.15)', color: 'var(--accent)', border: '1px solid rgba(6,182,212,0.3)', borderRadius: 8 }}
                          onClick={() => setAmount(ocrAmount)}
                        >
                          Pakai Nilai Ini
                        </button>
                      </div>
                    ) : (
                      <p style={{ fontSize: 13, color: 'var(--warning)' }}>Nominal tidak terdeteksi otomatis. Isi manual.</p>
                    )}
                    {ocrText && (
                      <details style={{ marginTop: 8 }}>
                        <summary style={{ fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>Lihat seluruh teks yang terbaca</summary>
                        <pre style={{
                          marginTop: 8, padding: 10,
                          background: 'rgba(255,255,255,0.04)', borderRadius: 8,
                          fontSize: 11, color: 'var(--text-secondary)',
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 150, overflowY: 'auto'
                        }}>{ocrText}</pre>
                      </details>
                    )}
                  </div>
                )}

                {ocrStatus === 'error' && (
                  <div className="alert alert-warning mt-3">
                    Gagal membaca teks gambar. Pastikan foto cukup jelas dan terang.
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>

        {/* History Section */}
        <div className="mt-5 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800 }}>Riwayat Input Anda</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Lihat dan perbaiki data yang baru saja dimasukkan</p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={fetchHistory}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
              Refresh
            </button>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th style={{ paddingLeft: 20 }}>Pasar</th>
                    <th>Nominal</th>
                    <th>Status</th>
                    <th>Validitas</th>
                    <th style={{ textAlign: 'right', paddingRight: 20 }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                        Belum ada riwayat input lokal.
                      </td>
                    </tr>
                  ) : (
                    history.map((item) => (
                      <tr key={item.tempId}>
                        <td style={{ paddingLeft: 20 }}>
                          <div style={{ fontWeight: 600 }}>{item.market_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(item.created_at).toLocaleString('id-ID')}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            Rp {item.amount.toLocaleString('id-ID')}
                          </div>
                        </td>
                        <td>
                          {item.synced ? (
                            <span className="badge badge-approved" style={{ fontSize: 10 }}>Tersinkron</span>
                          ) : (
                            <span className="badge badge-pending" style={{ fontSize: 10, background: 'rgba(168,85,247,0.1)', color: '#a855f7' }}>Menunggu Sinyal</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <span title="Geofence Status" style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: item.is_geofence_valid ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: item.is_geofence_valid ? '#22c55e' : '#ef4444' }}>
                              GPS: {item.is_geofence_valid ? 'OK' : 'Luar'}
                            </span>
                            {item.ocr_amount_detect && (
                              <span title="OCR Status" style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: Math.abs(item.ocr_amount_detect - item.amount) < 1 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: Math.abs(item.ocr_amount_detect - item.amount) < 1 ? '#22c55e' : '#ef4444' }}>
                                OCR: {Math.abs(item.ocr_amount_detect - item.amount) < 1 ? 'Match' : 'Beda'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', paddingRight: 20 }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleEdit(item)}
                            disabled={item.status && item.status !== 'pending'}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>

  );
}

// Icons
function LocIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>; }
function UploadIcon() { return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 16 12 12 8 16"/><line x1="12" x2="12" y1="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>; }
function SaveIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>; }
