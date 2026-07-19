import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuthStore } from '../../store/authStore';
import { Building2, Calendar, Eye } from 'lucide-react';

const timeSlots = [
  "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00",
  "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00",
  "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30"
];

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const getRowFromTime = (time) => {
  if (!time) return 2;
  const [h, m] = time.split(':').map(Number);
  const totalMins = h * 60 + m - (8 * 60 + 30);
  return Math.floor(totalMins / 30) + 2;
};

function getISOWeekNumber(d) {
  const date = new Date(d.getTime());
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

const getMonday = (d) => {
  const date = new Date(d);
  const day = date.getDay() || 7;
  if (day !== 1) date.setHours(-24 * (day - 1));
  date.setHours(0, 0, 0, 0);
  return date;
};

export default function BranchTimetable() {
  const { userData } = useAuthStore();
  const isSuperAdmin = userData?.role === 'superadmin';
  const isBranchManager = userData?.role === 'branch_manager';

  const [branch, setBranch] = useState(null);
  const [branches, setBranches] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [loading, setLoading] = useState(false);

  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState('');
  const [selectedWeek, setSelectedWeek] = useState('1');
  const [weeksData, setWeeksData] = useState([]);

  // Build the upcoming weeks data for branch manager (read-only multi-week view)
  useEffect(() => {
    const weeks = [];
    const currentMonday = getMonday(new Date());
    for (let i = 0; i < 8; i++) {
      const weekStart = new Date(currentMonday);
      weekStart.setDate(weekStart.getDate() + (i * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const isoWeek = getISOWeekNumber(weekStart);
      const pattern = isoWeek % 2 !== 0 ? '1' : '2';
      weeks.push({ startDate: weekStart, endDate: weekEnd, pattern });
    }
    setWeeksData(weeks);
  }, []);

  // Fetch branch info for branch manager
  useEffect(() => {
    const fetchBranchData = async () => {
      if (isSuperAdmin) {
        const bSnap = await getDocs(collection(db, 'branches'));
        const fSnap = await getDocs(collection(db, 'faculties'));
        setBranches(bSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setFaculties(fSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else if (isBranchManager && userData?.branch) {
        try {
          const snap = await getDoc(doc(db, 'branches', userData.branch));
          if (snap.exists()) setBranch({ id: snap.id, ...snap.data() });
        } catch (err) { console.error(err); }
      }
    };
    if (userData) fetchBranchData();
  }, [userData, isSuperAdmin, isBranchManager]);

  // Fetch timetable for branch manager's branch
  useEffect(() => {
    if (!isBranchManager || !userData?.branch) return;
    const fetchTimetable = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'timetable'),
          where('branchId', '==', userData.branch)
        );
        const snap = await getDocs(q);
        setTimetable(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) { console.error(err); }
      setLoading(false);
    };
    fetchTimetable();
  }, [userData, isBranchManager]);

  // Fetch timetable for superadmin (when branch+faculty selected)
  useEffect(() => {
    if (!isSuperAdmin) return;
    if (!selectedBranch || !selectedFaculty) { setTimetable([]); return; }
    const fetchTimetable = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'timetable'),
          where('branchId', '==', selectedBranch),
          where('facultyId', '==', selectedFaculty)
        );
        const snap = await getDocs(q);
        setTimetable(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) { console.error(err); }
      setLoading(false);
    };
    fetchTimetable();
  }, [isSuperAdmin, selectedBranch, selectedFaculty]);

  const filteredTimetable = timetable.filter(
    t => t.weekPattern === selectedWeek || t.weekPattern === 'Both'
  );

  // ── Timetable Grid (read-only) ────────────────────────────────────────────
  function TimetableGrid({ sessions }) {
    return (
      <div className="timetable-wrapper">
        <div className="timetable-css-grid" style={{ minWidth: '800px' }}>
          {/* Header */}
          <div className="timetable-header-cell" style={{ gridRow: 1, gridColumn: 1, borderRight: '1px solid var(--color-bg-secondary)' }}>
            Time
          </div>
          {daysOfWeek.map((day, i) => (
            <div key={day} className="timetable-header-cell" style={{ gridRow: 1, gridColumn: i + 2 }}>
              {day}
            </div>
          ))}

          {/* Grid Background */}
          {timeSlots.map((time) => {
            const rowIndex = getRowFromTime(time);
            return (
              <React.Fragment key={time}>
                <div className="timetable-time-cell" style={{ gridRow: rowIndex, gridColumn: 1, borderRight: '1px solid var(--color-bg-secondary)' }}>
                  {time}
                </div>
                {daysOfWeek.map((day, colIdx) => (
                  <div key={`${day}-${time}`} className="timetable-bg-cell" style={{ gridRow: rowIndex, gridColumn: colIdx + 2 }} />
                ))}
              </React.Fragment>
            );
          })}

          {/* Sessions (read-only) */}
          {sessions.map(session => {
            const rowStart = getRowFromTime(session.startTime);
            const rowEnd   = getRowFromTime(session.endTime);
            const col      = session.dayOfWeek + 1;
            return (
              <div key={session.id} className="timetable-session" style={{ gridRow: `${rowStart} / ${rowEnd}`, gridColumn: col, cursor: 'default' }}>
                <h4>{session.subject}</h4>
                <p>{session.startTime} - {session.endTime}</p>
                <p>{session.trainerFirstName || session.trainerName?.split(' ')[0]}</p>
                <p>Room: {session.room}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (!userData) return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading...</div>;

  // ── Branch Manager View ───────────────────────────────────────────────────
  if (isBranchManager) {
    if (!branch) {
      return (
        <div className="animate-fade-in">
          <h1 className="page-title">Branch Timetable</h1>
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <Building2 size={48} style={{ color: 'var(--color-text-secondary)', marginBottom: '1rem' }} />
            <h3>No Branch Assigned</h3>
            <p style={{ marginTop: '0.5rem', color: 'var(--color-text-secondary)' }}>You are not assigned to any branch. Contact the administrator.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="animate-fade-in">
        <h1 className="page-title">Branch Timetable</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.9rem', background: 'rgba(37,99,235,0.08)', borderRadius: '2rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-accent)' }}>
            <Building2 size={14} /> {branch.name}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.9rem', background: 'rgba(16,185,129,0.08)', borderRadius: '2rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-success)' }}>
            <Eye size={14} /> Read-only view
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>Loading timetable...</div>
        ) : (
          <div>
            {weeksData.map((week, idx) => {
              const weekSessions = timetable.filter(
                t => t.weekPattern === week.pattern || t.weekPattern === 'Both'
              );
              return (
                <div key={idx} className="card" style={{ marginBottom: '2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '2px solid var(--color-bg-secondary)' }}>
                    <Calendar size={18} style={{ color: 'var(--color-accent)' }} />
                    <h3 style={{ margin: 0 }}>
                      {week.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {week.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </h3>
                    <span style={{ fontSize: '0.8rem', padding: '0.2rem 0.6rem', background: 'var(--color-bg-secondary)', borderRadius: '1rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                      Week {week.pattern}
                    </span>
                  </div>
                  {weekSessions.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                      No classes scheduled for this week.
                    </div>
                  ) : (
                    <TimetableGrid sessions={weekSessions} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── SuperAdmin View ───────────────────────────────────────────────────────
  if (isSuperAdmin) {
    return (
      <div className="animate-fade-in">
        <h1 className="page-title">Branch Timetable</h1>
        <p className="page-subtitle">Read-only timetable view by branch and faculty</p>

        <div className="card" style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div className="input-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
              <label>Branch</label>
              <select className="input-control" value={selectedBranch} onChange={e => { setSelectedBranch(e.target.value); setSelectedFaculty(''); }}>
                <option value="">Select Branch</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="input-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
              <label>Faculty</label>
              <select className="input-control" value={selectedFaculty} onChange={e => setSelectedFaculty(e.target.value)} disabled={!selectedBranch}>
                <option value="">Select Faculty</option>
                {faculties.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div className="input-group" style={{ flex: 1, minWidth: '180px', marginBottom: 0 }}>
              <label>Week Pattern</label>
              <select className="input-control" value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)}>
                <option value="1">Week 1 (Odd Weeks)</option>
                <option value="2">Week 2 (Even Weeks)</option>
              </select>
            </div>
          </div>
        </div>

        {selectedBranch && selectedFaculty ? (
          loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>Loading...</div>
          ) : (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0 }}>Schedule — Week {selectedWeek}</h2>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.6rem', background: 'rgba(16,185,129,0.08)', borderRadius: '1rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-success)', marginLeft: '0.5rem' }}>
                  <Eye size={12} /> Read-only
                </span>
              </div>
              {filteredTimetable.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>
                  No classes scheduled for this selection.
                </div>
              ) : (
                <TimetableGrid sessions={filteredTimetable} />
              )}
            </div>
          )
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <p style={{ color: 'var(--color-text-secondary)' }}>Please select a Branch and Faculty to view the timetable.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
      You do not have access to this page.
    </div>
  );
}
