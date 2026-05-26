import './globals.css';

export const metadata = {
  title: 'Pendaftaran SENFA 2026',
  description: 'Formulir Pendaftaran Seminar Nasional Fisika dan Aplikasinya 2026',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
