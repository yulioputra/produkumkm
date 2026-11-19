# 🍲 Katalog Kuliner & Jajanan UMKM Nusantara

Website katalog kuliner interaktif buatan UMKM lokal (HTML, CSS, JavaScript). **Tanpa server, tanpa instalasi**: cukup buka `index.html`.

## ▶️ Cara Menjalankan
Pilih salah satu:
1. **Klik dua kali `index.html`** (paling mudah).
2. **Lewat XAMPP:** taruh folder ini di `C:\xampp\htdocs\`, nyalakan Apache, lalu buka `http://localhost/kuliner-umkm/`.
3. **Lewat VS Code:** pasang ekstensi *Live Server*, klik kanan `index.html`, pilih *Open with Live Server*.

Login admin: `yulio` / `admin123`. Member: daftar bebas lewat tombol **Login / Daftar**.

## 🚀 Fitur
* Stok berkurang otomatis setelah pesanan dibuat; keranjang kembali ke 0.
* **Checkout lengkap**: nama, HP, alamat, catatan, lalu pilih metode pembayaran (BCA VA, BRI VA, QRIS, COD). Pembayaran hanya **simulasi**, tidak ada uang sungguhan.
* Setelah selesai, teks pesanan lengkap dikirim ke WhatsApp penjual.
* **Riwayat Pesanan** (menu navbar).
* **Riwayat Stok** (khusus admin): siapa mengubah stok, sebelum → sesudah, dan alasannya.
* Admin bisa mengedit stok langsung di tabel.

* **Menu Favorit** bergeser otomatis searah; berhenti dan zoom saat disorot mouse; bisa digeser dengan jari/mouse.
* **Pencarian & kategori** di atas tabel katalog.
* **Detail jajanan**: klik foto/nama menu untuk melihat komposisi bahan.
* **Keranjang**: centang produk sebelum checkout; jumlah tidak boleh 0/kosong.
* **Member**: riwayat pesanan tersimpan permanen. Non-member: riwayat terhapus dalam 24 jam.

## ⚠️ Catatan
Data (stok, pesanan, riwayat) disimpan di **browser** lewat `localStorage`, tanpa server. Artinya:
* Data hanya terlihat di browser dan perangkat yang sama.
* Untuk mengembalikan data awal: tekan `F12` → tab *Application* → *Local Storage* → klik kanan → *Clear*, lalu refresh.
* Password admin ada di `script.js`, jadi cocok untuk demo/tugas, bukan toko sungguhan.

## 📁 Struktur Berkas
```text
kuliner-umkm/
├── index.html
├── style.css
├── script.js
├── README.md
└── images/      # foto menu
```

## 🐙 Upload ke GitHub
Semua isi folder ini boleh di-upload (tidak ada data pribadi di dalamnya). Pastikan folder `images/` ikut. Agar bisa dibuka lewat link, aktifkan **GitHub Pages**: repo → *Settings* → *Pages* → *Deploy from a branch* → branch `main`, folder `/ (root)` → *Save*.
