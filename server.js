// 1. Panggil semua library yang udah di-install tadi
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
require('dotenv').config(); // Nyalain dotenv biar bisa baca file .env

// 2. Bikin wujud aplikasi express-nya
const app = express();

// 3. Pasang 'satpam' CORS dan izin biar backend bisa nerima data format JSON
app.use(cors());
app.use(express.json()); 

// 4. Bikin jembatan koneksi ke Database Ubuntu
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// 5. Kita tes ngetuk pintu Database, nyambung apa kagak?
db.getConnection((err, connection) => {
    if (err) {
        console.error('Yah Lerr, Koneksi Database Gagal:', err.message);
    } else {
        console.log('SUJUD SYUKUR! Sukses nyambung ke MySQL di Ubuntu!');
        connection.release(); // Balikin koneksi biar ga penuh
    }
});

// 6. Bikin rute API (endpoint) buat ngetes
app.get('/', (req, res) => {
    res.send('Mantap! Mesin Backend HomeCloud udah nyala nih!');
});

// 7. Nyalain server Node.js di pelabuhan (Port) 3000
const PORT = process.env.PORT;
app.listen(PORT, () => {
    console.log(`Server Backend lagi nongkrong di http://localhost:${PORT}`);
});