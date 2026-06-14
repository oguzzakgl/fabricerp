const XLSX = require('xlsx');

const headersInvalid = [
  ['Cari Kodu', 'Cari Ünvan / Ad Soyad', 'Hesap Tipi', 'Telefon', 'Vergi Dairesi', 'VKN / TC No', 'E-Posta', 'Adres'],
  ['', 'Musteri Bir', 'Müşteri', '0212 555 11 22', 'Merter V.D.', '12345678901', 'bir@musteri.com', 'İstanbul'],
  ['S-TEST-99', 'Tedarikci Iki', 'Tedarikçi', '0216 444 33 22', 'Tuzla V.D.', '9876543210', 'info@tedarikciiki.com', 'Gebze'],
  ['', 'Cari Uc Both', 'İkiside', '', '', '', '', ''],
  ['', '', 'Müşteri', '', '', '', '', ''],
  ['', 'Gecersiz Tip Cari', 'Bilinmeyen Tip', '', '', '', '', ''],
  ['', 'Gecersiz Mail Cari', 'Müşteri', '', '', '', 'gecersizmail.com', '']
];

const headersValid = [
  ['Cari Kodu', 'Cari Ünvan / Ad Soyad', 'Hesap Tipi', 'Telefon', 'Vergi Dairesi', 'VKN / TC No', 'E-Posta', 'Adres'],
  ['', 'Musteri Gecerli Tek', 'Müşteri', '0212 999 88 77', 'Kagithane V.D.', '11111111111', 'tek@musteri.com', 'İstanbul'],
  ['', 'Tedarikci Gecerli Iki', 'Tedarikçi', '0216 888 77 66', 'Pendik V.D.', '22222222222', 'iki@tedarikci.com', 'Kocaeli'],
  ['BOTH-TEST-12', 'Alis Satis Gecerli Uc', 'İkiside', '', '', '', '', '']
];

const wb1 = XLSX.utils.book_new();
const ws1 = XLSX.utils.aoa_to_sheet(headersInvalid);
XLSX.utils.book_append_sheet(wb1, ws1, 'Test Cariler Hatalı');
XLSX.writeFile(wb1, 'test_cari_hesaplar.xlsx');

const wb2 = XLSX.utils.book_new();
const ws2 = XLSX.utils.aoa_to_sheet(headersValid);
XLSX.utils.book_append_sheet(wb2, ws2, 'Test Cariler Geçerli');
XLSX.writeFile(wb2, 'test_cari_hesaplar_valid.xlsx');

console.log('Both test sheets generated successfully.');
