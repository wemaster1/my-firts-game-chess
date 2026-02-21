
import { GoogleGenAI, Type } from "@google/genai";
import { GeminiMoveResponse, AiDifficulty } from "../types";

const DIFFICULTY_PROMPTS: Record<AiDifficulty, string> = {
  'Easy': "Play like a beginner (ELO 600). Make frequent mistakes, miss obvious tactical hanging pieces, and do not think ahead more than one move. Occasionally make a blunder that loses a major piece.",
  'Medium': "Play like an intermediate club player (ELO 1500). Follow solid opening principles and find basic tactics, but occasionally miss complex combinations or deep positional nuances.",
  'Hard': "Play like a Grandmaster (ELO 2400+). Be very precise, find punishing tactical sequences, and exert strong positional pressure. Only very rare mistakes.",
  'Expert': "Play like a World-Class Chess Engine (ELO 3200+). Absolute precision. Evaluate all lines deeply. Exploit every tiny weakness. Find the most efficient path to victory. Never blunder."
};

// Use generateContent for chess move analysis
export const getGeminiMove = async (fen: string, history: string[], difficulty: AiDifficulty = 'Medium'): Promise<GeminiMoveResponse> => {
  // Always use new GoogleGenAI instance right before making an API call to ensure it always uses the most up-to-date API key.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    You are a Chess AI acting at the following skill level: ${difficulty}.
    ${DIFFICULTY_PROMPTS[difficulty]}
    
    Current FEN: ${fen}
    Last few moves: ${history.slice(-10).join(', ')}

    Analyze the board and suggest the best move for the current player based on your skill level.
    Provide your response in JSON format.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            move: {
              type: Type.STRING,
              description: "The move in Algebraic Notation (e.g., 'e4', 'Nf3', 'O-O') or UCI format (e.g., 'e2e4').",
            },
            explanation: {
              type: Type.STRING,
              description: "A brief tactical explanation for the move.",
            },
            evaluation: {
              type: Type.STRING,
              description: "Briefly describe the current evaluation.",
            },
          },
          required: ["move", "explanation", "evaluation"],
        },
      },
    });

    // The text property returns the string output directly.
    const text = response.text || "{}";
    const result = JSON.parse(text.trim());
    return result as GeminiMoveResponse;
  } catch (error) {
    console.error("Gemini Move Error:", error);
    throw new Error("Failed to get move from Gemini");
  }
};

// Use generateContent to evaluate draw offers
export const evaluateAiDrawOffer = async (fen: string, history: string[], difficulty: AiDifficulty): Promise<boolean> => {
  // Always use new GoogleGenAI instance right before making an API call to ensure it always uses the most up-to-date API key.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    You are a Chess AI (${difficulty} difficulty). Your opponent has offered a draw.
    Current FEN: ${fen}
    History: ${history.slice(-10).join(', ')}

    Analyze the position. If you are significantly winning, decline the draw. If the position is equal, complex, or you are losing, you may accept.
    Respond with a JSON object: {"accept": boolean, "reason": "string"}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            accept: { type: Type.BOOLEAN },
            reason: { type: Type.STRING }
          },
          required: ["accept", "reason"]
        }
      }
    });
    // The text property returns the string output directly.
    const result = JSON.parse(response.text?.trim() || "{}");
    return !!result.accept;
  } catch (e) {
    console.error("Draw evaluation error:", e);
    return false;
  }
};
