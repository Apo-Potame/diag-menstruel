const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

// Endpoint pour recevoir les requêtes du frontend Shopify
app.post('/api/chat', async (req, res) => {
    const userMessage = req.body.userMessage;

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4",
                messages: [{ role: "user", content: userMessage }],
                max_tokens: 500
            })
        });

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error("Erreur API OpenAI :", error);
        res.status(500).send("Erreur du serveur");
    }
});

app.listen(PORT, () => {
    console.log(`Serveur Node.js en cours d'exécution sur http://localhost:${PORT}`);
});
