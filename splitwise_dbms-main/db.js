// Database wrapper for Splitwise DBMS project
// Uses Node's built-in node:sqlite module
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'splitwise.db');
let db;

// In-memory SQL execution log (capped at 50 logs)
const sqlLogs = [];

function addLog(sql, params, durationMs, success, plan, errorMsg = null) {
    sqlLogs.unshift({
        id: Date.now() + Math.random().toString(36).substr(2, 5),
        timestamp: new Date().toISOString(),
        sql: sql.trim(),
        params: params || [],
        durationMs: parseFloat(durationMs.toFixed(2)),
        success,
        plan,
        errorMsg
    });
    if (sqlLogs.length > 50) {
        sqlLogs.pop();
    }
}

// Open Database connection
function connectDb() {
    if (!db) {
        db = new DatabaseSync(DB_PATH);
        // Enable foreign key constraints (disabled by default in SQLite)
        db.exec('PRAGMA foreign_keys = ON;');
    }
    return db;
}

// Get raw DB instance
function getDbInstance() {
    connectDb();
    return db;
}

// Retrieve the SQL execution logs
function getSqlLogs() {
    return sqlLogs;
}

// Clears the SQL logs
function clearSqlLogs() {
    sqlLogs.length = 0;
}

// Retrieve Query Execution Plan
function getExplainPlan(sql, params = []) {
    // Only attempt EXPLAIN on SELECT, INSERT, UPDATE, DELETE queries
    const upperSql = sql.trim().toUpperCase();
    if (!upperSql.startsWith('SELECT') && !upperSql.startsWith('INSERT') && !upperSql.startsWith('UPDATE') && !upperSql.startsWith('DELETE')) {
        return 'N/A';
    }

    try {
        const explainStmt = db.prepare(`EXPLAIN QUERY PLAN ${sql}`);
        const rows = explainStmt.all(...params);
        return rows.map(r => r.detail).join('\n') || 'SCAN TABLE (no indices used)';
    } catch (e) {
        return `Explain error: ${e.message}`;
    }
}

// Reset/Initialize Database with schema.sql
function initDb() {
    connectDb();
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    const start = performance.now();
    try {
        // SQLite's exec can execute multiple statements separated by semicolons
        db.exec(schemaSql);
        const duration = performance.now() - start;
        addLog('EXEC schema.sql (Rebuild and Seed Tables)', [], duration, true, 'Re-created all tables, views, indexes, and inserted sample seed data.');
        return true;
    } catch (error) {
        const duration = performance.now() - start;
        addLog('EXEC schema.sql (FAIL)', [], duration, false, 'Failed to re-initialize schema', error.message);
        throw error;
    }
}

// Execute SELECT query (multiple rows)
function query(sql, params = []) {
    connectDb();
    const start = performance.now();
    let plan = 'N/A';
    try {
        plan = getExplainPlan(sql, params);
        const stmt = db.prepare(sql);
        const results = stmt.all(...params);
        const duration = performance.now() - start;
        addLog(sql, params, duration, true, plan);
        return results;
    } catch (error) {
        const duration = performance.now() - start;
        addLog(sql, params, duration, false, plan, error.message);
        throw error;
    }
}

// Execute SELECT query (single row)
function queryRow(sql, params = []) {
    connectDb();
    const start = performance.now();
    let plan = 'N/A';
    try {
        plan = getExplainPlan(sql, params);
        const stmt = db.prepare(sql);
        const result = stmt.get(...params);
        const duration = performance.now() - start;
        addLog(sql, params, duration, true, plan);
        return result;
    } catch (error) {
        const duration = performance.now() - start;
        addLog(sql, params, duration, false, plan, error.message);
        throw error;
    }
}

// Execute INSERT/UPDATE/DELETE statement
function run(sql, params = []) {
    connectDb();
    const start = performance.now();
    let plan = 'N/A';
    try {
        plan = getExplainPlan(sql, params);
        const stmt = db.prepare(sql);
        const result = stmt.run(...params);
        const duration = performance.now() - start;
        addLog(sql, params, duration, true, plan);
        return result; // contains { changes: number, lastInsertRowid: number }
    } catch (error) {
        const duration = performance.now() - start;
        addLog(sql, params, duration, false, plan, error.message);
        throw error;
    }
}

// Run a set of operations inside an ACID Transaction
function transaction(callback) {
    connectDb();
    const start = performance.now();
    
    // Log BEGIN
    const beginStart = performance.now();
    db.prepare('BEGIN TRANSACTION').run();
    addLog('BEGIN TRANSACTION', [], performance.now() - beginStart, true, 'Initiates a database transaction ensuring ACID compliance.');

    try {
        const result = callback();
        
        // Log COMMIT
        const commitStart = performance.now();
        db.prepare('COMMIT').run();
        addLog('COMMIT TRANSACTION', [], performance.now() - commitStart, true, 'Saves all updates made during the transaction.');
        
        return result;
    } catch (error) {
        // Log ROLLBACK
        const rollbackStart = performance.now();
        try {
            db.prepare('ROLLBACK').run();
            addLog('ROLLBACK TRANSACTION', [], performance.now() - rollbackStart, true, 'Reverts all changes made during the transaction due to error: ' + error.message);
        } catch (rollbackError) {
            console.error('Failed to rollback transaction:', rollbackError);
        }
        throw error;
    }
}

module.exports = {
    connectDb,
    getDbInstance,
    getSqlLogs,
    clearSqlLogs,
    initDb,
    query,
    queryRow,
    run,
    transaction
};
