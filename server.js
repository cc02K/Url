const express = require("express");
const path = require("path");
const axios = require("axios");
const { nanoid } = require("nanoid");
const admin = require("firebase-admin");

// Inisialisasi Firebase
const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const app = express();
app.set("view engine", "ejs");
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));


const RECAPTCHA_SECRET = "6LeRYOIqAAAAABgV6Vo74moyFFxwVs2000x6uohN";

// **1. Halaman Utama**
app.get("/", (req, res) => {
    res.render("index");
});

// **2. Proses Pemendekan URL**
app.post("/shorten", async (req, res) => {
    const { originalUrl } = req.body;
    const shortId = nanoid(6);

    await db.collection("urls").doc(shortId).set({
        originalUrl,
        shortId,
        clicks: 0,
        createdAt: new Date()
    });

    const baseUrl = req.protocol + "://" + req.get("host");
    res.json({ shortUrl: `${baseUrl}/${shortId}` });
});

// **3. Halaman CAPTCHA sebelum Redirect**
app.get("/:shortId", async (req, res) => {
    const { shortId } = req.params;
    const urlRef = db.collection("urls").doc(shortId);
    const doc = await urlRef.get();

    if (!doc.exists) return res.status(404).send("URL tidak ditemukan");

    res.render("captcha", { shortId });
});

// **4. Validasi reCAPTCHA & Redirect ke URL Asli**
app.post("/:shortId/validate", async (req, res) => {
    const { shortId } = req.params;
    const { captcha } = req.body;

    if (!captcha) {
        return res.status(400).json({ error: "CAPTCHA harus diisi!" });
    }

    const verificationURL = `https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA_SECRET}&response=${captcha}`;
    try {
        const response = await axios.post(verificationURL);
        if (!response.data.success) {
            return res.status(400).json({ error: "Verifikasi CAPTCHA gagal!" });
        }

        const urlRef = db.collection("urls").doc(shortId);
        const doc = await urlRef.get();
        if (!doc.exists) return res.status(404).send("URL tidak ditemukan");

        const urlData = doc.data();
        await urlRef.update({ clicks: urlData.clicks + 1 });

        res.json({ originalUrl: urlData.originalUrl });
    } catch (error) {
        res.status(500).json({ error: "Terjadi kesalahan saat verifikasi CAPTCHA" });
    }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server berjalan di port ${PORT}`));