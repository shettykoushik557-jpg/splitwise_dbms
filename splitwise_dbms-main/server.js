// Simple Node.js HTTP Server for Splitwise DBMS project
// Uses only built-in modules (no npm install required!)
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const db = require('./db');

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Helper to serve static files
function serveStaticFile(res, filePath, contentType) {
    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end(`Server Error: ${err.message}`);
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
}

// Helper to parse JSON body
function getRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (err) {
                reject(err);
            }
        });
    });
}

// Helper for JSON responses
function sendJSON(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

// Helper for error responses
function sendError(res, status, message) {
    sendJSON(res, status, { error: message });
}

// Define the server handler
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    console.log(`${method} ${pathname}`);

    // --- STATIC FILES CORNER ---
    if (method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
        return serveStaticFile(res, path.join(__dirname, 'index.html'), 'text/html');
    }
    if (method === 'GET' && (pathname === '/styles.css' || pathname === '/style.css')) {
        return serveStaticFile(res, path.join(__dirname, 'styles.css'), 'text/css');
    }
    if (method === 'GET' && pathname === '/app.js') {
        return serveStaticFile(res, path.join(__dirname, 'app.js'), 'application/javascript');
    }

    // --- DATABASE SCHEMA & LOGS API ---
    if (method === 'GET' && pathname === '/api/db/schema') {
        try {
            const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
            return sendJSON(res, 200, { schema: schemaSql });
        } catch (e) {
            return sendError(res, 500, e.message);
        }
    }

    if (method === 'POST' && pathname === '/api/db/reset') {
        try {
            db.clearSqlLogs();
            db.initDb();
            return sendJSON(res, 200, { message: 'Database reset and seeded successfully!' });
        } catch (e) {
            return sendError(res, 500, e.message);
        }
    }

    if (method === 'GET' && pathname === '/api/db/logs') {
        return sendJSON(res, 200, db.getSqlLogs());
    }

    // --- CUSTOM SQL PLAYGROUND API ---
    if (method === 'POST' && pathname === '/api/query') {
        try {
            const { sql } = await getRequestBody(req);
            if (!sql) return sendError(res, 400, 'SQL query is required.');

            const cleanSql = sql.trim();
            const upperSql = cleanSql.toUpperCase();

            // Run query & return results
            const start = performance.now();
            let results = null;
            let changes = null;
            let lastInsertRowid = null;

            const isSelect = upperSql.startsWith('SELECT') || upperSql.startsWith('EXPLAIN') || upperSql.startsWith('PRAGMA');

            if (isSelect) {
                results = db.query(cleanSql);
            } else {
                const resDb = db.run(cleanSql);
                changes = resDb.changes;
                lastInsertRowid = resDb.lastInsertRowid;
            }
            const duration = performance.now() - start;

            return sendJSON(res, 200, {
                success: true,
                isSelect,
                results,
                changes,
                lastInsertRowid,
                durationMs: parseFloat(duration.toFixed(2))
            });
        } catch (e) {
            return sendJSON(res, 200, {
                success: false,
                error: e.message
            });
        }
    }

    // --- USERS API ---
    if (pathname === '/api/users') {
        if (method === 'GET') {
            try {
                const users = db.query('SELECT * FROM users ORDER BY id DESC;');
                return sendJSON(res, 200, users);
            } catch (e) {
                return sendError(res, 500, e.message);
            }
        }
        if (method === 'POST') {
            try {
                const { name, email } = await getRequestBody(req);
                if (!name || !email) return sendError(res, 400, 'Name and email are required.');

                const result = db.run('INSERT INTO users (name, email) VALUES (?, ?);', [name, email]);
                return sendJSON(res, 201, { id: result.lastInsertRowid, name, email });
            } catch (e) {
                return sendError(res, 500, e.message);
            }
        }
    }

    if (method === 'DELETE' && pathname.startsWith('/api/users/')) {
        try {
            const userId = parseInt(pathname.split('/').pop());
            db.run('DELETE FROM users WHERE id = ?;', [userId]);
            return sendJSON(res, 200, { message: 'User deleted successfully!' });
        } catch (e) {
            return sendError(res, 500, e.message);
        }
    }

    // --- GROUPS API ---
    if (pathname === '/api/groups') {
        if (method === 'GET') {
            try {
                const groups = db.query('SELECT * FROM groups ORDER BY id DESC;');
                return sendJSON(res, 200, groups);
            } catch (e) {
                return sendError(res, 500, e.message);
            }
        }
        if (method === 'POST') {
            try {
                const { name, description } = await getRequestBody(req);
                if (!name) return sendError(res, 400, 'Group name is required.');

                const result = db.run('INSERT INTO groups (name, description) VALUES (?, ?);', [name, description || '']);
                return sendJSON(res, 201, { id: result.lastInsertRowid, name, description });
            } catch (e) {
                return sendError(res, 500, e.message);
            }
        }
    }

    if (method === 'DELETE' && pathname.startsWith('/api/groups/')) {
        try {
            const groupId = parseInt(pathname.split('/').pop());
            db.run('DELETE FROM groups WHERE id = ?;', [groupId]);
            return sendJSON(res, 200, { message: 'Group deleted successfully!' });
        } catch (e) {
            return sendError(res, 500, e.message);
        }
    }

    // --- GROUP MEMBERS API ---
    if (pathname === '/api/members') {
        if (method === 'GET') {
            try {
                const groupId = parseInt(parsedUrl.query.groupId);
                if (!groupId) return sendError(res, 400, 'groupId query parameter is required.');

                const members = db.query(
                    `SELECT u.id, u.name, u.email, gm.joined_at 
                     FROM users u 
                     JOIN group_members gm ON u.id = gm.user_id 
                     WHERE gm.group_id = ? 
                     ORDER BY u.name ASC;`,
                    [groupId]
                );
                return sendJSON(res, 200, members);
            } catch (e) {
                return sendError(res, 500, e.message);
            }
        }
        if (method === 'POST') {
            try {
                const { groupId, userId } = await getRequestBody(req);
                if (!groupId || !userId) return sendError(res, 400, 'groupId and userId are required.');

                db.run('INSERT INTO group_members (group_id, user_id) VALUES (?, ?);', [groupId, userId]);
                return sendJSON(res, 201, { message: 'User added to group successfully!' });
            } catch (e) {
                return sendError(res, 500, e.message);
            }
        }
    }

    // --- EXPENSES API (Featuring Transaction demo!) ---
    if (pathname === '/api/expenses') {
        if (method === 'GET') {
            try {
                const groupId = parseInt(parsedUrl.query.groupId);
                if (!groupId) return sendError(res, 400, 'groupId query parameter is required.');

                // Fetch expenses in group
                const expenses = db.query(
                    `SELECT e.*, u.name AS paid_by_name 
                     FROM expenses e 
                     JOIN users u ON e.paid_by_id = u.id 
                     WHERE e.group_id = ? 
                     ORDER BY e.id DESC;`,
                    [groupId]
                );

                // Fetch splits for these expenses
                for (let exp of expenses) {
                    exp.splits = db.query(
                        `SELECT es.*, u.name AS user_name 
                         FROM expense_splits es 
                         JOIN users u ON es.user_id = u.id 
                         WHERE es.expense_id = ?;`,
                        [exp.id]
                    );
                }

                return sendJSON(res, 200, expenses);
            } catch (e) {
                return sendError(res, 500, e.message);
            }
        }

        if (method === 'POST') {
            try {
                const { groupId, paidById, description, amount, splits } = await getRequestBody(req);

                // Validation
                if (!groupId || !paidById || !description || !amount || !splits || !splits.length) {
                    return sendError(res, 400, 'Missing required expense details.');
                }

                // Check split sum equals total amount (business logic validation)
                const sumSplits = splits.reduce((sum, s) => sum + s.owedAmount, 0);
                if (Math.abs(sumSplits - amount) > 0.01) {
                    return sendError(res, 400, `Sum of splits ($${sumSplits.toFixed(2)}) must equal the total amount ($${amount.toFixed(2)}).`);
                }

                // ACID Transaction
                const result = db.transaction(() => {
                    // 1. Insert into expenses table
                    const expRes = db.run(
                        'INSERT INTO expenses (group_id, paid_by_id, description, amount) VALUES (?, ?, ?, ?);',
                        [groupId, paidById, description, amount]
                    );
                    const expenseId = expRes.lastInsertRowid;

                    // 2. Insert into expense_splits table
                    for (let split of splits) {
                        db.run(
                            'INSERT INTO expense_splits (expense_id, user_id, owed_amount) VALUES (?, ?, ?);',
                            [expenseId, split.userId, split.owedAmount]
                        );
                    }
                    return { expenseId };
                });

                return sendJSON(res, 201, { message: 'Expense added successfully!', expenseId: result.expenseId });
            } catch (e) {
                return sendError(res, 500, e.message);
            }
        }
    }

    if (method === 'DELETE' && pathname.startsWith('/api/expenses/')) {
        try {
            const expenseId = parseInt(pathname.split('/').pop());
            db.run('DELETE FROM expenses WHERE id = ?;', [expenseId]);
            return sendJSON(res, 200, { message: 'Expense deleted successfully!' });
        } catch (e) {
            return sendError(res, 500, e.message);
        }
    }

    // --- SETTLEMENTS API ---
    if (pathname === '/api/settlements') {
        if (method === 'GET') {
            try {
                const groupId = parseInt(parsedUrl.query.groupId);
                if (!groupId) return sendError(res, 400, 'groupId query parameter is required.');

                const settlements = db.query(
                    `SELECT s.*, u1.name AS payer_name, u2.name AS payee_name 
                     FROM settlements s 
                     JOIN users u1 ON s.payer_id = u1.id 
                     JOIN users u2 ON s.payee_id = u2.id 
                     WHERE s.group_id = ? 
                     ORDER BY s.id DESC;`,
                    [groupId]
                );
                return sendJSON(res, 200, settlements);
            } catch (e) {
                return sendError(res, 500, e.message);
            }
        }
        if (method === 'POST') {
            try {
                const { groupId, payerId, payeeId, amount } = await getRequestBody(req);
                if (!groupId || !payerId || !payeeId || !amount) {
                    return sendError(res, 400, 'groupId, payerId, payeeId, and amount are required.');
                }

                const result = db.run(
                    'INSERT INTO settlements (group_id, payer_id, payee_id, amount) VALUES (?, ?, ?, ?);',
                    [groupId, payerId, payeeId, amount]
                );
                return sendJSON(res, 201, { id: result.lastInsertRowid, message: 'Settlement recorded successfully!' });
            } catch (e) {
                return sendError(res, 500, e.message);
            }
        }
    }

    // --- BALANCES API (Selecting from View v_group_balances) ---
    if (pathname === '/api/balances') {
        if (method === 'GET') {
            try {
                const groupId = parseInt(parsedUrl.query.groupId);
                if (!groupId) return sendError(res, 400, 'groupId query parameter is required.');

                const balances = db.query(
                    'SELECT * FROM v_group_balances WHERE group_id = ? ORDER BY net_balance DESC;',
                    [groupId]
                );
                return sendJSON(res, 200, balances);
            } catch (e) {
                return sendError(res, 500, e.message);
            }
        }
    }

    // --- FALLBACK ---
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
});

// Auto-initialize DB on startup if database file doesn't exist
const dbFileExists = fs.existsSync(path.join(__dirname, 'splitwise.db'));
db.connectDb();
if (!dbFileExists) {
    console.log('Database not found. Initializing with default schema and seed data...');
    db.initDb();
}

let currentPort = PORT;

function startServer() {
    server.listen(currentPort, () => {
        console.log(`==================================================`);
        console.log(`  Splitwise DBMS Project Server running successfully`);
        console.log(`  Access dashboard at: http://localhost:${currentPort}`);
        console.log(`==================================================`);
    });
}

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`Port ${currentPort} is busy, trying port ${currentPort + 1}...`);
        currentPort++;
        startServer();
    } else {
        console.error('Server error:', err);
    }
});

startServer();
