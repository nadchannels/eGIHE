import React, { useState, useEffect } from 'react';
import { collection, addDoc, deleteDoc, updateDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { Plus, Trash2, Edit2 } from 'lucide-react';

export default function InstitutionManager() {
  const [branches, setBranches] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [loading, setLoading] = useState(false);

  const [branchForm, setBranchForm] = useState({ name: '', tag: '' });
  const [facultyForm, setFacultyForm] = useState({ name: '', tag: '', branchIds: [] });
  
  const [editingFaculty, setEditingFaculty] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const bSnap = await getDocs(collection(db, 'branches'));
    setBranches(bSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    
    const fSnap = await getDocs(collection(db, 'faculties'));
    setFaculties(fSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const handleAddBranch = async (e) => {
    e.preventDefault();
    if (!branchForm.tag.match(/^[a-zA-Z0-9]+$/)) {
      alert('Tag must be one word with no special characters');
      return;
    }
    setLoading(true);
    await addDoc(collection(db, 'branches'), branchForm);
    setBranchForm({ name: '', tag: '' });
    fetchData();
    setLoading(false);
  };

  const handleDeleteBranch = async (id) => {
    if (confirm('Delete this branch?')) {
      await deleteDoc(doc(db, 'branches', id));
      fetchData();
    }
  };

  const handleAddFaculty = async (e) => {
    e.preventDefault();
    if (!facultyForm.tag.match(/^[a-zA-Z0-9]+$/)) {
      alert('Tag must be one word with no special characters');
      return;
    }
    setLoading(true);
    if (editingFaculty) {
      await updateDoc(doc(db, 'faculties', editingFaculty.id), {
        name: facultyForm.name,
        tag: facultyForm.tag,
        branches: facultyForm.branchIds
      });
      setEditingFaculty(null);
    } else {
      await addDoc(collection(db, 'faculties'), {
        name: facultyForm.name,
        tag: facultyForm.tag,
        branches: facultyForm.branchIds
      });
    }
    setFacultyForm({ name: '', tag: '', branchIds: [] });
    fetchData();
    setLoading(false);
  };

  const handleEditFaculty = (faculty) => {
    setEditingFaculty(faculty);
    setFacultyForm({
      name: faculty.name,
      tag: faculty.tag,
      branchIds: faculty.branches || []
    });
  };

  const handleDeleteFaculty = async (id) => {
    if (confirm('Delete this faculty?')) {
      await deleteDoc(doc(db, 'faculties', id));
      fetchData();
    }
  };

  const handleFacultyBranchChange = (e) => {
    const value = Array.from(e.target.selectedOptions, option => option.value);
    setFacultyForm({ ...facultyForm, branchIds: value });
  };

  return (
    <div className="animate-fade-in">
      <h1 className="page-title">Institution Management</h1>
      <p className="page-subtitle">Manage Branches and Faculties</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Branches */}
        <div>
          <div className="card" style={{ marginBottom: '2rem' }}>
            <h2>Add Branch</h2>
            <form onSubmit={handleAddBranch} style={{ marginTop: '1rem' }}>
              <div className="input-group">
                <label>Branch Name</label>
                <input type="text" className="input-control" required value={branchForm.name} onChange={e => setBranchForm({...branchForm, name: e.target.value})} />
              </div>
              <div className="input-group">
                <label>Tag (One word, alphanumeric)</label>
                <input type="text" className="input-control" required value={branchForm.tag} onChange={e => setBranchForm({...branchForm, tag: e.target.value})} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                <Plus size={16} /> Add Branch
              </button>
            </form>
          </div>

          <div className="card">
            <h2>Branches List</h2>
            <div className="table-wrapper" style={{ marginTop: '1rem' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Tag</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.map(b => (
                    <tr key={b.id}>
                      <td>{b.name}</td>
                      <td>@{b.tag}</td>
                      <td>
                        <button onClick={() => handleDeleteBranch(b.id)} style={{ color: 'var(--color-danger)' }}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Faculties */}
        <div>
          <div className="card" style={{ marginBottom: '2rem' }}>
            <h2>{editingFaculty ? 'Edit Faculty' : 'Add Faculty'}</h2>
            <form onSubmit={handleAddFaculty} style={{ marginTop: '1rem' }}>
              <div className="input-group">
                <label>Faculty Name</label>
                <input type="text" className="input-control" required value={facultyForm.name} onChange={e => setFacultyForm({...facultyForm, name: e.target.value})} />
              </div>
              <div className="input-group">
                <label>Tag (One word, alphanumeric)</label>
                <input type="text" className="input-control" required value={facultyForm.tag} onChange={e => setFacultyForm({...facultyForm, tag: e.target.value})} />
              </div>
              <div className="input-group">
                <label>Assign to Branches</label>
                <select multiple className="input-control" required value={facultyForm.branchIds} onChange={handleFacultyBranchChange} style={{ height: '100px' }}>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {editingFaculty ? <><Edit2 size={16} /> Update Faculty</> : <><Plus size={16} /> Add Faculty</>}
                </button>
                {editingFaculty && (
                  <button type="button" className="btn btn-secondary" onClick={() => { setEditingFaculty(null); setFacultyForm({ name: '', tag: '', branchIds: [] }); }}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="card">
            <h2>Faculties List</h2>
            <div className="table-wrapper" style={{ marginTop: '1rem' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Tag</th>
                    <th>Branches</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {faculties.map(f => (
                    <tr key={f.id}>
                      <td>{f.name}</td>
                      <td>@{f.tag}</td>
                      <td>{f.branches?.length || 0} assigned</td>
                      <td style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => handleEditFaculty(f)} style={{ color: 'var(--color-accent)' }}>
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDeleteFaculty(f.id)} style={{ color: 'var(--color-danger)' }}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
