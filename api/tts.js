export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Método não permitido');

    const { text, voiceId } = req.body;
    const apiKey = process.env.ELEVENLABS_API_KEY;

    try {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
                'xi-api-key': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                model_id: "eleven_multilingual_v2",
                voice_settings: { stability: 0.5, similarity_boost: 0.75 }
            })
        });

        if (!response.ok) throw new Error('Falha na ElevenLabs');
        
        const audioBuffer = await response.arrayBuffer();
        res.setHeader('Content-Type', 'audio/mpeg');
        res.send(Buffer.from(audioBuffer));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}