'use client';

import { useState, useRef, useCallback } from 'react';
import ParticleBackground from '../components/StarBackground';
import Link from 'next/link';

const APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || '';

export default function SubmitPaperPage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [regId, setRegId] = useState('');

  const [paperFile, setPaperFile] = useState({ name: '', base64: '', size: 0 });
  const paperRef = useRef(null);
  const [dragOverPaper, setDragOverPaper] = useState(false);

  const processFileGeneric = useCallback((file, setState, allowedTypes, maxMb) => {
    setError(null);
    if (!file) return;
    const fileExt = file.name.split('.').pop().toLowerCase();
    if (!allowedTypes.includes(fileExt)) {
      setError(`Format file harus ${allowedTypes.join('/')}`);
      return;
    }
    if (file.size > maxMb * 1024 * 1024) {
      setError(`Ukuran file maksimal ${maxMb}MB`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result.split(',')[1];
      setState({
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(2),
        base64: base64
      });
    };
    reader.readAsDataURL(file);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!regId) {
      setError('Registration ID wajib diisi.');
      return;
    }
    if (!paperFile.base64) {
      setError('File Full Paper wajib diunggah.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = {
        type: 'submit_paper',
        regId: regId.trim(),
        paperFileName: paperFile.name,
        paperBase64: paperFile.base64,
      };

      const res = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload),
        redirect: 'follow',
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(data.message);
      } else {
        setError(data.message || 'Terjadi kesalahan. Coba lagi.');
      }
    } catch {
      setError('Gagal terhubung ke server. Periksa koneksi internet kamu.');
    }
    setLoading(false);
  };

  // ─── Success View ───
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: '#ffffff' }}>
        <ParticleBackground />
        <div className="relative z-10 w-full max-w-md text-center animate-slide-up">
          <div className="mb-6 inline-flex items-center justify-center w-20 h-20 rounded-full"
            style={{ background: 'rgba(68, 203, 168, 0.1)', border: '2px solid rgba(68, 203, 168, 0.3)' }}>
            <span className="text-4xl">📄</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: '#201C46' }}>Upload Berhasil!</h2>
          <p className="text-gray-500 text-sm mb-8">{success}</p>

          <Link href="/daftar" className="text-gray-400 hover:text-gray-600 text-sm transition-colors underline underline-offset-4">
            ← Kembali ke halaman pendaftaran
          </Link>
        </div>
      </div>
    );
  }

  // ─── Main Form ───
  return (
    <div className="min-h-screen flex items-center justify-center relative px-4" style={{ background: '#ffffff' }}>
      <ParticleBackground />

      <div className="relative z-10 w-full max-w-lg mx-auto py-8 animate-slide-up">
        {/* ── Header ── */}
        <div className="text-center mb-8">
          <p className="text-xs sm:text-sm font-semibold mb-2" style={{ color: '#F98F1D', letterSpacing: '2px', textTransform: 'uppercase' }}>
            SENFA 2026
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: '#201C46' }}>Submit Full Paper</h1>
          <p className="text-gray-500 text-sm">Gunakan form ini untuk menyusulkan Full Paper bagi Anda yang sebelumnya hanya mengirimkan Abstrak.</p>
        </div>

        {/* ── Form Card ── */}
        <div className="card-glass p-5 sm:p-8">
          {error && (
            <div className="mb-5 p-4 rounded-xl flex items-start gap-3 text-sm"
              style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
              <span className="text-base flex-shrink-0">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#334155' }}>
                Registration ID <span style={{ color: '#F98F1D' }}>*</span>
              </label>
              <input className="form-input" type="text" required
                placeholder="Misal: SEM-2026-0001"
                value={regId}
                onChange={(e) => setRegId(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">ID ini dapat Anda lihat pada email konfirmasi pendaftaran sebelumnya.</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#334155' }}>
                Upload Full Paper (PDF Maks. 20MB) <span style={{ color: '#F98F1D' }}>*</span>
              </label>
              <div
                onClick={() => paperRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOverPaper(true); }}
                onDragLeave={() => setDragOverPaper(false)}
                onDrop={(e) => {
                  e.preventDefault(); setDragOverPaper(false);
                  processFileGeneric(e.dataTransfer.files[0], setPaperFile, ['pdf'], 20);
                }}
                className="relative rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all"
                style={{ borderColor: dragOverPaper ? '#F98F1D' : paperFile.name ? 'rgba(249,143,29,0.5)' : '#cbd5e1', background: dragOverPaper ? 'rgba(249,143,29,0.06)' : paperFile.name ? 'rgba(249,143,29,0.04)' : '#f8fafc' }}
              >
                <input ref={paperRef} type="file" accept=".pdf" className="hidden" onChange={(e) => processFileGeneric(e.target.files[0], setPaperFile, ['pdf'], 20)} />
                {paperFile.name ? (
                  <><div className="text-3xl mb-2">📄</div><p className="font-semibold text-sm" style={{ color: '#F98F1D' }}>{paperFile.name}</p><p className="text-gray-400 text-xs mt-1">{paperFile.size} MB</p></>
                ) : (
                  <><div className="text-3xl mb-2 opacity-40">📤</div><p className="text-gray-500 text-sm font-medium">Klik atau drag & drop file Full Paper (PDF)</p></>
                )}
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-orange w-full">
              {loading ? 'Mengunggah...' : 'Submit Full Paper →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
