---
title: Splitwise DBMS
emoji: 💸
colorFrom: green
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# Splitwise DBMS Project Analyzer

A complete, educational web-based Splitwise application designed specifically as a Database Management Systems (DBMS) project. 

This project uses **Node.js** with the native **`node:sqlite`** module, meaning it has **zero external npm package dependencies** and is extremely easy to run on any computer with Node.js installed.

---

## 🚀 How to Run the Project

1. **Prerequisites**: Ensure you have [Node.js](https://nodejs.org/) installed (v22.5.0 or newer is recommended since it includes built-in SQLite support).
2. **Start the Server**: Open your terminal, navigate to the project directory, and execute:
   ```bash
   node server.js
   ```
3. **Open the Web UI**: Open your web browser and navigate to:
   ```
   http://localhost:3000
   ```
4. **Load Sample Data**: Click the **"⚡ Reset & Seed Database"** button in the top right to instantly populate the database with sample users, groups, shared expenses, and settlements.

---

## 🛠️ Tech Stack Architecture
- **DBMS**: SQLite (run locally via Node.js's built-in `node:sqlite` module).
- **Backend API**: Node.js `http` native server.
- **Frontend UI**: Vanilla HTML5, CSS3 (with Glassmorphic responsive layouts and dynamic balance highlight transitions), and modern ES6 JavaScript.

---

## 📁 Database Schema Details

The database schema is defined in [`schema.sql`](file:///c:/Users/saketha%20raj/Desktop/splitwise/schema.sql) and implements a fully normalized relational structure (up to 3NF). It consists of 6 tables, 5 indexes, and 5 SQL views.

### Entity-Relationship Model (Conceptual)
```
  [users] 1 -------- N [group_members] N -------- 1 [groups]
    |                       |                         |
    | 1                     |                         | 1
    v                       |                         v
  [expenses] 1 -------------+------------------ N [settlements]
    |                       |
    | 1                     |
    v                       |
  [expense_splits] N -------+
```

---

## 📊 Key DBMS Operations Demonstrated

This project is built to demonstrate the core features of a relational database engine. Here is a breakdown of the specific DBMS concepts implemented:

### 1. Data Definition Language (DDL) & Schema Design
- **Constraints**: Relational integrity is enforced using:
  - `PRIMARY KEY` (e.g., composite key on `group_members(group_id, user_id)`).
  - `FOREIGN KEY` references linking tables.
  - `CHECK` constraints (e.g., `amount REAL CHECK(amount > 0)` and `owed_amount REAL CHECK(owed_amount >= 0)`).
  - `UNIQUE` constraints (e.g., `email TEXT UNIQUE`).
- **Cascading Deletes**: `ON DELETE CASCADE` is set on group memberships and expenses so that deleting a group automatically purges all child records, preventing orphaned rows.
- **Restricted Deletes**: `ON DELETE RESTRICT` protects critical transaction ledgers. For example, a user cannot be deleted if they are linked to an active expense split, demonstrating how databases enforce business rules.

### 2. ACID Transactions (Data Manipulation Language - DML)
When creating a shared expense, the database must write to both the `expenses` table (overall amount) and the `expense_splits` table (how much each individual owes). If one write succeeds but the other fails, the database becomes corrupt. 
- **Demo**: The `POST /api/expenses` endpoint wraps these queries in an SQL transaction (`BEGIN TRANSACTION` ... `COMMIT` ... `ROLLBACK`). If any split insertion violates a constraint (e.g., negative amount), the entire operation rolls back to the previous stable state.

### 3. Aggregations, Joins & Views
Instead of performing complex math in the application layer, the project offloads calculations to the SQLite database engine using **Joins** and **Aggregations**:
- **Aggregation Views**:
  - `v_total_paid`: Computes total paid by user per group.
  - `v_total_owed`: Computes total owed by user per group.
  - `v_total_settled_paid` & `v_total_settled_received`: Sums up payments recorded during settlement.
- **Outer Joins**: `v_group_balances` joins the above views with `group_members` using a `LEFT JOIN` and `COALESCE` to display the net balance:
  `Net Balance = (Total Paid) - (Total Owed) + (Settled Paid) - (Settled Received)`

### 4. Database Indexing & Query Optimizations
To speed up queries that join tables on foreign keys, indexes are created:
- `CREATE INDEX idx_expense_splits_user ON expense_splits(user_id);`
- `CREATE INDEX idx_group_members_user ON group_members(user_id);`
- **Execution Plans**: The DBMS console executes `EXPLAIN QUERY PLAN` for each database action and prints out the results so you can see exactly when the optimizer performs an index search (`SEARCH TABLE USING INDEX`) versus a full table scan (`SCAN TABLE`).

### 5. Custom SQL Playground
Includes an in-app console that allows you to execute raw SQL commands directly on the live database. It handles:
- Running `SELECT` queries and displaying the output dataset in a dynamic HTML table.
- Displaying execution times in milliseconds.
- Displaying the Query Plan generated by the SQLite optimizer.

---

## 🎓 Step-by-Step Presentation Script (For Evaluators)

When demonstrating this project to a professor or evaluator, follow these steps to showcase the DBMS operations:

### Step 1: Initialize the Database
- Show the evaluator the empty or initial screen.
- Click **"⚡ Reset & Seed Database"**. 
- **Point out**: The **DBMS Engine Console** in the right panel. It will show the execution of `schema.sql` which dropped existing tables, created the relational schema, configured foreign keys (`PRAGMA foreign_keys = ON;`), and loaded initial data.

### Step 2: Show Data Integrity Constraints
- Go to the **Users** section on the left. Find a user (e.g., Alice Smith) and click the `×` delete button.
- An alert will pop up: `DB Integrity Restriction: foreign key mismatch / RESTRICT constraint failed`.
- **Explain**: "Because Alice has posted expenses in the system, deleting her is blocked by the database's `ON DELETE RESTRICT` constraint, protecting our ledger from orphaned records."
- Next, add a new temporary user, add them to a group, and delete them. Show that it succeeds because they have no active financial records.

### Step 3: Show ACID Transactions in Action
- Select the group **"Roommates 301"** from the **Active Group Context** dropdown.
- Look at the **Add Expense** form. Fill in:
  - Description: `House Cleaning`
  - Amount: `150`
  - Paid By: `Alice Smith`
- Make sure "Split Equally" is checked.
- Click **"Post Expense & Write Splits"**.
- Go to the **DBMS Engine Console** (right panel) and scroll to the top of the **SQL Execution Log**.
- **Point out**: The database logged the statements in sequence:
  1. `BEGIN TRANSACTION`
  2. `INSERT INTO expenses ...`
  3. Multiple `INSERT INTO expense_splits ...` (one for each member in the group).
  4. `COMMIT TRANSACTION`
- **Explain**: "If the server went down or any database constraint failed halfway through inserting splits, the database would automatically rollback, ensuring atomic operations."

### Step 4: Show Complex Joins and Views
- Point to the **Group Balances** card in the center panel.
- **Explain**: "These net balances (e.g., Alice gets back $60, Bob owes $20) are calculated in real time by the database. The application runs `SELECT * FROM v_group_balances WHERE group_id = ?`. This is a database **View** which performs aggregations, sums, and outer joins behind the scenes, keeping our application logic simple."

### Step 5: Settle Up and Update Ledger
- Notice the **Debt Simplification** section: it tells you exactly who owes whom (e.g., `Bob owes Alice $20.00`).
- Go to the **Settle Up Balance** form. Set:
  - Payer: `Bob Jones`
  - Payee: `Alice Smith`
  - Amount: `20`
- Click **Record Settlement**.
- Show the evaluator that the balances have updated (Bob's balance is updated in real-time) and the settlement log lists the transactions.

### Step 6: Use the SQL Playground
- Click the **"📝 SQL Playground"** tab in the DBMS Engine Console.
- Click the quick-query button **"Splits"** or type:
  ```sql
  SELECT * FROM expense_splits WHERE owed_amount > 20;
  ```
- Click **"▶ Run Query"**.
- Show the evaluator the output dataset loaded into the table.
- **Explain**: "We also display the Query Plan. In this case, it shows `SEARCH TABLE expense_splits USING INDEX idx_expense_splits_user`, showing that the database is utilizing our index to optimize query execution instead of doing a slow full table scan."
