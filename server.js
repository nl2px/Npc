require("dotenv").config();

const express = require("express");
const { GoogleGenAI } = require("@google/genai");

const app = express();

app.use(express.json());

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

const conversations = new Map();

app.post("/chat", async (req, res) => {

    try {

        const {
            playerId,
            message
        } = req.body;

        if (!playerId || typeof message !== "string") {
            return res.status(400).json({
                error: "Requête invalide"
            });
        }

        if (message.length > 300) {
            return res.status(400).json({
                error: "Message trop long"
            });
        }

        if (!conversations.has(playerId)) {

            conversations.set(playerId, []);

        }

        const history = conversations.get(playerId);

        history.push({
            role: "user",
            parts: [
                {
                    text: message
                }
            ]
        });

        // Limite la mémoire pour éviter une conversation énorme
        const recentHistory = history.slice(-12);

        const response = await ai.models.generateContent({

            model: "gemini-3.7-flash",

            contents: recentHistory,

            config: {

                systemInstruction: `
Tu es un NPC dans un jeu Roblox.

Ton nom est le Gardien.

Tu dois parler naturellement avec le joueur.

Tu réponds toujours en français.

Tu es sympathique, naturel et légèrement mystérieux.

Tu ne dois jamais dire que tu es une IA.

Tu dois répondre comme si tu étais réellement un personnage
vivant dans le monde du jeu.

Garde tes réponses courtes pour permettre au NPC
de les prononcer facilement.

Maximum 250 caractères par réponse.
                `,

                maxOutputTokens: 100

            }

        });

        const answer =
            response.text || "Je n'ai pas compris.";

        history.push({
            role: "model",
            parts: [
                {
                    text: answer
                }
            ]
        });

        // On garde seulement les derniers messages
        if (history.length > 20) {

            history.splice(
                0,
                history.length - 20
            );

        }

        res.json({
            reply: answer
        });

    } catch (error) {

        console.error("Erreur Gemini :", error);

        res.status(500).json({
            error: "Erreur du serveur IA"
        });

    }

});

app.get("/", (req, res) => {

    res.send("Serveur NPC IA opérationnel.");

});

app.listen(3000, () => {

    console.log(
        "🤖 Serveur NPC IA lancé sur http://localhost:3000"
    );

});