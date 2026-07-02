import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { notification } from 'antd'
import './index.css'
import App from './App.tsx'

const clarityId = import.meta.env.VITE_CLARITY_ID;
if (clarityId) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  win.clarity = win.clarity || function(...args: any[]) {
    (win.clarity.q = win.clarity.q || []).push(args);
  };
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${clarityId}`;
  const firstScript = document.getElementsByTagName('script')[0];
  if (firstScript && firstScript.parentNode) {
    firstScript.parentNode.insertBefore(script, firstScript);
  }
}

// Initialize theme immediately on page load to prevent flash of light mode
const savedTheme = localStorage.getItem('theme') || 'light';
if (savedTheme === 'dark') {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.remove('dark');
}

// Tarayıcı alert kutularını modern sol-alt bildirimlerle değiştir (monkey patching)
window.alert = (message: string) => {
  if (!message) return;
  
  const msgStr = String(message);
  
  // Mesaj içeriğine göre durum belirle (Türkçe ve genel durumlar)
  const isSuccess = /başarılı|başarıyla|eklendi|güncellendi|silindi|onaylandı|kaydedildi|gönderildi/i.test(msgStr);
  const isError = /hata|başarısız|bulunamadı|eksik|geçersiz|yasak|engellendi|refuse|error/i.test(msgStr);
  const isWarning = /dikkat|uyarı|lütfen|zaten/i.test(msgStr);

  const config = {
    message: isSuccess ? 'İşlem Başarılı' : isError ? 'Hata Oluştu' : isWarning ? 'Uyarı' : 'Bilgi',
    description: msgStr,
    placement: 'bottomLeft' as const,
    duration: 4.5,
    style: {
      borderRadius: '12px',
      borderLeft: isSuccess 
        ? '5px solid #10b981' // yeşil
        : isError 
          ? '5px solid #ef4444' // kırmızı
          : isWarning 
            ? '5px solid #f59e0b' // turuncu/sarı
            : '5px solid #3b82f6', // mavi
      backgroundColor: '#ffffff',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    }
  };

  if (isSuccess) {
    notification.success(config);
  } else if (isError) {
    notification.error(config);
  } else if (isWarning) {
    notification.warning(config);
  } else {
    notification.info(config);
  }
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
