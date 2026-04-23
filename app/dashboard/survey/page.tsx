'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { haversineDistance, getUserLocation } from '@/lib/geofence';
import { compressImage, blobToBase64, formatFileSize } from '@/lib/imageCompressor';
import { addPendingSubmission } from '@/lib/dexieDb';
import ModernModal from '@/components/ModernModal';
import { Camera, MapPin, CheckCircle2, Save, ShoppingBag, Clock, Check, X, AlertCircle, Info, RefreshCw } from 'lucide-react';

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
  const workerRef = useRef<any>(null);

  // Form
  const [amount, setAmount] = useState('');
  const [locationType, setLocationType] = useState<'toko' | 'ruko' | 'lapak' | 'perorangan'>('lapak');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [torchActive, setTorchActive] = useState(false);
  
  // Real-time Sync Modal State
  const [syncModal, setSyncModal] = useState<{ 
    show: boolean, 
    status: 'idle' | 'processing' | 'success' | 'error', 
    message: string 
  }>({ show: false, status: 'idle', message: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // History & Edit
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [editId, setEditId] = useState<number | string | null>(null);
  const [isEditingServer, setIsEditingServer] = useState(false);
  const [editingTempId, setEditingTempId] = useState<string | null>(null);
  const [modalMsg, setModalMsg] = useState<{ title: string; msg: string; type: 'success' | 'danger' | 'info' } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  useEffect(() => {
    fetchCombinedHistory();
  }, [user]);

  const fetchCombinedHistory = async () => {
    if (!user) return;
    setLoadingHistory(true);
    try {
      // 1. Get Local Pending
      const { getAllLocalSubmissions } = await import('@/lib/dexieDb');
      const localData = await getAllLocalSubmissions();
      
      // 2. Get Server Data (if online) - Only for TODAY
      let serverData: any[] = [];
      const { supabase } = await import('@/lib/supabaseClient');
      const todayStart = new Date();
      todayStart.setHours(0,0,0,0);

      const { data, error } = await supabase
        .from('submissions')
        .select('*, market:markets(name)')
        .eq('surveyor_id', user.id)
        .gte('created_at', todayStart.toISOString())
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        serverData = data.map(s => ({
          ...s,
          market_name: s.market?.name || 'Pasar Tidak Dikenal',
          synced: true,
          fromServer: true
        }));
      }

      // 3. Merge: Filter out local data that matches server data (using tempId if available)
      const serverTempIds = new Set(serverData.map(s => s.id)); // Using ID as proxy
      const finalHistory = [
        ...localData.filter(l => !l.synced), // Only show unsynced locals
        ...serverData
      ].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setHistory(finalHistory);
    } catch (e) {
      console.error('Error fetching history:', e);
    }
    setLoadingHistory(false);
  };

  const clearForm = () => {
    // Pasar tidak di-reset agar memudahkan input berkali-kali di lokasi yang sama
    setPhotoPreview('');
    setPhotoBlob(null);
    setOcrText('');
    setOcrAmount('');
    setAmount('');
    setLocationType('lapak');
    setNotes('');
    setEditId(null);
    setIsEditingServer(false);
    setEditingTempId(null);
  };

  const handleEdit = (item: any) => {
    if (item.synced && item.status && item.status !== 'pending') {
      setModalMsg({ title: 'Tidak Bisa Diedit', msg: 'Data sudah disah-kan dan tidak bisa diedit lagi.', type: 'info' });
      return;
    }
    setEditId(item.id);
    setIsEditingServer(!!item.fromServer);
    setEditingTempId(item.tempId || null);
    setSelectedMarket(item.market_id);
    setAmount(item.amount.toString());
    setNotes(item.notes || '');
    setLocationType(item.location_type || 'lapak');
    setPhotoPreview(item.photo_base64 || '');
    setGeofenceStatus(item.is_geofence_valid ? 'valid' : 'invalid');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // =========================================
  // GEOFENCING
  // =========================================
  const checkGeofence = useCallback(async (marketIdOverride?: string) => {
    const marketId = marketIdOverride || selectedMarket;
    if (!marketId) return;
    setGeofenceStatus('checking');
    setGeofenceMsg('Mengambil lokasi GPS Anda...');
    try {
      const coords = await getUserLocation();
      const market = markets.find(m => m.id === marketId);
      if (!market) return;
      const dist = haversineDistance(coords.latitude, coords.longitude, market.lat, market.long);
      const distM = Math.round(dist * 1000);
      setLocationData({ lat: coords.latitude, long: coords.longitude, distance: distM });
      if (dist <= 1) {
        setGeofenceStatus('valid');
        setGeofenceMsg(`✅ Lokasi Valid: ${distM}m dari ${market.name}.`);
      } else {
        setGeofenceStatus('invalid');
        setGeofenceMsg(`❌ Terlalu Jauh: ${distM}m dari ${market.name}. Radius maks 1km.`);
      }
    } catch (err: any) {
      setGeofenceStatus('error');
      setGeofenceMsg('GPS Error: Pastikan izin lokasi diaktifkan.');
    }
  }, [selectedMarket, markets]);


  const handleDelete = async (item: any) => {
    setDeleteTarget(item);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const item = deleteTarget;
    setDeleteTarget(null);
    
    try {
      if (item.fromServer) {
        // Delete from Server
        const res = await fetch(`/api/submissions/${item.id}`, { method: 'DELETE' });
        const result = await res.json();
        if (!result.success) throw new Error(result.error);
      } else {
        // Delete from Local Dexie
        const { deleteLocalSubmission } = await import('@/lib/dexieDb');
        await deleteLocalSubmission(item.id);
      }
      
      setSaveResult({ type: 'success', msg: 'Data berhasil dihapus.' });
      fetchCombinedHistory();
    } catch (err: any) {
      setModalMsg({ title: 'Gagal Menghapus', msg: err.message, type: 'danger' });
    }
  };



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
      setModalMsg({ title: 'Akses Kamera Gagal', msg: 'Kamera tidak dapat diakses. Pastikan izin kamera diaktifkan di browser Anda.', type: 'danger' });
    }
  }, []);

  const stopCamera = useCallback(() => {
    cameraStream?.getTracks().forEach(t => t.stop());
    setCameraStream(null);
    setCameraActive(false);
    setTorchActive(false);
  }, [cameraStream]);

  const toggleTorch = useCallback(async () => {
    if (!cameraStream) return;
    const track = cameraStream.getVideoTracks()[0];
    const capabilities = track.getCapabilities() as any;
    if (capabilities.torch) {
      const next = !torchActive;
      await track.applyConstraints({
        advanced: [{ torch: next }]
      } as any);
      setTorchActive(next);
    } else {
      setModalMsg({ title: 'Fitur Tidak Didukung', msg: 'Perangkat Anda tidak mendukung fitur senter (flashlight) dari browser.', type: 'info' });
    }
  }, [cameraStream, torchActive]);

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
        
        // Use a reasonable size for OCR (not too big, not too small)
        const scale = Math.min(1, 1500 / Math.max(img.width, img.height));
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Contrast enhancement factor
        const contrast = 1.5; // Increase contrast by 50%
        const intercept = 128 * (1 - contrast);

        for (let i = 0; i < data.length; i += 4) {
          // Standard grayscale conversion
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          let gray = 0.299 * r + 0.587 * g + 0.114 * b;
          
          // Apply contrast
          gray = contrast * gray + intercept;
          
          // Apply binary threshold (black text on white background)
          // Most receipts are light paper with dark ink
          const binary = gray > 140 ? 255 : 0;
          
          data[i] = data[i + 1] = data[i + 2] = binary;
        }
        
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
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
      
      // Use cached worker or create new one
      if (!workerRef.current) {
        const worker = await createWorker('ind', 1, {
          logger: (m: any) => {
            if (m.status === 'recognizing text') {
              setOcrProgress(Math.round(m.progress * 100));
            }
          },
        });

        // Optimization for numbers and currency symbols
        await worker.setParameters({
          tessedit_char_whitelist: '0123456789.,Rp \n',
          tessjs_create_hocr: '0',
          tessjs_create_tsv: '0',
        });
        workerRef.current = worker;
      }

      const { data: { text } } = await workerRef.current.recognize(processedUrl);
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
      // Clean up worker on error to be safe
      if (workerRef.current) {
        await workerRef.current.terminate();
        workerRef.current = null;
      }
    }
  }, []);

  // Extract amount from OCR text
  function extractAmount(text: string): string {
    // 1. Clean common noise but keep dots and commas
    // Remove "Rp" and spaces between digits that might be misinterpreted
    let cleaned = text.replace(/Rp/gi, '').replace(/\s/g, ' ');
    
    // 2. Look for large number patterns (minimum 4 digits for IDR context)
    // Matches: 50.000, 50,000, 50000, 50.000,00
    const matches = cleaned.match(/\d[\d.,]{2,}\d/g) || [];
    
    let biggest = 0;
    
    for (const m of matches) {
      // Logic for IDR: 
      // If there's a comma followed by exactly 2 digits at the end, it's likely cents.
      // Otherwise, dots and commas are usually thousand separators.
      let numStr = m;
      if (m.match(/,\d{2}$/)) {
        numStr = m.substring(0, m.length - 3).replace(/[.,]/g, '');
      } else {
        numStr = m.replace(/[.,]/g, '');
      }
      
      const num = parseInt(numStr);
      
      // Filter out reasonable market amounts (usually between 1.000 and 10.000.000)
      // And ignore things that look like years (2024, 2025, 2026) if they appear alone
      if (!isNaN(num)) {
        // Preference for "standard" banknote values if found
        const isStandardBanknote = [1000, 2000, 5000, 10000, 20000, 50000, 100000].includes(num);
        
        if (isStandardBanknote) {
          // If we find a standard banknote, and it's the biggest so far, keep it.
          if (num > biggest) biggest = num;
        } else if (num >= 1000 && num <= 5000000) {
          // Ignore years (approx 1990-2040) unless it's clearly a nominal
          const isYear = num >= 1990 && num <= 2040;
          if (!isYear && num > biggest) {
            biggest = num;
          }
        }
      }
    }
    
    if (biggest > 0) {
      return biggest.toString();
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
        location_type: locationType,
        photo_base64: photoPreview,
        notes,
        lat: locationData?.lat || 0,
        long: locationData?.long || 0,
        is_geofence_valid: geofenceStatus === 'valid',
        ocr_amount_detect: ocrAmount ? parseFloat(ocrAmount) : null,
        created_at: new Date().toISOString(),
        synced: 0,
      };

      if (editId) {
        if (isEditingServer) {
          const res = await fetch(`/api/submissions/${editId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              market_id: selectedMarket,
              amount: parseFloat(amount),
              location_type: locationType,
              notes,
            })
          });
          const result = await res.json();
          if (!result.success) throw new Error(result.error);
          setSaveResult({ type: 'success', msg: 'Data di server berhasil diperbarui!' });
        } else {
          await updatePendingSubmission(editId as number, payload);
          setSaveResult({ type: 'success', msg: 'Data berhasil diperbarui! Sinkronisasi otomatis sedang berjalan.' });
        }
      } else {
        await addPendingSubmission(payload);
        setSaveResult({ type: 'success', msg: 'Data berhasil disimpan! Akan otomatis tersinkron saat online.' });
      }
      
      clearForm();
      fetchCombinedHistory();
      
      // Trigger sync immediately if online
      if (navigator.onLine) {
        import('@/lib/syncService').then(({ syncSubmissions }) => {
          syncSubmissions().then(() => fetchCombinedHistory());
        });
      }
    } catch (err: any) {
      console.error('Save error:', err);
      setModalMsg({ title: 'Gagal Menyimpan', msg: 'Gagal menyimpan data ke database lokal: ' + err.message, type: 'danger' });
    }
    setSaving(false);
  };

  useEffect(() => {
    return () => { 
      if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
      if (workerRef.current) workerRef.current.terminate();
    };
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
                  {editId ? (
                    <span style={{ color: 'var(--warning)', textTransform: 'uppercase' }}>MODE EDIT</span>
                  ) : (
                    <>
                      <span style={{
                        width: 24, height: 24, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 800, color: 'white', flexShrink: 0
                      }}>1</span>
                      Pilih Pasar
                    </>
                  )}
                </h3>
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <select
                    className="form-select lg:text-lg"
                    value={selectedMarket}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedMarket(val);
                      if (val) checkGeofence(val);
                    }}
                    required
                  >
                    <option value="">-- Pilih pasar --</option>
                    {markets.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                {/* GPS button removed as it is now auto-triggered */}
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

              <div className="card">
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 800, color: 'white', flexShrink: 0
                  }}>2</span>
                  Tipe Lokasi
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {['toko', 'ruko', 'lapak', 'perorangan'].map(type => (
                    <button
                      key={type}
                      type="button"
                      className={`btn btn-sm ${locationType === type ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setLocationType(type as any)}
                      style={{ textTransform: 'capitalize', justifyContent: 'center' }}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 3: Nominal & Catatan */}
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
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="submit"
                  className="btn btn-primary btn-full btn-lg"
                  disabled={!canSubmit || saving || !!(geofenceStatus === 'invalid')}
                  style={{ flex: 2 }}
                >
                  {saving
                    ? <><span className="spinner" /> {editId ? 'Memperbarui...' : 'Menyimpan...'}</>
                    : <>{editId ? <><Check /> Perbarui Data</> : <><SaveIcon /> Simpan Data Survei</>}</>
                  }
                </button>
                {editId && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-lg"
                    style={{ flex: 1, color: 'var(--text-muted)' }}
                    onClick={clearForm}
                  >
                    <X size={18} /> Batal
                  </button>
                )}
              </div>
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
                        <div style={{ position: 'relative', width: '100%', borderRadius: 12, overflow: 'hidden' }}>
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="camera-preview"
                            style={{ width: '100%', display: 'block' }}
                          />
                          {/* Visual Guide Overlay */}
                          <div style={{
                            position: 'absolute', inset: 0,
                            border: '2px dashed rgba(255,255,255,0.4)',
                            margin: '40px 20px', borderRadius: 8,
                            pointerEvents: 'none',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                              Posisikan Angka di Sini
                            </div>
                          </div>
                          
                          {/* Torch Button */}
                          <button
                            type="button"
                            onClick={toggleTorch}
                            style={{
                              position: 'absolute', top: 12, right: 12,
                              width: 40, height: 40, borderRadius: '50%',
                              background: torchActive ? 'var(--warning)' : 'rgba(0,0,0,0.4)',
                              backdropFilter: 'blur(8px)', border: 'none', color: 'white',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', zIndex: 10
                            }}
                          >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill={torchActive ? 'currentColor' : 'none'}/>
                            </svg>
                          </button>
                        </div>

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
              <h2 style={{ fontSize: 20, fontWeight: 800 }}>Riwayat Survei</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Status sinkronisasi & verifikasi real-time</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                className="btn btn-primary btn-sm" 
                onClick={async () => {
                   setSyncModal({ show: true, status: 'processing', message: 'Menghubungkan ke server...' });
                   setLoadingHistory(true);
                   try {
                     const { syncSubmissions } = await import('@/lib/syncService');
                     const result = await (syncSubmissions() as any);
                     
                     if (!result) {
                        setSyncModal({ show: true, status: 'success', message: 'Data sudah sinkron.' });
                     } else if (!result.success) {
                        setSyncModal({ show: true, status: 'error', message: result.message });
                     } else {
                        setSyncModal({ show: true, status: 'success', message: result.message });
                     }
                   } catch (err: any) {
                     setSyncModal({ show: true, status: 'error', message: err.message });
                   }
                   await fetchCombinedHistory();
                   setLoadingHistory(false);
                }}
                disabled={loadingHistory}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2v6h-6M3 22v-6h6"/><path d="M21 13a9 9 0 11-3-7.7L21 8"/></svg>
                Sinkron Data
              </button>
              <button className="btn btn-secondary btn-sm" onClick={fetchCombinedHistory} disabled={loadingHistory}>
                {loadingHistory ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>}
                Refresh
              </button>
            </div>
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
                      <tr key={item.fromServer ? item.id : item.tempId}>
                        <td style={{ paddingLeft: 20 }}>
                          <div style={{ fontWeight: 800, color: 'var(--primary-light)' }}>{item.market_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {new Date(item.created_at).toLocaleDateString('id-ID')} • {new Date(item.created_at).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' })}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 800, color: 'var(--success)', fontSize: 16 }}>
                            Rp {item.amount.toLocaleString('id-ID')}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                             {item.fromServer ? (
                               <span className={`badge badge-${item.status}`} style={{ fontSize: 10 }}>
                                 {item.status.toUpperCase()}
                               </span>
                             ) : (
                               <span className="badge badge-pending" style={{ fontSize: 10, background: 'rgba(168,85,247,0.1)', color: '#a855f7' }}>
                                 SINKRONISASI
                               </span>
                             )}
                             {item.synced === 1 && <span className="badge badge-synced" style={{ fontSize: 9 }}>SINKRON</span>}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <span title="Geofence Status" style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: item.is_geofence_valid ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: item.is_geofence_valid ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                              GPS: {item.is_geofence_valid ? 'OK' : 'FAIL'}
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', paddingRight: 20 }}>
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            {/* edit: strictly for pending or local */}
                            {(!item.status || item.status === 'pending') && (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleEdit(item)}
                                style={{ padding: '6px 12px' }}
                              >
                                Edit
                              </button>
                            )}
                            {/* delete: always allowed except for approved */}
                            {item.status !== 'approved' && (
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleDelete(item)}
                                style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', padding: '6px 12px', border: '1px solid rgba(239,68,68,0.2)' }}
                              >
                                Hapus
                              </button>
                            )}
                          </div>
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

      {/* Modern Modals Implementation */}
      <ModernModal
        isOpen={showSubmitConfirm}
        onClose={() => setShowSubmitConfirm(false)}
        title="Simpan Data Survei?"
        description="Data akan disimpan di memori HP dan otomatis dikirim ke server saat Anda online."
        confirmText="Ya, Simpan"
        onConfirm={() => {
          setShowSubmitConfirm(false);
          // Trigger the actual save logic
          const form = document.querySelector('form');
          if (form) form.requestSubmit();
        }}
      />

      <ModernModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Hapus Data Survei?"
        description="Data ini akan dihapus permanen dari riwayat Anda."
        type="danger"
        confirmText="Ya, Hapus"
        onConfirm={confirmDelete}
      />

      {modalMsg && (
        <ModernModal
          isOpen={!!modalMsg}
          onClose={() => setModalMsg(null)}
          title={modalMsg.title}
          description={modalMsg.msg}
          type={modalMsg.type}
          confirmText="Tutup"
          onConfirm={() => setModalMsg(null)}
        />
      )}

      {/* Modern Sync Modal */}
      {syncModal.show && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: 20, animation: 'fadeIn 0.3s ease'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(30,27,75,0.9), rgba(15,12,41,0.9))',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 24, padding: 32, width: '100%', maxWidth: 320,
            textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            transform: 'scale(1)', animation: 'popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}>
            {syncModal.status === 'processing' && (
              <div style={{ marginBottom: 20 }}>
                <div className="spinner" style={{ width: 60, height: 60, borderWidth: 4, margin: '0 auto' }} />
              </div>
            )}
            
            {syncModal.status === 'success' && (
              <div style={{ 
                width: 60, height: 60, borderRadius: '50%', background: 'rgba(34,197,94,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px'
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            )}

            {syncModal.status === 'error' && (
              <div style={{ 
                width: 60, height: 60, borderRadius: '50%', background: 'rgba(239,68,68,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px'
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
            )}

            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8, color: '#fff' }}>
              {syncModal.status === 'processing' ? 'Sinkronisasi...' : 
               syncModal.status === 'success' ? 'Berhasil!' : 'Sinkron Gagal'}
            </h3>
            
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, marginBottom: 24 }}>
              {syncModal.message}
            </p>

            {syncModal.status !== 'processing' && (
              <button 
                className="btn btn-primary" 
                style={{ width: '100%', borderRadius: 12 }}
                onClick={() => setSyncModal(prev => ({ ...prev, show: false }))}
              >
                Tutup
              </button>
            )}
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes popIn { 
          from { opacity: 0; transform: scale(0.9); } 
          to { opacity: 1; transform: scale(1); } 
        }
      `}</style>
    </>

  );
}

// Icons
function LocIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>; }
function UploadIcon() { return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 16 12 12 8 16"/><line x1="12" x2="12" y1="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>; }
function SaveIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>; }
