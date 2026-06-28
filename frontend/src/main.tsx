import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { notification } from 'antd'
import './index.css'
import App from './App.tsx'

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
