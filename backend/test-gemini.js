import { GoogleGenAI } from '@google/genai';
import { config } from './config/env.js';

const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });

async function test(modelName) {
    try {
        console.log(`Testing ${modelName}...`);
        const response = await ai.models.generateContent({
            model: modelName,
            contents: 'Say hello!',
        });
        console.log("Success! Response:", response.text);
    } catch(e) {
        console.error("Error for", modelName, ":", e.status, e.message);
    }
}
test('gemini-flash-latest');
