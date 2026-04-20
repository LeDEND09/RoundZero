import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc, onSnapshot, serverTimestamp, increment } from 'firebase/firestore';
import { ref, onValue, set } from 'firebase/database';
import { supabase } from '../supabase';
import Editor from '@monaco-editor/react';
import {
  StreamVideo,
  StreamVideoClient,
  StreamCall,
  SpeakerLayout,
  StreamTheme,
  useCallStateHooks
} from '@stream-io/video-react-sdk';
import { StreamChat } from 'stream-chat';
import {
  Chat,
  Channel,
  MessageList,
  MessageInput,
  Window
} from 'stream-chat-react';
import { motion, AnimatePresence } from 'framer-motion';

import '@stream-io/video-react-sdk/dist/css/styles.css';
import 'stream-chat-react/dist/css/v2/index.css';
import LoadingScreen from '../components/LoadingScreen';
import { rtdb } from '../firebase';
import './RoomPage.css';

// DEV_MODE: automatically true during `npm run dev`, false in production build
const DEV_MODE = import.meta.env.DEV;

// Child component so we can use Stream SDK hooks
function MyVideoUI({ onParticipantCountChange }) {
  const { useParticipantCount } = useCallStateHooks();
  const participantCount = useParticipantCount();

  useEffect(() => {
    onParticipantCountChange?.(participantCount || 0);
  }, [participantCount, onParticipantCountChange]);

  return (
    <StreamTheme>
      <div style={{
        width: '100%',
        height: '100%',
        position: 'relative'
      }}>
        <SpeakerLayout />
      </div>
    </StreamTheme>
  )
}


const FloatingControls = ({
  isExpert,
  leftOpen, setLeftOpen,
  rightOpen, setRightOpen,
  handleLeave,
  call,
  editorEnabled,
  toggleEditor
}) => {
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // If we have a call object (prod mode), we can toggle media
  const toggleMic = async () => {
    if (call) {
      await call.microphone.toggle();
      setMicMuted(!micMuted);
    } else {
      setMicMuted(!micMuted);
    }
  };

  const toggleCam = async () => {
    if (call) {
      await call.camera.toggle();
      setCamOff(!camOff);
    } else {
      setCamOff(!camOff);
    }
  };

  const performLeave = () => {
    setShowLeaveConfirm(false);
    handleLeave();
  };

  return (
    <div className="controls-bar">
      <button className={`ctrl-btn ${micMuted ? 'muted' : ''}`} onClick={toggleMic} title="Toggle Mic">
        {micMuted ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95v1.05a7 7 0 0 1-13.84-1.55"></path><line x1="12" y1="22" x2="12" y2="19"></line></svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line><line x1="8" y1="22" x2="16" y2="22"></line></svg>
        )}
      </button>

      <button className={`ctrl-btn ${camOff ? 'muted' : ''}`} onClick={toggleCam} title="Toggle Cam">
        {camOff ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 8.5V17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2-3h4l2 3h4a2 2 0 0 1 2 2v1.5l-2-1.5z"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
        )}
      </button>

      <button
        className={`ctrl-btn ${leftOpen ? 'active' : ''}`}
        onClick={() => {
          if (window.innerWidth < 768 && !leftOpen) setRightOpen(false);
          setLeftOpen(!leftOpen);
        }}
        title="Toggle Chat"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z"></path></svg>
      </button>

      {isExpert && (
        <>
          <div className="ctrl-divider"></div>
          <button
            className={`ctrl-btn ${editorEnabled ? 'active' : ''}`}
            onClick={toggleEditor}
            title="Toggle Code Editor"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
          </button>
        </>
      )}

      {isExpert && (
        <>
          <div className="ctrl-divider"></div>
          <button
            className={`ctrl-btn ${rightOpen ? 'active' : ''}`}
            onClick={() => {
              if (window.innerWidth < 768 && !rightOpen) setLeftOpen(false);
              setRightOpen(!rightOpen);
            }}
            title="Toggle AI Insights"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"></path><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
          </button>
        </>
      )}

      <div className="ctrl-divider"></div>

      <div className="popover-wrap">
        <button className="ctrl-btn btn-leave" onClick={() => setShowLeaveConfirm(!showLeaveConfirm)} title="Leave Call">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path><line x1="23" y1="1" x2="1" y2="23"></line></svg>
        </button>

        <AnimatePresence>
          {showLeaveConfirm && (
            <motion.div
              className="leave-popover"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <div className="popover-arrow"></div>
              <div className="popover-text">Leave session?</div>
              <div className="popover-actions">
                <button className="pop-btn stay" onClick={() => setShowLeaveConfirm(false)}>Stay</button>
                <button className="pop-btn confirm" onClick={performLeave}>Leave</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const QuestionCard = ({ q }) => {
  const [copied, setCopied] = useState(false);
  const [showProbes, setShowProbes] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(q.question);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="ai-q-card animate-fade-up">
      <div className="ai-q-header">
        <span className="ai-q-id">Q{q.id}</span>
        <button className={`ai-copy-btn ${copied ? 'copied' : ''}`} onClick={copyToClipboard}>
          {copied ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          )}
        </button>
      </div>
      <p className="ai-q-text">{q.question}</p>

      <div className="ai-probes-toggle" onClick={() => setShowProbes(!showProbes)}>
        {showProbes ? 'Hide logic' : 'Show logic & probes'}
        <svg style={{ transform: showProbes ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </div>

      <AnimatePresence>
        {showProbes && (
          <motion.div
            className="ai-probes-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <div className="ai-probe-section">
              <div className="probe-label green">Green Flags</div>
              <ul className="probe-list">
                {q.greenFlags.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
            <div className="ai-probe-section">
              <div className="probe-label red">Red Flags</div>
              <ul className="probe-list">
                {q.redFlags.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ScoreCard = ({ category, data, onChange, index }) => {
  const [hoveredStar, setHoveredStar] = useState(0);
  const showNote = data.stars > 0;

  const labels = {
    1: { text: 'Weak', color: 'var(--red)' },
    2: { text: 'Below average', color: 'var(--amber)' },
    3: { text: 'Average', color: 'var(--text2)' },
    4: { text: 'Strong', color: 'var(--green)' },
    5: { text: 'Exceptional', color: 'var(--accent)' }
  };

  const displayName = category.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

  return (
    <motion.div
      className="score-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
    >
      <div className="sc-header">
        <span className="sc-name">{displayName}</span>
        {data.stars > 0 && (
          <span className="sc-label" style={{ color: labels[data.stars].color }}>
            {labels[data.stars].text}
          </span>
        )}
      </div>

      <div className="sc-stars">
        {[1, 2, 3, 4, 5].map(star => (
          <motion.button
            key={star}
            className={`star-btn ${(hoveredStar || data.stars) >= star ? 'filled' : ''}`}
            onMouseEnter={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(0)}
            onClick={() => onChange(category, 'stars', data.stars === star ? 0 : star)}
            whileHover={{ scale: 1.2, rotate: 5 }}
            whileTap={{ scale: 0.85 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill={(hoveredStar || data.stars) >= star ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {(showNote || data.note) && (
          <motion.div
            className="sc-note-wrap"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <textarea
              className="sc-note-input"
              placeholder="Add a note... (optional)"
              value={data.note}
              onChange={(e) => onChange(category, 'note', e.target.value.slice(0, 150))}
              maxLength={150}
            />
            <div className="sc-char-count">{data.note.length}/150</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const LiveScoreTab = ({ scorecard, onChange, saveStatus }) => {
  const categories = Object.keys(scorecard);
  const ratedCategories = categories.filter(cat => scorecard[cat].stars > 0);
  const totalStars = ratedCategories.reduce((sum, cat) => sum + scorecard[cat].stars, 0);
  const overall = ratedCategories.length > 0 ? (totalStars / ratedCategories.length) * 2 : 0;

  const getOverallColor = (val) => {
    if (val >= 8) return 'var(--green)';
    if (val >= 6) return 'var(--accent)';
    return 'var(--red)';
  };

  return (
    <div className="live-score-tab">
      <div className="ls-header">
        <div style={{ flex: 1 }}>
          <h4 className="ls-title">Live Scorecard</h4>
          <p className="ls-sub">Tap to mark · Visible only to you</p>
        </div>
        <div className={`ls-save-indicator ${saveStatus}`}>
          {saveStatus === 'saving' ? (
            <>Saving...</>
          ) : saveStatus === 'saved' ? (
            <span style={{ color: 'var(--green)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              Saved <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </span>
          ) : null}
        </div>
      </div>

      <div className="ls-content">
        {categories.map((cat, i) => (
          <ScoreCard key={cat} category={cat} data={scorecard[cat]} onChange={onChange} index={i} />
        ))}
        <div style={{ height: '100px' }}></div>
      </div>

      <div className="ls-summary-sticky">
        <div className="ls-summary-row">
          <span className="ls-summary-label">Overall: {overall.toFixed(1)} / 10</span>
          <span className="ls-summary-value" style={{ color: getOverallColor(overall) }}>
            {overall.toFixed(1)}
          </span>
        </div>
        <div className="ls-progress-track">
          <motion.div
            className="ls-progress-fill"
            initial={{ width: 0 }}
            animate={{ width: `${overall * 10}%` }}
            style={{ background: getOverallColor(overall) }}
          />
        </div>
        <div className="ls-summary-meta">
          Categories rated: {ratedCategories.length} / 6
        </div>
      </div>
    </div>
  );
};

export default function RoomPage() {
  const { callId } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState(null);
  const [isCallReady, setIsCallReady] = useState(false);

  const clientRef = useRef(null);
  const callRef = useRef(null);
  const callLeftRef = useRef(false);
  const micStreamRef = useRef(null);
  const cameraStreamRef = useRef(null);

  const [chatClient, setChatClient] = useState(null);
  const [chatChannel, setChatChannel] = useState(null);
  const chatClientRef = useRef(null);

  async function initStreamChat(token, uid, displayName, channelMembers = []) {
    try {
      // Use same API key as video
      const apiKey = import.meta.env.VITE_STREAM_API_KEY;

      // Disconnect any existing client first
      if (chatClientRef.current) {
        setChatClient(null);
        setChatChannel(null);
        await chatClientRef.current.disconnectUser();
        chatClientRef.current = null;
      }

      const client = new StreamChat(apiKey);
      chatClientRef.current = client;

      // Connect user with same token as video
      await client.connectUser(
        {
          id: uid,
          name: displayName || 'Anonymous'
        },
        token  // same token from getStreamToken
      );

      // Create or join channel with callId as channel ID
      const members = Array.from(new Set([uid, ...channelMembers].filter(Boolean)));
      const channel = client.channel('messaging', callId, {
        name: 'Session Chat',
        members
      });

      await channel.watch();
      setChatClient(client);
      setChatChannel(channel);

    } catch (err) {
      console.warn('Stream Chat init failed:', err);
      // Don't crash — chat is non-critical
    }
  }

  function stopAllTracks() {
    // Stop mic stream
    if (micStreamRef.current) {
      micStreamRef.current
        .getTracks()
        .forEach(track => track.stop());
      micStreamRef.current = null;
    }
    // Stop camera stream
    if (cameraStreamRef.current) {
      cameraStreamRef.current
        .getTracks()
        .forEach(track => track.stop());
      cameraStreamRef.current = null;
    }
    // Stop ALL active media tracks as final sweep
    // This catches any tracks we might have missed
    try {
      document.querySelectorAll('video').forEach(video => {
        if (video.srcObject) {
          video.srcObject.getTracks()
            .forEach(track => track.stop());
          video.srcObject = null;
        }
      });
    } catch (e) { }
  }

  async function safeLeaveCall() {
    if (callLeftRef.current) return;
    callLeftRef.current = true;
    setIsCallReady(false);

    const currentCall = callRef.current;
    const currentClient = clientRef.current;
    callRef.current = null;
    clientRef.current = null;

    stopRecording();
    stopAllTracks();

    if (chatClientRef.current) {
      try {
        await chatClientRef.current.disconnectUser();
      } catch (err) {
        console.warn('Chat disconnect error:', err);
      }
      chatClientRef.current = null;
    }
    setChatClient(null);
    setChatChannel(null);

    try {
      await currentCall?.camera.disable();
      await currentCall?.microphone.disable();
    } catch (err) {
      console.warn('disable media error:', err);
    }
    try {
      await currentCall?.leave();
    } catch (err) {
      console.warn('call.leave() error (safe to ignore):', err);
    }

    try {
      await currentClient?.disconnectUser();
    } catch (err) {
      console.warn('video client disconnect error:', err);
    }

    setCall(null);
    setParticipantCount(0);
    recordingStartTriggeredRef.current = false;

    // Force release all media devices
    if (navigator.mediaDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        console.log('Media devices released');
      } catch (e) { }
    }
  }

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState('idle');
  const [recordingError, setRecordingError] = useState(null);
  const [participantCount, setParticipantCount] = useState(0);
  const recordingStartTriggeredRef = useRef(false);

  // Recording Refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Legacy state for cleanup
  const [call, setCall] = useState(null);

  // Layout state
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  // AI Questions state
  const [aiQuestions, setAiQuestions] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  // Timer state
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Editor state
  const [editorEnabled, setEditorEnabled] = useState(false);
  const [code, setCode] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('javascript');
  const [runOutput, setRunOutput] = useState('');
  const [runStatus, setRunStatus] = useState('idle'); // 'idle' | 'success' | 'error'
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showTabSwitchWarning, setShowTabSwitchWarning] = useState(false);
  const [expertToast, setExpertToast] = useState(null);
  const isRemoteUpdateRef = useRef(false);
  const typingTimeoutRef = useRef(null);

  const getStarterCode = (lang) => {
    const templates = {
      javascript: "// RoundZero Interview Session\n// Problem: [Expert will describe the problem]\n// Candidate: write your solution below\n\nfunction solution() {\n  // your code here\n}\n",
      python: "# RoundZero Interview Session\n# Problem: [Expert will describe the problem]\n\ndef solution():\n    # your code here\n    pass\n",
      java: "// RoundZero Interview Session\n// Problem: [Expert will describe the problem]\n\nclass Solution {\n    static Object solution() {\n        // your code here\n        return null;\n    }\n}\n",
      cpp: "// RoundZero Interview Session\n// Problem: [Expert will describe the problem]\n\n#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // your code here\n    return 0;\n}\n",
      typescript: "// RoundZero Interview Session\n// Problem: [Expert will describe the problem]\n\nfunction solution(): unknown {\n  // your code here\n  return null;\n}\n",
      go: "// RoundZero Interview Session\n// Problem: [Expert will describe the problem]\n\npackage main\n\nimport \"fmt\"\n\nfunc solution() interface{} {\n    // your code here\n    return nil\n}\n\nfunc main() {\n    fmt.Println(solution())\n}\n",
      rust: "// RoundZero Interview Session\n// Problem: [Expert will describe the problem]\n\nfn solution() {\n    // your code here\n}\n\nfn main() {\n    solution();\n}\n"
    };
    return templates[lang] || templates.javascript;
  };

  const formatRunValue = (value) => {
    if (typeof value === 'string') return value;
    if (value === undefined) return 'undefined';
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };

  const [activeTab, setActiveTab] = useState('ai'); // 'ai' or 'score'
  const [scorecard, setScorecard] = useState({
    communication: { stars: 0, note: '' },
    problemSolving: { stars: 0, note: '' },
    codeQuality: { stars: 0, note: '' },
    edgeCases: { stars: 0, note: '' },
    approachesDiscussed: { stars: 0, note: '' },
    conceptClarity: { stars: 0, note: '' }
  });
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle', 'saving', 'saved'
  const saveTimeoutRef = useRef(null);
  const editorRef = useRef(null);
  const bookingIdRef = useRef(null);
  const cursorsUnsubRef = useRef(null);

  const getBookingForCurrentUserAndCall = async (uidOverride = null) => {
    const uid = uidOverride || user?.uid;
    if (!uid || !callId) return null;

    const byCandidateSnap = await getDocs(
      query(collection(db, 'bookings'), where('candidateUid', '==', uid))
    );
    let bookingDoc = byCandidateSnap.docs.find((d) => d.data().streamCallId === callId);

    if (!bookingDoc) {
      const byExpertSnap = await getDocs(
        query(collection(db, 'bookings'), where('expertUid', '==', uid))
      );
      bookingDoc = byExpertSnap.docs.find((d) => d.data().streamCallId === callId);
    }

    return bookingDoc || null;
  };

  useEffect(() => {
    let isMounted = true;
    const resolveBookingId = async () => {
      if (!callId || !user) return;
      try {
        const bookingDoc = await getBookingForCurrentUserAndCall(user.uid);
        if (bookingDoc && isMounted) {
          bookingIdRef.current = bookingDoc.id;
        }
      } catch (err) {
        console.warn('Could not resolve booking id for room:', err);
      }
    };

    resolveBookingId();
    return () => {
      isMounted = false;
    };
  }, [callId, user]);

  useEffect(() => {
    if (!callId || !user || profile?.role !== 'expert') return;
    const scoreRef = ref(rtdb, `sessions/${callId}/liveScore/${user.uid}`);
    onValue(scoreRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setScorecard(prev => ({
          ...prev,
          ...data
        }));
      }
    }, { onlyOnce: true });
  }, [callId, user, profile]);

  const handleScoreChange = (category, field, value) => {
    const updated = {
      ...scorecard,
      [category]: { ...scorecard[category], [field]: value }
    };
    setScorecard(updated);

    setSaveStatus('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      if (!user) return;
      const scoreRef = ref(rtdb, `sessions/${callId}/liveScore/${user.uid}`);
      set(scoreRef, { ...updated, lastUpdated: Date.now() })
        .then(() => {
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 2000);
        })
        .catch(() => setSaveStatus('error'));
    }, 800);
  };

  useEffect(() => {
    if (!callId) return;
    const enabledRef = ref(rtdb, `sessions/${callId}/editorEnabled`);
    const unsubEnabled = onValue(enabledRef, (snapshot) => {
      setEditorEnabled(!!snapshot.val());
    });

    const codeRef = ref(rtdb, `sessions/${callId}/code`);
    const unsubCode = onValue(codeRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        if (data.lastUpdatedBy !== user?.uid) {
          isRemoteUpdateRef.current = true;
          setCode(data.content || '');
          if (data.language) setSelectedLanguage(data.language);
          setTimeout(() => { isRemoteUpdateRef.current = false; }, 50);
        }
      } else {
        if (profile?.role === 'expert') {
          const initialCode = getStarterCode('javascript');
          set(codeRef, { content: initialCode, language: 'javascript', lastUpdatedBy: user?.uid });
          setCode(initialCode);
        }
      }
    });

    return () => {
      unsubEnabled();
      unsubCode();
    };
  }, [callId, user, profile]);

  useEffect(() => {
    if (!editorEnabled) return;
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "Leaving or switching tabs during a coding challenge is not allowed";
    };
    const handleVisibilityChange = async () => {
      if (document.hidden && profile?.role === 'candidate') {
        setShowTabSwitchWarning(true);
        setTabSwitchCount(prev => prev + 1);
        setTimeout(() => setShowTabSwitchWarning(false), 3000);
        try {
          if (!bookingIdRef.current) return;
          await updateDoc(doc(db, 'bookings', bookingIdRef.current), {
            tabSwitchCount: increment(1),
            lastTabSwitch: serverTimestamp()
          });
          const tabSwitchRef = ref(rtdb, `sessions/${callId}/tabSwitch`);
          set(tabSwitchRef, Date.now());
        } catch (err) { }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (user) {
        const cursorRef = ref(rtdb, `sessions/${callId}/cursors/${user.uid}`);
        set(cursorRef, null);
      }
    };
  }, [editorEnabled, profile, callId, user]);

  useEffect(() => {
    if (profile?.role !== 'expert') return;
    const tabSwitchRef = ref(rtdb, `sessions/${callId}/tabSwitch`);
    const unsub = onValue(tabSwitchRef, (snap) => {
      if (snap.val()) {
        setExpertToast("Candidate switched tabs");
        setTimeout(() => setExpertToast(null), 3000);
      }
    });
    return () => unsub();
  }, [profile, callId]);

  const handleCodeChange = (newCode) => {
    const safeCode = newCode ?? '';
    setCode(safeCode);
    if (!isRemoteUpdateRef.current && user) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        const codeRef = ref(rtdb, `sessions/${callId}/code`);
        set(codeRef, { content: safeCode, language: selectedLanguage, lastUpdatedBy: user.uid });
      }, 300);
    }
  };

  const decorationsRef = useRef([]);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;

    // Listen for cursor changes
    editor.onDidChangeCursorPosition((e) => {
      if (user) {
        const cursorRef = ref(rtdb, `sessions/${callId}/cursors/${user.uid}`);
        set(cursorRef, {
          line: e.position.lineNumber,
          column: e.position.column,
          name: profile?.name || 'User',
          color: profile?.role === 'expert' ? '#d4af76' : '#7c6af7'
        });
      }
    });

    // Listen for other users' cursors
    const cursorsRef = ref(rtdb, `sessions/${callId}/cursors`);
    if (cursorsUnsubRef.current) {
      cursorsUnsubRef.current();
    }
    cursorsUnsubRef.current = onValue(cursorsRef, (snapshot) => {
      const allCursors = snapshot.val();
      if (!allCursors) return;

      const newDecorations = [];
      Object.keys(allCursors).forEach((uid) => {
        if (uid === user?.uid) return;
        const c = allCursors[uid];
        newDecorations.push({
          range: new monaco.Range(c.line, c.column, c.line, c.column + 1),
          options: {
            className: `remote-cursor-${uid}`,
            beforeContentClassName: `remote-cursor-label-${uid}`,
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
          }
        });

        // Dynamic CSS for cursor color
        let styleTag = document.getElementById(`cursor-style-${uid}`);
        if (!styleTag) {
          styleTag = document.createElement('style');
          styleTag.id = `cursor-style-${uid}`;
          document.head.appendChild(styleTag);
        }
        styleTag.innerHTML = `
          .remote-cursor-${uid} {
            border-left: 2px solid ${c.color};
            margin-left: -1px;
          }
          .remote-cursor-label-${uid}::after {
            content: "${c.name}";
            position: absolute;
            top: -14px;
            left: 0;
            background: ${c.color};
            color: white;
            font-size: 10px;
            padding: 0 4px;
            border-radius: 2px;
            white-space: nowrap;
            pointer-events: none;
            z-index: 10;
          }
        `;
      });
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);
    });
  };

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    const templateCode = getStarterCode(newLang);
    setSelectedLanguage(newLang);
    setCode(templateCode);
    setRunOutput('');
    setRunStatus('idle');
    if (user) {
      const codeRef = ref(rtdb, `sessions/${callId}/code`);
      set(codeRef, { content: templateCode, language: newLang, lastUpdatedBy: user.uid });
    }
  };

  const handleRunCode = async () => {
    if (selectedLanguage !== 'javascript') {
      setRunStatus('error');
      setRunOutput('Run is currently supported only for JavaScript in-browser.');
      return;
    }

    const logs = [];
    const runtimeConsole = {
      log: (...args) => logs.push(args.map(formatRunValue).join(' ')),
      error: (...args) => logs.push(`Error: ${args.map(formatRunValue).join(' ')}`)
    };

    try {
      const runner = new Function(
        'console',
        `${code}\n;return typeof solution === 'function' ? solution() : undefined;`
      );
      const result = await runner(runtimeConsole);
      const outputLines = [...logs];
      if (result !== undefined) {
        outputLines.push(`Return: ${formatRunValue(result)}`);
      }
      setRunStatus('success');
      setRunOutput(outputLines.length ? outputLines.join('\n') : 'Code executed successfully.');
    } catch (err) {
      setRunStatus('error');
      setRunOutput(`Runtime error: ${err?.message || 'Unknown error'}`);
    }
  };

  const toggleEditorEnabled = () => {
    if (profile?.role === 'expert') {
      const enabledRef = ref(rtdb, `sessions/${callId}/editorEnabled`);
      set(enabledRef, !editorEnabled);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        navigate('/login');
        return;
      }
      setUser(u);

      try {
        const docRef = doc(db, 'users', u.uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const profileData = snap.data();
          setProfile(profileData);

          initRealStreamSession(
            u,
            profileData.name || u.displayName || 'Anonymous',
            profileData.role || 'candidate'
          );
        }
      } catch (err) {
        console.error("Error fetching role", err);
        setInitError("Failed to load user profile");
        setLoading(false);
      }
    });
    return () => unsub();
  }, [navigate, callId]);

  const initRealStreamSession = async (userData, realName, appRole = 'candidate') => {
    const displayName = realName || userData.displayName || 'Anonymous';
    try {
      // Resolve booking first so token API can pre-create the chat channel with both members.
      const bookingDoc = await getBookingForCurrentUserAndCall(userData.uid);
      const bookingData = bookingDoc ? bookingDoc.data() : null;
      if (bookingDoc) {
        bookingIdRef.current = bookingDoc.id;
      }
      const chatMembers = bookingData ? [bookingData.expertUid, bookingData.candidateUid] : [];

      const response = await fetch('/api/getStreamToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: userData.uid,
          name: displayName,
          appRole,
          callId,
          members: chatMembers
        }),
      });

      if (!response.ok) throw new Error(`Token fetch failed: ${response.status}`);
      const { token, apiKey } = await response.json();

      // 1. Initialize Video
      const videoClient = new StreamVideoClient({
        apiKey,
        user: { id: userData.uid, name: displayName, image: userData.photoURL || undefined },
        token,
      });
      clientRef.current = videoClient;
      const streamCall = videoClient.call('default', callId);
      await streamCall.join({ create: true });
      callRef.current = streamCall;

      try {
        const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        cameraStreamRef.current = cameraStream;
      } catch (err) {
        console.warn('Could not capture camera ref:', err);
      }

      try {
        await streamCall.camera.enable();
        await streamCall.microphone.enable();
      } catch (e) {
        console.warn('Could not enable stream camera/mic:', e);
      }

      if (!DEV_MODE) {
        initStreamChat(token, userData.uid, displayName, chatMembers);
      }

      setCall(streamCall);
      setIsCallReady(true);

      if (profile?.role === 'expert') {
        fetchAiQuestions(
          bookingData?.targetRole ||
          profile?.targetRole ||
          'Software Engineer'
        );
      }

      setLoading(false);
    } catch (err) {
      console.error('Failed to init Stream:', err);
      setInitError(err.message || 'Stream connection failed');
      setIsCallReady(false);
      setLoading(false);
    }
  };

  const fetchAiQuestions = async (role) => {
    setAiLoading(true);
    setAiError(null);

    // MOCK DATA for local dev or fallback
    const MOCK_QUESTIONS = [
      {
        id: 1,
        question: `How do you handle state management in a large-scale ${role} application?`,
        greenFlags: ["Mentions scalability and prop-drilling", "Discusses trade-offs between tools", "Prioritizes local state when possible"],
        redFlags: ["Only knows one tool", "Suggests global state for everything"]
      },
      {
        id: 2,
        question: "Explain the difference between optimistic updates and standard loading states.",
        greenFlags: ["Mentions UX responsiveness", "Discusses rollback logic on failure", "Correctly identifies use-cases"],
        redFlags: ["Confusion about data consistency", "Cannot explain how to handle errors"]
      },
      {
        id: 3,
        question: "Describe a complex technical challenge you solved recently.",
        greenFlags: ["Structured approach (S.T.A.R)", "Clearly explains the 'Why'", "Focuses on the technical solution"],
        redFlags: ["Too vague", "Blames teammates", "Doesn't explain the actual fix"]
      }
    ];

    try {
      const response = await fetch('/api/generateQuestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetRole: role, bookingId: bookingIdRef.current || callId }),
      });

      if (!response.ok) throw new Error('API unreachable');

      const data = await response.json();
      const questions = Array.isArray(data?.questions) ? data.questions : [];
      if (!questions.length) {
        throw new Error('No valid questions returned from API');
      }
      setAiQuestions(questions);
    } catch (err) {
      console.warn("Using AI Mock Fallback:", err.message);
      setAiError(null);
      // Simulate network delay for mock feel
      await new Promise(resolve => setTimeout(resolve, 1500));
      setAiQuestions(MOCK_QUESTIONS);
    } finally {
      setAiLoading(false);
    }
  };

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });
      micStreamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 64000
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        stopAllTracks();
        await uploadAudioAndGrade(audioBlob);
      };

      mediaRecorder.start(10000);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingStatus('recording');

      stream.getTracks().forEach(track => {
        track.addEventListener('ended', () => {
          if (mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
          }
        });
      });
    } catch (err) {
      console.error('Recording failed to start:', err);
      setRecordingError('Microphone access denied');
      setRecordingStatus('error');
    }
  }

  useEffect(() => {
    if (DEV_MODE || !isCallReady) return;
    if (recordingStartTriggeredRef.current) return;
    if (participantCount < 2) return;

    recordingStartTriggeredRef.current = true;
    startRecording();
  }, [participantCount, isCallReady]);

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setRecordingStatus('uploading');
    }
  }

  async function uploadAudioAndGrade(audioBlob) {
    try {
      setRecordingStatus('uploading');

      const userRole = profile?.role;
      const fileName = `${callId}_${userRole}_${Date.now()}.webm`;

      const { data, error } = await supabase.storage
        .from('interview-recordings')
        .upload(fileName, audioBlob, {
          contentType: 'audio/webm',
          upsert: false
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('interview-recordings')
        .getPublicUrl(fileName);

      const audioUrl = urlData.publicUrl;
      const audioField = userRole === 'expert' ? 'expertAudioUrl' : 'candidateAudioUrl';
      const audioPathField = userRole === 'expert' ? 'expertAudioPath' : 'candidateAudioPath';

      const bookingDoc = await getBookingForCurrentUserAndCall(user?.uid);
      if (bookingDoc) {
        const bookingId = bookingDoc.id;
        const bookingData = bookingDoc.data();

        await updateDoc(doc(db, 'bookings', bookingId), {
          [audioField]: audioUrl,
          [audioPathField]: fileName,
          [`${audioField}UploadedAt`]: serverTimestamp()
        });

        // Gemini grading is intentionally disconnected for now.
        // Phase E will re-enable backend grading when audio pipeline is ready.
      }

      setRecordingStatus('done');
      setTimeout(() => setRecordingStatus('idle'), 4000);
    } catch (err) {
      console.error('Upload failed:', err);
      setRecordingStatus('error');
      setRecordingError('Failed to upload recording');
    }
  }

  useEffect(() => {
    const interval = setInterval(() => setElapsedSeconds(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (cursorsUnsubRef.current) cursorsUnsubRef.current();
      safeLeaveCall();
    }
  }, []);

  const handleLeave = async () => {
    stopRecording();

    // Save final scorecard to Firestore if expert
    if (profile?.role === 'expert' && user) {
      try {
        const ratedCategories = Object.keys(scorecard).filter(cat => scorecard[cat].stars > 0);
        const totalStars = ratedCategories.reduce((sum, cat) => sum + scorecard[cat].stars, 0);
        const overallScore = ratedCategories.length > 0
          ? Number(((totalStars / ratedCategories.length) * 2).toFixed(1))
          : 0;

        const feedbackBookingId = bookingIdRef.current || callId;
        await setDoc(doc(db, 'expertFeedback', feedbackBookingId), {
          scores: scorecard,
          overallScore,
          expertUid: user.uid,
          bookingId: feedbackBookingId,
          submittedAt: serverTimestamp()
        });
        // TODO: Gemini grading pipeline reads expertFeedback/{bookingId}
        // to combine expert live scores with transcript analysis
        // for a more accurate final scorecard
        // TODO: Phase F security rules must ensure candidates cannot read
        // expertFeedback or any expert-only score artifacts.
      } catch (err) {
        console.error("Error saving expert feedback:", err);
      }
    }

    try {
      // Only trigger hardcoded feedback for experts
      if (profile?.role === 'expert') {
        const booking = await getBookingForCurrentUserAndCall(user?.uid);
        if (booking) {
          const { candidateUid, expertUid } = booking.data();

          // TODO Phase E: Replace this URL with the real Gemini
          // grading function when the audio pipeline is ready.
          await fetch('/api/generateHardcodedFeedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bookingId: booking.id,
              candidateUid,
              expertUid
            })
          });

          await updateDoc(doc(db, 'bookings', booking.id), {
            status: 'completed',
            endedAt: serverTimestamp()
          });
        }
      }
    } catch (error) {
      console.error('Error generating feedback:', error);
      // Don't block navigation even if feedback fails
    }

    await safeLeaveCall();

    // Brief delay so React can render 'uploading' banner 
    // and browser unmounts video cleanly before routing
    setTimeout(() => {
      navigate('/dashboard');
    }, 100);
  };

  const formatTime = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return <LoadingScreen text="Preparing Room..." />;
  }

  const isExpert = profile?.role === 'expert';
  const myInitials = user?.displayName ? user.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'ME';

  return (
    <div className="room-container">
      <AnimatePresence>
        {showTabSwitchWarning && (
          <motion.div
            className="tab-warning-overlay"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="tab-warning-box">
              ⚠ Tab switch detected. Your interviewer has been notified.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {expertToast && (
          <motion.div
            className="expert-toast"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {expertToast}
          </motion.div>
        )}
      </AnimatePresence>

      {DEV_MODE && !isCallReady && (
        <div className="dev-banner">
          ⚠ Sandbox Mode — Video/Chat servers skipped in Local Dev.
        </div>
      )}

      {/* LEFT CHAT PANEL */}
      <motion.div
        className={`side-panel left ${leftOpen ? 'open' : 'closed'}`}
        animate={{ width: leftOpen ? 340 : 0 }}
      >
        <div className="panel-header">
          <h3 className="panel-title">Session Chat</h3>
          <button className="close-btn" onClick={() => setLeftOpen(false)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div className="chat-container">
          {DEV_MODE ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#9c9888',
              fontFamily: 'DM Sans, sans-serif',
              fontSize: 13,
              fontStyle: 'italic'
            }}>
              Chat available in production
            </div>
          ) : chatClient?.userID && chatChannel ? (
            <div style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}>
              <Chat client={chatClient} theme="str-chat__theme-dark">
                <Channel channel={chatChannel}>
                  <Window>
                    <MessageList />
                    <MessageInput />
                  </Window>
                </Channel>
              </Chat>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              flexDirection: 'column',
              gap: 8
            }}>
              <div style={{
                width: 20, height: 20,
                border: '2px solid rgba(255,255,255,0.1)',
                borderTopColor: '#d4af76',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <span style={{
                fontSize: 12,
                color: '#9c9888',
                fontFamily: 'DM Sans, sans-serif'
              }}>
                Connecting chat...
              </span>
            </div>
          )}
        </div>
      </motion.div>

      {/* CENTER EXECUTOR PANEL */}
      <div className="center-panel">
        {DEV_MODE && (
          <div style={{ width: '100%', padding: '6px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '12px', fontFamily: 'var(--font-ui)', zIndex: 20, background: 'rgba(212,175,118,0.1)', color: '#d4af76', borderBottom: '1px solid rgba(184,150,90,0.15)' }}>
            Dev mode — recording disabled until Stream token is live
          </div>
        )}
        {!DEV_MODE && isCallReady && recordingStatus === 'idle' && participantCount < 2 && (
          <div style={{
            width: '100%',
            padding: '6px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: '12px',
            fontFamily: 'var(--font-ui)',
            zIndex: 20,
            background: 'rgba(184,150,90,0.1)',
            borderBottom: '1px solid rgba(184,150,90,0.15)',
            color: '#d4af76'
          }}>
            Waiting for both participants to join before recording starts...
          </div>
        )}
        {!DEV_MODE && recordingStatus !== 'idle' && (
          <div style={{
            width: '100%', padding: '6px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '12px', fontFamily: 'var(--font-ui)', zIndex: 20,
            ...(recordingStatus === 'recording' ? { background: 'rgba(192,71,58,0.15)', borderBottom: '1px solid rgba(192,71,58,0.2)', color: '#d4594a' } :
              recordingStatus === 'uploading' ? { background: 'rgba(184,150,90,0.1)', borderBottom: '1px solid rgba(184,150,90,0.15)', color: '#d4af76' } :
                recordingStatus === 'done' ? { background: 'rgba(74,158,110,0.1)', borderBottom: '1px solid rgba(74,158,110,0.15)', color: '#4a9e6e' } :
                  { background: 'rgba(192,71,58,0.1)', color: '#d4594a' })
          }}>
            {recordingStatus === 'recording' && (
              <>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#d4594a', animation: 'pulse 1.5s infinite' }}></div>
                Recording in progress — do not close this tab
              </>
            )}
            {recordingStatus === 'uploading' && (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="4.93" x2="19.07" y2="7.76"></line></svg>
                Uploading recording...
              </>
            )}
            {recordingStatus === 'done' && '✓ Recording saved — feedback will appear in Past Sessions'}
            {recordingStatus === 'error' && `⚠ ${recordingError}`}
            <style>{`
               @keyframes pulse {
                 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(212, 89, 74, 0.7); }
                 70% { transform: scale(1); box-shadow: 0 0 0 4px rgba(212, 89, 74, 0); }
                 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(212, 89, 74, 0); }
               }
               @keyframes spin {
                 100% { transform: rotate(360deg); }
               }
             `}</style>
          </div>
        )}
        {/* Background graphics */}

        <div className="session-info-bar">
          <div className="sib-left">
            <div className="green-dot"></div>
            Live Session
          </div>
          <div className="sib-center">
            {formatTime(elapsedSeconds)}
          </div>
          <div className="sib-right">
            <span style={{ color: 'var(--text2)' }}>{isExpert ? 'Candidate: ' : 'Expert: '}</span>
            <span style={{ color: 'var(--green)' }}>Active</span>
          </div>
        </div>

        {/* Stream Stage Wrapper and Editor */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <motion.div
            className="video-wrapper"
            animate={{
              width: editorEnabled ? 200 : '100%',
              flex: editorEnabled ? 'none' : 1,
              padding: editorEnabled ? '12px' : '24px',
              background: editorEnabled ? 'var(--surface)' : 'transparent'
            }}
            transition={{ type: 'spring', damping: 30 }}
          >
            {initError ? (
              <div style={{ textAlign: 'center', color: '#ff6b6b' }}>
                <p>Connection Error: {initError}</p>
                <button
                  onClick={() => window.location.reload()}
                  style={{ marginTop: '10px', padding: '8px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', cursor: 'pointer' }}
                >
                  Retry Connection
                </button>
              </div>
            ) : isCallReady && clientRef.current && callRef.current ? (
              <StreamVideo client={clientRef.current}>
                <StreamCall call={callRef.current}>
                  <MyVideoUI onParticipantCountChange={setParticipantCount} />
                </StreamCall>
              </StreamVideo>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#9c9888',
                gap: '12px',
                fontSize: 14
              }}>
                <div className="green-dot"></div>
                Initializing encrypted session...
              </div>
            )}
          </motion.div>

          <AnimatePresence>
            {editorEnabled && (
              <motion.div
                className="editor-container"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              >
                <div className="editor-header">
                  <select className="editor-lang-select" value={selectedLanguage} onChange={handleLanguageChange}>
                    <option value="javascript">JavaScript</option>
                    <option value="python">Python</option>
                    <option value="java">Java</option>
                    <option value="cpp">C++</option>
                    <option value="go">Go</option>
                    <option value="rust">Rust</option>
                  </select>
                  <div className="editor-center-label">
                    <div className="green-dot"></div>
                    Collaborative Mode
                  </div>
                  <div className="editor-actions">
                    <button className="editor-ghost-btn" onClick={() => { navigator.clipboard.writeText(code) }}>Copy code</button>
                    <button className="editor-ghost-btn" onClick={() => handleCodeChange('')}>Clear</button>
                    {isExpert && (
                      <button className="editor-run-btn" onClick={handleRunCode}>Run</button>
                    )}
                  </div>
                </div>
                {isExpert && runOutput && (
                  <div className={`editor-run-output ${runStatus}`}>
                    {runOutput}
                  </div>
                )}
                <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
                  <Editor
                    height="100%"
                    language={selectedLanguage}
                    value={code}
                    onChange={handleCodeChange}
                    onMount={handleEditorDidMount}
                    theme="vs-dark"
                    options={{
                      fontSize: 14,
                      fontFamily: 'JetBrains Mono, Fira Code, monospace',
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      wordWrap: 'on',
                      lineNumbers: 'on',
                      renderLineHighlight: 'all',
                      cursorBlinking: 'smooth',
                      smoothScrolling: true,
                      contextmenu: false,
                      padding: { top: 16 }
                    }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Floating Controls */}
        <FloatingControls
          isExpert={isExpert}
          leftOpen={leftOpen} setLeftOpen={setLeftOpen}
          rightOpen={rightOpen} setRightOpen={setRightOpen}
          handleLeave={handleLeave}
          call={call}
          editorEnabled={editorEnabled}
          toggleEditor={toggleEditorEnabled}
        />

      </div>

      {/* RIGHT AI PANEL */}
      {isExpert && (
        <motion.div
          className={`side-panel right ${rightOpen ? 'open' : 'closed'}`}
          animate={{ width: rightOpen ? 360 : 0 }}
        >
          <div className="panel-header panel-header-right">
            <div className="panel-header-left">
              <div className="ai-bolt">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
              </div>
              <h3 className="panel-title">Session Panel</h3>
            </div>
            <button className="close-btn" onClick={() => setRightOpen(false)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>

          <div className="expert-tabs-container">
            <div className="expert-tab-switcher">
              <button
                className={`expert-tab-btn ${activeTab === 'ai' ? 'active' : ''}`}
                onClick={() => setActiveTab('ai')}
              >
                {activeTab === 'ai' && <motion.div layoutId="activeTab" className="active-tab-indicator" />}
                <span className="tab-label">AI Questions</span>
              </button>
              <button
                className={`expert-tab-btn ${activeTab === 'score' ? 'active' : ''}`}
                onClick={() => setActiveTab('score')}
              >
                {activeTab === 'score' && <motion.div layoutId="activeTab" className="active-tab-indicator" />}
                <span className="tab-label">Live Score</span>
              </button>
            </div>
          </div>

          <div className="ai-content-scroll">
            <AnimatePresence mode="wait">
              {activeTab === 'ai' ? (
                <motion.div
                  key="ai-tab"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  <div className="ai-meta">
                    Role: <span className="ai-role-tag">{profile?.targetRole || 'Software Engineer'}</span>
                  </div>

                  {aiLoading ? (
                    <div className="ai-skeleton-wrap">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="ai-skeleton-card">
                          <div className="shimmer" style={{ width: '40%', height: '14px', marginBottom: '12px' }}></div>
                          <div className="shimmer" style={{ width: '90%', height: '12px', marginBottom: '8px' }}></div>
                          <div className="shimmer" style={{ width: '70%', height: '12px' }}></div>
                        </div>
                      ))}
                    </div>
                  ) : aiError ? (
                    <div className="ai-error-state">
                      <p>{aiError}</p>
                      <button
                        className="ai-retry-btn"
                        onClick={() => fetchAiQuestions(profile?.targetRole || 'Software Engineer')}
                      >
                        Retry
                      </button>
                    </div>
                  ) : (
                    <div className="ai-questions-list">
                      {aiQuestions.map(q => <QuestionCard key={q.id} q={q} />)}
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="score-tab"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  <LiveScoreTab
                    scorecard={scorecard}
                    onChange={handleScoreChange}
                    saveStatus={saveStatus}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

    </div>
  );
}
