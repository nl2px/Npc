require("dotenv").config();

const express = require("express");
const { GoogleGenAI } = require("@google/genai");

const app = express();

app.use(express.json({ limit: "10kb" }));

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

const conversations = new Map();

// Empêche plusieurs requêtes simultanées pour le même joueur
const processing = new Map();

const SYSTEM_PROMPT = `
Tu es une personne normale vivant dans le monde du jeu Roblox.

Tu n'es PAS un gardien.
Tu n'es PAS un robot.
Tu n'es PAS un narrateur.
Tu n'es PAS un assistant virtuel.

Tu es simplement une personne normale.

Le joueur peut te poser n'importe quelle question.
Réponds naturellement comme une vraie personne dans une conversation.

Tu peux parler de ta vie, de tes goûts, de tes activités,
du monde autour de toi et de sujets généraux.

Tu peux avoir tes propres opinions et préférences.

Ne parle jamais de "gardien", de "monde à protéger",
de "mission" ou de "quête" sauf si le joueur en parle lui-même.

Ne dis pas que tu es une IA sauf si le joueur te demande directement.

Réponds en français.

Tes réponses doivent être courtes et naturelles,
généralement 1 à 3 phrases.

Ne mets pas de markdown.
Ne mets pas de liste.
Ne mets pas de texte inutile.

Si tu ne comprends pas parfaitement la question,
demande simplement au joueur de préciser.

Tu dois avoir l'impression d'être une vraie personne.
`;

app.post("/chat", async (req, res) => {

    const playerId = String(req.body?.playerId || "");
    const message =
        typeof req.body?.message === "string"
            ? req.body.message.trim()
            : "";

    console.log(
        `📩 Requête reçue | joueur=${playerId} | message="${message}"`
    );

    // ---------------------------------------------
    // VALIDATION
    // ---------------------------------------------

    if (!playerId || !message) {

        return res.status(400).json({
            error: "Requête invalide"
        });

    }

    if (message.length > 300) {

        return res.status(400).json({
            error: "Message trop long"
        });

    }

    // ---------------------------------------------
    // EMPÊCHE LES DOUBLES REQUÊTES
    // ---------------------------------------------

    if (processing.get(playerId)) {

        console.log(
            `⏳ Requête ignorée : ${playerId} est déjà en train de parler.`
        );

        return res.status(429).json({
            error: "NPC occupé"
        });

    }

    processing.set(playerId, true);

    try {

        // ---------------------------------------------
        // CRÉATION DE L'HISTORIQUE
        // ---------------------------------------------

        if (!conversations.has(playerId)) {

            conversations.set(playerId, []);

        }

        const history =
            conversations.get(playerId);

        // ---------------------------------------------
        // AJOUT DU MESSAGE JOUEUR
        // ---------------------------------------------

        history.push({

            role: "user",

            parts: [
                {
                    text: message
                }
            ]

        });

        // ---------------------------------------------
        // MÉMOIRE
        // ---------------------------------------------

        const recentHistory =
            history.slice(-12);

        console.log(
            `🧠 Gemini | historique=${recentHistory.length}`
        );

        // ---------------------------------------------
        // GEMINI
        // ---------------------------------------------

        const response =
            await ai.models.generateContent({

                model: "gemini-3.7-flash",

                contents: recentHistory,

                config: {

                    systemInstruction:
                        SYSTEM_PROMPT,

                    maxOutputTokens: 100

                }

            });

        // ---------------------------------------------
        // RÉCUPÉRATION RÉPONSE
        // ---------------------------------------------

        let answer =
            response.text;

        if (typeof answer !== "string") {

            answer = "";

        }

        answer =
            answer.trim();

        // ---------------------------------------------
        // RÉPONSE VIDE
        // ---------------------------------------------

        if (!answer) {

            console.warn(
                "⚠️ Gemini a renvoyé une réponse vide."
            );

            return res.status(500).json({
                error: "Réponse IA vide"
            });

        }

        // ---------------------------------------------
        // NETTOYAGE
        // ---------------------------------------------

        answer =
            answer.replace(/```/g, "");

        answer =
            answer.replace(/\n+/g, " ");

        answer =
            answer.replace(/\s+/g, " ");

        answer =
            answer.trim();

        // Roblox TTS : maximum 300 caractères
        if (answer.length > 300) {

            answer =
                answer.substring(0, 297) + "...";

        }

        // ---------------------------------------------
        // AJOUT RÉPONSE IA À LA MÉMOIRE
        // ---------------------------------------------

        history.push({

            role: "model",

            parts: [
                {
                    text: answer
                }
            ]

        });

        // ---------------------------------------------
        // LIMITE HISTORIQUE
        // ---------------------------------------------

        if (history.length > 20) {

            history.splice(
                0,
                history.length - 20
            );

        }

        console.log(
            `🤖 NPC → ${answer}`
        );

        // ---------------------------------------------
        // RÉPONSE ROBLOX
        // ---------------------------------------------

        return res.json({

            reply: answer

        });

    } catch (error) {

        console.error(
            "❌ ERREUR GEMINI :"
        );

        console.error(error);

        return res.status(500).json({

            error: "Erreur du serveur IA"

        });

    } finally {

        processing.delete(playerId);

    }

});


// ---------------------------------------------
// TEST SERVEUR
// ---------------------------------------------

app.get("/", (req, res) => {

    res.status(200).send(
        "🤖 Serveur NPC IA opérationnel."
    );

});


// ---------------------------------------------
// DÉMARRAGE RAILWAY
// ---------------------------------------------

const PORT =
    process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {

    console.log(
        `🤖 Serveur NPC IA lancé sur le port ${PORT}`
    );

});
