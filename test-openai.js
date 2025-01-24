const fetch = require('node-fetch');
require('dotenv').config();

// Assurez-vous que la clé API est dans le fichier .env
const apiKey = process.env.OPENAI_API_KEY;

async function testOpenAI() {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "user", content: "Bonjour, peux-tu m'aider ?" }
        ],
        max_tokens: 50
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Erreur API OpenAI :", data);
    } else {
      console.log("Réponse de l'API OpenAI :", data.choices[0].message.content);
    }
  } catch (error) {
    console.error("Erreur lors de la requête :", error.message || error);
  }
}

// Appelez la fonction pour tester
testOpenAI();
