import { GoogleGenAI } from '@google/genai';
import { config } from './config/env.js';

const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });

async function listModels() {
    try {
        const response = await ai.models.list();
        for await (const model of response) {
            console.log(model.name, model.supportedGenerationMethods);
        }
    } catch(e) {
        console.error("List models error:", e);
    }
}
listModels();
