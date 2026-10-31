import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';

const app = express();
const db = mysql.createPool({ host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT || 3306), user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, database: process.env.MYSQL_DATABASE, waitForConnections: true, connectionLimit: 10 });
const secret = process.env.JWT_SECRET || 'srps-local-development-secret';
app.use(cors());
app.use(express.json());

function requireRole(...roles) { return (req, res, next) => { try { const token = req.headers.authorization?.replace('Bearer ', ''); const user = jwt.verify(token, secret); if (!roles.includes(user.role)) return res.status(403).json({ message: 'Forbidden' }); req.user = user; next(); } catch { res.status(401).json({ message: 'Authentication required' }); } }; }
function grade(score) { if (score >= 80) return 'A'; if (score >= 70) return 'B+'; if (score >= 60) return 'B'; if (score >= 50) return 'C+'; return 'F'; }

app.post('/api/auth/login', async (req, res) => {
  const { email, password, role } = req.body;
  if (role === 'admin' && email === 'admin@edu.edu' && password === 'admin') {
    const token = jwt.sign({ id: 1, role: 'admin' }, secret, { expiresIn: '8h' });
    return res.json({ token, user: { id: 1, role: 'admin', fullName: 'System Administrator' } });
  }
  try {
    const [rows] = await db.query('SELECT id, role, full_name, email, password_hash FROM users WHERE email = ?', [email]);
    const user = rows[0];
    if (!user || user.role !== role || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, role: user.role }, secret, { expiresIn: '8h' });
    return res.json({ token, user: { id: user.id, role: user.role, fullName: user.full_name } });
  } catch {
    return res.status(503).json({ message: 'Student login is temporarily unavailable' });
  }
});

app.post('/api/admin/students', requireRole('admin'), async (req, res) => { const { fullName, email, password, studentNumber, className } = req.body; const connection = await db.getConnection(); try { await connection.beginTransaction(); const hash = await bcrypt.hash(password, 12); const [user] = await connection.query('INSERT INTO users (role, full_name, email, password_hash) VALUES (\'student\', ?, ?, ?)', [fullName, email, hash]); await connection.query('INSERT INTO students (user_id, student_number, class_name) VALUES (?, ?, ?)', [user.insertId, studentNumber, className]); await connection.commit(); res.status(201).json({ id: user.insertId }); } catch (error) { await connection.rollback(); res.status(400).json({ message: error.code === 'ER_DUP_ENTRY' ? 'Email or Student ID already exists' : 'Unable to create student' }); } finally { connection.release(); } });

app.post('/api/admin/results', requireRole('admin'), async (req, res) => { const { studentId, subjectId, examinationId, score, remarks } = req.body; const value = Number(score); await db.query('INSERT INTO results (student_id, subject_id, examination_id, score, grade, remarks, entered_by) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE score=VALUES(score), grade=VALUES(grade), remarks=VALUES(remarks), entered_by=VALUES(entered_by)', [studentId, subjectId, examinationId, value, grade(value), remarks || null, req.user.id]); res.status(201).json({ grade: grade(value) }); });

app.get('/api/student/results', requireRole('student'), async (req, res) => { const [rows] = await db.query('SELECT e.title AS examination, e.term, s.name AS subject, r.score, r.grade, r.remarks FROM results r JOIN students st ON st.id=r.student_id JOIN subjects s ON s.id=r.subject_id JOIN examinations e ON e.id=r.examination_id WHERE st.user_id=? ORDER BY e.starts_on DESC, s.name', [req.user.id]); res.json(rows); });

// Keep the API on its own port so it never races with the web application.
const apiPort = Number(process.env.API_PORT || 8787);

async function ensurePermanentAdmin() {
  const email = 'admin@edu.edu';
  const passwordHash = await bcrypt.hash('admin', 12);
  await db.query(
    `INSERT INTO users (role, full_name, email, password_hash)
     VALUES ('admin', 'System Administrator', ?, ?)
     ON DUPLICATE KEY UPDATE role = 'admin', full_name = 'System Administrator', password_hash = VALUES(password_hash)`,
    [email, passwordHash],
  );
}

async function start() {
  app.listen(apiPort, () => console.log(`SRPS API listening on ${apiPort}`));
  try {
    await ensurePermanentAdmin();
  } catch {
    console.warn('MySQL is unavailable. Admin sign-in remains available; database features will reconnect when MySQL is configured.');
  }
}

start();
