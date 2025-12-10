const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static('uploads'));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Create HTTP Server & Socket.io
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Allow all origins for dev
        methods: ["GET", "POST"]
    }
});

// --- SIGNALING SERVER LOGIC ---
const peers = {}; // tracking peers in rooms

io.on('connection', (socket) => {
    console.log('User Connected:', socket.id);

    // Join a Meeting Room (based on Batch ID)
    socket.on('join-room', (roomId, userId) => {
        socket.join(roomId);
        console.log(`User ${userId} joined room ${roomId}`);

        // Notify others in room
        socket.to(roomId).emit('user-connected', userId);

        socket.on('disconnect', () => {
            console.log(`User ${userId} disconnected`);
            socket.to(roomId).emit('user-disconnected', userId);
        });
    });

    // Forward WebRTC Signals (Offer, Answer, ICE Candidate)
    socket.on('signal', (data) => {
        // data: { target: 'socket/user id', signal: ... }
        // Broadcast to the room (or specific target if we had mapping)
        // For simple 1-on-1, broadcast to room mostly works or use room
        const { roomId, signal } = data;
        socket.to(roomId).emit('signal', { sender: socket.id, signal });
    });
});

const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');

// ... (previous imports)

// Initialize Database
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) console.error("Database Error:", err);
    else console.log("Connected to SQLite Database");
});

// Create Tables
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS batches (id TEXT PRIMARY KEY, data TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS students (id TEXT PRIMARY KEY, batchId TEXT, data TEXT)"); // Data contains full JSON
    db.run("CREATE TABLE IF NOT EXISTS qps (id TEXT PRIMARY KEY, sscId TEXT, data TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS nos (id TEXT PRIMARY KEY, qpId TEXT, data TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS pcs (id TEXT PRIMARY KEY, nosId TEXT, data TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS responses (id TEXT PRIMARY KEY, studentId TEXT, data TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS ssc (id TEXT PRIMARY KEY, data TEXT)");
});

// --- API ROUTES ---

// Helper for simple CRUD
function createCRUDEndpoints(tableName, routeName) {
    // GET ALL
    app.get(`/api/${routeName}`, (req, res) => {
        db.all(`SELECT data FROM ${tableName}`, [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            const items = rows.map(r => JSON.parse(r.data));
            res.json(items);
        });
    });

    // POST (Create/Update)
    app.post(`/api/${routeName}`, (req, res) => {
        const item = req.body;
        const id = item.id;
        const dataStr = JSON.stringify(item);

        // Simple Upsert logic
        db.run(`INSERT OR REPLACE INTO ${tableName} (id, data) VALUES (?, ?)`, [id, dataStr], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: id });
        });
    });

    // DELETE
    app.delete(`/api/${routeName}/:id`, (req, res) => {
        db.run(`DELETE FROM ${tableName} WHERE id = ?`, [req.params.id], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    });

    // SYNC (Replace All)
    app.post(`/api/sync/${routeName}`, (req, res) => {
        const items = req.body;
        if (!Array.isArray(items)) return res.status(400).json({ error: "Expected array" });

        db.serialize(() => {
            db.run(`DELETE FROM ${tableName}`);
            const stmt = db.prepare(`INSERT INTO ${tableName} (id, data) VALUES (?, ?)`);
            items.forEach(item => {
                stmt.run(item.id, JSON.stringify(item));
            });
            stmt.finalize();
            res.json({ success: true, count: items.length });
        });
    });
}

// Special Handling for Foreign Keys if needed, but for now storing full JSON in 'data' column is easiest for migration
// We might need separate columns for filtering (like batchId), but client does filtering mostly.
// Actually, 'students' needs filtering by batchId server-side for performance later, but for now client-side filtering is OK for small scale.

createCRUDEndpoints('batches', 'batches');
createCRUDEndpoints('students', 'students');
createCRUDEndpoints('qps', 'qps');
createCRUDEndpoints('nos', 'nos');
createCRUDEndpoints('pcs', 'pcs');
createCRUDEndpoints('responses', 'responses');
createCRUDEndpoints('ssc', 'ssc');

app.get('/', (req, res) => {
    res.send('Exam System API & Signaling Server Running');
});

// Use httpServer.listen instead of app.listen
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
