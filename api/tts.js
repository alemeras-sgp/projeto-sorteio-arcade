export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Método não permitido');

    const { text, voiceId } = req.body;
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: "API Key não encontrada na Vercel" });
    }

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

        // Se der erro, vamos capturar a resposta da ElevenLabs para saber o que é
        if (!response.ok) {
            const errorText = await response.text();
            console.error("ERRO DA ELEVENLABS:", errorText);
            return res.status(response.status).json({ error: errorText });
        }
        
        const audioBuffer = await response.arrayBuffer();
        res.setHeader('Content-Type', 'audio/mpeg');
        res.send(Buffer.from(audioBuffer));
    } catch (error) {
        console.error("ERRO NO TRY-CATCH:", error);
        res.status(500).json({ error: error.message });
    }
}