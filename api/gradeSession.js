export const maxDuration = 300; // 5 minute timeout for Vercel

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createClient } from '@supabase/supabase-js';

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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    bookingId, 
    expertAudioUrl, 
    candidateAudioUrl,
    expertAudioPath,
    candidateAudioPath,
    candidateUid,
    expertUid,
    singleAudio
  } = req.body;

  if (!bookingId || (!expertAudioUrl && !candidateAudioUrl)) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Missing GEMINI_API_KEY');
    }

    ensureFirebaseAdmin();
    const db = getFirestore();
    const bookingDoc = await db.collection('bookings').doc(bookingId).get();
    const bookingData = bookingDoc.exists ? bookingDoc.data() : null;
    const resolvedCandidateUid = candidateUid || bookingData?.candidateUid || null;
    const resolvedExpertUid = expertUid || bookingData?.expertUid || null;

    // Mark feedback as processing
    await db.collection('feedback').doc(bookingId).set({
      bookingId,
      candidateUid: resolvedCandidateUid,
      expertUid: resolvedExpertUid,
      status: 'processing',
      createdAt: new Date()
    });

    let expertFileUri = null;
    let candidateFileUri = null;

    // Step 1: Download available audio files and Step 2: Upload to Gemini File API
    if (expertAudioUrl) {
      const expertBuffer = await downloadFile(expertAudioUrl, expertAudioPath || bookingData?.expertAudioPath);
      expertFileUri = await uploadToGeminiFileApi(expertBuffer, 'expert_audio.webm', 'audio/webm');
    }
    if (candidateAudioUrl) {
      const candidateBuffer = await downloadFile(candidateAudioUrl, candidateAudioPath || bookingData?.candidateAudioPath);
      candidateFileUri = await uploadToGeminiFileApi(candidateBuffer, 'candidate_audio.webm', 'audio/webm');
    }

    // Step 3: Fetch candidate info for context
    const candidateDoc = resolvedCandidateUid
      ? await db.collection('users').doc(resolvedCandidateUid).get()
      : null;
    const candidateData = candidateDoc?.data?.() || null;
    const targetRole = candidateData?.targetRole || 'Software Engineer';
    const targetCompanies = candidateData?.targetCompanies || '';
    const techStack = candidateData?.techStack?.join(', ') || '';
    const expertFeedbackDoc = await db.collection('expertFeedback').doc(bookingId).get();
    const expertFeedback = expertFeedbackDoc.exists ? expertFeedbackDoc.data() : null;

    // Step 4: Grade with Gemini 1.5 Pro
    const scorecard = await gradeWithGemini(
      expertFileUri,
      candidateFileUri,
      targetRole,
      targetCompanies,
      techStack,
      singleAudio,
      expertFeedback
    );

    // Step 5: Save scorecard to Firestore
    await db.collection('feedback').doc(bookingId).set({
      bookingId,
      candidateUid: resolvedCandidateUid,
      expertUid: resolvedExpertUid,
      status: 'completed',
      technicalScore: scorecard.technicalScore,
      communicationScore: scorecard.communicationScore,
      problemSolvingScore: scorecard.problemSolvingScore ?? null,
      strengths: scorecard.strengths || [],
      improvements: scorecard.improvements || [],
      focusAreas: scorecard.focusAreas || [],
      revisionPlan: scorecard.revisionPlan || [],
      combinedAssessment: scorecard.combinedAssessment || '',
      summary: scorecard.summary || '',
      transcript: scorecard.transcript || '',
      completedAt: new Date()
    });

    return res.status(200).json({ success: true, scorecard });

  } catch (err) {
    console.error('gradeSession error:', err);

    // Save error state to Firestore
    try {
      const db = getFirestore();
      await db.collection('feedback').doc(bookingId).update({
        status: 'error',
        errorMessage: err.message
      });
    } catch (e) {}

    return res.status(500).json({ error: err.message });
  }
}

// Helper: Download file as buffer
async function downloadFile(url, storagePath) {
  // First try plain fetch (works if bucket/object is truly public)
  try {
    const response = await fetch(url);
    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
  } catch (_) {}

  // Fallback: download directly from Supabase Storage using service role
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      `Failed to download: ${url}. ` +
      `If your recordings bucket is private, set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the backend.`
    );
  }

  const path = storagePath || extractStoragePathFromUrl(url);
  if (!path) {
    throw new Error(`Failed to download: ${url}. Could not infer storage path.`);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // Try supabase-js download first
  try {
    const { data, error } = await supabase.storage
      .from('interview-recordings')
      .download(path);

    if (!error && data) {
      const arrayBuffer = await data.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
  } catch (_) {}

  // Final fallback: direct Storage REST fetch (more tolerant of edge-case paths)
  const restUrl = `${supabaseUrl.replace(/\\/$/, '')}/storage/v1/object/interview-recordings/${encodeURI(path)}`;
  const restResp = await fetch(restUrl, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });

  if (!restResp.ok) {
    const errText = await restResp.text().catch(() => '');
    throw new Error(
      `Failed to download: ${url}. Supabase REST download failed for path "${path}": ${errText || restResp.status}`
    );
  }

  const arrayBuffer = await restResp.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function extractStoragePathFromUrl(url) {
  try {
    const u = new URL(url);
    // Typical public format:
    // /storage/v1/object/public/<bucket>/<path>
    const parts = u.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('public');
    if (idx !== -1 && parts[idx + 1] === 'interview-recordings') {
      return parts.slice(idx + 2).join('/');
    }
    // Some setups omit /public/ even when accessible via tokenized links.
    const bucketIdx = parts.indexOf('interview-recordings');
    if (bucketIdx !== -1) {
      return parts.slice(bucketIdx + 1).join('/');
    }
  } catch (_) {}
  return null;
}

// Helper: Upload to Gemini File API
async function uploadToGeminiFileApi(buffer, displayName, mimeType) {
  const apiKey = process.env.GEMINI_API_KEY;
  const startResponse = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(buffer.length),
        'X-Goog-Upload-Header-Content-Type': mimeType,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file: { display_name: displayName }
      })
    }
  );

  if (!startResponse.ok) {
    const err = await startResponse.text();
    throw new Error(`Gemini upload start failed: ${err}`);
  }

  const uploadUrl = startResponse.headers.get('x-goog-upload-url');
  if (!uploadUrl) {
    throw new Error('Gemini upload URL missing from start response');
  }

  const finalizeResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Command': 'upload, finalize',
      'X-Goog-Upload-Offset': '0',
      'Content-Length': String(buffer.length),
      'Content-Type': mimeType
    },
    body: buffer
  });

  if (!finalizeResponse.ok) {
    const err = await finalizeResponse.text();
    throw new Error(`Gemini upload finalize failed: ${err}`);
  }

  const uploadData = await finalizeResponse.json();
  if (!uploadData?.file?.uri) {
    throw new Error('Gemini upload succeeded but returned no file URI');
  }

  return uploadData.file.uri;
}

// Helper: Grade with Gemini 1.5 Pro
async function gradeWithGemini(
  expertFileUri, 
  candidateFileUri, 
  targetRole,
  targetCompanies,
  techStack,
  singleAudio,
  expertFeedback
) {
  const apiKey = process.env.GEMINI_API_KEY;
  const expertFeedbackJson = expertFeedback
    ? JSON.stringify(expertFeedback, null, 2)
    : 'No interviewer review submitted.';

  let prompt = `You are a senior ${targetRole} interview performance analyst.

You will be given audio recording(s) of a technical interview.
The candidate is targeting: ${targetRole}
Target companies: ${targetCompanies || 'Not specified'}
Tech stack: ${techStack || 'Not specified'}
Interviewer submitted review JSON:
${expertFeedbackJson}

Please:
1. Transcribe the audio recording(s)
2. Evaluate the candidate's performance based on the conversation
3. Reconcile transcript evidence with interviewer review
4. Generate detailed actionable feedback covering strengths, weak areas, what to revise, and what to focus next

Return ONLY a valid JSON object with NO markdown, 
NO backticks, NO extra text. Exactly this structure:
{
  "technicalScore": <number 0-10>,
  "communicationScore": <number 0-10>,
  "problemSolvingScore": <number 0-10>,
  "strengths": [<string>, <string>, <string>],
  "improvements": [<string>, <string>, <string>],
  "focusAreas": [<string>, <string>, <string>],
  "revisionPlan": [<string>, <string>, <string>],
  "combinedAssessment": "<how transcript + interviewer review were combined>",
  "summary": "<2-3 sentence overall assessment>",
  "transcript": "<full interview transcript with speaker labels>"
}`;

  if (singleAudio) {
    prompt += `\nNOTE: Only one side of the conversation may have been fully captured. Please transcribe and grade based on the available audio context.`;
  } else {
    prompt += `\nThere are two audio recordings: Rec 1 is the Expert, Rec 2 is the Candidate.`;
  }

  const parts = [];
  if (expertFileUri) {
    parts.push({ fileData: { mimeType: 'audio/webm', fileUri: expertFileUri } });
  }
  if (candidateFileUri) {
    parts.push({ fileData: { mimeType: 'audio/webm', fileUri: candidateFileUri } });
  }
  parts.push({ text: prompt });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048
        }
      })
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API failed: ${err}`);
  }

  const data = await response.json();
  const text = (data.candidates?.[0]?.content?.parts || [])
    .map((part) => part?.text || '')
    .join('\n')
    .trim();

  if (!text) throw new Error('No response from Gemini');

  const clean = text
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Gemini response did not contain a valid JSON object');
  }
  const scorecard = JSON.parse(clean.slice(start, end + 1));

  if (typeof scorecard.technicalScore !== 'number' ||
      typeof scorecard.communicationScore !== 'number') {
    throw new Error('Invalid scorecard format from Gemini');
  }

  scorecard.technicalScore = Math.min(10, Math.max(0, scorecard.technicalScore));
  scorecard.communicationScore = Math.min(10, Math.max(0, scorecard.communicationScore));
  if (typeof scorecard.problemSolvingScore === 'number') {
    scorecard.problemSolvingScore = Math.min(10, Math.max(0, scorecard.problemSolvingScore));
  }

  return scorecard;
}
