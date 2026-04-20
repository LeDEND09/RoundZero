import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { targetRole, bookingId } = req.body || {};

  if (!targetRole) {
    return res.status(400).json({ error: "Candidate targetRole is required" });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "Gemini API Key not configured" });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      You are an expert technical interviewer for RoundZero. 
      Generate 6 high-quality, professional technical interview questions for a candidate applying for the role: "${targetRole}".
      
      For each question, provide:
      1. The question text.
      2. 2-3 "Green Flags" (what a good answer sounds like).
      3. 2-3 "Red Flags" (warning signs in an answer).
      
      Structure your response as a valid JSON array of exactly 6 objects with keys: "id", "question", "greenFlags" (array), and "redFlags" (array).
      Use numeric IDs from 1 to 6.
      Respond ONLY with the JSON array.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const cleaned = text.replace(/```json|```/g, "").trim();
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");

    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Could not parse question JSON array from model response");
    }

    const jsonStr = cleaned.slice(start, end + 1);
    const parsed = JSON.parse(jsonStr);
    const questions = Array.isArray(parsed) ? parsed : [];

    if (!questions.length) {
      throw new Error("Empty question list from model");
    }

    return res.status(200).json({ questions });
  } catch (err) {
    console.error("Gemini AI generation failed:", err);
    return res.status(500).json({ error: "Failed to generate AI questions" });
  }
}
