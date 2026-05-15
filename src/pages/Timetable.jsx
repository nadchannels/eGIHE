import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Info } from 'lucide-react';

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
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay()||7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
    return Math.ceil(( ( (date - yearStart) / 86400000) + 1)/7);
}

const getMonday = (d) => {
  const date = new Date(d);
  const day = date.getDay() || 7; 
  if (day !== 1) date.setHours(-24 * (day - 1)); 
  date.setHours(0, 0, 0, 0);
  return date;
};

export default function Timetable() {
  const [branches, setBranches] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState('');
  const [timetable, setTimetable] = useState([]);
  const [loading, setLoading] = useState(false);
  const [weeksData, setWeeksData] = useState([]);

  useEffect(() => {
    fetchBranches();
    
    const weeks = [];
    let currentMonday = getMonday(new Date());

    for (let i = 0; i < 12; i++) {
      const weekStart = new Date(currentMonday);
      weekStart.setDate(weekStart.getDate() + (i * 7));
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const isoWeek = getISOWeekNumber(weekStart);
      const pattern = isoWeek % 2 !== 0 ? '1' : '2';

      weeks.push({
        startDate: weekStart,
        endDate: weekEnd,
        pattern
      });
    }
    setWeeksData(weeks);
  }, []);

  useEffect(() => {
    if (selectedBranch) {
      fetchFaculties(selectedBranch);
    } else {
      setFaculties([]);
    }
  }, [selectedBranch]);

  useEffect(() => {
    if (selectedBranch && selectedFaculty) {
      fetchTimetable(selectedBranch, selectedFaculty);
    }
  }, [selectedBranch, selectedFaculty]);

  const fetchBranches = async () => {
    const q = query(collection(db, 'branches'));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setBranches(data);
  };

  const fetchFaculties = async (branchId) => {
    const q = query(collection(db, 'faculties'), where('branches', 'array-contains', branchId));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setFaculties(data);
  };

  const fetchTimetable = async (branchId, facultyId) => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'timetable'),
        where('branchId', '==', branchId),
        where('facultyId', '==', facultyId)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTimetable(data);
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  return (
    <div className="animate-fade-in">
      <h1 className="page-title">Timetable</h1>
      <p className="page-subtitle">Select your branch and faculty to view your schedule</p>

      <div className="card" style={{ marginBottom: '2rem', backgroundColor: 'var(--color-bg-primary)' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <Info size={24} color="var(--color-warning)" />
          <p style={{ color: 'var(--color-text-primary)', fontWeight: '500' }}>
            Timetable can be changed at any time. Please visit regularly and check the announcements page.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '2rem' }}>
          <div className="input-group" style={{ flex: 1 }}>
            <label>Branch</label>
            <select 
              className="input-control" 
              value={selectedBranch}
              onChange={(e) => {
                setSelectedBranch(e.target.value);
                setSelectedFaculty('');
              }}
            >
              <option value="">Select a branch</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div className="input-group" style={{ flex: 1 }}>
            <label>Faculty</label>
            <select 
              className="input-control"
              value={selectedFaculty}
              onChange={(e) => setSelectedFaculty(e.target.value)}
              disabled={!selectedBranch}
            >
              <option value="">Select a faculty</option>
              {faculties.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p>Loading timetable...</p>
        </div>
      ) : selectedBranch && selectedFaculty ? (
        <div>
          {weeksData.map((week, idx) => {
            const weekClasses = timetable.filter(t => t.weekPattern === week.pattern || t.weekPattern === 'Both');
            
            return (
              <div key={idx} className="card" style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1.5rem', borderBottom: '2px solid var(--color-bg-secondary)', paddingBottom: '0.5rem' }}>
                  Week of {week.startDate.toLocaleDateString()} - {week.endDate.toLocaleDateString()}
                </h3>
                <div className="timetable-wrapper">
                  <div className="timetable-css-grid" style={{ minWidth: '800px' }}>
                    {/* Header */}
                    <div 
                      className="timetable-header-cell" 
                      style={{ 
                        gridRow: 1,
                        gridColumn: 1,
                        borderRight: '1px solid var(--color-bg-secondary)' 
                      }}
                    >
                      Time
                    </div>
                    {daysOfWeek.map((day, i) => (
                      <div 
                        key={day} 
                        className="timetable-header-cell"
                        style={{
                          gridRow: 1,
                          gridColumn: i + 2
                        }}
                      >
                        {day}
                      </div>
                    ))}

                    {/* Grid Background */}
                    {timeSlots.map((time) => {
                      const rowIndex = getRowFromTime(time);
                      return (
                        <React.Fragment key={time}>
                          <div 
                            className="timetable-time-cell" 
                            style={{ 
                              gridRow: rowIndex,
                              gridColumn: 1,
                              borderRight: '1px solid var(--color-bg-secondary)' 
                            }}
                          >
                            {time}
                          </div>
                          {daysOfWeek.map((day, colIdx) => (
                            <div 
                              key={`${day}-${time}`} 
                              className="timetable-bg-cell"
                              style={{
                                gridRow: rowIndex,
                                gridColumn: colIdx + 2
                              }}
                            ></div>
                          ))}
                        </React.Fragment>
                      );
                    })}

                    {/* Sessions */}
                    {weekClasses.map(session => {
                      const rowStart = getRowFromTime(session.startTime);
                      const rowEnd = getRowFromTime(session.endTime);
                      const col = session.dayOfWeek + 1;

                      return (
                        <div 
                          key={session.id} 
                          className="timetable-session"
                          style={{ gridRow: `${rowStart} / ${rowEnd}`, gridColumn: col }}
                        >
                          <h4>{session.subject}</h4>
                          <p>{session.startTime} - {session.endTime}</p>
                          <p>{session.trainerFirstName || session.trainerName?.split(' ')[0]}</p>
                          <p>Room: {session.room}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
