import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const FEEDBACK_TEMPLATES = [
  {
    templateId: 'strong',
    technicalScore: 8.5,
    communicationScore: 9.0,
    overallScore: 8.7,
    strengths: [
      'Structured thinking throughout the session',
      'Clear and articulate communication',
      'Proactively identified edge cases',
      'Discussed multiple approaches before coding'
    ],
    improvements: [
      'Optimize time complexity in the final solution',
      'Consider space-time trade-offs more explicitly'
    ],
    summary: 'The candidate demonstrated strong problem-solving skills and communicated their thought process clearly throughout. They proactively identified edge cases and proposed multiple solutions before settling on the optimal one. With minor improvements to complexity analysis, this candidate would perform well in senior-level interviews.'
  },
  {
    templateId: 'average',
    technicalScore: 6.5,
    communicationScore: 7.0,
    overallScore: 6.8,
    strengths: [
      'Good foundational knowledge of core concepts',
      'Receptive to hints and course-corrected well',
      'Clean and readable code structure'
    ],
    improvements: [
      'Needs more practice with DSA patterns',
      'Should clarify requirements before coding',
      'Work on breaking down complex problems'
    ],
    summary: 'The candidate showed a solid understanding of core concepts but struggled when the problem required deeper algorithmic thinking. They were receptive to hints and course-corrected well when guided. Focused practice on data structures and a habit of clarifying requirements before coding would significantly improve their interview performance.'
  },
  {
    templateId: 'needs_improvement',
    technicalScore: 5.0,
    communicationScore: 5.5,
    overallScore: 5.2,
    strengths: [
      'Eager to learn and showed a positive attitude',
      'Willing to try different approaches when stuck'
    ],
    improvements: [
      'Practice LeetCode medium-level problems daily',
      'Study system design fundamentals',
      'Work on verbal communication under pressure',
      'Study time and space complexity analysis'
    ],
    summary: 'The candidate struggled to translate their ideas into working solutions and had difficulty explaining their reasoning under pressure. While they showed a willingness to learn and adapt, the technical gaps were significant for the target role. A structured study plan focusing on core algorithms, system design basics, and mock interview practice is strongly recommended before the next attempt.'
  }
];

function ensureFirebaseAdmin() {
  if (getApps().length) return;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase Admin credentials (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)'
    );
  }

  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey })
  });
}

function isFeedbackComplete(data) {
  if (!data) return false;
  if (data.status === 'completed') return true;
  const hasScores =
    typeof data.technicalScore === 'number' ||
    typeof data.communicationScore === 'number' ||
    typeof data.overallScore === 'number';
  return hasScores;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = typeof req.body === 'string'
    ? JSON.parse(req.body || '{}')
    : (req.body || {});
  const { bookingId, candidateUid, expertUid } = body;

  if (!bookingId || !candidateUid) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    ensureFirebaseAdmin();
    const db = getFirestore();

    // Check existing feedback.
    // Keep completed feedback; replace stale/incomplete feedback.
    const existing = await db.collection('feedback').doc(bookingId).get();
    const shouldReplaceExisting = existing.exists && !isFeedbackComplete(existing.data());
    if (existing.exists && !shouldReplaceExisting) {
      return res.status(200).json({
        message: 'Feedback already exists',
        feedback: existing.data()
      });
    }

    // Pick a random template
    const template = FEEDBACK_TEMPLATES[
      Math.floor(Math.random() * FEEDBACK_TEMPLATES.length)
    ];

    // Build the feedback document
    const feedbackDoc = {
      bookingId,
      candidateUid,
      expertUid: expertUid || null,
      status: 'completed',
      technicalScore: template.technicalScore,
      communicationScore: template.communicationScore,
      overallScore: template.overallScore,
      strengths: template.strengths,
      improvements: template.improvements,
      summary: template.summary,
      isHardcoded: true,
      // TODO: When real Gemini pipeline is ready, replace this
      // function with api/gradeSession.js and set isHardcoded: false
      templateId: template.templateId,
      createdAt: FieldValue.serverTimestamp(),
      completedAt: FieldValue.serverTimestamp()
    };

    // Save to Firestore (or replace stale document)
    await db.collection('feedback').doc(bookingId).set(feedbackDoc);

    return res.status(200).json({
      success: true,
      feedback: feedbackDoc
    });
  } catch (error) {
    console.error('Feedback generation error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to generate feedback' });
  }
}
