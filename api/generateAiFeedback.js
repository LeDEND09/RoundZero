import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { GoogleGenerativeAI } from "@google/generative-ai";

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

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { bookingId, candidateUid, expertUid } = req.body || {};

  if (!bookingId || !candidateUid) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    ensureFirebaseAdmin();
    const db = getFirestore();

    // 1. Fetch Expert Feedback & Candidate Profile for context
    const [expertFeedbackDoc, candidateDoc] = await Promise.all([
      db.collection('expertFeedback').doc(bookingId).get(),
      db.collection('users').doc(candidateUid).get()
    ]);

    if (!expertFeedbackDoc.exists) {
      throw new Error('Expert feedback not found for this session');
    }

    const expertData = expertFeedbackDoc.data();
    const candidateData = candidateDoc.exists ? candidateDoc.data() : {};
    
    const targetRole = candidateData.targetRole || 'Software Engineer';
    const techStack = candidateData.techStack?.join(', ') || 'Not specified';
    const scores = expertData.scores || {};
    const overallScore = expertData.overallScore || 0;

    // 2. Prepare Gemini Prompt
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      You are an expert technical interview analyst for RoundZero. 
      Your task is to generate a professional performance report for a candidate based on an interviewer's live scores and notes.

      Candidate Target Role: ${targetRole}
      Candidate Tech Stack: ${techStack}
      
      Interviewer's Live Scores (out of 5 stars and optional notes):
      ${JSON.stringify(scores, null, 2)}
      
      Calculated Overall Score: ${overallScore}/10

      Please generate:
      1. A professional 3-4 sentence "summary" of the performance.
      2. 3-4 specific "strengths" based on high scores or notes.
      3. 3-4 specific "improvements" based on lower scores or notes.
      
      Respond ONLY with a valid JSON object containing these keys: "summary", "strengths" (array of strings), and "improvements" (array of strings).
      Do not include markdown formatting or backticks.
    `;

    const result = await model.generateContent(prompt);
    const aiResponse = await result.response;
    const text = aiResponse.text();
    
    // Clean up response
    const cleaned = text.replace(/```json|```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    const jsonStr = cleaned.slice(start, end + 1);
    const aiParsed = JSON.parse(jsonStr);

    // 3. Build the final feedback document
    const feedbackDoc = {
      bookingId,
      candidateUid,
      expertUid: expertUid || expertData.expertUid || null,
      status: 'completed',
      technicalScore: (scores.codeQuality?.stars || scores.problemSolving?.stars || 0) * 2,
      communicationScore: (scores.communication?.stars || 0) * 2,
      overallScore: overallScore,
      strengths: aiParsed.strengths || [],
      improvements: aiParsed.improvements || [],
      summary: aiParsed.summary || '',
      isAiGenerated: true,
      createdAt: FieldValue.serverTimestamp(),
      completedAt: FieldValue.serverTimestamp()
    };

    // 4. Save to Firestore
    await db.collection('feedback').doc(bookingId).set(feedbackDoc);

    return res.status(200).json({
      success: true,
      feedback: feedbackDoc
    });

  } catch (error) {
    console.error('AI Feedback generation error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to generate AI feedback' });
  }
}
