// Splitwise DBMS Project - Frontend Script

document.addEventListener('DOMContentLoaded', () => {
    // STATE VARIABLES
    let activeGroupId = null;
    let usersList = [];
    let groupsList = [];
    let groupMembers = [];

    // DOM ELEMENTS
    const btnResetDb = document.getElementById('btn-reset-db');
    const btnViewSchema = document.getElementById('btn-view-schema');
    const btnCloseSchema = document.getElementById('btn-close-schema');
    const schemaModal = document.getElementById('schema-modal');
    const schemaCodeBlock = document.getElementById('schema-code-block');

    const formUser = document.getElementById('form-user');
    const formGroup = document.getElementById('form-group');
    const formMember = document.getElementById('form-member');
    const formExpense = document.getElementById('form-expense');
    const formSettle = document.getElementById('form-settle');

    const tableUsersBody = document.querySelector('#table-users tbody');
    const tableGroupsBody = document.querySelector('#table-groups tbody');
    const selectMemberGroup = document.getElementById('select-member-group');
    const selectMemberUser = document.getElementById('select-member-user');
    const selectActiveGroup = document.getElementById('select-active-group');
    const groupMembersList = document.getElementById('group-members-list');

    const groupDetailsArea = document.getElementById('group-details-area');
    const groupEmptyPlaceholder = document.getElementById('group-empty-placeholder');
    const balancesList = document.getElementById('balances-list');
    const simplificationList = document.getElementById('simplification-list');

    const expensePayer = document.getElementById('expense-payer');
    const expenseAmount = document.getElementById('expense-amount');
    const expenseSplitEqual = document.getElementById('expense-split-equal');
    const splitsContainer = document.getElementById('splits-container');

    const settlePayer = document.getElementById('settle-payer');
    const settlePayee = document.getElementById('settle-payee');
    const settleAmount = document.getElementById('settle-amount');

    const tabExpensesBtn = document.getElementById('tab-expenses-btn');
    const tabSettlementsBtn = document.getElementById('tab-settlements-btn');
    const ledgerExpensesList = document.getElementById('ledger-expenses-list');
    const ledgerSettlementsList = document.getElementById('ledger-settlements-list');

    const tabSqlLogsBtn = document.getElementById('tab-sql-logs-btn');
    const tabPlaygroundBtn = document.getElementById('tab-playground-btn');
    const consoleSqlLogs = document.getElementById('console-sql-logs');
    const consolePlayground = document.getElementById('console-playground');
    const sqlLogsContainer = document.getElementById('sql-logs-container');
    const btnClearLogs = document.getElementById('btn-clear-logs');

    const sqlQueryInput = document.getElementById('sql-query-input');
    const btnRunQuery = document.getElementById('btn-run-query');
    const playgroundResultArea = document.getElementById('playground-result-area');
    const queryStatusIndicator = document.getElementById('query-status-indicator');
    const queryMetaStats = document.getElementById('query-meta-stats');
    const queryExplainPlan = document.getElementById('query-explain-plan');
    const playgroundResultsTable = document.getElementById('playground-results-table');

    // INITIALIZATION
    initApp();

    function initApp() {
        fetchUsers();
        fetchGroups();
        fetchSqlLogs();
        setupEventListeners();
        renderGroupContext();
        // Periodically poll for database logs
        setInterval(fetchSqlLogs, 4000);
    }

    // --- EVENT LISTENERS ---
    function setupEventListeners() {
        // Schema view modal
        btnViewSchema.addEventListener('click', openSchemaModal);
        btnCloseSchema.addEventListener('click', () => schemaModal.classList.add('hidden'));
        schemaModal.addEventListener('click', (e) => {
            if (e.target === schemaModal) schemaModal.classList.add('hidden');
        });

        // Reset Database
        btnResetDb.addEventListener('click', resetDatabase);

        // Forms
        formUser.addEventListener('submit', createUser);
        formGroup.addEventListener('submit', createGroup);
        formMember.addEventListener('submit', addMemberToGroup);
        formExpense.addEventListener('submit', postExpense);
        formSettle.addEventListener('submit', recordSettlement);

        // Group Selector Changed
        selectActiveGroup.addEventListener('click', () => {}); // Handle selection
        selectActiveGroup.addEventListener('change', (e) => {
            activeGroupId = e.target.value ? parseInt(e.target.value) : null;
            renderGroupContext();
        });

        // Split Equally Logic
        expenseSplitEqual.addEventListener('change', toggleSplitEqually);
        expenseAmount.addEventListener('input', recalculateEqualSplits);

        // Ledger Tabs
        tabExpensesBtn.addEventListener('click', () => toggleTab('ledger', 'expenses'));
        tabSettlementsBtn.addEventListener('click', () => toggleTab('ledger', 'settlements'));

        // Console Tabs
        tabSqlLogsBtn.addEventListener('click', () => toggleTab('console', 'logs'));
        tabPlaygroundBtn.addEventListener('click', () => toggleTab('console', 'playground'));

        // Clear view logs button
        btnClearLogs.addEventListener('click', () => {
            sqlLogsContainer.innerHTML = '<p class="placeholder-text">Logs cleared from screen view.</p>';
        });

        // Quick SQL templates
        document.querySelectorAll('.btn-quick-sql').forEach(btn => {
            btn.addEventListener('click', (e) => {
                sqlQueryInput.value = e.target.getAttribute('data-sql');
                sqlQueryInput.focus();
            });
        });

        // Run query playground
        btnRunQuery.addEventListener('click', runCustomSQL);
    }

    // --- CORE API SERVICES ---
    
    // Fetch users list
    async function fetchUsers() {
        try {
            const res = await fetch('/api/users');
            usersList = await res.json();
            renderUsers();
            populateDropdowns();
        } catch (e) {
            console.error('Error fetching users:', e);
        }
    }

    // Create a new user
    async function createUser(e) {
        e.preventDefault();
        const name = document.getElementById('user-name').value;
        const email = document.getElementById('user-email').value;

        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email })
            });
            const data = await res.json();
            if (data.error) {
                alert(`DB Error: ${data.error}`);
            } else {
                formUser.reset();
                fetchUsers();
                fetchSqlLogs();
            }
        } catch (err) {
            alert('Failed to insert user.');
        }
    }

    // Delete user
    async function deleteUser(id) {
        if (!confirm('Are you sure you want to delete this user? (This will cascade delete memberships but fail if user has paid expenses)')) return;
        try {
            const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.error) {
                alert(`DB Integrity Restriction: ${data.error}\n\nReason: Relational constraints block deleting users who are linked to existing expenses or settlements.`);
            } else {
                fetchUsers();
                if (activeGroupId) renderGroupContext();
                fetchSqlLogs();
            }
        } catch (err) {
            alert('Failed to delete user.');
        }
    }

    // Fetch groups list
    async function fetchGroups() {
        try {
            const res = await fetch('/api/groups');
            groupsList = await res.json();
            renderGroups();
            populateDropdowns();
        } catch (e) {
            console.error('Error fetching groups:', e);
        }
    }

    // Create a new group
    async function createGroup(e) {
        e.preventDefault();
        const name = document.getElementById('group-name').value;
        const description = document.getElementById('group-desc').value;

        try {
            const res = await fetch('/api/groups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description })
            });
            const data = await res.json();
            if (data.error) {
                alert(`DB Error: ${data.error}`);
            } else {
                formGroup.reset();
                fetchGroups();
                fetchSqlLogs();
            }
        } catch (err) {
            alert('Failed to create group.');
        }
    }

    // Delete group
    async function deleteGroup(id) {
        if (!confirm('Are you sure you want to delete this group? (All expenses, splits, and settlements inside it will be CASCADE deleted)')) return;
        try {
            const res = await fetch(`/api/groups/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.error) {
                alert(`DB Error: ${data.error}`);
            } else {
                fetchGroups();
                if (activeGroupId === id) {
                    activeGroupId = null;
                    selectActiveGroup.value = "";
                    renderGroupContext();
                }
                fetchSqlLogs();
            }
        } catch (err) {
            alert('Failed to delete group.');
        }
    }

    // Add member to group
    async function addMemberToGroup(e) {
        e.preventDefault();
        const groupId = parseInt(selectMemberGroup.value);
        const userId = parseInt(selectMemberUser.value);

        try {
            const res = await fetch('/api/members', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupId, userId })
            });
            const data = await res.json();
            if (data.error) {
                alert(`DB Exception (Unique/FK Violation): ${data.error}`);
            } else {
                formMember.reset();
                fetchSqlLogs();
                if (activeGroupId === groupId) {
                    renderGroupContext();
                } else {
                    // Update current list view if selected
                    selectMemberGroup.value = groupId;
                    loadGroupMembers(groupId);
                }
            }
        } catch (err) {
            alert('Failed to add member.');
        }
    }

    // Load and render active group info
    async function renderGroupContext() {
        if (!activeGroupId) {
            groupDetailsArea.classList.add('hidden');
            groupEmptyPlaceholder.classList.remove('hidden');
            return;
        }

        groupDetailsArea.classList.remove('hidden');
        groupDetailsArea.classList.remove('disabled-state');
        groupEmptyPlaceholder.classList.add('hidden');

        // Fetch group memberships first
        await loadGroupMembers(activeGroupId);
        
        // Fetch balances, expenses, settlements
        fetchGroupBalances();
        fetchGroupExpenses();
        fetchGroupSettlements();
        fetchSqlLogs();
    }

    async function loadGroupMembers(groupId) {
        try {
            const res = await fetch(`/api/members?groupId=${groupId}`);
            const data = await res.json();
            
            // Render chips
            groupMembersList.innerHTML = '';
            if (!data || data.error || !Array.isArray(data) || data.length === 0) {
                groupMembersList.innerHTML = `<p class="placeholder-text">${data?.error || 'This group has no members yet. Add some above!'}</p>`;
                groupMembers = [];
            } else {
                groupMembers = data;
                groupMembers.forEach(m => {
                    const chip = document.createElement('span');
                    chip.className = 'member-chip';
                    chip.innerText = m.name;
                    groupMembersList.appendChild(chip);
                });
            }

            // Populate forms dropdowns
            populateGroupContextDropdowns();
            renderSplitsCheckboxes();
        } catch (e) {
            console.error('Error loading group members:', e);
            groupMembers = [];
        }
    }

    async function fetchGroupBalances() {
        try {
            const res = await fetch(`/api/balances?groupId=${activeGroupId}`);
            const balances = await res.json();
            
            // Render balances grid
            balancesList.innerHTML = '';
            if (!balances || balances.error || !Array.isArray(balances) || balances.length === 0) {
                balancesList.innerHTML = `<p class="placeholder-text">${balances?.error || 'No balances computed. Post some expenses to calculate.'}</p>`;
                simplificationList.innerHTML = '<p class="placeholder-text">No balances to simplify.</p>';
                return;
            }

            balances.forEach(b => {
                const balItem = document.createElement('div');
                let cardClass = 'settled';
                let symbol = '';
                let label = 'Settled Up';
                
                if (b.net_balance > 0.01) {
                    cardClass = 'credit';
                    symbol = '+';
                    label = 'Gets back';
                } else if (b.net_balance < -0.01) {
                    cardClass = 'debt';
                    symbol = '-';
                    label = 'Owes';
                }

                balItem.className = `balance-item ${cardClass}`;
                balItem.innerHTML = `
                    <div class="user-name">${b.user_name}</div>
                    <div class="section-desc">${label}</div>
                    <div class="amount">${symbol}$${Math.abs(b.net_balance).toFixed(2)}</div>
                `;
                balancesList.appendChild(balItem);
            });

            // Calculate debt simplification (Splitwise transaction minimizer)
            calculateDebtSimplification(balances);
        } catch (e) {
            console.error('Error fetching balances:', e);
        }
    }

    // Debt Simplification Algorithm
    function calculateDebtSimplification(balances) {
        simplificationList.innerHTML = '';

        // Separate debtors and creditors
        const debtors = balances
            .filter(b => b.net_balance < -0.01)
            .map(b => ({ ...b, balance: Math.abs(b.net_balance) }))
            .sort((a, b) => b.balance - a.balance); // sort descending

        const creditors = balances
            .filter(b => b.net_balance > 0.01)
            .map(b => ({ ...b, balance: b.net_balance }))
            .sort((a, b) => b.balance - a.balance); // sort descending

        if (debtors.length === 0 || creditors.length === 0) {
            simplificationList.innerHTML = '<div class="suggestion-row" style="border-style: solid; text-align: center;"><p style="width:100%; color: var(--color-emerald)">✔ All debts are settled up in this group!</p></div>';
            return;
        }

        const settlements = [];
        let dIdx = 0;
        let cIdx = 0;

        // Greedy matching of largest debtors with largest creditors
        while (dIdx < debtors.length && cIdx < creditors.length) {
            const debtor = debtors[dIdx];
            const creditor = creditors[cIdx];

            if (debtor.balance < 0.01) { dIdx++; continue; }
            if (creditor.balance < 0.01) { cIdx++; continue; }

            const amountToSettle = Math.min(debtor.balance, creditor.balance);
            settlements.push({
                debtor: debtor.user_name,
                creditor: creditor.user_name,
                amount: amountToSettle
            });

            debtor.balance -= amountToSettle;
            creditor.balance -= amountToSettle;

            if (debtor.balance < 0.01) dIdx++;
            if (creditor.balance < 0.01) cIdx++;
        }

        settlements.forEach(s => {
            const row = document.createElement('div');
            row.className = 'suggestion-row';
            row.innerHTML = `
                <div class="suggestion-text">
                    <span class="debtor">${s.debtor}</span> owes <span class="creditor">${s.creditor}</span>
                </div>
                <div class="suggestion-amount">$${s.amount.toFixed(2)}</div>
            `;
            simplificationList.appendChild(row);
        });
    }

    async function fetchGroupExpenses() {
        try {
            const res = await fetch(`/api/expenses?groupId=${activeGroupId}`);
            const expenses = await res.json();
            
            ledgerExpensesList.innerHTML = '';
            if (!expenses || expenses.error || !Array.isArray(expenses) || expenses.length === 0) {
                ledgerExpensesList.innerHTML = `<p class="placeholder-text" style="padding: 1rem">${expenses?.error || 'No expenses recorded yet.'}</p>`;
                return;
            }

            expenses.forEach(e => {
                const item = document.createElement('div');
                item.className = 'ledger-item';
                
                // Construct split details text
                const splitsText = e.splits && Array.isArray(e.splits) 
                    ? e.splits.map(s => `${s.user_name}: $${s.owed_amount.toFixed(2)}`).join(', ') 
                    : 'None';

                item.innerHTML = `
                    <div class="ledger-item-left">
                        <div class="ledger-item-title">${e.description}</div>
                        <div class="ledger-item-subtitle">Paid by ${e.paid_by_name} • Splits: ${splitsText}</div>
                    </div>
                    <div class="ledger-item-right">
                        <span class="ledger-item-amount" style="color: var(--text-primary)">$${e.amount.toFixed(2)}</span>
                        <button class="delete-btn" data-id="${e.id}">&times;</button>
                    </div>
                `;
                
                // Add delete handler
                item.querySelector('.delete-btn').addEventListener('click', (ev) => {
                    deleteExpense(ev.target.getAttribute('data-id'));
                });

                ledgerExpensesList.appendChild(item);
            });
        } catch (e) {
            console.error('Error fetching expenses:', e);
        }
    }

    async function deleteExpense(expenseId) {
        if (!confirm('Are you sure you want to delete this expense? (This DML command will automatically cascade delete splits)')) return;
        try {
            const res = await fetch(`/api/expenses/${expenseId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.error) {
                alert(`DB Error: ${data.error}`);
            } else {
                renderGroupContext();
            }
        } catch (err) {
            alert('Failed to delete expense.');
        }
    }

    async function fetchGroupSettlements() {
        try {
            const res = await fetch(`/api/settlements?groupId=${activeGroupId}`);
            const settlements = await res.json();
            
            ledgerSettlementsList.innerHTML = '';
            if (!settlements || settlements.error || !Array.isArray(settlements) || settlements.length === 0) {
                ledgerSettlementsList.innerHTML = `<p class="placeholder-text" style="padding: 1rem">${settlements?.error || 'No settlements recorded yet.'}</p>`;
                return;
            }

            settlements.forEach(s => {
                const item = document.createElement('div');
                item.className = 'ledger-item';
                item.innerHTML = `
                    <div class="ledger-item-left">
                        <div class="ledger-item-title">${s.payer_name} settled up with ${s.payee_name}</div>
                        <div class="ledger-item-subtitle">${new Date(s.settled_at).toLocaleString()}</div>
                    </div>
                    <div class="ledger-item-right">
                        <span class="ledger-item-amount" style="color: var(--color-emerald)">$${s.amount.toFixed(2)}</span>
                    </div>
                `;
                ledgerSettlementsList.appendChild(item);
            });
        } catch (e) {
            console.error('Error fetching settlements:', e);
        }
    }

    // Post expense (Transaction demo!)
    async function postExpense(e) {
        e.preventDefault();
        const description = document.getElementById('expense-desc').value;
        const amount = parseFloat(expenseAmount.value);
        const paidById = parseInt(expensePayer.value);

        // Gather splits
        const splits = [];
        const splitRows = splitsContainer.querySelectorAll('.split-row');
        splitRows.forEach(row => {
            const chk = row.querySelector('.split-member-check');
            const inp = row.querySelector('.split-member-share');
            if (chk.checked) {
                splits.push({
                    userId: parseInt(chk.getAttribute('data-userid')),
                    owedAmount: parseFloat(inp.value) || 0
                });
            }
        });

        if (splits.length === 0) {
            alert('Please select at least one user to split the expense with!');
            return;
        }

        // Validate splits sum equals amount
        const splitsSum = splits.reduce((sum, s) => sum + s.owedAmount, 0);
        if (Math.abs(splitsSum - amount) > 0.01) {
            alert(`Validation Error:\nThe sum of splits ($${splitsSum.toFixed(2)}) must equal the total expense amount ($${amount.toFixed(2)}).\nDifference: $${(amount - splitsSum).toFixed(2)}`);
            return;
        }

        try {
            const res = await fetch('/api/expenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    groupId: activeGroupId,
                    paidById,
                    description,
                    amount,
                    splits
                })
            });
            const data = await res.json();
            if (data.error) {
                alert(`DB Transaction Failed & Rolled Back:\n${data.error}`);
            } else {
                formExpense.reset();
                expenseSplitEqual.checked = true;
                renderGroupContext();
            }
        } catch (err) {
            alert('Server error posting transaction.');
        }
    }

    // Record settlement
    async function recordSettlement(e) {
        e.preventDefault();
        const payerId = parseInt(settlePayer.value);
        const payeeId = parseInt(settlePayee.value);
        const amount = parseFloat(settleAmount.value);

        if (payerId === payeeId) {
            alert('Payer and Payee must be different users.');
            return;
        }

        try {
            const res = await fetch('/api/settlements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    groupId: activeGroupId,
                    payerId,
                    payeeId,
                    amount
                })
            });
            const data = await res.json();
            if (data.error) {
                alert(`DB Error: ${data.error}`);
            } else {
                formSettle.reset();
                renderGroupContext();
            }
        } catch (err) {
            alert('Failed to write settlement record.');
        }
    }

    // Reset & Seed database
    async function resetDatabase() {
        if (!confirm('Are you sure you want to drop and re-create all tables, views, and seed initial data? This will clear all your active changes.')) return;
        try {
            const res = await fetch('/api/db/reset', { method: 'POST' });
            const data = await res.json();
            alert(data.message || 'Database reset successfully!');
            activeGroupId = null;
            selectActiveGroup.value = "";
            initApp();
            renderGroupContext();
        } catch (e) {
            alert('Reset command failed.');
        }
    }

    // --- SCHEMA MODAL WINDOW ---
    async function openSchemaModal() {
        try {
            const res = await fetch('/api/db/schema');
            const data = await res.json();
            schemaCodeBlock.textContent = data.schema;
            schemaModal.classList.remove('hidden');
        } catch (e) {
            alert('Could not retrieve schema definitions.');
        }
    }

    // --- FETCH SQL EXECUTION LOGS ---
    async function fetchSqlLogs() {
        try {
            const res = await fetch('/api/db/logs');
            const logs = await res.json();
            
            // Render logs in console feed
            // Compare if anything changed to avoid redrawing if nothing updated
            if (logs.length === 0) {
                sqlLogsContainer.innerHTML = '<p class="placeholder-text">Database is idle. Perform some actions to view SQL statements.</p>';
                return;
            }

            sqlLogsContainer.innerHTML = '';
            logs.forEach(log => {
                const logDiv = document.createElement('div');
                logDiv.className = `log-item ${log.success ? '' : 'fail'}`;

                // Extract query type class
                const cleanSql = log.sql.toUpperCase();
                let typePill = 'QUERY';
                let pillClass = 'select';
                
                if (cleanSql.startsWith('SELECT')) {
                    typePill = 'SELECT';
                    pillClass = 'select';
                } else if (cleanSql.startsWith('INSERT')) {
                    typePill = 'INSERT';
                    pillClass = 'insert';
                } else if (cleanSql.startsWith('UPDATE')) {
                    typePill = 'UPDATE';
                    pillClass = 'update';
                } else if (cleanSql.startsWith('DELETE')) {
                    typePill = 'DELETE';
                    pillClass = 'delete';
                } else if (cleanSql.includes('TRANSACTION') || cleanSql.startsWith('BEGIN') || cleanSql.startsWith('COMMIT') || cleanSql.startsWith('ROLLBACK')) {
                    typePill = 'ACID';
                    pillClass = 'transaction';
                }

                if (!log.success) {
                    typePill = 'ERROR';
                    pillClass = 'error';
                }

                const paramsText = log.params && log.params.length ? `Parameters: [${log.params.join(', ')}]` : '';
                const explainText = log.plan && log.plan !== 'N/A' ? `Explain Plan:\n${log.plan}` : '';

                logDiv.innerHTML = `
                    <div class="log-meta">
                        <span class="log-pill ${pillClass}">${typePill}</span>
                        <span class="log-duration">${log.durationMs}ms</span>
                    </div>
                    <div class="log-sql">${log.sql}</div>
                    ${paramsText ? `<div class="log-params">${paramsText}</div>` : ''}
                    ${explainText ? `<div class="log-explain">${explainText}</div>` : ''}
                    ${log.errorMsg ? `<div class="log-error-detail">⚠️ DB Error: ${log.errorMsg}</div>` : ''}
                `;
                sqlLogsContainer.appendChild(logDiv);
            });
        } catch (e) {
            console.error('Error fetching SQL logs:', e);
        }
    }

    // --- SQL PLAYGROUND SQL EXECUTOR ---
    async function runCustomSQL() {
        const sql = sqlQueryInput.value.trim();
        if (!sql) return alert('Please enter an SQL statement to run.');

        btnRunQuery.disabled = true;
        btnRunQuery.innerText = 'Running...';
        playgroundResultArea.classList.add('hidden');

        try {
            const res = await fetch('/api/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sql })
            });
            const data = await res.json();

            playgroundResultArea.classList.remove('hidden');
            fetchSqlLogs(); // instantly fetch logs which includes the explain statement

            if (!data.success) {
                queryStatusIndicator.className = 'error';
                queryStatusIndicator.innerText = '❌ Error';
                queryMetaStats.innerText = `Runtime exception`;
                queryExplainPlan.innerText = 'N/A (Invalid statement syntax)';
                playgroundResultsTable.querySelector('thead').innerHTML = '';
                playgroundResultsTable.querySelector('tbody').innerHTML = `<tr><td style="color: var(--color-rose); font-family: monospace;">${data.error}</td></tr>`;
            } else {
                queryStatusIndicator.className = 'success';
                queryStatusIndicator.innerText = '✔ Success';
                
                // Explaining query plan for playground
                // Fetch the logs and check the topmost plan
                const logRes = await fetch('/api/db/logs');
                const logs = await logRes.json();
                const currentLog = logs.find(l => l.sql === sql);
                queryExplainPlan.innerText = currentLog && currentLog.plan ? currentLog.plan : 'N/A (Non-explainable statement)';

                if (data.isSelect) {
                    const rows = data.results;
                    queryMetaStats.innerText = `${rows.length} rows returned in ${data.durationMs}ms`;
                    
                    // Render headers
                    const thead = playgroundResultsTable.querySelector('thead');
                    const tbody = playgroundResultsTable.querySelector('tbody');
                    thead.innerHTML = '';
                    tbody.innerHTML = '';

                    if (rows.length === 0) {
                        tbody.innerHTML = '<tr><td class="placeholder-text">Empty result set (0 rows matches query)</td></tr>';
                    } else {
                        const headers = Object.keys(rows[0]);
                        const hr = document.createElement('tr');
                        headers.forEach(h => {
                            const th = document.createElement('th');
                            th.innerText = h;
                            hr.appendChild(th);
                        });
                        thead.appendChild(hr);

                        rows.forEach(row => {
                            const tr = document.createElement('tr');
                            headers.forEach(h => {
                                const td = document.createElement('td');
                                td.innerText = row[h] !== null ? row[h] : 'NULL';
                                tr.appendChild(td);
                            });
                            tbody.appendChild(tr);
                        });
                    }
                } else {
                    queryMetaStats.innerText = `Statement OK, ${data.changes} rows affected, lastInsertRowid: ${data.lastInsertRowid} (${data.durationMs}ms)`;
                    playgroundResultsTable.querySelector('thead').innerHTML = '';
                    playgroundResultsTable.querySelector('tbody').innerHTML = `
                        <tr><td style="color: var(--color-emerald)">DML Command execution succeeded.</td></tr>
                        <tr><td style="color: var(--text-muted)">Rows updated/inserted/deleted: ${data.changes}</td></tr>
                        <tr><td style="color: var(--text-muted)">Last inserted row index: ${data.lastInsertRowid || 'N/A'}</td></tr>
                    `;
                    // Reload context since database state changed
                    if (activeGroupId) renderGroupContext();
                    fetchUsers();
                    fetchGroups();
                }
            }
        } catch (err) {
            alert('Network error running custom SQL.');
        } finally {
            btnRunQuery.disabled = false;
            btnRunQuery.innerText = '▶ Run Query';
        }
    }

    // --- HTML RENDERING & DROPDOWN POPULATOR ---
    
    function renderUsers() {
        tableUsersBody.innerHTML = '';
        usersList.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${u.id}</td>
                <td><strong>${u.name}</strong></td>
                <td>${u.email}</td>
                <td><button class="delete-btn" onclick="return false;">&times;</button></td>
            `;
            tr.querySelector('.delete-btn').addEventListener('click', () => deleteUser(u.id));
            tableUsersBody.appendChild(tr);
        });
    }

    function renderGroups() {
        tableGroupsBody.innerHTML = '';
        groupsList.forEach(g => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${g.id}</td>
                <td><strong>${g.name}</strong></td>
                <td>${g.description || '<em class="placeholder-text">None</em>'}</td>
                <td><button class="delete-btn" onclick="return false;">&times;</button></td>
            `;
            tr.querySelector('.delete-btn').addEventListener('click', () => deleteGroup(g.id));
            tableGroupsBody.appendChild(tr);
        });
    }

    function populateDropdowns() {
        // 1. Group members form selector
        const prevGroup = selectMemberGroup.value;
        selectMemberGroup.innerHTML = '<option value="">-- Select Group --</option>';
        groupsList.forEach(g => {
            selectMemberGroup.innerHTML += `<option value="${g.id}">${g.name}</option>`;
        });
        selectMemberGroup.value = prevGroup;

        // 2. Group members user selector
        const prevUser = selectMemberUser.value;
        selectMemberUser.innerHTML = '<option value="">-- Select User --</option>';
        usersList.forEach(u => {
            selectMemberUser.innerHTML += `<option value="${u.id}">${u.name} (${u.email})</option>`;
        });
        selectMemberUser.value = prevUser;

        // 3. Active group dashboard selector
        selectActiveGroup.innerHTML = '<option value="">-- Choose a group to analyze --</option>';
        groupsList.forEach(g => {
            selectActiveGroup.innerHTML += `<option value="${g.id}">${g.name}</option>`;
        });
        if (activeGroupId && groupsList.some(g => g.id === activeGroupId)) {
            selectActiveGroup.value = activeGroupId;
        } else {
            selectActiveGroup.value = '';
            activeGroupId = null;
        }
    }

    function populateGroupContextDropdowns() {
        // Payer in expense form
        expensePayer.innerHTML = '<option value="">-- Who Paid? --</option>';
        groupMembers.forEach(m => {
            expensePayer.innerHTML += `<option value="${m.id}">${m.name}</option>`;
        });

        // Settle payer and payee
        settlePayer.innerHTML = '<option value="">-- Select Payer --</option>';
        settlePayee.innerHTML = '<option value="">-- Select Payee --</option>';
        groupMembers.forEach(m => {
            settlePayer.innerHTML += `<option value="${m.id}">${m.name}</option>`;
            settlePayee.innerHTML += `<option value="${m.id}">${m.name}</option>`;
        });
    }

    // Render checkbox list for splits
    function renderSplitsCheckboxes() {
        splitsContainer.innerHTML = '';
        if (groupMembers.length === 0) {
            splitsContainer.innerHTML = '<p class="placeholder-text">Add members to this group first.</p>';
            return;
        }

        groupMembers.forEach(m => {
            const div = document.createElement('div');
            div.className = 'split-row';
            div.innerHTML = `
                <label class="checkbox-container">
                    <input type="checkbox" class="split-member-check" data-userid="${m.id}" checked>
                    <span class="checkmark"></span>
                    ${m.name}
                </label>
                <input type="number" class="split-member-share" step="0.01" min="0" placeholder="0.00">
            `;
            
            // Recalculate on click of checkbox
            div.querySelector('.split-member-check').addEventListener('change', () => {
                if (expenseSplitEqual.checked) {
                    recalculateEqualSplits();
                }
            });

            // Recalculate if user edits share manually (auto-disable Equal split)
            div.querySelector('.split-member-share').addEventListener('input', () => {
                if (expenseSplitEqual.checked) {
                    expenseSplitEqual.checked = false;
                    toggleSplitEqually();
                }
            });

            splitsContainer.appendChild(div);
        });

        recalculateEqualSplits();
    }

    function toggleSplitEqually() {
        const isEqual = expenseSplitEqual.checked;
        const shares = splitsContainer.querySelectorAll('.split-member-share');
        shares.forEach(s => {
            s.readOnly = isEqual;
        });
        if (isEqual) {
            recalculateEqualSplits();
        }
    }

    function recalculateEqualSplits() {
        if (!expenseSplitEqual.checked) return;
        
        const amount = parseFloat(expenseAmount.value) || 0;
        const checkedBoxes = splitsContainer.querySelectorAll('.split-member-check:checked');
        const count = checkedBoxes.length;

        const shares = splitsContainer.querySelectorAll('.split-member-share');
        shares.forEach(s => s.value = '');

        if (count === 0 || amount === 0) return;

        const equalShare = amount / count;
        // Float handling to make sure sum equals amount perfectly:
        // We round down to 2 decimals for all except the last one, which gets the remainder.
        let allocated = 0;
        const roundedShare = Math.floor(equalShare * 100) / 100;
        
        checkedBoxes.forEach((chk, index) => {
            const row = chk.closest('.split-row');
            const inp = row.querySelector('.split-member-share');
            
            if (index === count - 1) {
                // Last checkbox gets the remainder to prevent precision loss
                const remainder = amount - allocated;
                inp.value = remainder.toFixed(2);
            } else {
                inp.value = roundedShare.toFixed(2);
                allocated += roundedShare;
            }
        });
    }

    // --- TAB TOGGLE CONTROLLER ---
    function toggleTab(system, tab) {
        if (system === 'ledger') {
            tabExpensesBtn.classList.toggle('active', tab === 'expenses');
            tabSettlementsBtn.classList.toggle('active', tab === 'settlements');
            ledgerExpensesList.classList.toggle('active', tab === 'expenses');
            ledgerSettlementsList.classList.toggle('active', tab === 'settlements');
        } else if (system === 'console') {
            tabSqlLogsBtn.classList.toggle('active', tab === 'logs');
            tabPlaygroundBtn.classList.toggle('active', tab === 'playground');
            consoleSqlLogs.classList.toggle('active', tab === 'logs');
            consolePlayground.classList.toggle('active', tab === 'playground');
        }
    }
});
