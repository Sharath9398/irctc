
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

let db = null;
let dbFilePath = null;

function init(dataDir) {
  return new Promise((resolve, reject) => {
    try {
      if (!dataDir) throw new Error('dataDir is required');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      dbFilePath = path.join(dataDir, 'irctc_tatkal.sqlite3');
      db = new sqlite3.Database(dbFilePath, (err) => {
        if (err) return reject(err);

        db.serialize(() => {
          
          // Create clean users table
          db.run(
            `CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              password TEXT NOT NULL,
              pin TEXT NOT NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );`
          );

          // Add pin column if it doesn't exist (for existing databases)
          db.run(`ALTER TABLE users ADD COLUMN pin TEXT`, (err) => {
            // Ignore error if column already exists
          });

          db.run(
            `CREATE TABLE IF NOT EXISTS bookings (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              pnr TEXT,
              passenger_ids TEXT,
              status TEXT,
              details TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );`
          );

          db.run(
            `CREATE TABLE IF NOT EXISTS tickets (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              source TEXT NOT NULL,
              destination TEXT NOT NULL,
              train_no TEXT NOT NULL,
              train_class TEXT,
              quota TEXT,
              travel_date TEXT,
              mob_no TEXT,
              email TEXT,
              ticket_name TEXT,
              pt_fare_limit TEXT,
              irctc_id INTEGER,
              payment_id INTEGER,
              consider_auto_upgrade BOOLEAN DEFAULT 0,
              book_only_if_confirm BOOLEAN DEFAULT 0,
              payment_method TEXT DEFAULT 'BHIM/UPI',
              passengers TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );`
          );

          db.run(
            `CREATE TABLE IF NOT EXISTS proxies (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              host TEXT NOT NULL,
              port INTEGER,
              username TEXT,
              password TEXT,
              meta TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );`
          );

          // Create payment_details table with correct schema
          db.run(
            `CREATE TABLE IF NOT EXISTS payment_details (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              gateway TEXT NOT NULL,
              upi_id TEXT,
              card_type TEXT,
              card_no TEXT,
              expiry_month TEXT,
              expiry_year TEXT,
              name_on_card TEXT,
              pin TEXT,
              cvv TEXT,
              password_3d TEXT,
              name_to_save TEXT,
              type TEXT DEFAULT 'bank',
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );`
          );



          return resolve();
        });
      });
    } catch (err) {
      reject(err);
    }
  });
}

function getDbPath() {
  return dbFilePath;
}

function ensureDb() {
  if (!db) throw new Error('Database not initialized. Call init(dataDir) first.');
}

function getUsers(options = {}) {
  return new Promise((resolve, reject) => {
    try {
      ensureDb();
      const { limit = 1000, offset = 0, search = null } = options;
      let sql = `SELECT id, name, password, pin, created_at FROM users`;
      const params = [];
      if (search) {
        sql += ` WHERE name LIKE ?`;
        params.push(`%${search}%`);
      }
      sql += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    } catch (err) {
      reject(err);
    }
  });
}

function getUserById(id) {
  return new Promise((resolve, reject) => {
    try {
      ensureDb();
      db.get(
        `SELECT id, name, password, pin, created_at FROM users WHERE id = ?`,
        [id],
        (err, row) => {
          if (err) return reject(err);
          resolve(row || null);
        }
      );
    } catch (err) {
      reject(err);
    }
  });
}

function addUser(p) {
  return new Promise((resolve, reject) => {
    try {
      ensureDb();
      if (!p || !p.name) return reject(new Error('name is required'));

      const stmt = db.prepare(
        `INSERT INTO users (name, password, pin) VALUES (?, ?, ?)`
      );

      stmt.run(
        [p.name, p.password, p.pin],
        function (err) {
          if (err) {
            stmt.finalize(() => {});
            return reject(err);
          }
          const insertedId = this.lastID;
          stmt.finalize((ferr) => {
            if (ferr) return reject(ferr);
            resolve({ id: insertedId });
          });
        }
      );
    } catch (err) {
      reject(err);
    }
  });
}



function deleteUser(id) {
  return new Promise((resolve, reject) => {
    try {
      ensureDb();
      if (!id) return reject(new Error('id is required'));
      db.run(`DELETE FROM users WHERE id = ?`, [id], function (err) {
        if (err) return reject(err);
        resolve({ deleted: this.changes || 0 });
      });
    } catch (err) {
      reject(err);
    }
  });
}

function bulkInsertUsers(rows) {
  return new Promise((resolve, reject) => {
    try {
      ensureDb();
      if (!Array.isArray(rows)) return reject(new Error('rows must be an array'));

      let inserted = 0;
      let skipped = 0;

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        const stmt = db.prepare(
          `INSERT INTO users (name, password, pin) VALUES (?, ?, ?)`
        );

        for (const r of rows) {
          try {
            if (!r || !r.name || !r.password) {
              skipped++;
              continue;
            }
            stmt.run([r.name, r.password, r.pin]);
            inserted++;
          } catch (errRow) {
            skipped++;
            console.error('bulkInsert row failed', errRow);
          }
        }

        stmt.finalize((errFinalize) => {
          if (errFinalize) {
            db.run('ROLLBACK');
            return reject(errFinalize);
          }
          db.run('COMMIT', (errCommit) => {
            if (errCommit) {
              return reject(errCommit);
            }
            resolve({ inserted, skipped });
          });
        });
      });
    } catch (err) {
      reject(err);
    }
  });
}

function getPaymentDetails(type = null) {
  return new Promise((resolve, reject) => {
    try {
      ensureDb();
      let sql = `SELECT id, gateway, upi_id, card_type, card_no, expiry_month, expiry_year, name_on_card, pin, cvv, password_3d, name_to_save, type, created_at FROM payment_details`;
      const params = [];
      if (type) {
        sql += ` WHERE type = ?`;
        params.push(type);
      }
      sql += ` ORDER BY id DESC`;
      
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    } catch (err) {
      reject(err);
    }
  });
}

function addPaymentDetail(p) {
  return new Promise((resolve, reject) => {
    try {
      ensureDb();
      if (!p || !p.gateway) return reject(new Error('gateway is required'));
      
      // Validate based on payment type
      if (p.type === 'bank' && !p.upi_id) {
        return reject(new Error('UPI ID is required for bank payments'));
      }
      if ((p.type === 'debit' || p.type === 'credit') && (!p.card_no || !p.name_to_save)) {
        return reject(new Error('Card number and name to save are required for card payments'));
      }
      
      const stmt = db.prepare(
        `INSERT INTO payment_details (gateway, upi_id, card_type, card_no, expiry_month, expiry_year, name_on_card, pin, cvv, password_3d, name_to_save, type) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      
      stmt.run([
        p.gateway,
        p.upi_id || null,
        p.card_type || null,
        p.card_no || null,
        p.expiry_month || null,
        p.expiry_year || null,
        p.name_on_card || null,
        p.pin || null,
        p.cvv || null,
        p.password_3d || null,
        p.name_to_save || null,
        p.type || 'bank'
      ], function (err) {
        if (err) {
          stmt.finalize(() => {});
          return reject(err);
        }
        const insertedId = this.lastID;
        stmt.finalize((ferr) => {
          if (ferr) return reject(ferr);
          resolve({ id: insertedId });
        });
      });
    } catch (err) {
      reject(err);
    }
  });
}

function deletePaymentDetail(id) {
  return new Promise((resolve, reject) => {
    try {
      ensureDb();
      if (!id) return reject(new Error('id is required'));
      db.run(`DELETE FROM payment_details WHERE id = ?`, [id], function (err) {
        if (err) return reject(err);
        resolve({ deleted: this.changes || 0 });
      });
    } catch (err) {
      reject(err);
    }
  });
}

function getProxies() {
  return new Promise((resolve, reject) => {
    try {
      ensureDb();
      db.all(`SELECT id, host, port, username, password, meta, created_at FROM proxies ORDER BY id DESC`, (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    } catch (err) {
      reject(err);
    }
  });
}

function addProxy(p) {
  return new Promise((resolve, reject) => {
    try {
      ensureDb();
      if (!p || !p.host || !p.port) return reject(new Error('host and port are required'));
      
      const stmt = db.prepare(`INSERT INTO proxies (host, port, username, password, meta) VALUES (?, ?, ?, ?, ?)`);
      const meta = p.meta ? JSON.stringify(p.meta) : null;
      
      stmt.run([p.host, p.port, p.username || null, p.password || null, meta], function (err) {
        if (err) {
          stmt.finalize(() => {});
          return reject(err);
        }
        const insertedId = this.lastID;
        stmt.finalize((ferr) => {
          if (ferr) return reject(ferr);
          resolve({ id: insertedId });
        });
      });
    } catch (err) {
      reject(err);
    }
  });
}

function deleteProxy(id) {
  return new Promise((resolve, reject) => {
    try {
      ensureDb();
      if (!id) return reject(new Error('id is required'));
      db.run(`DELETE FROM proxies WHERE id = ?`, [id], function (err) {
        if (err) return reject(err);
        resolve({ deleted: this.changes || 0 });
      });
    } catch (err) {
      reject(err);
    }
  });
}

function getTickets() {
  return new Promise((resolve, reject) => {
    try {
      ensureDb();
      db.all(`SELECT * FROM tickets ORDER BY id DESC`, (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    } catch (err) {
      reject(err);
    }
  });
}

function updateUser(id, data) {
  return new Promise((resolve, reject) => {
    try {
      ensureDb();
      if (!id || !data.name) return reject(new Error('id and name are required'));
      db.run(`UPDATE users SET name = ?, password = ?, pin = ? WHERE id = ?`, [data.name, data.password, data.pin, id], function (err) {
        if (err) return reject(err);
        resolve({ updated: this.changes || 0 });
      });
    } catch (err) {
      reject(err);
    }
  });
}

function updatePaymentDetail(id, data) {
  return new Promise((resolve, reject) => {
    try {
      ensureDb();
      if (!id || !data.gateway) return reject(new Error('id and gateway are required'));
      db.run(`UPDATE payment_details SET gateway = ?, upi_id = ?, card_type = ?, card_no = ?, expiry_month = ?, expiry_year = ?, name_on_card = ?, pin = ?, cvv = ?, password_3d = ?, name_to_save = ?, type = ? WHERE id = ?`, 
        [data.gateway, data.upi_id, data.card_type, data.card_no, data.expiry_month, data.expiry_year, data.name_on_card, data.pin, data.cvv, data.password_3d, data.name_to_save, data.type, id], function (err) {
        if (err) return reject(err);
        resolve({ updated: this.changes || 0 });
      });
    } catch (err) {
      reject(err);
    }
  });
}

function updateProxy(id, data) {
  return new Promise((resolve, reject) => {
    try {
      ensureDb();
      if (!id || !data.host || !data.port) return reject(new Error('id, host and port are required'));
      db.run(`UPDATE proxies SET host = ?, port = ?, username = ?, password = ? WHERE id = ?`, [data.host, data.port, data.username, data.password, id], function (err) {
        if (err) return reject(err);
        resolve({ updated: this.changes || 0 });
      });
    } catch (err) {
      reject(err);
    }
  });
}

function updateTicket(id, data) {
  return new Promise((resolve, reject) => {
    try {
      ensureDb();
      if (!id || !data.source || !data.destination || !data.train_no) return reject(new Error('id, source, destination and train_no are required'));
      db.run(`UPDATE tickets SET source = ?, destination = ?, train_no = ?, train_class = ?, quota = ?, travel_date = ?, mob_no = ?, email = ?, ticket_name = ?, pt_fare_limit = ?, irctc_id = ?, payment_id = ?, consider_auto_upgrade = ?, book_only_if_confirm = ?, passengers = ? WHERE id = ?`, 
        [data.source, data.destination, data.train_no, data.train_class, data.quota, data.travel_date, data.mob_no, data.email, data.ticket_name, data.pt_fare_limit, data.irctc_id, data.payment_id, data.consider_auto_upgrade ? 1 : 0, data.book_only_if_confirm ? 1 : 0, data.passengers, id], function (err) {
        if (err) return reject(err);
        resolve({ updated: this.changes || 0 });
      });
    } catch (err) {
      reject(err);
    }
  });
}

function deleteTicket(id) {
  return new Promise((resolve, reject) => {
    try {
      ensureDb();
      if (!id) return reject(new Error('id is required'));
      db.run(`DELETE FROM tickets WHERE id = ?`, [id], function (err) {
        if (err) return reject(err);
        resolve({ deleted: this.changes || 0 });
      });
    } catch (err) {
      reject(err);
    }
  });
}

function addTicket(t) {
  return new Promise((resolve, reject) => {
    try {
      ensureDb();
      if (!t || !t.source || !t.destination || !t.train_no) {
        return reject(new Error('source, destination and train_no are required'));
      }
      
      const stmt = db.prepare(
        `INSERT INTO tickets (source, destination, train_no, train_class, quota, travel_date, mob_no, email, ticket_name, pt_fare_limit, irctc_id, payment_id, consider_auto_upgrade, book_only_if_confirm, passengers) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      
      stmt.run([
        t.source,
        t.destination,
        t.trainNo || t.train_no,
        t.trainClass || t.train_class,
        t.quota,
        t.travelDate || t.travel_date,
        t.mobNo || t.mob_no,
        t.email,
        t.ticketName || t.ticket_name,
        t.ptFareLimit || t.pt_fare_limit,
        t.irctcId || t.irctc_id,
        t.payment,
        t.considerAutoUpgrade ? 1 : 0,
        t.bookOnlyIfConfirm ? 1 : 0,
        t.passengers
      ], function (err) {
        if (err) {
          stmt.finalize(() => {});
          return reject(err);
        }
        const insertedId = this.lastID;
        stmt.finalize((ferr) => {
          if (ferr) return reject(ferr);
          resolve({ id: insertedId });
        });
      });
    } catch (err) {
      reject(err);
    }
  });
}

function close() {
  return new Promise((resolve, reject) => {
    if (!db) return resolve();
    db.close((err) => {
      if (err) return reject(err);
      db = null;
      resolve();
    });
  });
}

module.exports = {
  init,
  getDbPath,
  getUsers,
  getUserById,
  addUser,
  updateUser,
  deleteUser,
  bulkInsertUsers,
  getPaymentDetails,
  addPaymentDetail,
  updatePaymentDetail,
  deletePaymentDetail,
  getProxies,
  addProxy,
  updateProxy,
  deleteProxy,
  getTickets,
  updateTicket,
  deleteTicket,
  addTicket,
  close
};
