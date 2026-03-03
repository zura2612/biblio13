import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: any;
try {
  db = new Database(path.join(__dirname, 'library.db'));
  console.log('Database initialized at:', path.join(__dirname, 'library.db'));
} catch (e: any) {
  console.error('CRITICAL: Could not open database file:', e.message);
  // Fallback to in-memory if file is corrupted
  db = new Database(':memory:');
  console.log('Falling back to in-memory database.');
}

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    isbn TEXT UNIQUE,
    category TEXT,
    total_copies INTEGER DEFAULT 1,
    available_copies INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    join_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_payment_date DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS loans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER,
    subscriber_id INTEGER,
    loan_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    due_date DATETIME,
    return_date DATETIME,
    status TEXT DEFAULT 'active',
    FOREIGN KEY (book_id) REFERENCES books (id),
    FOREIGN KEY (subscriber_id) REFERENCES subscribers (id)
  );
`);

// Robust migration for existing databases
const migrations = [
  // Repair French schema if it exists
  { sql: 'ALTER TABLE subscribers RENAME COLUMN nom TO last_name', table: 'subscribers', column: 'nom', rename: 'last_name' },
  { sql: 'ALTER TABLE subscribers RENAME COLUMN téléphone TO phone', table: 'subscribers', column: 'téléphone', rename: 'phone' },
  { sql: 'ALTER TABLE subscribers RENAME COLUMN "date_d\'inscription" TO join_date', table: 'subscribers', column: "date_d'inscription", rename: 'join_date' },
  { sql: 'ALTER TABLE subscribers RENAME COLUMN date_dernier_paiement TO last_payment_date', table: 'subscribers', column: 'date_dernier_paiement', rename: 'last_payment_date' },
  
  // Standard migrations
  { sql: 'ALTER TABLE subscribers ADD COLUMN last_payment_date DATETIME', table: 'subscribers', column: 'last_payment_date' },
  { sql: 'ALTER TABLE books ADD COLUMN available_copies INTEGER DEFAULT 1', table: 'books', column: 'available_copies' },
  { sql: 'ALTER TABLE books ADD COLUMN category TEXT', table: 'books', column: 'category' },
  { sql: 'ALTER TABLE loans ADD COLUMN status TEXT DEFAULT "active"', table: 'loans', column: 'status' },
  { sql: 'ALTER TABLE loans ADD COLUMN due_date DATETIME', table: 'loans', column: 'due_date' },
  { sql: 'ALTER TABLE loans ADD COLUMN return_date DATETIME', table: 'loans', column: 'return_date' }
];

console.log('Starting migrations...');
migrations.forEach(m => {
  try {
    // Check if column exists first
    const info = db.prepare(`PRAGMA table_info(${m.table})`).all();
    const exists = info.some((c: any) => c.name === m.column);
    
    if (exists) {
      if (m.rename) {
        // Check if target name already exists
        const targetExists = info.some((c: any) => c.name === m.rename);
        if (!targetExists) {
          db.prepare(m.sql).run();
          console.log(`Migration successful: Renamed ${m.column} to ${m.rename} in ${m.table}`);
        } else {
          console.log(`Column ${m.rename} already exists, skipping rename from ${m.column}`);
        }
      } else {
        console.log(`Column ${m.column} already exists in ${m.table}`);
      }
    } else if (!m.rename) {
      // Add column if it doesn't exist and it's not a rename
      db.prepare(m.sql).run();
      console.log(`Migration successful: Added ${m.column} to ${m.table}`);
      
      // Special handling for last_payment_date default if it failed earlier
      if (m.column === 'last_payment_date') {
        db.prepare("UPDATE subscribers SET last_payment_date = CURRENT_TIMESTAMP WHERE last_payment_date IS NULL").run();
      }
    }
  } catch (e: any) {
    console.error(`Migration failed for ${m.table}.${m.column}:`, e.message);
  }
});

// Log current schema for debugging
try {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Tables in database:', tables.map((t: any) => t.name).join(', '));
  
  tables.forEach((t: any) => {
    try {
      const count = db.prepare(`SELECT COUNT(*) as count FROM ${t.name}`).get() as any;
      console.log(`Table ${t.name} has ${count.count} rows.`);
    } catch (e: any) {
      console.error(`Could not count rows in ${t.name}:`, e.message);
    }
  });
} catch (e: any) {
  console.error('Could not list tables:', e.message);
}

['books', 'subscribers', 'loans'].forEach(table => {
  try {
    const info = db.prepare(`PRAGMA table_info(${table})`).all();
    console.log(`Schema for ${table}:`, info.map((c: any) => c.name).join(', '));
  } catch (e: any) {
    console.error(`Could not get schema for ${table}:`, e.message);
  }
});

// Ensure available_copies is set if it was null after migration
try {
  db.prepare('UPDATE books SET available_copies = total_copies WHERE available_copies IS NULL').run();
  console.log('Ensured available_copies are set.');
} catch (e: any) {
  console.error('Failed to update available_copies:', e.message);
}

async function startServer() {
  const app = express();
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  app.use(express.json());

  // Request logger
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    if (req.method === 'PUT' || req.method === 'POST') {
      console.log('Body:', req.body);
    }
    next();
  });

  // API Routes
  app.get('/api/ping', (req, res) => {
    res.json({ status: 'pong', timestamp: new Date().toISOString() });
  });

  app.get('/api/debug/schema', (req, res) => {
    try {
      const schema: any = {};
      ['books', 'subscribers', 'loans'].forEach(table => {
        schema[table] = db.prepare(`PRAGMA table_info(${table})`).all();
      });
      res.json(schema);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Books
  app.get('/api/books', (req, res) => {
    try {
      const books = db.prepare('SELECT * FROM books').all();
      res.json(books);
    } catch (e: any) {
      console.error('Error fetching books:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/books', (req, res) => {
    const { title, author, isbn, category, total_copies } = req.body;
    console.log('Adding book:', { title, author, isbn, category, total_copies });
    try {
      const info = db.prepare(
        'INSERT INTO books (title, author, isbn, category, total_copies, available_copies) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(title, author, isbn, category, total_copies, total_copies);
      console.log('Book added with ID:', info.lastInsertRowid);
      res.json({ id: info.lastInsertRowid });
    } catch (e: any) {
      console.error('Error adding book:', e.message);
      res.status(400).json({ error: e.message });
    }
  });

  app.delete('/api/books/:id', (req, res) => {
    db.prepare('DELETE FROM books WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  app.put('/api/books/:id', (req, res) => {
    const { title, author, isbn, category, total_copies } = req.body;
    const { id } = req.params;
    console.log(`Updating book ${id} with:`, { title, author, isbn, category, total_copies });
    
    try {
      // We need to adjust available_copies if total_copies changed
      const currentBook = db.prepare('SELECT total_copies, available_copies FROM books WHERE id = ?').get(id) as any;
      if (!currentBook) {
        return res.status(404).json({ error: 'Livre non trouvé' });
      }

      const diff = total_copies - currentBook.total_copies;
      const newAvailable = currentBook.available_copies + diff;

      if (newAvailable < 0) {
        return res.status(400).json({ error: 'Impossible de réduire le stock total en dessous du nombre d\'exemplaires actuellement empruntés' });
      }

      db.prepare(
        'UPDATE books SET title = ?, author = ?, isbn = ?, category = ?, total_copies = ?, available_copies = ? WHERE id = ?'
      ).run(title, author, isbn, category, total_copies, newAvailable, id);
      
      console.log(`Book ${id} updated successfully`);
      res.json({ success: true });
    } catch (e: any) {
      console.error('Update book DB error:', e.message);
      res.status(400).json({ error: e.message });
    }
  });

  // Subscribers
  app.get('/api/subscribers', (req, res) => {
    try {
      const subscribers = db.prepare('SELECT * FROM subscribers ORDER BY last_name ASC').all();
      res.json(subscribers);
    } catch (e: any) {
      console.error('Error fetching subscribers:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/subscribers', (req, res) => {
    const { first_name, last_name, email, phone } = req.body;
    try {
      const info = db.prepare(
        'INSERT INTO subscribers (first_name, last_name, email, phone) VALUES (?, ?, ?, ?)'
      ).run(first_name, last_name, email, phone);
      res.json({ id: info.lastInsertRowid });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put('/api/subscribers/:id', (req, res) => {
    const { first_name, last_name, email, phone, last_payment_date } = req.body;
    const { id } = req.params;
    console.log(`Updating subscriber ${id} with:`, { first_name, last_name, email, phone, last_payment_date });
    try {
      const result = db.prepare(
        'UPDATE subscribers SET first_name = ?, last_name = ?, email = ?, phone = ?, last_payment_date = ? WHERE id = ?'
      ).run(first_name, last_name, email, phone, last_payment_date, id);
      
      if (result.changes === 0) {
        console.log(`No subscriber found with ID ${id}`);
        return res.status(404).json({ error: 'Abonné non trouvé' });
      }
      
      console.log(`Subscriber ${id} updated successfully`);
      res.json({ success: true });
    } catch (e: any) {
      console.error('Update DB error:', e.message);
      res.status(400).json({ error: e.message });
    }
  });

  app.delete('/api/subscribers/:id', (req, res) => {
    try {
      // Check if subscriber has active loans
      const activeLoans = db.prepare('SELECT COUNT(*) as count FROM loans WHERE subscriber_id = ? AND status = \'active\'').get(req.params.id) as any;
      if (activeLoans.count > 0) {
        return res.status(400).json({ error: 'Impossible de supprimer un abonné ayant des emprunts en cours' });
      }
      db.prepare('DELETE FROM subscribers WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Loans
  app.get('/api/loans', (req, res) => {
    try {
      const loans = db.prepare(`
        SELECT l.*, b.title as book_title, s.first_name, s.last_name 
        FROM loans l
        JOIN books b ON l.book_id = b.id
        JOIN subscribers s ON l.subscriber_id = s.id
        ORDER BY l.loan_date DESC
      `).all();
      res.json(loans);
    } catch (e: any) {
      console.error('Error fetching loans:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/loans', (req, res) => {
    const { book_id, subscriber_id, due_date } = req.body;
    
    const book = db.prepare('SELECT available_copies FROM books WHERE id = ?').get(book_id) as any;
    if (!book || book.available_copies <= 0) {
      return res.status(400).json({ error: 'Book not available' });
    }

    const transaction = db.transaction(() => {
      db.prepare('UPDATE books SET available_copies = available_copies - 1 WHERE id = ?').run(book_id);
      return db.prepare(
        'INSERT INTO loans (book_id, subscriber_id, due_date) VALUES (?, ?, ?)'
      ).run(book_id, subscriber_id, due_date);
    });

    try {
      const info = transaction();
      res.json({ id: info.lastInsertRowid });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/loans/:id/return', (req, res) => {
    const loan = db.prepare('SELECT book_id, status FROM loans WHERE id = ?').get(req.params.id) as any;
    if (!loan || loan.status === 'returned') {
      return res.status(400).json({ error: 'Invalid loan or already returned' });
    }

    const transaction = db.transaction(() => {
      db.prepare('UPDATE books SET available_copies = available_copies + 1 WHERE id = ?').run(loan.book_id);
      db.prepare('UPDATE loans SET status = \'returned\', return_date = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
    });

    try {
      transaction();
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Stats
  app.get('/api/stats', (req, res) => {
    try {
      const totalBooks = db.prepare('SELECT SUM(total_copies) as count FROM books').get() as any;
      const totalSubscribers = db.prepare('SELECT COUNT(*) as count FROM subscribers').get() as any;
      const activeLoans = db.prepare('SELECT COUNT(*) as count FROM loans WHERE status = \'active\'').get() as any;
      const overdueLoans = db.prepare('SELECT COUNT(*) as count FROM loans WHERE status = \'active\' AND due_date < CURRENT_TIMESTAMP').get() as any;
      const expiredMemberships = db.prepare('SELECT COUNT(*) as count FROM subscribers WHERE last_payment_date < datetime(\'now\', \'-1 year\')').get() as any;
      res.json({
        books: totalBooks?.count || 0,
        subscribers: totalSubscribers?.count || 0,
        activeLoans: activeLoans?.count || 0,
        overdueLoans: overdueLoans?.count || 0,
        expiredMemberships: expiredMemberships?.count || 0
      });
    } catch (e: any) {
      console.error('Error fetching stats:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // Issue Reporting
  app.post('/api/report-issue', async (req, res) => {
    const { email, subject, description } = req.body;

    if (!subject || !description) {
      return res.status(400).json({ error: 'Le sujet et la description sont obligatoires.' });
    }

    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const mailOptions = {
        from: process.env.SMTP_USER,
        to: process.env.REPORT_RECIPIENT_EMAIL,
        subject: `[SIGNALEMENT] ${subject}`,
        text: `Nouveau signalement de problème reçu.\n\nEmail de l'utilisateur: ${email || 'Non fourni'}\nSujet: ${subject}\nDescription:\n${description}`,
        replyTo: email || undefined
      };

      await transporter.sendMail(mailOptions);
      console.log('Email de signalement envoyé avec succès');
      res.json({ success: true, message: 'Votre signalement a été envoyé avec succès.' });
    } catch (error: any) {
      console.error('Erreur lors de l\'envoi de l\'email de signalement:', error);
      res.status(500).json({ error: 'Une erreur est survenue lors de l\'envoi du signalement. Veuillez réessayer plus tard.' });
    }
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('mode développement');
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
    console.log('mode production');
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server fonctionne sur http://localhost:${PORT}`);
  });
}

startServer();
