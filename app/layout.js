import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import Navbar from '@/components/Navbar';
import RoamingPetWrapper from '@/components/RoamingPetWrapper';

export const metadata = {
  title: '규칙의나라 (Class Republic)',
  description: '학급 규칙 제정 웹앱 - 클래스 공화국',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        <AuthProvider>
          <Navbar />
          <main>
            {children}
          </main>
          <RoamingPetWrapper />
        </AuthProvider>
      </body>
    </html>
  );
}
