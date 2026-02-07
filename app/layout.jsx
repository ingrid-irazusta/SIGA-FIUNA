import "./globals.css";
import { AuthWrapper } from "@/components/AuthWrapper";

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
        <AuthWrapper>{children}</AuthWrapper>
      </body>
    </html>
  );
}
