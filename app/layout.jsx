import "./globals.css";
import AppShell from "../components/AppShell";

export const metadata = {
  title: "S.I.G.A. FIUNA — Preview",
  description: "Preview minimalista (pro) de SIGA FIUNA",
};

// Permite zoom/pinch en móvil (útil para el Ábaco y tablas).
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
