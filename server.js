// 1. Panggil semua library yang udah di-install tadi
const express = require('express');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2');
const cors = require('cors');
require('dotenv').config(); // Nyalain dotenv biar bisa baca file .env

// 2. Bikin wujud aplikasi express-nya
const app = express();

// 3. Pasang 'satpam' CORS dan izin biar backend bisa nerima data format JSON
app.use(cors());
app.use(express.json());

// Ngajarin Multer cara naruh barang ke folder 'uploads'
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/') 
    },
    filename: function (req, file, cb) {
        // Bikin nama file unik biar ga bentrok
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, uniqueSuffix + path.extname(file.originalname))
    }
})

const upload = multer({ storage: storage })

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

// ==========================================
// ENDPOINT 1: REGISTER (DAFTAR AKUN BARU)
// ==========================================
app.post('/register', async (req, res) => {
    // 1. Tangkep data yang dikirim user dari aplikasi (username & password)
    const { username, password } = req.body;

    // 2. Cek dulu, user ada ngirim data kosong ga? Kalo kosong, tolak!
    if (!username || !password) {
        return res.status(400).json({ message: "Username dan Password wajib diisi, kocak!" });
    }

    try {
        // 3. Acak-acak passwordnya pake bcrypt (angka 10 itu tingkat kerumitan acakannya)
        const hashedPassword = await bcrypt.hash(password, 10);

        // 4. Masukin ke database Ubuntu lu
        const query = 'INSERT INTO users (username, password) VALUES (?, ?)';
        db.query(query, [username, hashedPassword], (err, result) => {
            if (err) {
                // Kalo error biasanya karena username udah ada yang pake (Duplicate entry)
                return res.status(500).json({ message: "Gagal daftar, mungkin username udah kepake", error: err.message });
            }
            res.status(201).json({ message: "Sujud Syukur! Akun berhasil didaftarin!" });
        });
    } catch (error) {
        res.status(500).json({ message: "Server ngereog Lerr", error: error.message });
    }
});

// ==========================================
// ENDPOINT 2: LOGIN (MASUK APLIKASI)
// ==========================================
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: "Isi dulu username sama passwordnya Lerr!" });
    }

    // 1. Cari usernamenya di database
    const query = 'SELECT * FROM users WHERE username = ?';
    db.query(query, [username], async (err, results) => {
        if (err) return res.status(500).json({ message: "Database error", error: err.message });

        // 2. Kalo hasil pencariannya kosong, berarti akun ga ada
        if (results.length === 0) {
            return res.status(401).json({ message: "Username kagak kedaftar!" });
        }

        const user = results[0]; // Ambil data user yang ketemu

        // 3. Bandingin password yang diketik sama password acak di database
        const isPasswordMatch = await bcrypt.compare(password, user.password);

        if (!isPasswordMatch) {
            return res.status(401).json({ message: "Password lu salah, plenger!" });
        }

        // 4. Kalo password bener, cetak Gelang Tiket (Token JWT)
        // Tiket ini isinya ID user dan berlaku cuma buat 24 jam
        const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, {
            expiresIn: '24h'
        });

        // 5. Kasih tiketnya ke user
        res.status(200).json({ 
            message: "Login Sukses, Welcome to HomeCloud!", 
            token: token 
        });
    });
});

// ==========================================
// ENDPOINT 3: UPLOAD FILE (JANTUNG HOMECLOUD)
// ==========================================
app.post('/upload', upload.single('fileKu'), (req, res) => {
    // 1. Cek filenya beneran keangkut ga?
    if (!req.file) {
        return res.status(400).json({ message: "Mana filenya plenger? Kosong gini!" });
    }

    // 2. Siapin data buat dimasukin ke tabel 'files' lu yang cakep itu
    // Karena kita belom masang sistem gembok JWT di rute ini, kita tembak angka 1 dulu buat user_id nya. 
    // Nanti di tahap penyempurnaan baru kita ganti pake ID asli dari token.
    const idUser = 1; 
    const namaFile = req.file.originalname; // Masuk ke kolom 'filename'
    const pathFile = req.file.path; // Masuk ke kolom 'filepath' (isinya kek: uploads/17123987.png)

    // 3. Catet di buku database Ubuntu lu pake struktur yang bener
    const query = 'INSERT INTO files (user_id, filename, filepath) VALUES (?, ?, ?)';
    
    db.query(query, [idUser, namaFile, pathFile], (err, result) => {
        if (err) {
            return res.status(500).json({ message: "Gagal nyatet di Database Lerr", error: err.message });
        }
        
        res.status(200).json({
            message: "Sujud Syukur Abangku! File berhasil mendarat dengan aman!",
            data_tersimpan: {
                user_id: idUser,
                filename: namaFile,
                filepath: pathFile
            }
        });
    });
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