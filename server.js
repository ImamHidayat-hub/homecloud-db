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
// FUNGSI SATPAM: CEK TIKET JWT (MIDDLEWARE)
// ==========================================
const satpamTiket = (req, res, next) => {
    // 1. Tangkep tiket dari header request
    const tiket = req.headers['authorization'];
    
    // 2. Kalo kosong, usir!
    if (!tiket) {
        return res.status(403).json({ message: "Mana tiket lu Lerr? Login dulu sana!" });
    }

    // 3. Biasanya formatnya "Bearer tokenPanjangBanget", kita potong ambil tokennya doang
    const tokenAsli = tiket.split(' ')[1];

    // 4. Cek keaslian tiket pake rahasia dari .env
    jwt.verify(tokenAsli, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: "Tiket lu palsu atau udah kadaluarsa, plenger!" });
        }
        
        // 5. Kalo tiket asli, simpen ID user-nya buat dipake di endpoint selanjutnya
        req.user = decoded; 
        next(); // Silakan lewat!
    });
};

// ==========================================
// ENDPOINT 3: UPLOAD FILE (JANTUNG HOMECLOUD)
// ==========================================
app.post('/upload', satpamTiket, upload.single('fileKu'), (req, res) => {
    // 1. Cek filenya beneran keangkut ga?
    if (!req.file) {
        return res.status(400).json({ message: "Mana filenya plenger? Kosong gini!" });
    }

    // 2. Siapin data buat dimasukin ke tabel 'files' lu yang cakep itu
    // Karena kita belom masang sistem gembok JWT di rute ini, kita tembak angka 1 dulu buat user_id nya. 
    // Nanti di tahap penyempurnaan baru kita ganti pake ID asli dari token.
    const idUser = req.user.id; 
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

// ==========================================
// ENDPOINT 4: NAMPILIN DAFTAR FILE MILIK USER
// ==========================================
app.get('/files', satpamTiket, (req, res) => {
    // Ambil ID user dari tiket JWT yang udah dicek sama satpam
    const idUser = req.user.id; 

    // Cari file di database yang user_id-nya sama kayak idUser
    const query = 'SELECT id, filename, filepath, uploaded_at FROM files WHERE user_id = ?';
    
    db.query(query, [idUser], (err, results) => {
        if (err) {
            return res.status(500).json({ message: "Database ngereog Lerr", error: err.message });
        }
        
        res.status(200).json({
            message: "Ini daftar harta karun lu:",
            total_file: results.length,
            data: results
        });
    });
});

// ==========================================
// ENDPOINT 5: DOWNLOAD FILE FISIK
// ==========================================
// ':id' itu ibarat parameter dinamis. Misal user mau download file nomor 3, URL-nya jadi /download/3
app.get('/download/:id', satpamTiket, (req, res) => {
    const idFile = req.params.id; // Ngambil angka dari URL
    const idUser = req.user.id;   // Ngambil ID user yang lagi login

    // 1. Cek dulu, file nomor segitu beneran ada ga? Dan beneran punya dia ga?
    const query = 'SELECT filename, filepath FROM files WHERE id = ? AND user_id = ?';
    
    db.query(query, [idFile, idUser], (err, results) => {
        if (err) return res.status(500).json({ message: "Database ngereog", error: err.message });
        
        // Kalo file ga ketemu atau dia nyoba nyolong file orang lain
        if (results.length === 0) {
            return res.status(404).json({ message: "File kagak ketemu atau lu nyoba nyolong file orang yak?!" });
        }

        const file = results[0];
        
        // 2. Rangkai alamat lengkap lokasi file fisiknya di dalem laptop Mukti
        const lokasiFileLengkap = path.join(__dirname, file.filepath);

        // 3. Paksa browser buat nge-download file tersebut
        res.download(lokasiFileLengkap, file.filename, (err) => {
            if (err) {
                res.status(500).json({ message: "Gagal ngirim file fisiknya ke lu Lerr", error: err.message });
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