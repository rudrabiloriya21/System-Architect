import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { Task } from "../types";

export async function getChatResponse(
  prompt: string, 
  modelName: string = "System Architect v1.0",
  history: { role: 'user' | 'model', content: string }[] = []
) {
  const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
  const groqApiKey = import.meta.env.VITE_GROQ_API_KEY || process.env.GROQ_API_KEY || "";
  
  const ai = new GoogleGenAI({ apiKey: geminiApiKey });
  const groq = new OpenAI({ 
    apiKey: groqApiKey, 
    baseURL: "https://api.groq.com/openai/v1",
    dangerouslyAllowBrowser: true 
  });

  let modelInstruction = "";
  let isPro = false;

  switch (modelName) {
    case "System Architect v1.1":
      modelInstruction = "You have enhanced logic and reasoning modules. Focus on logical consistency and breaking down complex problems into clear, sequential steps.";
      break;
    case "System Architect v1.0 pro":
      modelInstruction = "You are a high-performance professional core. Provide sophisticated, strategic advice with a formal and authoritative tone. Use advanced vocabulary.";
      isPro = true;
      break;
    case "System Architect v1.1 pro":
      modelInstruction = "You are the ultimate architectural intelligence. Combine deep logical reasoning with high-level strategic planning. Be extremely thorough and insightful.";
      isPro = true;
      break;
    default:
      modelInstruction = "You are a stable and efficient architecture core. Provide quick, reliable, and straightforward productivity assistance.";
  }

  const systemPrompt = `You are ${modelName}, a high-performance productivity AI. 
        ${modelInstruction}
        Your goal is to help the user manage their daily productivity effectively.
        
        Instructions:
        1. Be concise, professional, and architecturally precise.
        2. If the user asks for advice, provide structured, actionable steps.
        3. Use markdown for formatting.
        4. Your tone is helpful but efficient.`;

  try {
    if (isPro) {
      if (!groqApiKey) {
        throw new Error("Groq API key is missing. Please add VITE_GROQ_API_KEY to your .env file or Vercel settings.");
      }
      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          ...history.map(msg => ({
            role: msg.role === 'model' ? 'assistant' : 'user' as const,
            content: msg.content
          })),
          { role: "user", content: prompt }
        ],
      });
      return response.choices[0].message.content || "";
    } else {
      // Format history for Gemini
      const contents = history.map(msg => ({
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));
      
      // Append the new prompt
      contents.push({
        role: 'user',
        parts: [{ text: prompt }]
      });

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: contents,
        config: {
          systemInstruction: systemPrompt,
        }
      });
      return response.text;
    }
  } catch (error) {
    console.error("AI API Error:", error);
    throw error;
  }
}
