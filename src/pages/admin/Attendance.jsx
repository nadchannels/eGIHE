import React, { useState, useEffect, useCallback } from 'react';
import {
  collection, getDocs, doc, getDoc, setDoc, query, where
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuthStore } from '../../store/authStore';
import {
  Plus, Trash2, Download, Save,
  CheckCircle, AlertTriangle, Info, FileCode2, Eye, Users
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

function makeDocId(trainerId, facultyId, program, month) {
  return `${trainerId}_${facultyId}_${program}_${month}`;
}

function countAbsences(sessions) {
  return Object.values(sessions).filter(v => v === 'A').length;
}

function isSuspended(trainee, program) {
  return countAbsences(trainee.sessions) >= (SUSPENSION_THRESHOLD[program] ?? 3);
}

function computeStats(trainees, program) {
  let present = 0, absent = 0, leave = 0, suspended = 0;
  for (const t of trainees) {
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

function newTrainee(name = '', regNumber = '') {
  return {
    id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name,
    regNumber,
    sessions: makeSessions()
  };
}

function downloadCSV(trainees, facultyName, program, month, monthLabel, trainerName) {
  const header = ['#', 'Name', 'Reg Number', ...SESSIONS.map(s => `Session ${s}`), 'Total Absences', 'Status'];
  const rows = trainees.map((t, idx) => {
    const abs = countAbsences(t.sessions);
    const susp = isSuspended(t, program) ? 'SUSPENDED' : 'Active';
    return [idx + 1, `"${t.name}"`, `"${t.regNumber}"`, ...SESSIONS.map(s => t.sessions[String(s)] || ''), abs, susp].join(',');
  });
  const csv = [
    `"Attendance Report"`,
    `"Faculty: ${facultyName} | Program: ${program} | Month: ${monthLabel}"`,
    trainerName ? `"Trainer: ${trainerName}"` : `"All Trainers"`,
    `"Suspension rule: ${SUSPENSION_THRESHOLD[program]}+ absences = suspended"`,
    '',
    header.join(','),
    ...rows
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendance_${facultyName.replace(/\s+/g, '_')}_${program}_${month}.csv`;
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
function downloadLaTeX(trainees, facultyName, program, month, monthLabel, trainerName) {
  const threshold = SUSPENSION_THRESHOLD[program] ?? 3;

  // Column spec: #(0.4cm) | Name(auto) | Reg(1.8cm) | Status(1.6cm) | S1–S20 (0.42cm each)
  const sessionCols = SESSIONS.map(() => 'p{0.42cm}').join('@{}')
  const colSpec = `|r|p{3.8cm}|p{1.8cm}|p{1.6cm}|${sessionCols}|`;

  // Header row
  const sessionHeaders = SESSIONS.map(s => `{\\tiny S${s}}`).join(' & ');
  const headerRow = `\\rowcolor{headercolor} {\\color{white}\\bfseries\\tiny \\#} & {\\color{white}\\bfseries\\tiny Full Name} & {\\color{white}\\bfseries\\tiny Reg. No.} & {\\color{white}\\bfseries\\tiny Status} & ${sessionHeaders} \\\\ \\hline`;

  // Data rows
  const dataRows = trainees.map((t, idx) => {
    const abs = countAbsences(t.sessions);
    const susp = isSuspended(t, program);
    const nearLimit = !susp && abs >= threshold - 1 && abs > 0;
    const rowColor = susp ? '\\rowcolor{suspendedcolor}' : nearLimit ? '\\rowcolor{warningcolor}' : '';
    const statusTex = susp
      ? '{\\bfseries\\tiny SUSPENDED}'
      : nearLimit
        ? `{\\tiny ${abs}/${threshold} abs}`
        : '{\\tiny Active}';
    const sessionCells = SESSIONS.map(s => {
      const v = t.sessions[String(s)] || '';
      const color = v === 'P' ? '\\textcolor{presentcolor}' : v === 'A' ? '\\textcolor{absentcolor}' : v === 'L' ? '\\textcolor{leavecolor}' : '';
      return v ? `${color}{\\tiny\\bfseries ${v}}` : '{\\tiny\\textperiodcentered}';
    }).join(' & ');
    return `${rowColor} {\\tiny ${idx + 1}} & {\\tiny ${texEsc(t.name)}} & {\\tiny ${texEsc(t.regNumber || '—')}} & ${statusTex} & ${sessionCells} \\\\ \\hline`;
  }).join('\n');

  // Summary stats
  const stats = computeStats(trainees, program);

  const doc = `% ============================================================
%  Attendance Report — generated by eGIHE
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
{\\Large\\bfseries Attendance Report} \\hfill {\\small Generated by eGIHE}

\\vspace{0.3cm}
\\colorbox{subtleblue}{\\parbox{\\linewidth}{
  \\small
  \\textbf{Faculty:} ${texEsc(facultyName)} \\quad
  \\textbf{Program:} ${texEsc(program)} \\quad
  \\textbf{Month:} ${texEsc(monthLabel)} \\quad
  \\textbf{Trainer:} ${texEsc(trainerName || 'All Trainers')}
}}

\\vspace{0.25cm}
{\\small Suspension rule: \\textbf{${threshold}+} absences triggers SUSPENDED status in the \\textbf{${program}} programme.}

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
  \\bfseries Suspended: & ${stats.suspended} \\\\
  \\bfseries Total trainees: & ${trainees.length} & & \\\\
\\end{tabular}

\\end{document}
`;

  const blob = new Blob([doc], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendance_${facultyName.replace(/\s+/g, '_')}_${program}_${month}.tex`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Shared Attendance Grid ───────────────────────────────────────────────────
function AttendanceGrid({ trainees, program, readOnly, onCellClick, onRemoveTrainee,
  newName, newReg, setNewName, setNewReg, onAddTrainee, onAddKeyDown }) {
  const stats = computeStats(trainees, program);
  const threshold = SUSPENSION_THRESHOLD[program];

  return (
    <>
      {trainees.length > 0 && (
        <div className="att-stats att-no-print">
          <span className="att-stat-chip present">P Present: {stats.present}</span>
          <span className="att-stat-chip absent">A Absent: {stats.absent}</span>
          <span className="att-stat-chip leave">L Leave: {stats.leave}</span>
          <span className="att-stat-chip suspended">! Suspended: {stats.suspended}</span>
          <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--color-text-secondary)', alignSelf: 'center', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            {readOnly ? <><Eye size={13} /> View-only mode</> : <><Info size={13} /> Click any cell to toggle</>}
          </span>
        </div>
      )}

      {stats.suspended > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem 1.1rem', background: '#fee2e2', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.85rem', color: '#b91c1c', fontWeight: 600 }} className="att-no-print">
          <AlertTriangle size={15} />
          {stats.suspended} trainee{stats.suspended !== 1 ? 's are' : ' is'} suspended ({threshold}+ absences in {program} program)
        </div>
      )}

      <div className="att-table-wrapper">
        <table className="att-table">
          <thead>
            <tr>
              <th className="att-col-no">#</th>
              <th className="att-col-name" style={{ textAlign: 'left' }}>Full Name</th>
              <th className="att-col-reg">Reg. No.</th>
              <th className="att-col-status">Status</th>
              {SESSIONS.map(s => <th key={s} className="session-col">S{s}</th>)}
              {!readOnly && <th className="att-no-print" style={{ minWidth: 40, width: 40 }} />}
            </tr>
          </thead>
          <tbody>
            {trainees.map((trainee, idx) => {
              const susp = isSuspended(trainee, program);
              const abs = countAbsences(trainee.sessions);
              const nearLimit = !susp && abs >= threshold - 1 && abs > 0;
              return (
                <tr key={trainee.id} className={susp ? 'row-suspended' : ''}>
                  <td className="att-col-no" style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--color-text-secondary)', padding: '0.3rem 0.2rem' }}>{idx + 1}</td>
                  <td className="att-col-name" style={{ fontWeight: 600 }}>{trainee.name}</td>
                  <td className="att-col-reg" style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', padding: '0.4rem' }}>{trainee.regNumber || '-'}</td>
                  <td className="att-col-status" style={{ padding: '0.3rem 0.4rem' }}>
                    {susp ? <span className="att-badge suspended">SUSPENDED</span>
                      : nearLimit ? <span className="att-badge warning">{abs}/{threshold} abs</span>
                        : <span className="att-badge ok">Active</span>}
                  </td>
                  {SESSIONS.map(s => {
                    const val = trainee.sessions[String(s)] || '';
                    return (
                      <td key={s} style={{ padding: 0 }}>
                        <button
                          className={`att-cell-btn status-${val || 'empty'}`}
                          onClick={readOnly ? undefined : () => onCellClick(trainee.id, s)}
                          style={readOnly ? { cursor: 'default', pointerEvents: 'none' } : {}}
                          title={`Session ${s}: ${val || 'blank'}`}
                        >{val || '·'}</button>
                      </td>
                    );
                  })}
                  {!readOnly && (
                    <td className="att-no-print" style={{ padding: '0.2rem', verticalAlign: 'middle' }}>
                      <button onClick={() => onRemoveTrainee(trainee.id)} style={{ color: 'var(--color-danger)', padding: '0.3rem', borderRadius: '4px', display: 'flex', alignItems: 'center' }} title="Remove trainee">
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
                  <input id="att-new-name" className="att-inline-input" placeholder="Enter trainee full name..." value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={onAddKeyDown} />
                </td>
                <td className="att-col-reg" style={{ padding: 0 }}>
                  <input id="att-new-reg" className="att-inline-input" placeholder="Reg number..." value={newReg} onChange={e => setNewReg(e.target.value)} onKeyDown={onAddKeyDown} />
                </td>
                <td className="att-col-status" style={{ padding: '0.3rem' }}>
                  <button id="att-add-trainee-btn" className="btn btn-primary" style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem', margin: '0 auto', display: 'flex', whiteSpace: 'nowrap' }} onClick={onAddTrainee} disabled={!newName.trim()}>
                    <Plus size={13} /> Add
                  </button>
                </td>
                {SESSIONS.map(s => <td key={s} style={{ background: 'var(--color-bg-secondary)', opacity: 0.5 }} />)}
                <td className="att-no-print" />
              </tr>
            )}

            {trainees.length === 0 && (
              <tr>
                <td colSpan={4 + SESSIONS.length + (readOnly ? 0 : 1)}>
                  <div className="att-empty" style={{ padding: '3rem 2rem' }}>
                    <div className="att-empty-icon">📋</div>
                    <h3 style={{ marginBottom: '0.5rem', color: 'var(--color-text-primary)' }}>
                      {readOnly ? 'No attendance recorded yet' : 'Sheet is empty'}
                    </h3>
                    <p style={{ fontSize: '0.88rem' }}>
                      {readOnly ? 'The trainer has not recorded attendance for this selection yet.'
                        : 'Type a name and press Enter or click Add.'}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {trainees.length > 0 && (
        <div style={{ marginTop: '1rem', display: 'flex', gap: '2rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--color-text-secondary)', padding: '0.75rem 1rem', background: 'var(--color-white)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-bg-secondary)' }}>
          <span><strong style={{ color: '#047857' }}>P</strong> = Present</span>
          <span><strong style={{ color: '#b91c1c' }}>A</strong> = Absent</span>
          <span><strong style={{ color: '#92400e' }}>L</strong> = Permitted Leave</span>
          <span>· = Not recorded</span>
          <span style={{ marginLeft: 'auto', fontStyle: 'italic' }}>Suspension: Day/Night 3+ abs · Weekend 2+ abs</span>
        </div>
      )}
    </>
  );
}

// ─── SuperAdmin Read-Only View ────────────────────────────────────────────────
function SuperAdminView({ faculties, monthOptions }) {
  const [activeFacultyId, setActiveFacultyId] = useState(faculties[0]?.id || '');
  const [activeProgram, setActiveProgram] = useState('Day');
  const [activeMonth, setActiveMonth] = useState(currentMonthValue());
  const [sheets, setSheets] = useState([]);
  const [activeTrainerIdx, setActiveTrainerIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [trainerCache, setTrainerCache] = useState({});

  const activeFaculty = faculties.find(f => f.id === activeFacultyId);
  const activeMonthLabel = monthOptions.find(m => m.value === activeMonth)?.label || activeMonth;

  const loadAllSheets = useCallback(async () => {
    if (!activeFacultyId) return;
    setLoading(true);
    setActiveTrainerIdx(0);
    try {
      const q = query(
        collection(db, 'attendance'),
        where('facultyId', '==', activeFacultyId),
        where('program', '==', activeProgram),
        where('month', '==', activeMonth)
      );
      const snap = await getDocs(q);
      const results = [];
      const cacheUpdate = { ...trainerCache };

      for (const d of snap.docs) {
        const data = d.data();
        const tid = data.trainerId;
        let tName = cacheUpdate[tid];
        if (!tName) {
          try {
            const uSnap = await getDoc(doc(db, 'users', tid));
            if (uSnap.exists()) {
              const u = uSnap.data();
              tName = `${u.firstName} ${u.lastName}`;
            } else { tName = tid; }
          } catch { tName = tid; }
          cacheUpdate[tid] = tName;
        }
        results.push({ trainerId: tid, trainerName: tName, trainees: data.trainees || [] });
      }
      results.sort((a, b) => a.trainerName.localeCompare(b.trainerName));
      setSheets(results);
      setTrainerCache(cacheUpdate);
    } catch (err) {
      console.error('Error loading sheets:', err);
      setSheets([]);
    }
    setLoading(false);
  }, [activeFacultyId, activeProgram, activeMonth]);

  useEffect(() => { loadAllSheets(); }, [activeFacultyId, activeProgram, activeMonth]);

  const currentSheet = sheets[activeTrainerIdx] || null;
  const currentTrainees = currentSheet?.trainees || [];
  const allTrainees = sheets.flatMap(s => s.trainees);
  const totalStats = computeStats(allTrainees, activeProgram);

  return (
    <div className="animate-fade-in">
      <div className="att-no-print" style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title">Attendance Overview</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.8rem', background: 'rgba(37,99,235,0.08)', borderRadius: '2rem', fontSize: '0.83rem', fontWeight: 600, color: 'var(--color-accent)' }}>
            <Eye size={13} /> Read-only — viewing all trainer records
          </span>
        </div>
      </div>

      <div className="att-print-area">
        {faculties.length > 0 && (
          <div className="att-faculty-tabs att-no-print">
            {faculties.map(f => (
              <button key={f.id} className={`att-faculty-tab${activeFacultyId === f.id ? ' active' : ''}`} onClick={() => setActiveFacultyId(f.id)}>
                {f.name}
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
            <label htmlFor="att-month-sa" style={{ fontWeight: 600, fontSize: '0.9rem' }}>Month:</label>
            <select id="att-month-sa" className="att-month-select" value={activeMonth} onChange={e => setActiveMonth(e.target.value)}>
              {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {sheets.length > 0 && (
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Users size={13} /> {sheets.length} trainer sheet{sheets.length !== 1 ? 's' : ''} &middot; {allTrainees.length} trainees
            </span>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
            <button id="att-sa-latex-btn" className="btn btn-secondary"
              onClick={() => downloadLaTeX(currentTrainees, activeFaculty?.name || '', activeProgram, activeMonth, activeMonthLabel, currentSheet?.trainerName)}
              disabled={currentTrainees.length === 0}>
              <FileCode2 size={16} /> LaTeX / PDF
            </button>
            <button id="att-sa-csv-btn" className="btn btn-secondary"
              onClick={() => downloadCSV(currentTrainees, activeFaculty?.name || '', activeProgram, activeMonth, activeMonthLabel, currentSheet?.trainerName)}
              disabled={currentTrainees.length === 0}>
              <Download size={16} /> Excel / CSV
            </button>
          </div>
        </div>

        {sheets.length > 0 && !loading && (
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', padding: '0.75rem 1.2rem', background: 'linear-gradient(135deg, #f0f4ff, #f7f7f7)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-bg-secondary)', marginBottom: '1.25rem', fontSize: '0.85rem', fontWeight: 600 }} className="att-no-print">
            <span style={{ color: 'var(--color-text-secondary)' }}>All trainers combined:</span>
            <span style={{ color: '#047857' }}>P Present: {totalStats.present}</span>
            <span style={{ color: '#b91c1c' }}>A Absent: {totalStats.absent}</span>
            <span style={{ color: '#92400e' }}>L Leave: {totalStats.leave}</span>
            <span style={{ color: '#7f1d1d' }}>Suspended: {totalStats.suspended}</span>
          </div>
        )}

        {sheets.length > 1 && (
          <div className="att-no-print" style={{ marginBottom: '1rem' }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Select Trainer Sheet:</p>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {sheets.map((sh, idx) => (
                <button key={sh.trainerId} onClick={() => setActiveTrainerIdx(idx)}
                  style={{ padding: '0.4rem 1rem', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '0.83rem', border: `2px solid ${activeTrainerIdx === idx ? 'var(--color-text-primary)' : 'var(--color-bg-secondary)'}`, background: activeTrainerIdx === idx ? 'var(--color-text-primary)' : 'var(--color-white)', color: activeTrainerIdx === idx ? 'var(--color-white)' : 'var(--color-text-secondary)', cursor: 'pointer', transition: 'all 0.2s' }}>
                  {sh.trainerName} <span style={{ opacity: 0.7, fontSize: '0.76rem' }}>({sh.trainees.length})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Print header */}
        <div style={{ display: 'none' }} className="att-print-header-block">
          <h2 style={{ fontSize: '1.3rem', marginBottom: '0.2rem' }}>Attendance — {activeFaculty?.name}</h2>
          <p style={{ fontSize: '0.9rem', color: '#555' }}>Program: <strong>{activeProgram}</strong> | Month: <strong>{activeMonthLabel}</strong></p>
          <p style={{ fontSize: '0.8rem', color: '#888' }}>Trainer: {currentSheet?.trainerName || 'All'} | Threshold: {SUSPENSION_THRESHOLD[activeProgram]} absences</p>
          <hr style={{ margin: '0.6rem 0' }} />
        </div>

        {sheets.length > 0 && currentSheet && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(37,99,235,0.06)', borderRadius: 'var(--radius-md)', fontSize: '0.88rem', color: 'var(--color-text-primary)', fontWeight: 600 }} className="att-no-print">
            <Eye size={15} style={{ color: 'var(--color-accent)' }} />
            Viewing: <strong>{currentSheet.trainerName}</strong>
            <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>&middot; {currentTrainees.length} trainee{currentTrainees.length !== 1 ? 's' : ''}</span>
          </div>
        )}

        {loading ? (
          <div className="att-empty"><div className="att-empty-icon">loading</div><p>Loading records...</p></div>
        ) : sheets.length === 0 ? (
          <div className="att-empty" style={{ padding: '4rem 2rem' }}>
            <div className="att-empty-icon">📋</div>
            <h3>No Records Found</h3>
            <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
              No trainer has recorded attendance for <strong>{activeFaculty?.name}</strong> — <strong>{activeProgram}</strong> in <strong>{activeMonthLabel}</strong> yet.
            </p>
          </div>
        ) : (
          <AttendanceGrid trainees={currentTrainees} program={activeProgram} readOnly={true} />
        )}
      </div>
    </div>
  );
}

// ─── Trainer Editable View ────────────────────────────────────────────────────
function TrainerView({ faculties, monthOptions, user, userData }) {
  const [activeFacultyId, setActiveFacultyId] = useState(faculties[0]?.id || '');
  const [activeProgram, setActiveProgram] = useState('Day');
  const [activeMonth, setActiveMonth] = useState(currentMonthValue());
  const [trainees, setTrainees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [docExists, setDocExists] = useState(false);
  const [newName, setNewName] = useState('');
  const [newReg, setNewReg] = useState('');

  const activeFaculty = faculties.find(f => f.id === activeFacultyId);
  const activeMonthLabel = monthOptions.find(m => m.value === activeMonth)?.label || activeMonth;

  const loadSheet = useCallback(async () => {
    if (!activeFacultyId || !user) return;
    setLoading(true);
    setSaved(false);
    const docId = makeDocId(user.uid, activeFacultyId, activeProgram, activeMonth);
    try {
      const snap = await getDoc(doc(db, 'attendance', docId));
      if (snap.exists()) { setTrainees(snap.data().trainees || []); setDocExists(true); }
      else { setTrainees([]); setDocExists(false); }
    } catch (err) { console.error(err); setTrainees([]); }
    setLoading(false);
  }, [activeFacultyId, activeProgram, activeMonth, user]);

  useEffect(() => { loadSheet(); }, [loadSheet]);

  const handleSave = async () => {
    if (!user || !activeFacultyId) return;
    setSaving(true);
    const docId = makeDocId(user.uid, activeFacultyId, activeProgram, activeMonth);
    try {
      await setDoc(doc(db, 'attendance', docId), {
        facultyId: activeFacultyId, trainerId: user.uid,
        program: activeProgram, month: activeMonth, trainees,
        updatedAt: new Date().toISOString(),
        ...(docExists ? {} : { createdAt: new Date().toISOString() })
      }, { merge: true });
      setDocExists(true); setSaved(true);
      setTimeout(() => setSaved(false), 3500);
    } catch (err) { console.error(err); alert('Failed to save. Please try again.'); }
    setSaving(false);
  };

  const handleAddTrainee = () => {
    if (!newName.trim()) return;
    setTrainees(prev => [...prev, newTrainee(newName.trim(), newReg.trim())]);
    setNewName(''); setNewReg(''); setSaved(false);
  };
  const handleAddKeyDown = (e) => { if (e.key === 'Enter') handleAddTrainee(); };
  const handleRemoveTrainee = (id) => {
    if (!window.confirm('Remove this trainee?')) return;
    setTrainees(prev => prev.filter(t => t.id !== id)); setSaved(false);
  };
  const handleCellClick = (traineeId, sessionNum) => {
    setTrainees(prev => prev.map(t => {
      if (t.id !== traineeId) return t;
      const key = String(sessionNum);
      return { ...t, sessions: { ...t.sessions, [key]: cycleStatus(t.sessions[key]) } };
    }));
    setSaved(false);
  };

  return (
    <div className="animate-fade-in">
      <div className="att-no-print" style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title">Attendance</h1>
        <p className="page-subtitle" style={{ marginBottom: 0 }}>
          Monthly attendance — click a session cell to cycle: <strong>P</strong> (Present) | <strong>A</strong> (Absent) | <strong>L</strong> (Leave)
        </p>
      </div>

      <div className="att-print-area">
        {faculties.length > 0 && (
          <div className="att-faculty-tabs att-no-print">
            {faculties.map(f => (
              <button key={f.id} className={`att-faculty-tab${activeFacultyId === f.id ? ' active' : ''}`} onClick={() => { setActiveFacultyId(f.id); setSaved(false); }}>
                {f.name}
              </button>
            ))}
          </div>
        )}

        <div className="att-program-selector att-no-print">
          {PROGRAMS.map(prog => (
            <button key={prog} className={`att-program-btn${activeProgram === prog ? ' active' : ''}`} onClick={() => { setActiveProgram(prog); setSaved(false); }}>
              {prog} <span style={{ marginLeft: '0.3rem', fontSize: '0.72rem', opacity: 0.7 }}>({SUSPENSION_THRESHOLD[prog]} abs.)</span>
            </button>
          ))}
        </div>

        <div className="att-controls att-no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label htmlFor="att-month-tr" style={{ fontWeight: 600, fontSize: '0.9rem' }}>Month:</label>
            <select id="att-month-tr" className="att-month-select" value={activeMonth} onChange={e => { setActiveMonth(e.target.value); setSaved(false); }}>
              {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button id="att-save-btn" className="btn btn-primary" onClick={handleSave} disabled={saving || trainees.length === 0}>
              {saving ? <><Save size={16} /> Saving...</> : saved ? <><CheckCircle size={16} /> Saved!</> : <><Save size={16} /> Save Sheet</>}
            </button>
            <button id="att-latex-btn" className="btn btn-secondary"
              onClick={() => downloadLaTeX(trainees, activeFaculty?.name || '', activeProgram, activeMonth, activeMonthLabel, `${userData?.firstName} ${userData?.lastName}`)}
              disabled={trainees.length === 0}>
              <FileCode2 size={16} /> LaTeX / PDF
            </button>
            <button id="att-csv-btn" className="btn btn-secondary"
              onClick={() => downloadCSV(trainees, activeFaculty?.name || '', activeProgram, activeMonth, activeMonthLabel, `${userData?.firstName} ${userData?.lastName}`)}
              disabled={trainees.length === 0}>
              <Download size={16} /> Excel / CSV
            </button>
          </div>
        </div>

        <div style={{ display: 'none' }} className="att-print-header-block">
          <h2 style={{ fontSize: '1.3rem', marginBottom: '0.2rem' }}>Attendance Sheet — {activeFaculty?.name}</h2>
          <p style={{ fontSize: '0.9rem', color: '#555' }}>Program: <strong>{activeProgram}</strong> | Month: <strong>{activeMonthLabel}</strong></p>
          <p style={{ fontSize: '0.8rem', color: '#888' }}>Trainer: {userData?.firstName} {userData?.lastName} | Threshold: {SUSPENSION_THRESHOLD[activeProgram]} absences</p>
          <hr style={{ margin: '0.6rem 0' }} />
        </div>

        {loading ? (
          <div className="att-empty"><div className="att-empty-icon">loading</div><p>Loading sheet...</p></div>
        ) : (
          <AttendanceGrid
            trainees={trainees} program={activeProgram} readOnly={false}
            onCellClick={handleCellClick} onRemoveTrainee={handleRemoveTrainee}
            newName={newName} newReg={newReg} setNewName={setNewName} setNewReg={setNewReg}
            onAddTrainee={handleAddTrainee} onAddKeyDown={handleAddKeyDown}
          />
        )}
      </div>
    </div>
  );
}

// ─── Root Component ───────────────────────────────────────────────────────────
export default function Attendance() {
  const { userData, user } = useAuthStore();
  const isSuperAdmin = userData?.role === 'superadmin';
  const [faculties, setFaculties] = useState([]);
  const [loading, setLoading] = useState(true);
  const monthOptions = getMonthOptions();

  useEffect(() => {
    const fetchFaculties = async () => {
      if (!userData) return;
      const snap = await getDocs(collection(db, 'faculties'));
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setFaculties(isSuperAdmin ? all : all.filter(f => (userData?.faculties || []).includes(f.id)));
      setLoading(false);
    };
    fetchFaculties();
  }, [userData, isSuperAdmin]);

  if (!userData || loading) {
    return <div className="animate-fade-in" style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading...</div>;
  }

  if (!faculties.length) {
    return (
      <div className="animate-fade-in">
        <h1 className="page-title">Attendance</h1>
        <p className="page-subtitle">Monthly trainee attendance management</p>
        <div className="card att-empty">
          <div className="att-empty-icon">📋</div>
          <h3>No Faculties Assigned</h3>
          <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>You don't have any faculties assigned yet. Contact the administrator.</p>
        </div>
      </div>
    );
  }

  if (isSuperAdmin) {
    return <SuperAdminView faculties={faculties} monthOptions={monthOptions} />;
  }

  return <TrainerView faculties={faculties} monthOptions={monthOptions} user={user} userData={userData} />;
}

