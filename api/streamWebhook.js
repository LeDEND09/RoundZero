/*
  STREAM WEBHOOK SETUP CHECKLIST
  1. Deploy to Vercel → get your prod URL e.g. https://roundzero.vercel.app
  2. Stream Dashboard → Video & Audio → Webhooks
     → Add endpoint: https://roundzero.vercel.app/api/streamWebhook
     → Enable event: call.transcription_ready (NOT call.ended)
  3. Stream Dashboard → Video & Audio → Call Types → default
     → Transcription → set Mode to "auto-on"
     → This starts transcription automatically when both participants join
  4. Verify env vars on Vercel: STREAM_API_KEY, STREAM_API_SECRET, GEMINI_API_KEY
*/

import crypto from 'crypto';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = {
  api: {
    bodyParser: false,
  },
};

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

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  try {
    const rawBody = await getRawBody(req);
    
    // Step 1: Signature verification
    const signature = req.headers['x-signature'];
    if (!signature) {
      console.warn("Missing x-signature header");
      return res.status(401).send("Missing signature");
    }

    const apiSecret = process.env.STREAM_API_SECRET;
    if (!apiSecret) {
      console.error("STREAM_API_SECRET not configured");
      return res.status(500).send("Server configuration error");
    }

    const expectedSignature = crypto.createHmac('sha256', apiSecret)
      .update(rawBody)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.warn("Invalid signature. Expected:", expectedSignature, "Got:", signature);
      return res.status(401).send("Invalid signature");
    }

    // Step 2: Parse and filter events
    const event = JSON.parse(rawBody.toString('utf8'));
    if (event.type !== "call.transcription_ready") {
      return res.status(200).send("ignored");
    }

    // Step 3: Extract fields
    const streamCallCid = event.call_cid;
    const callId = streamCallCid ? streamCallCid.split(":")[1] : null;
    const transcriptUrl = event.call_transcription?.url;

    if (!callId || !transcriptUrl) {
      console.warn("Missing callId or transcriptUrl");
      return res.status(200).send("ignored (missing required fields)");
    }

    // Step 4: Firestore lookup
    ensureFirebaseAdmin();
    const db = getFirestore();

    const snapshot = await db.collection("bookings").where("streamCallId", "==", callId).get();
    if (snapshot.empty) {
      console.warn("No booking found for streamCallId:", callId);
      return res.status(200).send("ignored (no booking)");
    }

    const bookingDoc = snapshot.docs[0];
    const bookingId = bookingDoc.id;
    const { roleDescription, candidateUid, expertUid } = bookingDoc.data();

    // Step 5: Parallel fetch
    const [transcriptRes, feedbackSnap] = await Promise.all([
      fetch(transcriptUrl),
      db.collection("expertFeedback").doc(bookingId).get()
    ]);

    const transcriptText = await transcriptRes.text();
    const expertScorecard = feedbackSnap.exists ? feedbackSnap.data() : {};

    // Step 6: Call Gemini 1.5 Flash
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY not configured");
      return res.status(500).send("Server configuration error");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    let roleDomain = "Software Engineering";
    const rd = (roleDescription || "").toLowerCase();
    if (rd.includes("frontend") || rd.includes("react") || rd.includes("ui")) roleDomain = "Frontend Engineering";
    else if (rd.includes("backend") || rd.includes("node") || rd.includes("java") || rd.includes("python")) roleDomain = "Backend Engineering";
    else if (rd.includes("cyber") || rd.includes("security") || rd.includes("infosec")) roleDomain = "Cybersecurity";
    else if (rd.includes("data") || rd.includes("ml") || rd.includes("machine learning") || rd.includes("ai")) roleDomain = "Data Science / ML";
    else if (rd.includes("devops") || rd.includes("cloud") || rd.includes("infra")) roleDomain = "DevOps / Infrastructure";
    else if (rd.includes("mobile") || rd.includes("ios") || rd.includes("android")) roleDomain = "Mobile Engineering";

    const prompt = `You are a world-class senior interviewer and hiring committee member 
at a top-tier tech company, specialising in ${roleDomain} roles. 
Your role: ${roleDescription || 'Software Engineer'}.

You have just reviewed a technical interview. Your job is to produce 
a brutally honest, precise, experience-level-appropriate evaluation 
that would hold up in a real hiring committee review.

EXPERT SCORECARD (filled by the human interviewer during the session):
- Communication: ${expertScorecard.communication || 0}/5 — Notes: "${expertScorecard.notes?.communication || 'none'}"
- Problem Solving: ${expertScorecard.problemSolving || 0}/5 — Notes: "${expertScorecard.notes?.problemSolving || 'none'}"  
- Code Quality: ${expertScorecard.codeQuality || 0}/5 — Notes: "${expertScorecard.notes?.codeQuality || 'none'}"
- Edge Cases: ${expertScorecard.edgeCases || 0}/5 — Notes: "${expertScorecard.notes?.edgeCases || 'none'}"
- Approaches: ${expertScorecard.approaches || 0}/5 — Notes: "${expertScorecard.notes?.approaches || 'none'}"
- Concept Clarity: ${expertScorecard.conceptClarity || 0}/5 — Notes: "${expertScorecard.notes?.conceptClarity || 'none'}"
- Expert Overall Score: ${expertScorecard.overallScore || 0}/10
- Expert Notes: "${expertScorecard.notes?.overall || 'none'}"

FULL INTERVIEW TRANSCRIPT:
${transcriptText}

Based on the transcript evidence and expert scorecard above, return 
ONLY a valid JSON object (no markdown, no preamble, no explanation) 
with exactly these fields:

{
  "overallRating": "Excellent" | "Good" | "Needs Work" | "Poor",
  "recommendation": "STRONG HIRE" | "HIRE" | "BORDERLINE" | "NO HIRE",
  "overallScore": number 1-10,
  "technicalScore": number 1-10,
  "communicationScore": number 1-10,
  "problemSolvingScore": number 1-10,
  "summary": "3-4 sentence overall narrative. Use the candidate's first name if detectable from transcript. Be specific, not generic.",
  "technical": "2-3 sentences. Cite specific questions or moments from the transcript. Name exact concepts they got right or wrong.",
  "communication": "2-3 sentences. How did they structure answers? Did they think out loud? Any red flags?",
  "problemSolving": "2-3 sentences. How did they approach unfamiliar problems? Did they ask clarifying questions?",
  "codeQuality": "2-3 sentences. Comment on readability, edge case handling, efficiency. Skip if no coding occurred.",
  "strengths": ["specific strength 1", "specific strength 2", "specific strength 3"],
  "improvements": ["specific improvement 1", "specific improvement 2", "specific improvement 3"],
  "flaws": ["honest critical flaw 1", "honest critical flaw 2"],
  "roadmap": ["concrete study/practice action 1", "concrete study/practice action 2", "concrete study/practice action 3"],
  "expertCorroboration": "1 sentence: does transcript evidence support or challenge the expert's ratings? Be specific."
}

Rules:
- Be specific. Reference actual transcript moments, not generic advice.
- Match depth to the role: SWE → focus on CS fundamentals + system design. Cybersecurity → focus on threat modelling + tooling. Frontend → focus on browser APIs + performance. Data → focus on stats + ML fundamentals.
- Do not inflate scores. A score of 7+ should require demonstrated depth, not just surface-level answers.
- flaws should be honest — things that would actually concern a hiring manager, not softened versions of improvements.
- roadmap should be actionable: specific topics, resources, or practice patterns — not vague advice like "practice more".`;

    let parsedAI = {
      isHardcoded: false,
      gradedBy: "gemini-fallback",
      summary: "Analysis pending — transcript received."
    };

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const cleaned = text.replace(/```json|```/g, "").trim();
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start !== -1 && end !== -1) {
        parsedAI = JSON.parse(cleaned.slice(start, end + 1));
      } else {
        throw new Error("No JSON object found in response");
      }
    } catch (parseErr) {
      console.error("Gemini Parsing/Generation failed:", parseErr);
    }

    // Step 7: Write to Firestore feedback/{bookingId}
    await db.collection("feedback").doc(bookingId).set({
      ...parsedAI,
      candidateUid,
      expertUid,
      isHardcoded: false,
      gradedBy: parsedAI.gradedBy || "gemini",
      gradedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    // Step 8: Return 200
    return res.status(200).send("ok");

  } catch (err) {
    console.error("Webhook handler error:", err);
    // Always return 200 even on non-fatal errors so Stream doesn't retry endlessly.
    return res.status(200).send("error ignored");
  }
}
