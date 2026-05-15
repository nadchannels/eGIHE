import React from 'react';

export default function Home() {
  return (
    <div className="animate-fade-in">
      <h1 className="page-title">Welcome to eGIHE</h1>
      <p className="page-subtitle">Your Academic Gateway for KSP</p>

      <div className="card">
        <h2 style={{ marginBottom: '1rem' }}>Our Mission & Vision</h2>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
          This web app is made to serve the Trainees and Trainers with the best performing website that delivers timetable and academic updates.
        </p>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          We aim to digitize and streamline the scheduling and announcement process for all branches and faculties.
        </p>
      </div>
    </div>
  );
}
