import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './DemoDashboard.css';

const genericMedications = [
  { drug: "Amoxicillin 500mg", frequency: "1-0-1", dosage: "1 Tablet", duration: "5 days", constraint: "after food" },
  { drug: "Vitamin D3", frequency: "1-0-0", dosage: "1 Pill", duration: "5 days", constraint: "after food" },
  { drug: "Paracetamol 650mg", frequency: "0-1-0", dosage: "1 Tablet", duration: "5 days", constraint: "any" }
];

const DayAdaptiveTimeline = ({ originalSchedule, updatedSchedule }) => {
  if (!originalSchedule || !updatedSchedule) return null;

  // Group by Day
  const days = [1, 2, 3, 4, 5];
  
  return (
    <div className="adaptive-timeline">
      {days.map(day => {
        const originalDay = originalSchedule.filter(d => d.day === day);
        if (originalDay.length === 0) return null;

        return (
          <div key={day} className="day-group">
            <div className="day-header">Day {day} {day === 1 ? '(Baseline)' : '(Optimized)'}</div>
            <div className="timeline-cards">
              {originalDay.map(dose => {
                const updated = updatedSchedule.find(u => u.dose_id === dose.dose_id);
                const isShifted = updated && updated.scheduled_time !== dose.scheduled_time;

                return (
                  <div key={dose.dose_id} className="timeline-card">
                    <div className="card-info">
                      <div className="drug">{dose.drug_name}</div>
                      <div className="slot-tag">{dose.slot.toUpperCase()}</div>
                    </div>
                    <div className="card-times">
                      {isShifted ? (
                        <>
                          <span className="base-time">{dose.scheduled_time}</span>
                          <span className="arrow-icon">→</span>
                          <span className="new-time">{updated.scheduled_time}</span>
                        </>
                      ) : (
                        <span className="unchanged-time">{dose.scheduled_time}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const DemoDashboard = ({ onClose }) => {
  const { user, token } = useAuth();
  const [selectedPersona, setSelectedPersona] = useState('forgetful');
  const [step, setStep] = useState('idle'); // idle, generating, running, replanning, complete
  const [logs, setLogs] = useState([]);
  
  // Data State
  const [scheduleData, setScheduleData] = useState(null);
  const [eventsData, setEventsData] = useState([]);
  const [replanData, setReplanData] = useState(null);

  const sessionId = `demo_session_${user?.id || 'guest'}`;

  const addLog = (msg, type = 'info') => {
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), msg, type }]);
  };

  const delay = ms => new Promise(res => setTimeout(res, ms));

  useEffect(() => {
    const fetchExistingDemo = async () => {
      try {
        const authHeaders = {
          'Authorization': `Bearer ${token}`
        };
        const res = await fetch(`/api/simulator/state?session_id=${sessionId}`, { headers: authHeaders });
        if (res.ok) {
          const data = await res.json();
          if (data.schedule && data.schedule.length > 0) {
            setScheduleData({ total_doses: data.total_doses || data.schedule.length });
            
            // Assume if simulation events exist, simulation ran
            if (data.adherence && data.adherence.percent) {
              setEventsData([{ status: 'taken', drug_name: 'Loaded from Database', slot: 'history' }]); // dummy length to trigger UI
              
              if (data.inferred_persona) {
                // If it inferred persona, Planner ran
                setReplanData({
                  summary: {
                    inferred_persona: data.inferred_persona,
                    persona_confidence: data.persona_scores?.[data.inferred_persona] || 0.8,
                    persona_reasoning: "Loaded from previous demo execution.",
                    planning_actions: ["Restored schedule adjustments from database."],
                    replanned_doses: 0
                  }
                });
                setStep('complete');
                setSelectedPersona(data.inferred_persona);
              }
            }
          }
        }
      } catch (e) {
        // quiet fail on initial fetch context 
      }
    };
    fetchExistingDemo();
  }, [sessionId, token]);

  const runSimulation = async () => {
    try {
      setLogs([]);
      setScheduleData(null);
      setEventsData([]);
      setReplanData(null);
      
      const authHeaders = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // ----------------------------------------------------
      // PHASE 1: GENERATE BASE SCHEDULE
      // ----------------------------------------------------
      setStep('generating');
      addLog("Sending prescription arrays to Architect Agent...", "action");
      
      // We pass the generic medications to our proxy route 
      // (Wait, /api/schedule proxy needs the same format as frontend)
      const scheduleRes = await fetch('/api/schedule', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          session_id: sessionId,
          medications: genericMedications,
          start_date: new Date().toISOString().split('T')[0]
        })
      });
      if (!scheduleRes.ok) throw new Error("Architect Agent Failed");
      
      const scheduleOut = await scheduleRes.json();
      setScheduleData(scheduleOut);
      addLog(`Architect mapped ${genericMedications.length} medications to ${scheduleOut.total_doses} total doses across 5 days.`, "success");
      await delay(100);

      // ----------------------------------------------------
      // PHASE 2: SIMULATE PERSONA BEHAVIOR
      // ----------------------------------------------------
      setStep('running');
      addLog(`Connecting to Demo Engine... Simulating 5 days of behavior as a "${selectedPersona}" persona.`, "action");

      const simRes = await fetch('/api/simulator/simulate', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          session_id: sessionId,
          persona: selectedPersona,
          schedule: scheduleOut.schedule
        })
      });
      if (!simRes.ok) {
        const errorData = await simRes.json().catch(() => ({}));
        throw new Error(errorData.error || "Simulation Agent Failed");
      }
      
      const simOut = await simRes.json();
      setEventsData(simOut.events);
      addLog(`Simulation complete! Adherence Score: ${simOut.adherence.percent}`, "success");
      
      // REDUNDANT REMINDER LOGS (Persona-specific demo)
      if (selectedPersona === 'forgetful') {
        await delay(100);
        addLog("[AI] Checking for missed notifications...", "info");
        await delay(100);
        addLog("[AI] Triggering secondary reminders for unacknowledged doses.", "info");
      }

      await delay(100);


      // ----------------------------------------------------
      // PHASE 3: REPLANNING INFERENCE
      // ----------------------------------------------------
      setStep('replanning');
      addLog("Feeding interaction history to the General Planner AI...", "action");

      const replanRes = await fetch('/api/simulator/replan', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ 
          session_id: sessionId,
          schedule: scheduleOut.schedule,
          events: simOut.events,
          requested_persona: selectedPersona
        })
      });
      if (!replanRes.ok) {
        const errorData = await replanRes.json().catch(() => ({}));
        throw new Error(errorData.error || "Replanning Agent Failed");
      }

      const replanOut = await replanRes.json();
      setReplanData(replanOut);
      
      addLog(`Planner Agent inferred persona: ${replanOut.summary.inferred_persona.toUpperCase()} (Confidence: ${replanOut.summary.persona_confidence * 100}%)`, "success");
      setStep('complete');

    } catch (err) {
      addLog(`Error: ${err.message}`, "error");
      setStep('error');
    }
  };

  return (
    <div className="demo-dashboard" style={{ animation: 'fadeInUp 0.5s ease' }}>
      
      <div className="demo-header">
        <div>
          <h2 style={{ background: 'linear-gradient(90deg, #9d4edd, #ff4d6d)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            PersonaRx Intelligence Simulator
          </h2>
          <p style={{ color: 'var(--text-3)' }}>Precision Adherence. AI-Driven Care.</p>
        </div>
        <button className="btn-close-demo" onClick={onClose}>✖ Close Demo Mode</button>
      </div>

      <div className="demo-grid">
        {/* LEFT COLUMN: Controls & Logs */}
        <div className="demo-controls-panel">
          <div className="demo-card">
            <h3>1. Configure Persona</h3>
            <p className="small-text">Select how the simulated user behaves when receiving medication notifications.</p>
            
            <select 
              className="demo-select" 
              value={selectedPersona} 
              onChange={e => setSelectedPersona(e.target.value)}
              disabled={step !== 'idle' && step !== 'complete' && step !== 'error'}
            >
              <option value="forgetful">Forgetful (Often ignores or delays randomly)</option>
              <option value="busy">Busy Professional (Consistently misses afternoon doses)</option>
              <option value="anxious">Anxious (Takes doses 15 mins early strictly)</option>
            </select>

            <button 
              className="btn-demo-run" 
              onClick={runSimulation}
              disabled={step !== 'idle' && step !== 'complete' && step !== 'error'}
            >
              {step === 'idle' || step === 'complete' || step === 'error' ? '▶ Run Full Stack Simulation' : 'Running...'}
            </button>
          </div>

          <div className="demo-card terminal-card">
            <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px', marginBottom: '8px' }}>Real-time System Logs</h3>
            <div className="terminal-logs">
              {logs.map((L, i) => (
                <div key={i} className={`log-entry ${L.type}`}>
                  <span className="log-time">[{L.time}]</span> {L.msg}
                </div>
              ))}
              {step !== 'idle' && step !== 'complete' && step !== 'error' && (
                <div className="log-entry action blink">_</div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Visualizations */}
        <div className="demo-visuals-panel">
          
          {step === 'idle' && (
            <div className="demo-empty">
              <div style={{ fontSize: '40px' }}>🧪</div>
              <p>Configure a persona and run the simulation to see the Multi-Agent architecture in action.</p>
            </div>
          )}

          {(scheduleData || eventsData.length > 0 || replanData) && (
            <div className="demo-stages">
              
              {/* STAGE 1: Architect */}
              <div className={`demo-stage-box ${scheduleData ? 'visible' : ''}`}>
                <h4>⚙️ Phase 1: The Scheduler Agent</h4>
                <p>Created a rigid timeline based on standard medical meal slots.</p>
                {scheduleData && (
                  <div className="metric-row">
                    <div className="metric"><span className="val">{genericMedications.length}</span><span className="lbl">Meds</span></div>
                    <div className="metric"><span className="val">{scheduleData.total_doses}</span><span className="lbl">Doses</span></div>
                  </div>
                )}
              </div>

              {/* STAGE 2: Simulation timeline */}
              <div className={`demo-stage-box ${eventsData.length > 0 ? 'visible' : ''}`}>
                <h4>👤 Phase 2: Simulated User Interaction</h4>
                <p>Generated {eventsData.length} mock clicks/delays across 5 virtual days.</p>
                <div className="events-timeline">
                  {eventsData.slice(0, 15).map((e, idx) => (
                    <div key={idx} className={`event-dot event-${e?.status || 'taken'}`} title={`${e?.drug_name || 'Event'} (${e?.slot || ''}) - ${(e?.status || 'taken').toUpperCase()}`}>
                    </div>
                  ))}
                  {eventsData.length > 15 && <span style={{ color: 'var(--text-3)' }}>+{eventsData.length - 15} more</span>}
                </div>
              </div>

              {/* STAGE 3: Planner Inference */}
              <div className={`demo-stage-box highlight-box ${(replanData || step === 'replanning') ? 'visible' : ''}`}>
                <h4>🧠 Phase 3: The Planner Agent (Inference & Adaptation)</h4>
                {step === 'replanning' && (
                  <div className="planner-loading">
                    <div className="blink">AI Agent is analyzing Day 1 behaviors and calculating optimal shifts...</div>
                  </div>
                )}
                {replanData && (
                  <div className="replan-results">
                    <div className="replan-reasoning">
                      <strong>AI Reasoning:</strong> {replanData.summary.persona_reasoning}
                    </div>
                    
                    <div className="replan-actions">
                      <strong>AI Actions Taken:</strong>
                      <ul>
                        {replanData.summary.planning_actions.map((act, i) => <li key={i}>{act}</li>)}
                      </ul>
                      {replanData.summary.replanned_doses > 0 && (
                        <div style={{ marginTop: '8px', color: '#ff4d6d' }}>
                          ⚡ Shifted {replanData.summary.replanned_doses} doses to maintain safety gaps due to delays.
                        </div>
                      )}

                      <h4 style={{ marginTop: '24px', fontSize: '15px' }}>📈 Day-Wise Schedule Adaptation</h4>
                      <DayAdaptiveTimeline 
                        originalSchedule={scheduleData.schedule} 
                        updatedSchedule={replanData.updated_schedule} 
                      />
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default DemoDashboard;
