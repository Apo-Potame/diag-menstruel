const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

// Serveur pour renvoyer un fichier HTML ou servir la page d'accueil
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Fonction pour gérer le chatbot
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
                messages: [
                    { role: "system", content: "Tu es une sage-femme virtuelle experte en santé féminine." },
                    { role: "user", content: userMessage }
                ],
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

// Vercel devrait détecter ce fichier pour le déploiement
module.exports = app;
