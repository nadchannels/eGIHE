import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuthStore } from '../../store/authStore';
import { Trash2, Plus, X } from 'lucide-react';

const timeSlots = [
  "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00",
  "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00",
  "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30"
];

const endSlots = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00"
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

export default function AdminTimetable() {
  const { userData } = useAuthStore();
  const isSuperAdmin = userData?.role === 'superadmin';

  const [branches, setBranches] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [loading, setLoading] = useState(false);

  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState('');
  const [selectedWeek, setSelectedWeek] = useState('1'); // '1' or '2'

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    dayOfWeek: 1,
    startTime: '08:30',
    endTime: '09:00',
    subject: '',
    trainerId: '',
    room: ''
  });
  const [weeksData, setWeeksData] = useState([]);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchData();
    } else {
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
    }
    fetchTimetable();
  }, [userData, selectedBranch, selectedFaculty]);

  const fetchData = async () => {
    const bSnap = await getDocs(collection(db, 'branches'));
    const fSnap = await getDocs(collection(db, 'faculties'));
    const tSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'trainer'), where('status', '==', 'approved')));
    
    setBranches(bSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setFaculties(fSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setTrainers(tSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const fetchTimetable = async () => {
    setLoading(true);
    try {
      let q;
      if (isSuperAdmin) {
        if (!selectedBranch || !selectedFaculty) {
          setTimetable([]);
          setLoading(false);
          return;
        }
        q = query(collection(db, 'timetable'), where('branchId', '==', selectedBranch), where('facultyId', '==', selectedFaculty));
      } else {
        q = query(collection(db, 'timetable'), where('trainerId', '==', userData.username));
      }
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setTimetable(data);
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  const openModal = (dayIndex, time) => {
    if (!isSuperAdmin) return;
    const startIndex = timeSlots.indexOf(time);
    const endTime = startIndex >= 0 && startIndex < timeSlots.length - 1 ? timeSlots[startIndex + 1] : "20:00";
    
    setForm({
      dayOfWeek: dayIndex,
      startTime: time,
      endTime: endTime,
      subject: '',
      trainerId: '',
      room: ''
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const selectedTrainer = trainers.find(t => t.username === form.trainerId);
      const trainerName = selectedTrainer ? `${selectedTrainer.firstName} ${selectedTrainer.lastName}` : form.trainerId;

      if (getRowFromTime(form.endTime) <= getRowFromTime(form.startTime)) {
        alert("Ending time must be after starting time.");
        setLoading(false);
        return;
      }

      const weekPattern = selectedWeek === '1' ? 'Both' : '2';

      await addDoc(collection(db, 'timetable'), {
        branchId: selectedBranch,
        facultyId: selectedFaculty,
        dayOfWeek: form.dayOfWeek,
        startTime: form.startTime,
        endTime: form.endTime,
        subject: form.subject,
        trainerId: form.trainerId,
        trainerName,
        trainerFirstName: selectedTrainer ? selectedTrainer.firstName : form.trainerId,
        room: form.room,
        weekPattern: weekPattern
      });
      
      setModalOpen(false);
      fetchTimetable();
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  const handleDelete = async (session) => {
    if (!confirm('Delete this class?')) return;
    
    try {
      if (session.weekPattern === 'Both') {
        const newPattern = selectedWeek === '1' ? '2' : '1';
        await updateDoc(doc(db, 'timetable', session.id), { weekPattern: newPattern });
      } else {
        await deleteDoc(doc(db, 'timetable', session.id));
      }
      fetchTimetable();
    } catch (error) {
      console.error(error);
    }
  };

  const filteredTimetable = timetable.filter(t => t.weekPattern === selectedWeek || t.weekPattern === 'Both');

  return (
    <div className="animate-fade-in">
      <h1 className="page-title">Timetable Management</h1>
      <p className="page-subtitle">
        {isSuperAdmin ? 'Schedule classes for all branches and faculties' : 'View your scheduled classes'}
      </p>

      {isSuperAdmin && (
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
            <div className="input-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
              <label>Select Week Pattern</label>
              <select className="input-control" value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)}>
                <option value="1">Week 1 (Odd Weeks)</option>
                <option value="2">Week 2 (Even Weeks)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {isSuperAdmin ? (
        selectedBranch && selectedFaculty ? (
          <div className="card">
            <h2>Schedule - Week {selectedWeek}</h2>
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
                          className={`timetable-bg-cell ${isSuperAdmin ? 'clickable' : ''}`}
                          style={{
                            gridRow: rowIndex,
                            gridColumn: colIdx + 2
                          }}
                          onClick={() => openModal(colIdx + 1, time)}
                        ></div>
                      ))}
                    </React.Fragment>
                  );
                })}

                {/* Sessions */}
                {filteredTimetable.map(session => {
                  const rowStart = getRowFromTime(session.startTime);
                  const rowEnd = getRowFromTime(session.endTime);
                  const col = session.dayOfWeek + 1;

                  return (
                    <div 
                      key={session.id} 
                      className="timetable-session"
                      style={{ 
                        gridRow: `${rowStart} / ${rowEnd}`, 
                        gridColumn: col,
                      }}
                    >
                      <h4>{session.subject}</h4>
                      <p>{session.startTime} - {session.endTime}</p>
                      <p>{session.trainerFirstName || session.trainerName?.split(' ')[0]}</p>
                      <p>Room: {session.room}</p>
                      
                      {isSuperAdmin && (
                        <button 
                           className="delete-btn"
                           onClick={(e) => { e.stopPropagation(); handleDelete(session); }}
                           title="Delete Class"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <p style={{ color: 'var(--color-text-secondary)' }}>Please select a Branch and Faculty to view the timetable.</p>
          </div>
        )
      ) : (
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
      )}

      {/* Add Session Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2>Add Class</h2>
              <button onClick={() => setModalOpen(false)}><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="input-group">
                <label>Day</label>
                <select className="input-control" value={form.dayOfWeek} disabled>
                  {daysOfWeek.map((d, i) => <option key={i} value={i+1}>{d}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label>Subject</label>
                <input type="text" className="input-control" required value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} />
              </div>
              <div className="input-group">
                <label>Start Time</label>
                <select className="input-control" required value={form.startTime} onChange={e => setForm({...form, startTime: e.target.value})}>
                  {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label>End Time</label>
                <select className="input-control" required value={form.endTime} onChange={e => setForm({...form, endTime: e.target.value})}>
                  {endSlots.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                <label>Trainer Username</label>
                <select className="input-control" required value={form.trainerId} onChange={e => setForm({...form, trainerId: e.target.value})}>
                  <option value="">Select Trainer</option>
                  {trainers.map(t => <option key={t.id} value={t.username}>{t.firstName} {t.lastName} (@{t.username})</option>)}
                </select>
              </div>
              <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                <label>Room Name</label>
                <input type="text" className="input-control" required value={form.room} onChange={e => setForm({...form, room: e.target.value})} />
              </div>
              
              <div style={{ gridColumn: '1 / -1', marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                  <Plus size={16} /> Schedule Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
