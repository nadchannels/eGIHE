import React, { useState, useEffect, useCallback } from 'react';
import {
  collection, getDocs, doc, getDoc, setDoc, query, where
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuthStore } from '../../store/authStore';
import {
  Plus, Trash2, Download, Save,
  CheckCircle, AlertTriangle, Info, FileCode2, Eye, Users, Building2
} from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────────
const PROGRAMS = ['Day', 'Weekend', 'Night'];
const SESSIONS = Array.from({ length: 20 }, (_, i) => i + 1);
const SUSPENSION_THRESHOLD = { Day: 3, Night: 3, Weekend: 2 };

function getMonthOptions() {
  const options = [];
  const now = new Date();
  for (let i = -11; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    options.push({ value, label });
  }
  return options;
}

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function makeBranchDocId(managerId, branchId, program, month) {
  return `${managerId}_${branchId}_${program}_${month}`;
}

function countAbsences(sessions) {
  return Object.values(sessions).filter(v => v === 'A').length;
}

function isSuspended(trainer, program) {
  return countAbsences(trainer.sessions) >= (SUSPENSION_THRESHOLD[program] ?? 3);
}

function computeStats(trainers, program) {
  let present = 0, absent = 0, leave = 0, suspended = 0;
  for (const t of trainers) {
    for (const v of Object.values(t.sessions)) {
      if (v === 'P') present++;
      else if (v === 'A') absent++;
      else if (v === 'L') leave++;
    }
    if (isSuspended(t, program)) suspended++;
  }
  return { present, absent, leave, suspended };
}

function cycleStatus(current) {
  if (!current || current === '') return 'P';
  if (current === 'P') return 'A';
  if (current === 'A') return 'L';
  return '';
}

function makeSessions() {
  const s = {};
  SESSIONS.forEach(n => { s[String(n)] = ''; });
  return s;
}

function newTrainer(name = '', staffId = '') {
  return {
    id: `tr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name,
    staffId,
    sessions: makeSessions()
  };
}

function downloadCSV(trainers, branchName, program, month, monthLabel, managerName) {
  const header = ['#', 'Trainer Name', 'Staff ID', ...SESSIONS.map(s => `Session ${s}`), 'Total Absences', 'Status'];
  const rows = trainers.map((t, idx) => {
    const abs = countAbsences(t.sessions);
    const susp = isSuspended(t, program) ? 'WARNING' : 'OK';
    return [idx + 1, `"${t.name}"`, `"${t.staffId}"`, ...SESSIONS.map(s => t.sessions[String(s)] || ''), abs, susp].join(',');
  });
  const csv = [
    `"Branch Trainer Attendance Report"`,
    `"Branch: ${branchName} | Program: ${program} | Month: ${monthLabel}"`,
    managerName ? `"Branch Manager: ${managerName}"` : '',
    `"Suspension rule: ${SUSPENSION_THRESHOLD[program]}+ absences"`,
    '',
    header.join(','),
    ...rows
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `branch_attendance_${branchName.replace(/\s+/g, '_')}_${program}_${month}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── LaTeX special-char escaper ──────────────────────────────────────────────
function texEsc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

// ─── LaTeX Download ───────────────────────────────────────────────────────────
function downloadLaTeX(trainers, branchName, program, month, monthLabel, managerName) {
  const threshold = SUSPENSION_THRESHOLD[program] ?? 3;

  const sessionCols = SESSIONS.map(() => 'p{0.42cm}').join('@{}')
  const colSpec = `|r|p{3.8cm}|p{1.8cm}|p{1.6cm}|${sessionCols}|`;

  const sessionHeaders = SESSIONS.map(s => `{\\tiny S${s}}`).join(' & ');
  const headerRow = `\\rowcolor{headercolor} {\\color{white}\\bfseries\\tiny \\#} & {\\color{white}\\bfseries\\tiny Trainer Name} & {\\color{white}\\bfseries\\tiny Staff ID} & {\\color{white}\\bfseries\\tiny Status} & ${sessionHeaders} \\\\ \\hline`;

  const dataRows = trainers.map((t, idx) => {
    const abs = countAbsences(t.sessions);
    const susp = isSuspended(t, program);
    const nearLimit = !susp && abs >= threshold - 1 && abs > 0;
    const rowColor = susp ? '\\rowcolor{suspendedcolor}' : nearLimit ? '\\rowcolor{warningcolor}' : '';
    const statusTex = susp
      ? '{\\bfseries\\tiny HIGH ABS}'
      : nearLimit
        ? `{\\tiny ${abs}/${threshold} abs}`
        : '{\\tiny Good}';
    const sessionCells = SESSIONS.map(s => {
      const v = t.sessions[String(s)] || '';
      const color = v === 'P' ? '\\textcolor{presentcolor}' : v === 'A' ? '\\textcolor{absentcolor}' : v === 'L' ? '\\textcolor{leavecolor}' : '';
      return v ? `${color}{\\tiny\\bfseries ${v}}` : '{\\tiny\\textperiodcentered}';
    }).join(' & ');
    return `${rowColor} {\\tiny ${idx + 1}} & {\\tiny ${texEsc(t.name)}} & {\\tiny ${texEsc(t.staffId || '—')}} & ${statusTex} & ${sessionCells} \\\\ \\hline`;
  }).join('\n');

  const stats = computeStats(trainers, program);

  const doc = `% ============================================================
%  Branch Trainer Attendance — generated by eGIHE
%  Compile with: pdflatex or upload to Overleaf
% ============================================================
\\documentclass[a4paper,landscape]{article}
\\usepackage[margin=1cm,top=1.5cm,bottom=1.5cm]{geometry}
\\usepackage{longtable}
\\usepackage{booktabs}
\\usepackage{array}
\\usepackage{colortbl}
\\usepackage[dvipsnames]{xcolor}
\\usepackage{helvet}
\\usepackage{microtype}
\\renewcommand{\\familydefault}{\\sfdefault}
\\setlength{\\parindent}{0pt}
\\setlength{\\LTpre}{4pt}
\\setlength{\\LTpost}{4pt}

% ── Color palette ─────────────────────────────────────────
\\definecolor{headercolor}{RGB}{57,62,70}
\\definecolor{suspendedcolor}{RGB}{254,226,226}
\\definecolor{warningcolor}{RGB}{254,243,199}
\\definecolor{presentcolor}{RGB}{4,120,87}
\\definecolor{absentcolor}{RGB}{185,28,28}
\\definecolor{leavecolor}{RGB}{146,64,14}
\\definecolor{subtleblue}{RGB}{240,244,255}

\\begin{document}
\\pagestyle{empty}

% ── Title block ───────────────────────────────────────────
{\\Large\\bfseries Branch Trainer Attendance Report} \\hfill {\\small Generated by eGIHE}

\\vspace{0.3cm}
\\colorbox{subtleblue}{\\parbox{\\linewidth}{
  \\small
  \\textbf{Branch:} ${texEsc(branchName)} \\quad
  \\textbf{Program:} ${texEsc(program)} \\quad
  \\textbf{Month:} ${texEsc(monthLabel)} \\quad
  \\textbf{Branch Manager:} ${texEsc(managerName || 'N/A')}
}}

\\vspace{0.25cm}
{\\small Absence flag threshold: \\textbf{${threshold}+} absences in the \\textbf{${program}} programme.}

\\vspace{0.3cm}

% ── Attendance table ──────────────────────────────────────
\\begin{longtable}{${colSpec}}
  \\hline
  ${headerRow}
  \\endfirsthead
  \\multicolumn{${4 + SESSIONS.length}}{l}{{\\small \\itshape (continued from previous page)}} \\\\
  \\hline
  ${headerRow}
  \\endhead
  \\hline \\multicolumn{${4 + SESSIONS.length}}{r}{{\\small \\itshape continued on next page}} \\\\
  \\endfoot
  \\hline
  \\endlastfoot
  ${dataRows || '\\multicolumn{' + (4 + SESSIONS.length) + '}{c}{\\itshape No data} \\\\'}
\\end{longtable}

% ── Summary ───────────────────────────────────────────────
\\vspace{0.2cm}
\\begin{tabular}{llll}
  \\textcolor{presentcolor}{\\bfseries P~Present:} & ${stats.present} &
  \\textcolor{absentcolor}{\\bfseries A~Absent:} & ${stats.absent} \\\\
  \\textcolor{leavecolor}{\\bfseries L~Leave:} & ${stats.leave} &
  \\bfseries Flagged: & ${stats.suspended} \\\\
  \\bfseries Total trainers: & ${trainers.length} & & \\\\
\\end{tabular}

\\end{document}
`;

  const blob = new Blob([doc], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `branch_attendance_${branchName.replace(/\s+/g, '_')}_${program}_${month}.tex`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Shared Attendance Grid ───────────────────────────────────────────────────
function AttendanceGrid({ trainers, program, readOnly, onCellClick, onRemoveTrainer,
  newName, newStaffId, setNewName, setNewStaffId, onAddTrainer, onAddKeyDown }) {
  const stats = computeStats(trainers, program);
  const threshold = SUSPENSION_THRESHOLD[program];

  return (
    <>
      {trainers.length > 0 && (
        <div className="att-stats att-no-print">
          <span className="att-stat-chip present">P Present: {stats.present}</span>
          <span className="att-stat-chip absent">A Absent: {stats.absent}</span>
          <span className="att-stat-chip leave">L Leave: {stats.leave}</span>
          <span className="att-stat-chip suspended">! Flagged: {stats.suspended}</span>
          <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--color-text-secondary)', alignSelf: 'center', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            {readOnly ? <><Eye size={13} /> View-only mode</> : <><Info size={13} /> Click any cell to toggle</>}
          </span>
        </div>
      )}

      {stats.suspended > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem 1.1rem', background: '#fee2e2', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.85rem', color: '#b91c1c', fontWeight: 600 }} className="att-no-print">
          <AlertTriangle size={15} />
          {stats.suspended} trainer{stats.suspended !== 1 ? 's have' : ' has'} high absence count ({threshold}+ absences in {program} program)
        </div>
      )}

      <div className="att-table-wrapper">
        <table className="att-table">
          <thead>
            <tr>
              <th className="att-col-no">#</th>
              <th className="att-col-name" style={{ textAlign: 'left' }}>Trainer Name</th>
              <th className="att-col-reg">Staff ID</th>
              <th className="att-col-status">Status</th>
              {SESSIONS.map(s => <th key={s} className="session-col">S{s}</th>)}
              {!readOnly && <th className="att-no-print" style={{ minWidth: 40, width: 40 }} />}
            </tr>
          </thead>
          <tbody>
            {trainers.map((trainer, idx) => {
              const susp = isSuspended(trainer, program);
              const abs = countAbsences(trainer.sessions);
              const nearLimit = !susp && abs >= threshold - 1 && abs > 0;
              return (
                <tr key={trainer.id} className={susp ? 'row-suspended' : ''}>
                  <td className="att-col-no" style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--color-text-secondary)', padding: '0.3rem 0.2rem' }}>{idx + 1}</td>
                  <td className="att-col-name" style={{ fontWeight: 600 }}>{trainer.name}</td>
                  <td className="att-col-reg" style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', padding: '0.4rem' }}>{trainer.staffId || '-'}</td>
                  <td className="att-col-status" style={{ padding: '0.3rem 0.4rem' }}>
                    {susp ? <span className="att-badge suspended">HIGH ABS</span>
                      : nearLimit ? <span className="att-badge warning">{abs}/{threshold} abs</span>
                        : <span className="att-badge ok">Good</span>}
                  </td>
                  {SESSIONS.map(s => {
                    const val = trainer.sessions[String(s)] || '';
                    return (
                      <td key={s} style={{ padding: 0 }}>
                        <button
                          className={`att-cell-btn status-${val || 'empty'}`}
                          onClick={readOnly ? undefined : () => onCellClick(trainer.id, s)}
                          style={readOnly ? { cursor: 'default', pointerEvents: 'none' } : {}}
                          title={`Session ${s}: ${val || 'blank'}`}
                        >{val || '·'}</button>
                      </td>
                    );
                  })}
                  {!readOnly && (
                    <td className="att-no-print" style={{ padding: '0.2rem', verticalAlign: 'middle' }}>
                      <button onClick={() => onRemoveTrainer(trainer.id)} style={{ color: 'var(--color-danger)', padding: '0.3rem', borderRadius: '4px', display: 'flex', alignItems: 'center' }} title="Remove trainer">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}

            {!readOnly && (
              <tr className="att-add-row att-no-print">
                <td className="att-col-no" style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '0.35rem' }}><Plus size={14} /></td>
                <td className="att-col-name" style={{ padding: 0 }}>
                  <input id="branch-att-new-name" className="att-inline-input" placeholder="Trainer full name..." value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={onAddKeyDown} />
                </td>
                <td className="att-col-reg" style={{ padding: 0 }}>
                  <input id="branch-att-new-staffid" className="att-inline-input" placeholder="Staff ID..." value={newStaffId} onChange={e => setNewStaffId(e.target.value)} onKeyDown={onAddKeyDown} />
                </td>
                <td className="att-col-status" style={{ padding: '0.3rem' }}>
                  <button id="branch-att-add-btn" className="btn btn-primary" style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem', margin: '0 auto', display: 'flex', whiteSpace: 'nowrap' }} onClick={onAddTrainer} disabled={!newName.trim()}>
                    <Plus size={13} /> Add
                  </button>
                </td>
                {SESSIONS.map(s => <td key={s} style={{ background: 'var(--color-bg-secondary)', opacity: 0.5 }} />)}
                <td className="att-no-print" />
              </tr>
            )}

            {trainers.length === 0 && (
              <tr>
                <td colSpan={4 + SESSIONS.length + (readOnly ? 0 : 1)}>
                  <div className="att-empty" style={{ padding: '3rem 2rem' }}>
                    <div className="att-empty-icon">👥</div>
                    <h3 style={{ marginBottom: '0.5rem', color: 'var(--color-text-primary)' }}>
                      {readOnly ? 'No attendance recorded yet' : 'Sheet is empty'}
                    </h3>
                    <p style={{ fontSize: '0.88rem' }}>
                      {readOnly ? 'No attendance has been recorded for this selection.'
                        : 'Add trainer names using the row above.'}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {trainers.length > 0 && (
        <div style={{ marginTop: '1rem', display: 'flex', gap: '2rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--color-text-secondary)', padding: '0.75rem 1rem', background: 'var(--color-white)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-bg-secondary)' }}>
          <span><strong style={{ color: '#047857' }}>P</strong> = Present</span>
          <span><strong style={{ color: '#b91c1c' }}>A</strong> = Absent</span>
          <span><strong style={{ color: '#92400e' }}>L</strong> = Permitted Leave</span>
          <span>· = Not recorded</span>
          <span style={{ marginLeft: 'auto', fontStyle: 'italic' }}>Flag threshold: Day/Night 3+ abs · Weekend 2+ abs</span>
        </div>
      )}
    </>
  );
}

// ─── SuperAdmin Overview ──────────────────────────────────────────────────────
function SuperAdminBranchView({ branches, monthOptions }) {
  const [activeBranchId, setActiveBranchId] = useState(branches[0]?.id || '');
  const [activeProgram, setActiveProgram] = useState('Day');
  const [activeMonth, setActiveMonth] = useState(currentMonthValue());
  const [sheets, setSheets] = useState([]);
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [managerCache, setManagerCache] = useState({});

  const activeBranch = branches.find(b => b.id === activeBranchId);
  const activeMonthLabel = monthOptions.find(m => m.value === activeMonth)?.label || activeMonth;

  const loadAllSheets = useCallback(async () => {
    if (!activeBranchId) return;
    setLoading(true);
    setActiveSheetIdx(0);
    try {
      const q = query(
        collection(db, 'branchAttendance'),
        where('branchId', '==', activeBranchId),
        where('program', '==', activeProgram),
        where('month', '==', activeMonth)
      );
      const snap = await getDocs(q);
      const results = [];
      const cacheUpdate = { ...managerCache };

      for (const d of snap.docs) {
        const data = d.data();
        const mid = data.branchManagerId;
        let mName = cacheUpdate[mid];
        if (!mName) {
          try {
            const uSnap = await getDoc(doc(db, 'users', mid));
            if (uSnap.exists()) {
              const u = uSnap.data();
              mName = `${u.firstName} ${u.lastName}`;
            } else { mName = mid; }
          } catch { mName = mid; }
          cacheUpdate[mid] = mName;
        }
        results.push({ managerId: mid, managerName: mName, trainers: data.trainers || [] });
      }
      results.sort((a, b) => a.managerName.localeCompare(b.managerName));
      setSheets(results);
      setManagerCache(cacheUpdate);
    } catch (err) {
      console.error('Error loading branch sheets:', err);
      setSheets([]);
    }
    setLoading(false);
  }, [activeBranchId, activeProgram, activeMonth]);

  useEffect(() => { loadAllSheets(); }, [activeBranchId, activeProgram, activeMonth]);

  const currentSheet = sheets[activeSheetIdx] || null;
  const currentTrainers = currentSheet?.trainers || [];
  const allTrainers = sheets.flatMap(s => s.trainers);
  const totalStats = computeStats(allTrainers, activeProgram);

  return (
    <div className="animate-fade-in">
      <div className="att-no-print" style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title">Branch Attendance Overview</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.8rem', background: 'rgba(37,99,235,0.08)', borderRadius: '2rem', fontSize: '0.83rem', fontWeight: 600, color: 'var(--color-accent)' }}>
            <Eye size={13} /> Read-only — viewing all branch manager records
          </span>
        </div>
      </div>

      <div className="att-print-area">
        {branches.length > 0 && (
          <div className="att-faculty-tabs att-no-print">
            {branches.map(b => (
              <button key={b.id} className={`att-faculty-tab${activeBranchId === b.id ? ' active' : ''}`} onClick={() => setActiveBranchId(b.id)}>
                <Building2 size={14} style={{ marginRight: '0.3rem' }} />
                {b.name}
              </button>
            ))}
          </div>
        )}

        <div className="att-program-selector att-no-print">
          {PROGRAMS.map(prog => (
            <button key={prog} className={`att-program-btn${activeProgram === prog ? ' active' : ''}`} onClick={() => setActiveProgram(prog)}>
              {prog} <span style={{ marginLeft: '0.3rem', fontSize: '0.72rem', opacity: 0.7 }}>({SUSPENSION_THRESHOLD[prog]} abs.)</span>
            </button>
          ))}
        </div>

        <div className="att-controls att-no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label htmlFor="batt-month-sa" style={{ fontWeight: 600, fontSize: '0.9rem' }}>Month:</label>
            <select id="batt-month-sa" className="att-month-select" value={activeMonth} onChange={e => setActiveMonth(e.target.value)}>
              {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {sheets.length > 0 && (
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Users size={13} /> {sheets.length} manager sheet{sheets.length !== 1 ? 's' : ''} &middot; {allTrainers.length} trainers
            </span>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
            <button id="batt-sa-latex-btn" className="btn btn-secondary"
              onClick={() => downloadLaTeX(currentTrainers, activeBranch?.name || '', activeProgram, activeMonth, activeMonthLabel, currentSheet?.managerName)}
              disabled={currentTrainers.length === 0}>
              <FileCode2 size={16} /> LaTeX / PDF
            </button>
            <button id="batt-sa-csv-btn" className="btn btn-secondary"
              onClick={() => downloadCSV(currentTrainers, activeBranch?.name || '', activeProgram, activeMonth, activeMonthLabel, currentSheet?.managerName)}
              disabled={currentTrainers.length === 0}>
              <Download size={16} /> Excel / CSV
            </button>
          </div>
        </div>

        {sheets.length > 0 && !loading && (
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', padding: '0.75rem 1.2rem', background: 'linear-gradient(135deg, #f0f4ff, #f7f7f7)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-bg-secondary)', marginBottom: '1.25rem', fontSize: '0.85rem', fontWeight: 600 }} className="att-no-print">
            <span style={{ color: 'var(--color-text-secondary)' }}>All managers combined:</span>
            <span style={{ color: '#047857' }}>P Present: {totalStats.present}</span>
            <span style={{ color: '#b91c1c' }}>A Absent: {totalStats.absent}</span>
            <span style={{ color: '#92400e' }}>L Leave: {totalStats.leave}</span>
            <span style={{ color: '#7f1d1d' }}>Flagged: {totalStats.suspended}</span>
          </div>
        )}

        {sheets.length > 1 && (
          <div className="att-no-print" style={{ marginBottom: '1rem' }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Select Manager Sheet:</p>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {sheets.map((sh, idx) => (
                <button key={sh.managerId} onClick={() => setActiveSheetIdx(idx)}
                  style={{ padding: '0.4rem 1rem', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '0.83rem', border: `2px solid ${activeSheetIdx === idx ? 'var(--color-text-primary)' : 'var(--color-bg-secondary)'}`, background: activeSheetIdx === idx ? 'var(--color-text-primary)' : 'var(--color-white)', color: activeSheetIdx === idx ? 'var(--color-white)' : 'var(--color-text-secondary)', cursor: 'pointer', transition: 'all 0.2s' }}>
                  {sh.managerName} <span style={{ opacity: 0.7, fontSize: '0.76rem' }}>({sh.trainers.length})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'none' }} className="att-print-header-block">
          <h2 style={{ fontSize: '1.3rem', marginBottom: '0.2rem' }}>Branch Trainer Attendance — {activeBranch?.name}</h2>
          <p style={{ fontSize: '0.9rem', color: '#555' }}>Program: <strong>{activeProgram}</strong> | Month: <strong>{activeMonthLabel}</strong></p>
          <p style={{ fontSize: '0.8rem', color: '#888' }}>Branch Manager: {currentSheet?.managerName || 'All'}</p>
          <hr style={{ margin: '0.6rem 0' }} />
        </div>

        {sheets.length > 0 && currentSheet && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(37,99,235,0.06)', borderRadius: 'var(--radius-md)', fontSize: '0.88rem', color: 'var(--color-text-primary)', fontWeight: 600 }} className="att-no-print">
            <Eye size={15} style={{ color: 'var(--color-accent)' }} />
            Viewing: <strong>{currentSheet.managerName}</strong>
            <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>&middot; {currentTrainers.length} trainer{currentTrainers.length !== 1 ? 's' : ''}</span>
          </div>
        )}

        {loading ? (
          <div className="att-empty"><div className="att-empty-icon">loading</div><p>Loading records...</p></div>
        ) : sheets.length === 0 ? (
          <div className="att-empty" style={{ padding: '4rem 2rem' }}>
            <div className="att-empty-icon">📋</div>
            <h3>No Records Found</h3>
            <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
              No branch manager has recorded attendance for <strong>{activeBranch?.name}</strong> — <strong>{activeProgram}</strong> in <strong>{activeMonthLabel}</strong> yet.
            </p>
          </div>
        ) : (
          <AttendanceGrid trainers={currentTrainers} program={activeProgram} readOnly={true} />
        )}
      </div>
    </div>
  );
}

// ─── Branch Manager Editable View ────────────────────────────────────────────
function BranchManagerView({ branch, monthOptions, user, userData }) {
  const [activeProgram, setActiveProgram] = useState('Day');
  const [activeMonth, setActiveMonth] = useState(currentMonthValue());
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [docExists, setDocExists] = useState(false);
  const [newName, setNewName] = useState('');
  const [newStaffId, setNewStaffId] = useState('');

  const activeMonthLabel = monthOptions.find(m => m.value === activeMonth)?.label || activeMonth;

  const loadSheet = useCallback(async () => {
    if (!branch?.id || !user) return;
    setLoading(true);
    setSaved(false);
    const docId = makeBranchDocId(user.uid, branch.id, activeProgram, activeMonth);
    try {
      const snap = await getDoc(doc(db, 'branchAttendance', docId));
      if (snap.exists()) { setTrainers(snap.data().trainers || []); setDocExists(true); }
      else { setTrainers([]); setDocExists(false); }
    } catch (err) { console.error(err); setTrainers([]); }
    setLoading(false);
  }, [branch?.id, activeProgram, activeMonth, user]);

  useEffect(() => { loadSheet(); }, [loadSheet]);

  const handleSave = async () => {
    if (!user || !branch?.id) return;
    setSaving(true);
    const docId = makeBranchDocId(user.uid, branch.id, activeProgram, activeMonth);
    try {
      await setDoc(doc(db, 'branchAttendance', docId), {
        branchId: branch.id,
        branchManagerId: user.uid,
        program: activeProgram,
        month: activeMonth,
        trainers,
        updatedAt: new Date().toISOString(),
        ...(docExists ? {} : { createdAt: new Date().toISOString() })
      }, { merge: true });
      setDocExists(true); setSaved(true);
      setTimeout(() => setSaved(false), 3500);
    } catch (err) { console.error(err); alert('Failed to save. Please try again.'); }
    setSaving(false);
  };

  const handleAddTrainer = () => {
    if (!newName.trim()) return;
    setTrainers(prev => [...prev, newTrainer(newName.trim(), newStaffId.trim())]);
    setNewName(''); setNewStaffId(''); setSaved(false);
  };
  const handleAddKeyDown = (e) => { if (e.key === 'Enter') handleAddTrainer(); };
  const handleRemoveTrainer = (id) => {
    if (!window.confirm('Remove this trainer from the sheet?')) return;
    setTrainers(prev => prev.filter(t => t.id !== id)); setSaved(false);
  };
  const handleCellClick = (trainerId, sessionNum) => {
    setTrainers(prev => prev.map(t => {
      if (t.id !== trainerId) return t;
      const key = String(sessionNum);
      return { ...t, sessions: { ...t.sessions, [key]: cycleStatus(t.sessions[key]) } };
    }));
    setSaved(false);
  };

  return (
    <div className="animate-fade-in">
      <div className="att-no-print" style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title">Branch Attendance</h1>
        <p className="page-subtitle" style={{ marginBottom: 0 }}>
          Trainer attendance for <strong>{branch?.name}</strong> — click a session cell to cycle: <strong>P</strong> (Present) | <strong>A</strong> (Absent) | <strong>L</strong> (Leave)
        </p>
      </div>

      {/* Branch info chip */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 1rem', background: 'rgba(37,99,235,0.07)', borderRadius: '2rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-accent)', marginBottom: '1.5rem' }} className="att-no-print">
        <Building2 size={14} />
        {branch?.name}
      </div>

      <div className="att-print-area">
        <div className="att-program-selector att-no-print">
          {PROGRAMS.map(prog => (
            <button key={prog} className={`att-program-btn${activeProgram === prog ? ' active' : ''}`} onClick={() => { setActiveProgram(prog); setSaved(false); }}>
              {prog} <span style={{ marginLeft: '0.3rem', fontSize: '0.72rem', opacity: 0.7 }}>({SUSPENSION_THRESHOLD[prog]} abs.)</span>
            </button>
          ))}
        </div>

        <div className="att-controls att-no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label htmlFor="batt-month-bm" style={{ fontWeight: 600, fontSize: '0.9rem' }}>Month:</label>
            <select id="batt-month-bm" className="att-month-select" value={activeMonth} onChange={e => { setActiveMonth(e.target.value); setSaved(false); }}>
              {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button id="batt-save-btn" className="btn btn-primary" onClick={handleSave} disabled={saving || trainers.length === 0}>
              {saving ? <><Save size={16} /> Saving...</> : saved ? <><CheckCircle size={16} /> Saved!</> : <><Save size={16} /> Save Sheet</>}
            </button>
            <button id="batt-latex-btn" className="btn btn-secondary"
              onClick={() => downloadLaTeX(trainers, branch?.name || '', activeProgram, activeMonth, activeMonthLabel, `${userData?.firstName} ${userData?.lastName}`)}
              disabled={trainers.length === 0}>
              <FileCode2 size={16} /> LaTeX / PDF
            </button>
            <button id="batt-csv-btn" className="btn btn-secondary"
              onClick={() => downloadCSV(trainers, branch?.name || '', activeProgram, activeMonth, activeMonthLabel, `${userData?.firstName} ${userData?.lastName}`)}
              disabled={trainers.length === 0}>
              <Download size={16} /> Excel / CSV
            </button>
          </div>
        </div>

        <div style={{ display: 'none' }} className="att-print-header-block">
          <h2 style={{ fontSize: '1.3rem', marginBottom: '0.2rem' }}>Branch Trainer Attendance — {branch?.name}</h2>
          <p style={{ fontSize: '0.9rem', color: '#555' }}>Program: <strong>{activeProgram}</strong> | Month: <strong>{activeMonthLabel}</strong></p>
          <p style={{ fontSize: '0.8rem', color: '#888' }}>Branch Manager: {userData?.firstName} {userData?.lastName}</p>
          <hr style={{ margin: '0.6rem 0' }} />
        </div>

        {loading ? (
          <div className="att-empty"><div className="att-empty-icon">loading</div><p>Loading sheet...</p></div>
        ) : (
          <AttendanceGrid
            trainers={trainers} program={activeProgram} readOnly={false}
            onCellClick={handleCellClick} onRemoveTrainer={handleRemoveTrainer}
            newName={newName} newStaffId={newStaffId} setNewName={setNewName} setNewStaffId={setNewStaffId}
            onAddTrainer={handleAddTrainer} onAddKeyDown={handleAddKeyDown}
          />
        )}
      </div>
    </div>
  );
}

// ─── Root Component ───────────────────────────────────────────────────────────
export default function BranchAttendance() {
  const { userData, user } = useAuthStore();
  const isSuperAdmin = userData?.role === 'superadmin';
  const isBranchManager = userData?.role === 'branch_manager';
  const [branch, setBranch] = useState(null);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const monthOptions = getMonthOptions();

  useEffect(() => {
    const fetchData = async () => {
      if (!userData) return;
      if (isSuperAdmin) {
        const snap = await getDocs(collection(db, 'branches'));
        setBranches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else if (isBranchManager && userData.branch) {
        try {
          const snap = await getDoc(doc(db, 'branches', userData.branch));
          if (snap.exists()) setBranch({ id: snap.id, ...snap.data() });
        } catch (err) { console.error(err); }
      }
      setLoading(false);
    };
    fetchData();
  }, [userData, isSuperAdmin, isBranchManager]);

  if (!userData || loading) {
    return <div className="animate-fade-in" style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading...</div>;
  }

  if (isSuperAdmin) {
    if (!branches.length) {
      return (
        <div className="animate-fade-in">
          <h1 className="page-title">Branch Attendance Overview</h1>
          <div className="card att-empty">
            <div className="att-empty-icon">🏢</div>
            <h3>No Branches Found</h3>
            <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>No branches have been created yet. Add branches in Institution Manager.</p>
          </div>
        </div>
      );
    }
    return <SuperAdminBranchView branches={branches} monthOptions={monthOptions} />;
  }

  if (isBranchManager) {
    if (!branch) {
      return (
        <div className="animate-fade-in">
          <h1 className="page-title">Branch Attendance</h1>
          <div className="card att-empty">
            <div className="att-empty-icon">🏢</div>
            <h3>No Branch Assigned</h3>
            <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>You are not assigned to any branch. Contact the administrator.</p>
          </div>
        </div>
      );
    }
    return <BranchManagerView branch={branch} monthOptions={monthOptions} user={user} userData={userData} />;
  }

  return (
    <div className="animate-fade-in" style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
      You do not have access to this page.
    </div>
  );
}
