# Plan: Rapikan area error (.field-error) agar tidak menggeser layout secara liar

## Information Gathered

- CSS sudah punya `.field-error { min-height: 18px; color; font-size; }` sehingga ruang minimum ada, tapi layout shift masih mungkin terjadi saat error dikosongkan/diisi karena:
  - nilai min-height saja tidak menjamin tinggi efektif konsisten saat font/line-height berubah
  - default `margin` (jika ada di markup browser) dapat memicu loncat
  - saat error kosong, node masih dapat mempengaruhi line box berbeda tergantung state.
- JS (`js/script.js`) mengisi/mereset error dengan `errorNode.textContent = message` dan `errorNode.textContent = ""`, jadi kondisi “tidak ada error” memang membuat elemen menjadi kosong.

## Plan

### File: css/styles.css

1. Jadikan `.field-error` sebagai blok yang stabil:
   - set `display: block;`
   - set `height` (atau `min-height` + `line-height`) agar tinggi konsisten
   - set `margin: 0; padding: 0;`
2. Hindari shift saat elemen kosong:
   - gunakan `.field-error:empty { visibility: hidden; opacity: 0; }`
   - `.field-error { visibility: visible; opacity: 1; }` default
3. Batasi agar teks error tidak membuat area melebar:
   - set `line-height` dan `max-height` agar 1 baris konsisten (sesuaikan dengan ukuran font 0.85rem)

## Dependent Files to be edited

- `css/styles.css` saja.

## Followup steps

- Buka halaman yang punya form validasi (reservasi/pembayaran/kontak/aktivitas bila ada) lalu coba input kosong -> pastikan area error tidak membuat elemen di bawah ikut “loncat”.

<ask_followup_question>
Konfirmasi: boleh update `.field-error` dengan pendekatan CSS stabil (height + :empty {visibility:hidden}) sehingga saat teks kosong layout tetap menyisakan ruang yang konsisten.
</ask_followup_question>
