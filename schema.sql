-- Splitwise DBMS Schema
-- Demonstrates DDL, Constraints, Joins, Views, and Indexing

PRAGMA foreign_keys = ON;

-- 1. DROP TABLES if they exist (clean slate)
DROP VIEW IF EXISTS v_group_balances;
DROP VIEW IF EXISTS v_total_settled_received;
DROP VIEW IF EXISTS v_total_settled_paid;
DROP VIEW IF EXISTS v_total_owed;
DROP VIEW IF EXISTS v_total_paid;

DROP TABLE IF EXISTS settlements;
DROP TABLE IF EXISTS expense_splits;
DROP TABLE IF EXISTS expenses;
DROP TABLE IF EXISTS group_members;
DROP TABLE IF EXISTS groups;
DROP TABLE IF EXISTS users;

-- 2. CREATE TABLES
-- Users Table
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Groups Table
CREATE TABLE groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Group Members Table (Many-to-Many relationship between Users and Groups)
CREATE TABLE group_members (
    group_id INTEGER,
    user_id INTEGER,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, user_id),
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Expenses Table (One-to-Many relationship with groups, and paid_by relation to users)
CREATE TABLE expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    paid_by_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL CHECK(amount > 0),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (paid_by_id) REFERENCES users(id) ON DELETE RESTRICT
);

-- Expense Splits Table (Many-to-Many split mapping of who owes what for each expense)
CREATE TABLE expense_splits (
    expense_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    owed_amount REAL NOT NULL CHECK(owed_amount >= 0),
    PRIMARY KEY (expense_id, user_id),
    FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);

-- Settlements Table (Records financial payments made to settle up)
CREATE TABLE settlements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    payer_id INTEGER NOT NULL,
    payee_id INTEGER NOT NULL,
    amount REAL NOT NULL CHECK(amount > 0),
    settled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (payer_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (payee_id) REFERENCES users(id) ON DELETE RESTRICT
);

-- 3. CREATE INDEXES (Performance optimization on frequent join keys)
CREATE INDEX idx_group_members_user ON group_members(user_id);
CREATE INDEX idx_expenses_group ON expenses(group_id);
CREATE INDEX idx_expenses_paid_by ON expenses(paid_by_id);
CREATE INDEX idx_expense_splits_user ON expense_splits(user_id);
CREATE INDEX idx_settlements_group ON settlements(group_id);

-- 4. CREATE VIEWS (Simplifies complex aggregation queries for user balances)
-- Calculates total paid by each user per group
CREATE VIEW v_total_paid AS
SELECT group_id, paid_by_id AS user_id, SUM(amount) AS total_paid
FROM expenses
GROUP BY group_id, paid_by_id;

-- Calculates total owed by each user per group
CREATE VIEW v_total_owed AS
SELECT e.group_id, es.user_id, SUM(es.owed_amount) AS total_owed
FROM expense_splits es
JOIN expenses e ON es.expense_id = e.id
GROUP BY e.group_id, es.user_id;

-- Calculates total settled paid (sent) by each user per group
CREATE VIEW v_total_settled_paid AS
SELECT group_id, payer_id AS user_id, SUM(amount) AS settled_paid
FROM settlements
GROUP BY group_id, payer_id;

-- Calculates total settled received by each user per group
CREATE VIEW v_total_settled_received AS
SELECT group_id, payee_id AS user_id, SUM(amount) AS settled_received
FROM settlements
GROUP BY group_id, payee_id;

-- Comprehensive View aggregating everything to get Net Balance per user per group
-- Net Balance = (Total Paid) - (Total Owed) + (Settled Paid) - (Settled Received)
CREATE VIEW v_group_balances AS
SELECT 
    gm.group_id,
    gm.user_id,
    u.name AS user_name,
    COALESCE(p.total_paid, 0) AS total_paid,
    COALESCE(o.total_owed, 0) AS total_owed,
    COALESCE(sp.settled_paid, 0) AS settled_paid,
    COALESCE(sr.settled_received, 0) AS settled_received,
    (COALESCE(p.total_paid, 0) - COALESCE(o.total_owed, 0) + COALESCE(sp.settled_paid, 0) - COALESCE(sr.settled_received, 0)) AS net_balance
FROM group_members gm
JOIN users u ON gm.user_id = u.id
LEFT JOIN v_total_paid p ON gm.group_id = p.group_id AND gm.user_id = p.user_id
LEFT JOIN v_total_owed o ON gm.group_id = o.group_id AND gm.user_id = o.user_id
LEFT JOIN v_total_settled_paid sp ON gm.group_id = sp.group_id AND gm.user_id = sp.user_id
LEFT JOIN v_total_settled_received sr ON gm.group_id = sr.group_id AND gm.user_id = sr.user_id;

-- 5. POPULATE INITIAL SEED DATA
-- Insert Users
INSERT INTO users (name, email) VALUES 
('Alice Smith', 'alice@example.com'),
('Bob Jones', 'bob@example.com'),
('Charlie Brown', 'charlie@example.com'),
('Diana Prince', 'diana@example.com');

-- Insert Groups
INSERT INTO groups (name, description) VALUES 
('Roommates 301', 'Shared apartment expenses'),
('Trip to Paris', 'Weekend getaway vacation!');

-- Link Users to Groups (Memberships)
-- Roommates 301: Alice, Bob, Charlie
INSERT INTO group_members (group_id, user_id) VALUES 
(1, 1), -- Alice
(1, 2), -- Bob
(1, 3); -- Charlie

-- Trip to Paris: Alice, Bob, Charlie, Diana
INSERT INTO group_members (group_id, user_id) VALUES 
(2, 1), -- Alice
(2, 2), -- Bob
(2, 3), -- Charlie
(2, 4); -- Diana

-- Insert Initial Expenses
-- Expense 1: Alice paid $90 for Groceries in Roommates 301. Split equally ($30 each).
INSERT INTO expenses (group_id, paid_by_id, description, amount) VALUES 
(1, 1, 'Groceries', 90.00);

-- Splits for Expense 1
INSERT INTO expense_splits (expense_id, user_id, owed_amount) VALUES 
(1, 1, 30.00), -- Alice owes $30
(1, 2, 30.00), -- Bob owes $30
(1, 3, 30.00); -- Charlie owes $30

-- Expense 2: Bob paid $60 for WiFi in Roommates 301. Split equally ($20 each).
INSERT INTO expenses (group_id, paid_by_id, description, amount) VALUES 
(1, 2, 'WiFi Internet', 60.00);

-- Splits for Expense 2
INSERT INTO expense_splits (expense_id, user_id, owed_amount) VALUES 
(2, 1, 20.00), -- Alice owes $20
(2, 2, 20.00), -- Bob owes $20
(2, 3, 20.00); -- Charlie owes $20

-- Expense 3: Charlie paid $200 for Paris Flights. Split equally ($50 each for Alice, Bob, Charlie, Diana).
INSERT INTO expenses (group_id, paid_by_id, description, amount) VALUES 
(2, 3, 'Flight Tickets', 200.00);

-- Splits for Expense 3
INSERT INTO expense_splits (expense_id, user_id, owed_amount) VALUES 
(3, 1, 50.00),
(3, 2, 50.00),
(3, 3, 50.00),
(3, 4, 50.00);

-- Insert Settlements
-- Bob settles $10 to Alice in Roommates 301 (bringing Alice's net from Bob closer to settled)
INSERT INTO settlements (group_id, payer_id, payee_id, amount) VALUES 
(1, 2, 1, 10.00);
