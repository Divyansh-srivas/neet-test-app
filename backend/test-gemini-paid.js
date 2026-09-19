import { GoogleGenAI } from '@google/genai';
import { config } from './config/env.js';

const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });

async function test(modelName) {
    try {
        console.log(`Testing ${modelName}...`);
        const res = await ai.models.generateContent({
            model: modelName,
            contents: "Say hello world"
        });
        console.log(`Success with ${modelName}:`, res.text);
    } catch(e) {
        console.error(`Error with ${modelName}:`, e.status, e.message);
    }
}

async function run() {
    await test('gemini-3.6-flash');
    await test('gemini-1.5-flash');
    await test('gemini-1.5-flash-latest');
    await test('gemini-1.5-pro');
    await test('gemini-2.0-flash');
}
run();
