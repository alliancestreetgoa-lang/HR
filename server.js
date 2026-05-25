// ============================================================
//  Multi-Company HR Management System — Node.js Backend
//  Connects to Neon PostgreSQL via .env DATABASE_URL
// ============================================================
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const fs      = require('fs');
const path    = require('path');

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── DB connection ───────────────────────────────────────────
// Strip unsupported pg params (channel_binding) from the URL
function cleanDbUrl(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    u.searchParams.delete('channel_binding');
    return u.toString();
  } catch { return url; }
}

const pool = new Pool({
  connectionString: cleanDbUrl(process.env.DATABASE_URL),
  ssl: { rejectUnauthorized: false },
});

async function query(sql, params = []) {
  const client = await pool.connect();
  try   { return await client.query(sql, params); }
  finally { client.release(); }
}

// ─── Schema init ─────────────────────────────────────────────
async function initSchema() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  if (!fs.existsSync(schemaPath)) { console.warn('schema.sql not found — skipping'); return; }
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await query(sql);
  console.log('✅ Database schema ready.');
}

// ═════════════════════════════════════════════════════════════
//  COMPANIES
// ═════════════════════════════════════════════════════════════
app.get('/api/companies', async (req, res) => {
  try {
    const r = await query(`
      SELECT c.*,
        (SELECT COUNT(*) FROM employees e WHERE e.company_id = c.id) AS emp_count,
        (SELECT COUNT(*) FROM holidays h WHERE h.company_id = c.id) AS hol_count
      FROM companies c ORDER BY c.name`);
    res.json(r.rows);
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/companies', async (req, res) => {
  const { id, name, address='', contact='', currency='₹', working_days='auto', logo='', ot_rate=0 } = req.body;
  try {
    const r = await query(
      `INSERT INTO companies(id,name,address,contact,currency,working_days,logo,ot_rate)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [id, name, address, contact, currency, working_days, logo, ot_rate]);
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.get('/api/companies/:id', async (req, res) => {
  try {
    const r = await query('SELECT * FROM companies WHERE id=$1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({error:'Not found'});
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.put('/api/companies/:id', async (req, res) => {
  const { name, address='', contact='', currency='₹', working_days='auto', logo='', ot_rate=0 } = req.body;
  try {
    const r = await query(
      `UPDATE companies SET name=$1,address=$2,contact=$3,currency=$4,working_days=$5,logo=$6,ot_rate=$7
       WHERE id=$8 RETURNING *`,
      [name, address, contact, currency, working_days, logo, ot_rate, req.params.id]);
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.delete('/api/companies/:id', async (req, res) => {
  try {
    await query('DELETE FROM companies WHERE id=$1', [req.params.id]);
    res.json({ok: true});
  } catch(e) { res.status(500).json({error: e.message}); }
});

// ═════════════════════════════════════════════════════════════
//  EMPLOYEES
// ═════════════════════════════════════════════════════════════
app.get('/api/companies/:cid/employees', async (req, res) => {
  try {
    const r = await query(
      'SELECT * FROM employees WHERE company_id=$1 ORDER BY name',
      [req.params.cid]);
    res.json(r.rows);
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/companies/:cid/employees', async (req, res) => {
  const cid = req.params.cid;
  const { code, name, designation='', department='', join_date, salary=0,
          phone='', bank='', pan='', allowance=0, deduction=0 } = req.body;
  try {
    await query(
      `INSERT INTO employees(company_id,code,name,designation,department,join_date,salary,phone,bank,pan,allowance,deduction)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT(company_id,code) DO UPDATE SET
         name=$3,designation=$4,department=$5,join_date=$6,salary=$7,phone=$8,bank=$9,pan=$10,allowance=$11,deduction=$12`,
      [cid, code, name, designation, department, join_date, salary, phone, bank, pan, allowance, deduction]);
    res.json({ok: true});
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.put('/api/companies/:cid/employees/:code', async (req, res) => {
  const { cid, code } = req.params;
  const { name, designation='', department='', join_date, salary=0,
          phone='', bank='', pan='', allowance=0, deduction=0, newCode } = req.body;
  try {
    if (newCode && newCode !== code) {
      // rename: update attendance/overtime keys too
      await query('UPDATE attendance SET employee_code=$1 WHERE company_id=$2 AND employee_code=$3', [newCode, cid, code]);
      await query('UPDATE overtime    SET employee_code=$1 WHERE company_id=$2 AND employee_code=$3', [newCode, cid, code]);
      await query('UPDATE leave_requests SET employee_code=$1 WHERE company_id=$2 AND employee_code=$3', [newCode, cid, code]);
      await query('UPDATE payments SET employee_code=$1 WHERE company_id=$2 AND employee_code=$3', [newCode, cid, code]);
      await query('UPDATE advances SET employee_code=$1 WHERE company_id=$2 AND employee_code=$3', [newCode, cid, code]);
    }
    const finalCode = newCode || code;
    await query(
      `UPDATE employees SET code=$1,name=$2,designation=$3,department=$4,join_date=$5,
       salary=$6,phone=$7,bank=$8,pan=$9,allowance=$10,deduction=$11
       WHERE company_id=$12 AND code=$13`,
      [finalCode, name, designation, department, join_date, salary, phone, bank, pan, allowance, deduction, cid, code]);
    res.json({ok: true});
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.delete('/api/companies/:cid/employees/:code', async (req, res) => {
  const { cid, code } = req.params;
  try {
    await query('DELETE FROM employees WHERE company_id=$1 AND code=$2', [cid, code]);
    res.json({ok: true});
  } catch(e) { res.status(500).json({error: e.message}); }
});

// ═════════════════════════════════════════════════════════════
//  ATTENDANCE
// ═════════════════════════════════════════════════════════════
app.get('/api/companies/:cid/attendance', async (req, res) => {
  const { month } = req.query; // YYYY-MM
  try {
    let r;
    if (month) {
      r = await query(
        `SELECT employee_code, att_date::text AS date, status FROM attendance
         WHERE company_id=$1 AND att_date >= $2::date AND att_date <= ($2::date + interval '1 month - 1 day')`,
        [req.params.cid, month + '-01']);
    } else {
      r = await query(
        'SELECT employee_code, att_date::text AS date, status FROM attendance WHERE company_id=$1',
        [req.params.cid]);
    }
    // Return as { empCode: { date: status } }
    const out = {};
    r.rows.forEach(row => {
      if (!out[row.employee_code]) out[row.employee_code] = {};
      out[row.employee_code][row.date] = row.status;
    });
    res.json(out);
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/companies/:cid/attendance', async (req, res) => {
  const cid = req.params.cid;
  const { employee_code, date, status } = req.body;
  try {
    if (!status) {
      await query('DELETE FROM attendance WHERE company_id=$1 AND employee_code=$2 AND att_date=$3',
        [cid, employee_code, date]);
    } else {
      await query(
        `INSERT INTO attendance(company_id,employee_code,att_date,status)
         VALUES($1,$2,$3,$4) ON CONFLICT(company_id,employee_code,att_date)
         DO UPDATE SET status=$4`,
        [cid, employee_code, date, status]);
    }
    res.json({ok: true});
  } catch(e) { res.status(500).json({error: e.message}); }
});

// Bulk attendance
app.post('/api/companies/:cid/attendance/bulk', async (req, res) => {
  const cid = req.params.cid;
  const { records } = req.body; // [{employee_code, date, status}]
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const r of records) {
        if (!r.status) {
          await client.query('DELETE FROM attendance WHERE company_id=$1 AND employee_code=$2 AND att_date=$3',
            [cid, r.employee_code, r.date]);
        } else {
          await client.query(
            `INSERT INTO attendance(company_id,employee_code,att_date,status)
             VALUES($1,$2,$3,$4) ON CONFLICT(company_id,employee_code,att_date) DO UPDATE SET status=$4`,
            [cid, r.employee_code, r.date, r.status]);
        }
      }
      await client.query('COMMIT');
      res.json({ok: true, count: records.length});
    } catch(e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  } catch(e) { res.status(500).json({error: e.message}); }
});

// ═════════════════════════════════════════════════════════════
//  OVERTIME
// ═════════════════════════════════════════════════════════════
app.get('/api/companies/:cid/overtime', async (req, res) => {
  const { month } = req.query;
  try {
    let r;
    if (month) {
      r = await query(
        `SELECT employee_code, ot_date::text AS date, hours FROM overtime
         WHERE company_id=$1 AND ot_date >= $2::date AND ot_date <= ($2::date + interval '1 month - 1 day')`,
        [req.params.cid, month + '-01']);
    } else {
      r = await query('SELECT employee_code, ot_date::text AS date, hours FROM overtime WHERE company_id=$1', [req.params.cid]);
    }
    const out = {};
    r.rows.forEach(row => {
      if (!out[row.employee_code]) out[row.employee_code] = {};
      out[row.employee_code][row.date] = parseFloat(row.hours);
    });
    res.json(out);
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/companies/:cid/overtime', async (req, res) => {
  const { employee_code, date, hours } = req.body;
  try {
    if (!hours || hours <= 0) {
      await query('DELETE FROM overtime WHERE company_id=$1 AND employee_code=$2 AND ot_date=$3',
        [req.params.cid, employee_code, date]);
    } else {
      await query(
        `INSERT INTO overtime(company_id,employee_code,ot_date,hours)
         VALUES($1,$2,$3,$4) ON CONFLICT(company_id,employee_code,ot_date) DO UPDATE SET hours=$4`,
        [req.params.cid, employee_code, date, hours]);
    }
    res.json({ok: true});
  } catch(e) { res.status(500).json({error: e.message}); }
});

// ═════════════════════════════════════════════════════════════
//  HOLIDAYS
// ═════════════════════════════════════════════════════════════
app.get('/api/companies/:cid/holidays', async (req, res) => {
  try {
    const r = await query(
      'SELECT hol_date::text AS date, name FROM holidays WHERE company_id=$1 ORDER BY hol_date',
      [req.params.cid]);
    res.json(r.rows);
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/companies/:cid/holidays', async (req, res) => {
  const { date, name } = req.body;
  try {
    await query(
      `INSERT INTO holidays(company_id,hol_date,name) VALUES($1,$2,$3)
       ON CONFLICT(company_id,hol_date) DO UPDATE SET name=$3`,
      [req.params.cid, date, name]);
    res.json({ok: true});
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.delete('/api/companies/:cid/holidays/:date', async (req, res) => {
  try {
    await query('DELETE FROM holidays WHERE company_id=$1 AND hol_date=$2',
      [req.params.cid, req.params.date]);
    res.json({ok: true});
  } catch(e) { res.status(500).json({error: e.message}); }
});

// ═════════════════════════════════════════════════════════════
//  LEAVE REQUESTS
// ═════════════════════════════════════════════════════════════
app.get('/api/companies/:cid/leaves', async (req, res) => {
  try {
    const r = await query(
      `SELECT id, employee_code, type, from_date::text AS "from", to_date::text AS "to",
              reason, status, submitted_at
       FROM leave_requests WHERE company_id=$1 ORDER BY submitted_at DESC`,
      [req.params.cid]);
    res.json(r.rows);
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/companies/:cid/leaves', async (req, res) => {
  const { id, employee_code, type, from, to, reason='', status='pending' } = req.body;
  try {
    await query(
      `INSERT INTO leave_requests(id,company_id,employee_code,type,from_date,to_date,reason,status)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, req.params.cid, employee_code, type, from, to, reason, status]);
    res.json({ok: true});
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.put('/api/companies/:cid/leaves/:id', async (req, res) => {
  const { employee_code, type, from, to, reason, status } = req.body;
  try {
    await query(
      `UPDATE leave_requests SET employee_code=$1,type=$2,from_date=$3,to_date=$4,reason=$5,status=$6
       WHERE company_id=$7 AND id=$8`,
      [employee_code, type, from, to, reason, status, req.params.cid, req.params.id]);
    res.json({ok: true});
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.delete('/api/companies/:cid/leaves/:id', async (req, res) => {
  try {
    await query('DELETE FROM leave_requests WHERE company_id=$1 AND id=$2',
      [req.params.cid, req.params.id]);
    res.json({ok: true});
  } catch(e) { res.status(500).json({error: e.message}); }
});

// ═════════════════════════════════════════════════════════════
//  PAYROLL RUNS & PAYMENTS
// ═════════════════════════════════════════════════════════════
app.get('/api/companies/:cid/payroll', async (req, res) => {
  try {
    const runs = await query(
      'SELECT * FROM payroll_runs WHERE company_id=$1 ORDER BY month DESC',
      [req.params.cid]);
    res.json(runs.rows);
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.get('/api/companies/:cid/payroll/:month/payments', async (req, res) => {
  try {
    const r = await query(
      `SELECT p.*, e.name AS employee_name, e.designation, e.department, e.bank, e.phone
       FROM payments p
       LEFT JOIN employees e ON e.company_id = p.company_id AND e.code = p.employee_code
       WHERE p.company_id=$1 AND p.month=$2 ORDER BY e.name`,
      [req.params.cid, req.params.month]);
    res.json(r.rows);
  } catch(e) { res.status(500).json({error: e.message}); }
});

// Run payroll — compute and store payment records for a month
app.post('/api/companies/:cid/payroll/run', async (req, res) => {
  const cid = req.params.cid;
  const { month } = req.body; // YYYY-MM
  if (!month) return res.status(400).json({error:'month required'});

  try {
    const [y, m] = month.split('-').map(Number);
    const daysIn = new Date(y, m, 0).getDate();

    // Fetch company settings
    const coRes = await query('SELECT * FROM companies WHERE id=$1', [cid]);
    if (!coRes.rows.length) return res.status(404).json({error:'Company not found'});
    const co = coRes.rows[0];

    // Fetch employees
    const empRes = await query('SELECT * FROM employees WHERE company_id=$1', [cid]);

    // Fetch attendance for month
    const attRes = await query(
      `SELECT employee_code, att_date::text AS date, status FROM attendance
       WHERE company_id=$1 AND att_date >= $2::date AND att_date <= ($2::date + interval '1 month - 1 day')`,
      [cid, month + '-01']);
    const attMap = {};
    attRes.rows.forEach(r => {
      if (!attMap[r.employee_code]) attMap[r.employee_code] = {};
      attMap[r.employee_code][r.date] = r.status;
    });

    // Fetch overtime for month
    const otRes = await query(
      `SELECT employee_code, ot_date::text AS date, hours FROM overtime
       WHERE company_id=$1 AND ot_date >= $2::date AND ot_date <= ($2::date + interval '1 month - 1 day')`,
      [cid, month + '-01']);
    const otMap = {};
    otRes.rows.forEach(r => {
      if (!otMap[r.employee_code]) otMap[r.employee_code] = {};
      otMap[r.employee_code][r.date] = parseFloat(r.hours);
    });

    // Fetch holidays for month
    const holRes = await query(
      `SELECT hol_date::text AS date FROM holidays
       WHERE company_id=$1 AND hol_date >= $2::date AND hol_date <= ($2::date + interval '1 month - 1 day')`,
      [cid, month + '-01']);
    const holSet = new Set(holRes.rows.map(r => r.date));

    // Fetch active advances (for deduction)
    const advRes = await query(
      `SELECT * FROM advances WHERE company_id=$1 AND status='active'`, [cid]);
    const advMap = {};
    advRes.rows.forEach(a => {
      if (!advMap[a.employee_code]) advMap[a.employee_code] = [];
      advMap[a.employee_code].push(a);
    });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Upsert payroll run
      const runRes = await client.query(
        `INSERT INTO payroll_runs(company_id,month,run_date) VALUES($1,$2,CURRENT_DATE)
         ON CONFLICT(company_id,month) DO UPDATE SET run_date=CURRENT_DATE RETURNING id`,
        [cid, month]);
      const runId = runRes.rows[0].id;

      let totalGross = 0, totalNet = 0;

      for (const emp of empRes.rows) {
        const att = attMap[emp.code] || {};
        const ot  = otMap[emp.code]  || {};
        let P=0,A=0,H=0,PL=0,ML=0,W=0,HOL=0,bj=0,totalOT=0;
        for (let d=1; d<=daysIn; d++) {
          const ds = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
          const wd = new Date(y,m-1,d).getDay();
          if (emp.join_date && ds < emp.join_date.toISOString?.()?.substring(0,10)) { bj++; continue; }
          if (ot[ds]) totalOT += ot[ds];
          const s = att[ds];
          if (s==='P') P++; else if (s==='A') A++; else if (s==='H') H++;
          else if (s==='PL') PL++; else if (s==='ML') ML++;
          else if (holSet.has(ds)) HOL++;
          else if (wd===0) W++;
        }
        let workingDays = daysIn;
        if (co.working_days === 'auto') { workingDays = daysIn-W-HOL-bj; if (workingDays<1) workingDays=1; }
        else if (co.working_days === '26') workingDays = 26;
        else if (co.working_days === '30') workingDays = 30;

        const payableDays = P + H*0.5 + PL + ML;
        const perDay = parseFloat(emp.salary) / workingDays;
        const basicEarned = perDay * payableDays;
        const allowanceEarned = parseFloat(emp.allowance||0) * (payableDays / workingDays);
        const otAmount = totalOT * parseFloat(co.ot_rate||0);
        const grossAmount = basicEarned + allowanceEarned + otAmount;

        // Advance deductions
        let advanceDeducted = 0;
        for (const adv of advMap[emp.code] || []) {
          if (adv.status === 'active') {
            const monthly = parseFloat(adv.monthly_deduction);
            const outstanding = parseFloat(adv.amount) - parseFloat(adv.amount_recovered);
            const thisDeduct = Math.min(monthly, outstanding);
            advanceDeducted += thisDeduct;
          }
        }

        const statutoryDeduct = parseFloat(emp.deduction||0);
        const netAmount = grossAmount - statutoryDeduct - advanceDeducted;

        await client.query(
          `INSERT INTO payments(company_id,payroll_run_id,employee_code,month,working_days,payable_days,
            basic_earned,allowance_earned,ot_amount,gross_amount,statutory_deduct,advance_deducted,net_amount,status)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending')
           ON CONFLICT(company_id,employee_code,month) DO UPDATE SET
             payroll_run_id=$2,working_days=$5,payable_days=$6,basic_earned=$7,allowance_earned=$8,
             ot_amount=$9,gross_amount=$10,statutory_deduct=$11,advance_deducted=$12,net_amount=$13`,
          [cid, runId, emp.code, month, workingDays, payableDays,
           basicEarned.toFixed(2), allowanceEarned.toFixed(2), otAmount.toFixed(2),
           grossAmount.toFixed(2), statutoryDeduct.toFixed(2), advanceDeducted.toFixed(2), netAmount.toFixed(2)]);

        totalGross += grossAmount;
        totalNet   += netAmount;
      }

      // Update run totals
      await client.query(
        'UPDATE payroll_runs SET total_gross=$1,total_net=$2 WHERE id=$3',
        [totalGross.toFixed(2), totalNet.toFixed(2), runId]);

      await client.query('COMMIT');
      res.json({ok:true, run_id: runId, employee_count: empRes.rows.length,
                total_gross: totalGross.toFixed(2), total_net: totalNet.toFixed(2)});
    } catch(e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.put('/api/companies/:cid/payments/:id', async (req, res) => {
  const { status, payment_mode, payment_date, remarks } = req.body;
  try {
    await query(
      `UPDATE payments SET status=$1,payment_mode=$2,payment_date=$3,remarks=$4
       WHERE company_id=$5 AND id=$6`,
      [status, payment_mode||'', payment_date||null, remarks||'', req.params.cid, req.params.id]);
    res.json({ok: true});
  } catch(e) { res.status(500).json({error: e.message}); }
});

// Bulk update payment status
app.post('/api/companies/:cid/payments/bulk-status', async (req, res) => {
  const { ids, status, payment_mode, payment_date } = req.body;
  try {
    const pdate = payment_date || new Date().toISOString().substring(0,10);
    await query(
      `UPDATE payments SET status=$1,payment_mode=$2,payment_date=$3
       WHERE company_id=$4 AND id=ANY($5::int[])`,
      [status, payment_mode||'bank', pdate, req.params.cid, ids]);
    res.json({ok: true});
  } catch(e) { res.status(500).json({error: e.message}); }
});

// ═════════════════════════════════════════════════════════════
//  ADVANCES & LOANS
// ═════════════════════════════════════════════════════════════
app.get('/api/companies/:cid/advances', async (req, res) => {
  try {
    const r = await query(
      `SELECT a.*, e.name AS employee_name, e.designation
       FROM advances a LEFT JOIN employees e ON e.company_id=a.company_id AND e.code=a.employee_code
       WHERE a.company_id=$1 ORDER BY a.created_at DESC`,
      [req.params.cid]);
    res.json(r.rows);
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/companies/:cid/advances', async (req, res) => {
  const { employee_code, amount, reason='', given_date, repayment_months=1, monthly_deduction } = req.body;
  const monthlyDed = monthly_deduction || (amount / repayment_months).toFixed(2);
  try {
    const r = await query(
      `INSERT INTO advances(company_id,employee_code,amount,reason,given_date,repayment_months,monthly_deduction)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.cid, employee_code, amount, reason, given_date || new Date().toISOString().substring(0,10),
       repayment_months, monthlyDed]);
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.put('/api/companies/:cid/advances/:id', async (req, res) => {
  const { amount_recovered, status, monthly_deduction } = req.body;
  try {
    await query(
      `UPDATE advances SET amount_recovered=$1,status=$2,monthly_deduction=$3 WHERE company_id=$4 AND id=$5`,
      [amount_recovered, status, monthly_deduction, req.params.cid, req.params.id]);
    res.json({ok: true});
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.delete('/api/companies/:cid/advances/:id', async (req, res) => {
  try {
    await query('DELETE FROM advances WHERE company_id=$1 AND id=$2', [req.params.cid, req.params.id]);
    res.json({ok: true});
  } catch(e) { res.status(500).json({error: e.message}); }
});

// ─── Serve index.html for all other routes ───────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start ───────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
(async () => {
  try {
    await initSchema();
    app.listen(PORT, () => {
      console.log(`\n✅ HR System running at: http://localhost:${PORT}`);
      console.log('   Press Ctrl+C to stop.\n');
    });
  } catch(e) {
    console.error('❌ Failed to start:', e.message);
    process.exit(1);
  }
})();
