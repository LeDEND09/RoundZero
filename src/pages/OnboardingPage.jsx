import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import LoadingScreen from '../components/LoadingScreen';
import Logo from '../components/Logo';

import './OnboardingPage.css';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [dbRole, setDbRole] = useState(null); // 'candidate' | 'expert'
  const [isLoading, setIsLoading] = useState(true);
  
  const [step, setStep] = useState(1);
  const [transitioning, setTransitioning] = useState(false);
  const [saving, setSaving] = useState(false);

  // Common Candidate State
  const [targetRole, setTargetRole] = useState('');
  const [yearsOfExperience, setYearsOfExperience] = useState('');
  const [techStack, setTechStack] = useState([]);
  const [interviewFocus, setInterviewFocus] = useState([]);
  const [targetCompanies, setTargetCompanies] = useState('');

  // Common Expert State
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [domains, setDomains] = useState([]);
  const [bio, setBio] = useState('');

  const EXP_OPTIONS = ["Fresher", "1–3 yrs", "3–5 yrs", "5–8 yrs", "8+ yrs"];
  const TECH_OPTS = ["React", "Node.js", "Python", "Go", "Java", "TypeScript", "AWS", "System Design", "SQL", "Docker", "Kubernetes", "GraphQL"];
  const FOCUS_OPTS = ["Data Structures & Algorithms", "System Design", "Behavioural", "Frontend specific", "Backend specific", "Full mock interview"];
  const DOMAIN_OPTS = ["Frontend", "Backend", "System Design", "DSA", "Mobile", "DevOps", "ML / AI", "Behavioural", "Full Stack"];

  const renderRoleIcon = (icon) => {
    const commonProps = {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.8",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    };

    switch (icon) {
      case 'frontend':
        return <svg {...commonProps}><rect x="3" y="4" width="18" height="14" rx="2"></rect><path d="M8 20h8"></path></svg>;
      case 'backend':
        return <svg {...commonProps}><ellipse cx="12" cy="6" rx="7" ry="3"></ellipse><path d="M5 6v8c0 1.7 3.1 3 7 3s7-1.3 7-3V6"></path></svg>;
      case 'fullstack':
        return <svg {...commonProps}><rect x="3" y="4" width="18" height="8" rx="2"></rect><path d="M7 16h10"></path><path d="M9 20h6"></path></svg>;
      case 'mobile':
        return <svg {...commonProps}><rect x="8" y="2.5" width="8" height="19" rx="2"></rect><path d="M11 18h2"></path></svg>;
      case 'devops':
        return <svg {...commonProps}><path d="M12 2v4"></path><path d="M12 18v4"></path><path d="M4.9 4.9l2.8 2.8"></path><path d="M16.3 16.3l2.8 2.8"></path><path d="M2 12h4"></path><path d="M18 12h4"></path><path d="M4.9 19.1l2.8-2.8"></path><path d="M16.3 7.7l2.8-2.8"></path><circle cx="12" cy="12" r="3"></circle></svg>;
      case 'data':
        return <svg {...commonProps}><path d="M4 20V10"></path><path d="M10 20V4"></path><path d="M16 20v-7"></path><path d="M22 20v-4"></path></svg>;
      case 'ml':
        return <svg {...commonProps}><rect x="4" y="6" width="16" height="12" rx="2"></rect><circle cx="9" cy="12" r="1"></circle><circle cx="15" cy="12" r="1"></circle><path d="M12 2v2"></path></svg>;
      case 'manager':
        return <svg {...commonProps}><circle cx="12" cy="8" r="3"></circle><path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6"></path></svg>;
      default:
        return <svg {...commonProps}><circle cx="12" cy="12" r="8"></circle></svg>;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate('/login');
        return;
      }
      setCurrentUser(user);
      
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          if (data.onboarded) {
             navigate('/dashboard');
             return;
          }
          setDbRole(data.role || 'candidate');
        }
      } catch (err) {
        console.error("Failed to fetch user role", err);
      } finally {
        setIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  if (isLoading) {
    return <LoadingScreen text="Loading..." />;
  }

  const isExpert = dbRole === 'expert';
  const totalSteps = isExpert ? 2 : 3;

  const toggleArray = (arr, setArr, val) => {
    if (arr.includes(val)) setArr(arr.filter(i => i !== val));
    else setArr([...arr, val]);
  };

  const handleNext = () => {
    setTransitioning(true);
    setTimeout(() => {
      setStep(s => s + 1);
      setTransitioning(false);
    }, 250);
  };

  const handleBack = () => {
    setTransitioning(true);
    setTimeout(() => {
      setStep(s => s - 1);
      setTransitioning(false);
    }, 250);
  };

  const handleFinish = async () => {
    if (!currentUser) return;
    setSaving(true);
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      if (isExpert) {
        await updateDoc(userDocRef, {
          company, title, yearsOfExperience, domains, bio, onboarded: true
        });
      } else {
        await updateDoc(userDocRef, {
          targetRole, yearsOfExperience, techStack, interviewFocus, targetCompanies, onboarded: true
        });
      }
      navigate('/dashboard');
    } catch (err) {
      console.error("Error saving onboarding details", err);
      setSaving(false);
    }
  };

  // Validation
  let canContinue = false;
  if (!isExpert) {
    if (step === 1) canContinue = targetRole !== '';
    if (step === 2) canContinue = yearsOfExperience !== '' && techStack.length > 0;
    if (step === 3) canContinue = interviewFocus.length > 0;
  } else {
    if (step === 1) canContinue = company !== '' && title !== '' && yearsOfExperience !== '';
    if (step === 2) canContinue = domains.length > 0 && bio !== '';
  }

  // Render Helpers
  const renderStepIndicators = () => {
    return (
      <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', justifyContent: 'center' }}>
        {Array.from({ length: totalSteps }).map((_, idx) => {
          const stepNum = idx + 1;
          let dotClass = 'dot-upcoming';
          if (stepNum < step) dotClass = 'dot-complete';
          if (stepNum === step) dotClass = 'dot-active';
          return <div key={idx} className={`progress-dot ${dotClass}`} />
        })}
      </div>
    );
  };

  return (
    <>

      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column', 
        alignItems: 'center', justifyContent: 'center', padding: '40px 20px'
      }}>
        
        <div style={{ width: '100%', maxWidth: '520px' }}>
          
          <div className="logo-header">
            <Logo size={34} showWordmark={true} />
          </div>

          <div className="onboarding-card">
            {renderStepIndicators()}

            <div className={transitioning ? "step-transition-exit-active" : "step-transition-enter-active"}>
              
              {/* CANDIDATE FLOW */}
              {!isExpert && step === 1 && (
                <div>
                  <h2 style={{ fontSize: '24px', fontFamily: `'Inter', sans-serif`, margin: '0 0 24px 0' }}>What role are you targeting?</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {[
                      { icon: "frontend", label: "Frontend Engineer" },
                      { icon: "backend", label: "Backend Engineer" },
                      { icon: "fullstack", label: "Full Stack Engineer" },
                      { icon: "mobile", label: "Mobile Engineer" },
                      { icon: "devops", label: "DevOps / SRE" },
                      { icon: "data", label: "Data Engineer" },
                      { icon: "ml", label: "ML Engineer" },
                      { icon: "manager", label: "Engineering Manager" }
                    ].map(r => (
                      <div key={r.label} onClick={() => setTargetRole(r.label)} className={`option-card ${targetRole === r.label ? 'selected' : ''}`}>
                        <span className="role-icon-badge">{renderRoleIcon(r.icon)}</span>
                        <span className="role-label">{r.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!isExpert && step === 2 && (
                <div>
                  <h2 style={{ fontSize: '24px', fontFamily: `'Inter', sans-serif`, margin: '0 0 24px 0' }}>Tell us about your experience</h2>
                  
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{ fontSize: '14px', color: 'var(--text2)', marginBottom: '12px' }}>Years of Experience</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {EXP_OPTIONS.map(exp => (
                        <div key={exp} onClick={() => setYearsOfExperience(exp)} className={`tag-pill ${yearsOfExperience === exp ? 'selected' : ''}`}>{exp}</div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '14px', color: 'var(--text2)', marginBottom: '12px' }}>Preferred Tech Stack</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {TECH_OPTS.map(tech => (
                        <div key={tech} onClick={() => toggleArray(techStack, setTechStack, tech)} className={`tag-pill ${techStack.includes(tech) ? 'selected' : ''}`}>{tech}</div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {!isExpert && step === 3 && (
                <div>
                  <h2 style={{ fontSize: '24px', fontFamily: `'Inter', sans-serif`, margin: '0 0 24px 0' }}>What do you want to focus on?</h2>
                  
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{ fontSize: '14px', color: 'var(--text2)', marginBottom: '12px' }}>Interview Types</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                      {FOCUS_OPTS.map(focus => (
                        <div key={focus} onClick={() => toggleArray(interviewFocus, setInterviewFocus, focus)} 
                          style={{ flexDirection: 'row', justifyContent: 'flex-start', padding: '12px 16px' }}
                          className={`option-card ${interviewFocus.includes(focus) ? 'selected' : ''}`}>
                          {focus}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '14px', color: 'var(--text2)', marginBottom: '12px' }}>Target Companies (Optional)</div>
                    <input 
                      type="text" 
                      placeholder="e.g. Google, Stripe, Atlassian" 
                      value={targetCompanies}
                      onChange={e => setTargetCompanies(e.target.value)}
                      className="custom-input"
                    />
                  </div>
                </div>
              )}

              {/* EXPERT FLOW */}
              {isExpert && step === 1 && (
                <div>
                  <h2 style={{ fontSize: '24px', fontFamily: `'Inter', sans-serif`, margin: '0 0 24px 0' }}>Tell us about your expertise</h2>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                    <div>
                      <div style={{ fontSize: '14px', color: 'var(--text2)', marginBottom: '8px' }}>Current Company</div>
                      <input type="text" placeholder="e.g. Google, Stripe" value={company} onChange={e => setCompany(e.target.value)} className="custom-input"/>
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', color: 'var(--text2)', marginBottom: '8px' }}>Job Title</div>
                      <input type="text" placeholder="e.g. Staff Engineer, Tech Lead" value={title} onChange={e => setTitle(e.target.value)} className="custom-input"/>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '14px', color: 'var(--text2)', marginBottom: '12px' }}>Years of Experience (Min 5 yrs required)</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {["5–8 yrs", "8–10 yrs", "10+ yrs"].map(exp => (
                        <div key={exp} onClick={() => setYearsOfExperience(exp)} className={`tag-pill ${yearsOfExperience === exp ? 'selected' : ''}`}>{exp}</div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {isExpert && step === 2 && (
                <div>
                  <h2 style={{ fontSize: '24px', fontFamily: `'Inter', sans-serif`, margin: '0 0 24px 0' }}>What will you interview candidates on?</h2>
                  
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{ fontSize: '14px', color: 'var(--text2)', marginBottom: '12px' }}>Your Domains</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {DOMAIN_OPTS.map(domain => (
                        <div key={domain} onClick={() => toggleArray(domains, setDomains, domain)} className={`tag-pill ${domains.includes(domain) ? 'selected' : ''}`}>{domain}</div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '14px', color: 'var(--text2)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Short Bio</span>
                      <span>{bio.length}/200</span>
                    </div>
                    <textarea 
                      placeholder="Tell candidates a bit about your background..." 
                      value={bio}
                      onChange={e => setBio(e.target.value.slice(0, 200))}
                      className="custom-textarea"
                    />
                  </div>
                </div>
              )}

            </div>

            {/* Navigation Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '40px' }}>
              <div>
                {step > 1 && (
                  <button onClick={handleBack} className="back-link" style={{ background: 'transparent', border: 'none' }}>
                    <span>←</span> Back
                  </button>
                )}
              </div>
              <button 
                disabled={!canContinue || saving} 
                onClick={step === totalSteps ? handleFinish : handleNext} 
                className="continue-btn"
              >
                {saving ? "Saving..." : (step === totalSteps ? "Finish setup" : "Continue →")}
              </button>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
