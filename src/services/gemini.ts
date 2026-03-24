import { GoogleGenAI } from "@google/genai";
import { Task } from "../types";

export async function getChatResponse(prompt: string, modelName: string = "System Architect v1.0") {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
  const ai = new GoogleGenAI({ apiKey });

  let modelInstruction = "";
  let geminiModel = "gemini-3-flash-preview";

  switch (modelName) {
    case "System Architect v1.1":
      modelInstruction = "You have enhanced logic and reasoning modules. Focus on logical consistency and breaking down complex problems into clear, sequential steps.";
      break;
    case "System Architect v1.0 pro":
      modelInstruction = "You are a high-performance professional core. Provide sophisticated, strategic advice with a formal and authoritative tone. Use advanced vocabulary.";
      geminiModel = "gemini-3.1-pro-preview";
      break;
    case "System Architect v1.1 pro":
      modelInstruction = "You are the ultimate architectural intelligence. Combine deep logical reasoning with high-level strategic planning. Be extremely thorough and insightful.";
      geminiModel = "gemini-3.1-pro-preview";
      break;
    default:
      modelInstruction = "You are a stable and efficient architecture core. Provide quick, reliable, and straightforward productivity assistance.";
  }

  try {
    const response = await ai.models.generateContent({
      model: geminiModel,
      contents: prompt,
      config: {
        systemInstruction: `You are ${modelName}, a high-performance productivity AI. 
        ${modelInstruction}
        Your goal is to help the user manage their daily productivity effectively.
        
        Instructions:
        1. Be concise, professional, and architecturally precise.
        2. If the user asks for advice, provide structured, actionable steps.
        3. Use markdown for formatting.
        4. Your tone is helpful but efficient.`,
      }
    });

    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}
