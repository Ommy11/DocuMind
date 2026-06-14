
import { GoogleGenAI } from "@google/genai";
import { Message, Source } from "../types";

const MODEL_NAME = 'gemini-3-flash-preview';

export const askGemini = async (
  query: string, 
  context: string, 
  history: Message[]
): Promise<{ text: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const systemInstruction = `
    You are an advanced Multi-Document RAG (Retrieval-Augmented Generation) assistant. 
    Your goal is to answer the user's question accurately using ONLY the provided context.
    
    Context Information:
    ${context}

    Guidelines:
    1. If the answer is not in the context, clearly state that you don't have enough information.
    2. Cite specific document names when providing information.
    3. Be concise but thorough.
    4. Format your response using clean Markdown.
  `;

  const chat = ai.chats.create({
    model: MODEL_NAME,
    config: {
      systemInstruction,
      temperature: 0.3, // Lower temperature for more factual responses
    },
  });

  const response = await chat.sendMessage({ message: query });
  
  return {
    text: response.text || "I'm sorry, I couldn't generate a response."
  };
};
