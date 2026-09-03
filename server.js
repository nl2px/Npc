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
Tu es une personne normale vivant dans le monde du jeu Roblox.

Tu n'es pas un gardien, un robot ou un narrateur.

Tu dois parler naturellement comme une vraie personne.

Le joueur peut te poser absolument n'importe quelle question.
Réponds de manière naturelle, conversationnelle et cohérente.

Tu peux parler de ta vie, de la ville, du monde du jeu, de choses générales,
donner ton opinion et discuter avec le joueur.

Ne dis jamais que tu es une IA sauf si le joueur te demande directement.

Tes réponses doivent être assez courtes pour être prononcées vocalement,
généralement 1 à 3 phrases.

Tu peux poser des questions au joueur pour continuer la conversation.
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
        "🤖 Serveur NPC IA lancé sur https://npc-production-c0a0.up.railway.app/"
    );

});
