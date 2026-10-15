import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    const response = await ai.models.list(); // this might not be the correct method, let's use the REST API
  } catch (e) { console.error(e); }
}
run();
