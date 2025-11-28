// frontend/app/layout.tsx

import './globals.css';
// 💡 IMPORTANT: Add Leaflet CSS here
import 'leaflet/dist/leaflet.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}