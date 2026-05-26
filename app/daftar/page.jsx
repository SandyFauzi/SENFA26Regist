'use client';

import { useState, useRef, useCallback } from 'react';
import ParticleBackground from '../components/StarBackground';

const APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || '';

const SUBTEMA_OPTIONS = [
  'Fisika Teori dan Komputasi',
  'Fisika Material dan Nanoteknologi',
  'Fisika Medis dan Biofisika',
  'Geofisika dan Fisika Lingkungan',
  'Instrumentasi dan Elektronika',
  'Energi Terbarukan',
  'Optika dan Fotonika',
  'Fisika Terapan Lainnya',
];

const KATEGORI_SEMINAR = [
  { value: 'mahasiswa_pemakalah', label: 'Mahasiswa Pemakalah — Rp 200.000 (Early Bird) / Rp 250.000' },
  { value: 'dosen_peneliti', label: 'Dosen / Peneliti — Rp 350.000' },
  { value: 'umum', label: 'Umum — Rp 400.000' },
];

const KATEGORI_ONLINE = [
  { value: 'online_mahasiswa_pemakalah', label: 'Mahasiswa (S1/S2/S3) Pemakalah - Rp 250.000' },
  { value: 'online_dosen_pemakalah', label: 'Dosen/Peneliti/Umum Pemakalah - Rp 450.000' },
  { value: 'online_mahasiswa_non', label: 'Mahasiswa (S1/S2/S3) Non-Pemakalah - Rp 50.000' },
  { value: 'online_dosen_non', label: 'Dosen/Peneliti/Umum Non-Pemakalah - Rp 100.000' },
];

const KATEGORI_OFFLINE = [
  { value: 'offline_mahasiswa_pemakalah', label: 'Mahasiswa (S1/S2/S3) Pemakalah - Rp 350.000' },
  { value: 'offline_dosen_pemakalah', label: 'Dosen/Peneliti/Umum Pemakalah - Rp 650.000' },
  { value: 'offline_mahasiswa_non', label: 'Mahasiswa (S1/S2/S3) Non-Pemakalah - Rp 150.000' },
  { value: 'offline_dosen_non', label: 'Dosen/Peneliti/Umum Non-Pemakalah - Rp 300.000' },
];

export default function DaftarPage() {
  const [activeTab, setActiveTab] = useState('seminar');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  // LKTII File State
  const [dragOverLktii, setDragOverLktii] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fileBase64, setFileBase64] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const fileRef = useRef(null);

  // Seminar File States
  const [dragOverPaper, setDragOverPaper] = useState(false);
  const [paperFile, setPaperFile] = useState({ name: '', base64: '', size: 0 });
  const paperRef = useRef(null);

  const [seminarForm, setSeminarForm] = useState({
    nama: '', email: '', whatsapp: '', instansi: '', pekerjaan: '',
    tipePeserta: '', kategoriKehadiran: '', kategoriHarga: '',
    bidangMinat: '', judulMakalah: '', abstrakMakalah: '', tipeUpload: '',
    namaRekening: '', bersediaPublish: false, konfirmasi: false
  });

  const [lktiiForm, setLktiiForm] = useState({
    namaTim: '', ketuaTim: '', emailKetua: '', whatsappKetua: '',
    instansi: '', anggota1: '', anggota2: '', judulKarya: '', subtema: '',
  });

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

  const handleLktiiDrop = (e) => {
    e.preventDefault(); setDragOverLktii(false);
    processFileGeneric(e.dataTransfer.files[0], (data) => {
      setFileName(data.name); setFileSize(data.size); setFileBase64(data.base64);
    }, ['pdf'], 20);
  };
  const handleLktiiFileChange = (e) => {
    processFileGeneric(e.target.files[0], (data) => {
      setFileName(data.name); setFileSize(data.size); setFileBase64(data.base64);
    }, ['pdf'], 20);
  };

  const handleSeminarSubmit = async (e) => {
    e.preventDefault();
    if (!seminarForm.konfirmasi) {
      setError('Anda harus menyetujui konfirmasi keikutsertaan.');
      return;
    }
    if (seminarForm.tipePeserta === 'Pemakalah' && !paperFile.base64) {
      setError('Upload abstrak / full paper wajib bagi pemakalah.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          type: 'seminar', ...seminarForm,
          paperFileName: paperFile.name, paperBase64: paperFile.base64
        }),
        redirect: 'follow',
      });
      const data = await res.json();
      if (data.success) setSuccess(data);
      else setError(data.message || 'Terjadi kesalahan. Coba lagi.');
    } catch {
      setError('Gagal terhubung ke server. Periksa koneksi internet kamu.');
    }
    setLoading(false);
  };

  const handleLktiiSubmit = async (e) => {
    e.preventDefault();
    if (!fileBase64) {
      setError('Upload file karya terlebih dahulu');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ type: 'lktii', ...lktiiForm, fileBase64, fileName }),
        redirect: 'follow',
      });
      const data = await res.json();
      if (data.success) setSuccess(data);
      else setError(data.message || 'Terjadi kesalahan. Coba lagi.');
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
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="#44CBA8">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: '#201C46' }}>Pendaftaran Berhasil!</h2>
          <p className="text-gray-500 text-sm mb-8">{success.message}</p>

          <div className="card-glass p-5 sm:p-6 mb-6">
            <p className="text-gray-400 text-xs uppercase tracking-widest mb-3">Registration ID Kamu</p>
            <p className="text-2xl sm:text-3xl font-black tracking-wider" style={{ color: '#F98F1D', fontFamily: 'Montserrat, sans-serif' }}>
              {success.registrationId}
            </p>
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid #e2e8f0' }}>
              <div className="flex items-start gap-2">
                <span className="text-lg mt-0.5">📧</span>
                <p className="text-gray-500 text-xs text-left leading-relaxed">
                  Invoice dan instruksi pembayaran QRIS sudah dikirim ke email kamu. Segera lakukan pembayaran dan konfirmasi ke Bendahara.
                </p>
              </div>
            </div>
          </div>

          <div className="card-glass p-4 mb-6 text-left">
            <p className="text-gray-400 text-xs uppercase tracking-widest mb-3">Langkah Selanjutnya</p>
            {[
              'Cek email untuk invoice & instruksi pembayaran',
              'Scan QRIS yang ada di email untuk membayar',
              'Kirim bukti bayar ke WA Bendahara via tombol di email',
              'Jika memilih Hanya Abstrak, cek link submit full paper di email',
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3 mb-2 last:mb-0">
                <span className="flex-shrink-0 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center mt-0.5"
                  style={{ background: 'rgba(249,143,29,0.1)', color: '#F98F1D', border: '1px solid rgba(249,143,29,0.2)' }}>
                  {i + 1}
                </span>
                <p className="text-gray-600 text-sm">{step}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => { setSuccess(null); setError(null); setFileBase64(''); setFileName(''); }}
            className="text-gray-400 hover:text-gray-600 text-sm transition-colors underline underline-offset-4"
          >
            ← Kembali ke formulir
          </button>
        </div>
      </div>
    );
  }

  // ─── Main Form ───
  return (
    <div className="min-h-screen relative" style={{ background: '#ffffff' }}>
      <ParticleBackground />

      <div className="relative z-10 w-full max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10 pb-16">

        {/* ── Header ── */}
        <div className="text-center mb-8 sm:mb-10 animate-slide-up">
          {/* Logos row */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <img
              src="http://hifi.fmipa.unpad.ac.id/wp-content/uploads/2026/05/Logo-Fisika-Background-Putih.png"
              alt="Logo Fisika" className="h-10 sm:h-12 w-auto object-contain"
            />
            <img
              src="http://hifi.fmipa.unpad.ac.id/wp-content/uploads/2023/07/cropped-hifi.png"
              alt="Logo HiFi" className="h-10 sm:h-12 w-auto object-contain"
            />
          </div>

          {/* SENFA Title Image */}
          <img
            src="http://hifi.fmipa.unpad.ac.id/wp-content/uploads/2026/05/Senfa-2026-Title-scaled.png"
            alt="SENFA 2026"
            className="mx-auto mb-3"
            style={{ maxWidth: '340px', width: '85%', height: 'auto' }}
          />

          <p className="text-xs sm:text-sm font-semibold" style={{ color: '#201C46', letterSpacing: '2px', textTransform: 'uppercase' }}>
            Seminar Nasional Fisika dan Aplikasinya
          </p>
          <p className="text-gray-400 text-xs mt-1">Formulir Pendaftaran Resmi</p>

          {/* Decorative line */}
          <div className="flex items-center gap-3 mt-4 max-w-xs mx-auto">
            <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, transparent, rgba(249,143,29,0.5))' }} />
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#F98F1D' }} />
            <div className="h-px flex-1" style={{ background: 'linear-gradient(to left, transparent, rgba(249,143,29,0.5))' }} />
          </div>
        </div>

        {/* ── Tab Switcher ── */}
        <div className="card-glass p-1.5 mb-5 sm:mb-6 flex animate-slide-up stagger-1">
          {[
            { key: 'seminar', label: 'Seminar', icon: '🎓' },
            { key: 'lktii', label: 'LKTII', icon: '📝' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setError(null); }}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === tab.key ? 'tab-active' : 'tab-inactive'}`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ── Form Card ── */}
        <div className="card-glass p-5 sm:p-6 md:p-8 animate-slide-up stagger-2">

          {/* Error banner */}
          {error && (
            <div className="mb-5 p-4 rounded-xl flex items-start gap-3 text-sm"
              style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
              <span className="text-base flex-shrink-0">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* ─── SEMINAR FORM ─── */}
          {activeTab === 'seminar' && (
            <form onSubmit={handleSeminarSubmit} className="space-y-5">
              <FormSection label="Data Diri Peserta" />

              <Field label="Nama Lengkap" required>
                <input className="form-input" type="text" required
                  placeholder="Nama lengkap sesuai KTP / KTM"
                  value={seminarForm.nama}
                  onChange={(e) => setSeminarForm({ ...seminarForm, nama: e.target.value })}
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <Field label="Email Aktif" required>
                  <input className="form-input" type="email" required
                    placeholder="email@contoh.com"
                    value={seminarForm.email}
                    onChange={(e) => setSeminarForm({ ...seminarForm, email: e.target.value })}
                  />
                </Field>
                <Field label="Nomor WhatsApp" required>
                  <input className="form-input" type="tel" required
                    placeholder="08xxxxxxxxxx"
                    value={seminarForm.whatsapp}
                    onChange={(e) => setSeminarForm({ ...seminarForm, whatsapp: e.target.value })}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <Field label="Asal Instansi" required>
                  <input className="form-input" type="text" required
                    placeholder="Universitas / Sekolah / Instansi"
                    value={seminarForm.instansi}
                    onChange={(e) => setSeminarForm({ ...seminarForm, instansi: e.target.value })}
                  />
                </Field>
                <Field label="Pekerjaan / Status" required>
                  <input className="form-input" type="text" required
                    placeholder="Mahasiswa / Dosen / Peneliti / Umum"
                    value={seminarForm.pekerjaan}
                    onChange={(e) => setSeminarForm({ ...seminarForm, pekerjaan: e.target.value })}
                  />
                </Field>
              </div>

              <FormSection label="Kategori Keikutsertaan" />

              <Field label="Kategori Peserta" required>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="tipePeserta" value="Pemakalah" required
                      checked={seminarForm.tipePeserta === 'Pemakalah'}
                      onChange={(e) => setSeminarForm({ ...seminarForm, tipePeserta: e.target.value, kategoriKehadiran: '', kategoriHarga: '' })}
                      className="accent-orange-500" />
                    <span className="text-sm">Pemakalah</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="tipePeserta" value="Non-Pemakalah" required
                      checked={seminarForm.tipePeserta === 'Non-Pemakalah'}
                      onChange={(e) => setSeminarForm({ ...seminarForm, tipePeserta: e.target.value, kategoriKehadiran: '', kategoriHarga: '', bidangMinat: '', judulMakalah: '', abstrakMakalah: '' })}
                      className="accent-orange-500" />
                    <span className="text-sm">Non-Pemakalah</span>
                  </label>
                </div>
              </Field>

              <Field label="Kehadiran" required>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="kategoriKehadiran" value="Online" required
                      checked={seminarForm.kategoriKehadiran === 'Online'}
                      onChange={(e) => setSeminarForm({ ...seminarForm, kategoriKehadiran: e.target.value, kategoriHarga: '' })}
                      className="accent-orange-500" />
                    <span className="text-sm">Online</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="kategoriKehadiran" value="Offline" required
                      checked={seminarForm.kategoriKehadiran === 'Offline'}
                      onChange={(e) => setSeminarForm({ ...seminarForm, kategoriKehadiran: e.target.value, kategoriHarga: '' })}
                      className="accent-orange-500" />
                    <span className="text-sm">Offline</span>
                  </label>
                </div>
              </Field>

              {seminarForm.kategoriKehadiran === 'Online' && (
                <Field label="Kategori Peserta Online" required>
                  <select className="form-select" required
                    value={seminarForm.kategoriHarga}
                    onChange={(e) => setSeminarForm({ ...seminarForm, kategoriHarga: e.target.value })}
                  >
                    <option value="" disabled>Pilih kategori...</option>
                    {KATEGORI_ONLINE.filter(k => k.label.includes(seminarForm.tipePeserta)).map((k) => (
                      <option key={k.value} value={k.label}>{k.label}</option>
                    ))}
                  </select>
                </Field>
              )}

              {seminarForm.kategoriKehadiran === 'Offline' && (
                <Field label="Kategori Peserta Offline" required>
                  <select className="form-select" required
                    value={seminarForm.kategoriHarga}
                    onChange={(e) => setSeminarForm({ ...seminarForm, kategoriHarga: e.target.value })}
                  >
                    <option value="" disabled>Pilih kategori...</option>
                    {KATEGORI_OFFLINE.filter(k => k.label.includes(seminarForm.tipePeserta)).map((k) => (
                      <option key={k.value} value={k.label}>{k.label}</option>
                    ))}
                  </select>
                </Field>
              )}

              {seminarForm.tipePeserta === 'Pemakalah' && (
                <div className="space-y-5 animate-slide-up mt-4 p-5 rounded-xl" style={{background: 'rgba(32,28,70,0.02)', border: '1px solid rgba(32,28,70,0.05)'}}>
                  <Field label="Bidang Minat / Fokus Penulisan" required>
                    <select className="form-select" required
                      value={seminarForm.bidangMinat}
                      onChange={(e) => setSeminarForm({ ...seminarForm, bidangMinat: e.target.value })}
                    >
                      <option value="" disabled>Pilih subtema...</option>
                      {SUBTEMA_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="Judul Makalah" required>
                    <input className="form-input" type="text" required
                      placeholder="Judul makalah anda"
                      value={seminarForm.judulMakalah}
                      onChange={(e) => setSeminarForm({ ...seminarForm, judulMakalah: e.target.value })}
                    />
                  </Field>
                  <Field label="Abstrak Makalah" required>
                    <textarea className="form-input min-h-[100px] resize-y" required
                      placeholder="Tuliskan abstrak makalah anda di sini..."
                      value={seminarForm.abstrakMakalah}
                      onChange={(e) => setSeminarForm({ ...seminarForm, abstrakMakalah: e.target.value })}
                    />
                  </Field>
                  
                  <Field label="Tipe Upload" required>
                    <div className="flex gap-4 mb-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="tipeUpload" value="Hanya Abstrak" required
                          checked={seminarForm.tipeUpload === 'Hanya Abstrak'}
                          onChange={(e) => setSeminarForm({ ...seminarForm, tipeUpload: e.target.value })}
                          className="accent-orange-500" />
                        <span className="text-sm">Hanya Abstrak</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="tipeUpload" value="Abstrak & Full Paper" required
                          checked={seminarForm.tipeUpload === 'Abstrak & Full Paper'}
                          onChange={(e) => setSeminarForm({ ...seminarForm, tipeUpload: e.target.value })}
                          className="accent-orange-500" />
                        <span className="text-sm">Abstrak & Full Paper</span>
                      </label>
                    </div>
                  </Field>

                  <Field label={`Upload ${seminarForm.tipeUpload || 'Abstrak / Full Paper'} (PDF Maks. 20MB)`} required>
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
                        <><div className="text-3xl mb-2 opacity-40">📤</div><p className="text-gray-500 text-sm font-medium">Klik atau drag & drop file PDF</p></>
                      )}
                    </div>
                  </Field>

                  <label className="flex items-start gap-3 mt-4 cursor-pointer">
                    <input type="checkbox" className="mt-1 w-4 h-4 accent-orange-500" 
                      checked={seminarForm.bersediaPublish}
                      onChange={(e) => setSeminarForm({...seminarForm, bersediaPublish: e.target.checked})}
                    />
                    <span className="text-sm text-gray-600">Saya bersedia makalah ini dipublikasikan dalam prosiding (opsional)</span>
                  </label>
                </div>
              )}



              <FormSection label="Konfirmasi & Penutup" />

              <Field label="Konfirmasi Keikutsertaan" required>
                <label className="flex items-start gap-3 mt-2 cursor-pointer bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <input type="checkbox" className="mt-1 w-4 h-4 accent-orange-500 flex-shrink-0" required
                    checked={seminarForm.konfirmasi}
                    onChange={(e) => setSeminarForm({...seminarForm, konfirmasi: e.target.checked})}
                  />
                  <span className="text-sm text-gray-600 leading-relaxed">
                    Saya menyatakan bahwa data yang diisikan sudah benar, dan saya bersedia mengikuti rangkaian kegiatan dengan mematuhi segala peraturan yang berlaku.
                  </span>
                </label>
              </Field>

              <Field label="Link Grup WA Peserta">
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 flex items-start gap-3">
                  <span className="text-lg">💬</span>
                  <div>
                    <p className="text-sm text-orange-900 font-medium mb-1">Silakan bergabung ke grup WhatsApp berikut:</p>
                    <a href="https://chat.whatsapp.com/example" target="_blank" rel="noopener noreferrer" className="text-sm text-orange-600 font-bold hover:underline">
                      🔗 Link Grup WA Peserta SENFA 2026
                    </a>
                  </div>
                </div>
              </Field>

              <InfoBox>
                Setelah submit, data akan diverifikasi oleh panitia (maks. 1×24 jam). Info lebih lanjut akan dikirim ke email kamu.
              </InfoBox>

              <SubmitButton loading={loading}>Daftar Seminar Sekarang →</SubmitButton>
            </form>
          )}

          {/* ─── LKTII FORM ─── */}
          {activeTab === 'lktii' && (
            <form onSubmit={handleLktiiSubmit} className="space-y-5">
              <FormSection label="Data Tim" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <Field label="Nama Tim" required>
                  <input className="form-input" type="text" required placeholder="Nama tim kalian"
                    value={lktiiForm.namaTim}
                    onChange={(e) => setLktiiForm({ ...lktiiForm, namaTim: e.target.value })}
                  />
                </Field>
                <Field label="Instansi / Asal" required>
                  <input className="form-input" type="text" required placeholder="Universitas / Sekolah"
                    value={lktiiForm.instansi}
                    onChange={(e) => setLktiiForm({ ...lktiiForm, instansi: e.target.value })}
                  />
                </Field>
              </div>

              <FormSection label="Data Ketua Tim" />

              <Field label="Nama Ketua" required>
                <input className="form-input" type="text" required placeholder="Nama lengkap ketua tim"
                  value={lktiiForm.ketuaTim}
                  onChange={(e) => setLktiiForm({ ...lktiiForm, ketuaTim: e.target.value })}
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <Field label="Email Ketua" required>
                  <input className="form-input" type="email" required placeholder="email@contoh.com"
                    value={lktiiForm.emailKetua}
                    onChange={(e) => setLktiiForm({ ...lktiiForm, emailKetua: e.target.value })}
                  />
                </Field>
                <Field label="WhatsApp Ketua" required>
                  <input className="form-input" type="tel" required placeholder="08xxxxxxxxxx"
                    value={lktiiForm.whatsappKetua}
                    onChange={(e) => setLktiiForm({ ...lktiiForm, whatsappKetua: e.target.value })}
                  />
                </Field>
              </div>

              <FormSection label="Anggota Tim" sublabel="opsional · maks. 2 orang" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <Field label="Anggota 1">
                  <input className="form-input" type="text" placeholder="Nama lengkap anggota 1"
                    value={lktiiForm.anggota1}
                    onChange={(e) => setLktiiForm({ ...lktiiForm, anggota1: e.target.value })}
                  />
                </Field>
                <Field label="Anggota 2">
                  <input className="form-input" type="text" placeholder="Nama lengkap anggota 2"
                    value={lktiiForm.anggota2}
                    onChange={(e) => setLktiiForm({ ...lktiiForm, anggota2: e.target.value })}
                  />
                </Field>
              </div>

              <FormSection label="Data Karya" />

              <Field label="Judul Karya Tulis" required>
                <input className="form-input" type="text" required placeholder="Judul lengkap karya tulis ilmiah"
                  value={lktiiForm.judulKarya}
                  onChange={(e) => setLktiiForm({ ...lktiiForm, judulKarya: e.target.value })}
                />
              </Field>

              <Field label="Subtema" required>
                <select className="form-select" required
                  value={lktiiForm.subtema}
                  onChange={(e) => setLktiiForm({ ...lktiiForm, subtema: e.target.value })}
                >
                  <option value="" disabled>Pilih subtema karya</option>
                  {SUBTEMA_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Field>

              {/* File Upload */}
              <Field label="Upload Karya (PDF · Maks. 20MB)" required>
                <div
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOverLktii(true); }}
                  onDragLeave={() => setDragOverLktii(false)}
                  onDrop={handleLktiiDrop}
                  className="relative rounded-xl border-2 border-dashed p-6 sm:p-8 text-center cursor-pointer transition-all duration-300"
                  style={{
                    borderColor: dragOverLktii ? '#F98F1D' : fileName ? 'rgba(249,143,29,0.5)' : '#cbd5e1',
                    background: dragOverLktii ? 'rgba(249,143,29,0.06)' : fileName ? 'rgba(249,143,29,0.04)' : '#f8fafc',
                  }}
                >
                  <input ref={fileRef} type="file" accept=".pdf" onChange={handleLktiiFileChange} className="hidden" />
                  {fileName ? (
                    <>
                      <div className="text-4xl mb-3">📄</div>
                      <p className="font-semibold text-sm" style={{ color: '#F98F1D' }}>{fileName}</p>
                      <p className="text-gray-400 text-xs mt-1">{fileSize} MB · Klik untuk ganti file</p>
                    </>
                  ) : (
                    <>
                      <div className="text-4xl mb-3 opacity-40">📤</div>
                      <p className="text-gray-500 text-sm font-medium">Klik atau drag & drop file PDF</p>
                      <p className="text-gray-400 text-xs mt-1.5">Format: PDF · Ukuran maksimal 20MB</p>
                    </>
                  )}
                </div>
              </Field>

              <InfoBox>
                Setelah submit, invoice + instruksi pembayaran QRIS akan dikirim ke email ketua tim. Biaya: <strong>Rp 150.000 / artikel</strong>.
              </InfoBox>

              <SubmitButton loading={loading}>Daftar LKTII Sekarang →</SubmitButton>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6 sm:mt-8 space-y-1">
          <p className="text-gray-400 text-xs">© 2026 SENFA · Seminar Nasional Fisika dan Aplikasinya</p>
          <p className="text-gray-300 text-xs">Department of Physics · HIFI FMIPA UNPAD</p>
        </div>
      </div>
    </div>
  );
}

// ─── Reusable Components ───

function FormSection({ label, sublabel }) {
  return (
    <div className="section-divider pt-1">
      <span className="text-gray-400 text-xs font-semibold tracking-widest uppercase flex-shrink-0">
        {label}
        {sublabel && (
          <span className="text-gray-300 normal-case font-normal tracking-normal ml-1">· {sublabel}</span>
        )}
      </span>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2" style={{ color: '#334155' }}>
        {label}
        {required && <span style={{ color: '#F98F1D', marginLeft: 4 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function InfoBox({ children }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl text-sm"
      style={{ background: 'rgba(32,28,70,0.04)', border: '1px solid rgba(32,28,70,0.08)', color: '#64748b' }}
    >
      <span className="flex-shrink-0 text-base mt-0.5" style={{ color: '#201C46' }}>ℹ️</span>
      <p className="leading-relaxed text-xs">{children}</p>
    </div>
  );
}

function SubmitButton({ loading, children }) {
  return (
    <button type="submit" disabled={loading} className="btn-orange mt-2">
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Memproses Pendaftaran...
        </span>
      ) : children}
    </button>
  );
}
