import { encode } from '@msgpack/msgpack';
const ELEVEN_LABS_API_KEY = import.meta.env.VITE_ELEVEN_LABS_API_KEY;
const VOICE_ID = import.meta.env.VITE_ELEVEN_LABS_VOICE_ID;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour cache

// Audio cache using IndexedDB
const audioCache = new Map();
const cacheKey = (text) => encode(text).toString();
export const synthesizeSpeech = async (text, options = {}) => {
    const key = cacheKey(text);

    // Check memory cache first
    if (audioCache.has(key)) {
        const { blob, timestamp } = audioCache.get(key);
        if (Date.now() - timestamp < CACHE_DURATION) {
            return URL.createObjectURL(blob);
        }
        audioCache.delete(key);
    }

    try {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': ELEVEN_LABS_API_KEY,
            },
            body: JSON.stringify({
                text,
                model_id: 'eleven_monolingual_v1',
                voice_settings: {
                    stability: options.stability ??  0.5,
                    similarity_boost: options.similarity_bosst ?? 0.75,
                },
            })            
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail?.message || 'Speech synthesis failed');
        }

        const audioBlob = await response.blob();

        // Cache the result
        audioCache.set(key, {
            blob: audioBlob.slice(),
            timestamp: Date.now()
        });

        return URL.createObjectURL(audioBlob);
    } catch (error) {
        console.error('ElevenLabs API Error:', error);
        throw error;
    }
};

export const cleanup = (url) => {
    if (url) URL.revokeObjectURL(url);
};