const SUPABASE_URL = "https://supabase.co";
const SUPABASE_KEY = "sb_publishable_Uh7k-VG0YDuMxcvLbZmbog_006UtmzW";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let gymRegistryBook = [], activePrintMode = "All", targetPrintDate = "";

async function initDashboard() {
    document.getElementById('datePaid').value = new Date().toISOString().split('T')[0];
    await downloadCloudData();
    calculateAutoPrice();
}

async function downloadCloudData() {
    let { data: book } = await supabaseClient.from('springfield_gym_book').select('*').order('created_at', { ascending: false });
    if (book) gymRegistryBook = book;
    await renderLogBook();
}

function calculateAutoPrice() {
    const g = document.getElementById('gender').value, t = document.getElementById('trainerOpt').value, p = document.getElementById('paymentPlan').value;
    let price = (t === "With Trainer") ? ((p === "Session") ? 100 : (g === "Male" ? 1000 : 1200)) : ((p === "Session") ? 50 : 600);
    document.getElementById('totalDue').value = price; calculateBalance();
}

function calculateBalance() {
    document.getElementById('remainingBalance').value = (Number(document.getElementById('totalDue').value) || 0) - (Number(document.getElementById('amountPaid').value) || 0);
}

function toggleMpesaField() {
    const m = document.getElementById('payMethod').value, g = document.getElementById('mpesaCodeGroup');
    if (m === "M-Pesa") g.classList.remove('hidden'); else { g.classList.add('hidden'); document.getElementById('mpesaCode').value = ''; }
}

function toggleLedgerVisibility() {
    const w = document.getElementById('ledgerTableWrapper'), b = document.getElementById('ledgerAuditButtons'), a = document.getElementById('ledgerToggleArrow');
    if (!w || !b) return;
    if (w.classList.contains('hidden')) { 
        w.classList.remove('hidden'); 
        b.classList.remove('hidden'); 
        if (a) a.classList.add('rotated'); 
    } 
    else { 
        w.classList.add('hidden'); 
        b.classList.add('hidden'); 
        if (a) a.classList.remove('rotated'); 
    }
}

function evaluateFinancialPrintState() {
    if (!document.getElementById('includeTotalsCheckbox').checked) document.body.classList.add('hide-print-totals'); else document.body.classList.remove('hide-print-totals');
}

function cancelEditingSession() {
    document.getElementById('editEntryId').value = ""; document.getElementById('logForm').reset(); document.getElementById('datePaid').value = new Date().toISOString().split('T')[0];
    document.getElementById('formPanelHeading').innerText = "Log Book Entry"; document.getElementById('btnSubmitForm').innerText = "Save To Cloud Book"; document.getElementById('btnCancelEdit').classList.add('hidden'); calculateAutoPrice();
}

async function deleteRegistryRow(id) {
    if (confirm("Are you sure you want to permanently delete this member record?")) { await supabaseClient.from('springfield_gym_book').delete().eq('id', id); await downloadCloudData(); }
}
async function renderLogBook() {
    const tbody = document.getElementById('logTableBody'); if (!tbody) return;
    tbody.innerHTML = '';
    let cash = 0, mpesa = 0, debt = 0, idx = 1;
    const today = new Date(); today.setHours(0,0,0,0);
    gymRegistryBook.forEach(entry => {
        if (activePrintMode === "Daily" && entry.date !== targetPrintDate) return;
        if (activePrintMode === "Monthly" && entry.date.substring(0, 7) !== targetPrintDate.substring(0, 7)) return;
        cash += (entry.method === "Cash") ? Number(entry.paid) : 0; mpesa += (entry.method === "M-Pesa") ? Number(entry.paid) : 0; debt += Number(entry.balance);
        let ren = "";
        if (entry.plan === "Session") { ren = `<span class="badge badge-active">Session Pass</span>`; } 
        else {
            const exp = new Date(entry.date); exp.setDate(exp.getDate() + 30);
            const diff = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
            ren = diff < 0 ? `<span class="badge badge-expired">Expired</span><span class="text-action-required">Add Money</span>` : `<span class="badge badge-active">Active</span><small style="display:block;color:var(--text-muted);">${diff} Days Left</small>`;
        }
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="table-number">${idx}</td><td><div><strong>${entry.name}</strong><small style="display:block;color:var(--text-muted);">Phone: ${entry.phone||'None'}</small></div></td><td><span class="badge ${entry.plan==='Session'?'badge-session':'badge-monthly'}">${entry.plan}</span><small style="display:block;color:var(--text-muted);">${entry.trainer}</small></td><td>Due: ${entry.total}<br>Paid: <strong>${entry.paid}</strong><br><span style="${Number(entry.balance)>0?'color:var(--primary);font-weight:bold;':''}">Bal: ${entry.balance}</span></td><td>${entry.method==='M-Pesa'?`M-Pesa<small style="display:block;color:var(--text-muted);">\${entry.code||'NO CODE'}</small>`:'Cash'}</td><td>${entry.date}</td><td>${ren}</td><td class="no-print"><button class="btn-edit-row" onclick="startEditingSession(${entry.id})">Edit</button><button class="btn-delete-row" onclick="deleteRegistryRow(${entry.id})">Delete</button><button class="btn-print-row" onclick="printSingleReceipt('${entry.name}','${entry.date}',${entry.id})">Receipt</button></td>`;
        tbody.appendChild(tr); idx++;
    });
    const cEl = document.getElementById('totalCashSum'), mEl = document.getElementById('totalMpesaSum'), dEl = document.getElementById('totalDebtSum');
    if (cEl) cEl.innerText = `Ksh ${cash.toLocaleString()}`; 
    if (mEl) mEl.innerText = `Ksh ${mpesa.toLocaleString()}`; 
    if (dEl) dEl.innerText = `Ksh ${debt.toLocaleString()}`;
}

document.getElementById('logForm')?.addEventListener('submit', async (e) => {
    e.preventDefault(); const editId = document.getElementById('editEntryId').value;
    const entryData = { name: document.getElementById('memberName').value.trim(), phone: document.getElementById('phoneNo').value.trim(), gender: document.getElementById('gender').value, trainer: document.getElementById('trainerOpt').value, plan: document.getElementById('paymentPlan').value, method: document.getElementById('payMethod').value, code: document.getElementById('mpesaCode').value.trim(), total: Number(document.getElementById('totalDue').value), paid: Number(document.getElementById('amountPaid').value), balance: Number(document.getElementById('remainingBalance').value), date: document.getElementById('datePaid').value };
    if (editId) { await supabaseClient.from('springfield_gym_book').update(entryData).eq('id', editId); cancelEditingSession(); } 
    else { await supabaseClient.from('springfield_gym_book').insert([entryData]); document.getElementById('memberName').value = ''; document.getElementById('phoneNo').value = ''; document.getElementById('mpesaCode').value = ''; document.getElementById('amountPaid').value = ''; }
    calculateAutoPrice(); await downloadCloudData();
});

function startEditingSession(id) {
    const t = gymRegistryBook.find(r => r.id === id); if (!t) return;
    document.getElementById('editEntryId').value = t.id; document.getElementById('memberName').value = t.name; document.getElementById('phoneNo').value = t.phone; document.getElementById('gender').value = t.gender; document.getElementById('trainerOpt').value = t.trainer; document.getElementById('paymentPlan').value = t.plan; document.getElementById('payMethod').value = t.method; toggleMpesaField(); document.getElementById('mpesaCode').value = t.code; document.getElementById('totalDue').value = t.total; document.getElementById('amountPaid').value = t.paid; document.getElementById('remainingBalance').value = t.balance; document.getElementById('datePaid').value = t.date;
    document.getElementById('formPanelHeading').innerText = "Update Member Record"; document.getElementById('btnSubmitForm').innerText = "Apply Changes"; document.getElementById('btnCancelEdit').classList.remove('hidden'); window.scrollTo({ top: 0, behavior: 'smooth' });
}

function printSingleReceipt(n, d, id) {
    const match = gymRegistryBook.find(r => r.id === id); if (!match) return;
    evaluateFinancialPrintState(); document.title = "Receipt_" + n.replace(/\s+/g, '_') + "_" + d;
    document.getElementById('printReportHeader').innerHTML = `<h2>SPRINGFIELD GYM - RECEIPT FOR ${n.toUpperCase()}</h2><p>Payment Date: ${d} | Print Run: ${new Date().toLocaleDateString()}</p>`;
    const origM = activePrintMode, origL = gymRegistryBook; gymRegistryBook = [match]; activePrintMode = "All"; renderLogBook();
    const w = document.getElementById('ledgerTableWrapper'); const hidden = w.classList.contains('hidden'); if (hidden) w.classList.remove('hidden');
    document.getElementById('inputFormPanel').classList.add('hidden'); window.print();
    if (hidden) w.classList.add('hidden'); document.getElementById('inputFormPanel').classList.remove('hidden');
    document.getElementById('printReportHeader').innerHTML = `<h2>SPRINGFIELD GYM - AUDIT SHEET</h2><p>Report Framework Generated On: <span id="livePrintTimestamp"></span></p>`;
    document.title = "Springfield Gym - Shared System"; gymRegistryBook = origL; activePrintMode = origM; renderLogBook(); document.body.classList.remove('hide-print-totals');
}

function printDailyAudit() {
    const sd = document.getElementById('datePaid').value; if (!sd) return alert("Select a date in the form input box first.");
    evaluateFinancialPrintState(); document.title = "Daily_Audit_" + sd; activePrintMode = "Daily"; targetPrintDate = sd; document.getElementById('livePrintTimestamp').innerText = sd;
    const w = document.getElementById('ledgerTableWrapper'); const hidden = w.classList.contains('hidden'); if (hidden) w.classList.remove('hidden');
    renderLogBook(); window.print(); if (hidden) w.classList.add('hidden'); activePrintMode = "All"; renderLogBook(); document.body.classList.remove('hide-print-totals'); document.title = "Springfield Gym - Shared System";
}

function printMonthlyAudit() {
    const sd = document.getElementById('datePaid').value; if (!sd) return alert("Select a date within the target month first.");
    evaluateFinancialPrintState(); const ym = sd.substring(0, 7); document.title = "Monthly_Audit_" + ym; activePrintMode = "Monthly"; targetPrintDate = sd; document.getElementById('livePrintTimestamp').innerText = "Month View: " + ym;
    const w = document.getElementById('ledgerTableWrapper'); const hidden = w.classList.contains('hidden'); if (hidden) w.classList.remove('hidden');
    renderLogBook(); window.print(); if (hidden) w.classList.add('hidden'); activePrintMode = "All"; renderLogBook(); document.body.classList.remove('hide-print-totals'); document.title = "Springfield Gym - Shared System";
}

document.addEventListener("DOMContentLoaded", () => {
    initDashboard();
    const toggleHeader = document.getElementById("ledgerToggleHeading");
    if (toggleHeader) {
        toggleHeader.style.cursor = "pointer";
        toggleHeader.addEventListener("click", (e) => {
            if (!e.target.closest("#ledgerAuditButtons")) {
                toggleLedgerVisibility();
            }
        });
    }
});
