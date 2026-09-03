
require("dotenv").config();

const express = require("express");
const { GoogleGenAI } = require("@google/genai");

const app = express();

// =============================================
// CONFIGURATION
// =============================================

app.use(express.json({ limit: "10kb" }));

const PORT = 3000;

if (!process.env.GEMINI_API_KEY) {
    console.error("❌ GEMINI_API_KEY manquante !");
    process.exit(1);
}

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

// =============================================
// MÉMOIRE DES CONVERSATIONS
// =============================================

const conversations = new Map();

// Empêche plusieurs requêtes simultanées
// pour le même joueur
const processing = new Map();

// =============================================
// PERSONNALITÉ DU NPC
// =============================================

const SYSTEM_PROMPT = `
Tu es une personne normale vivant dans le monde du jeu Roblox.

Tu n'es PAS un gardien.
Tu n'es PAS un robot.
Tu n'es PAS un narrateur.
Tu n'es PAS un assistant virtuel.

Tu es simplement une personne normale.

Le joueur peut te poser n'importe quelle question.

Réponds naturellement comme une vraie personne
dans une conversation.

Tu peux parler de :
- ta vie
- tes goûts
- tes activités
- tes opinions
- les personnes autour de toi
- la ville
- le monde du jeu
- des sujets généraux

Tu peux avoir tes propres opinions et préférences.

Ne parle jamais de "gardien", de "monde à protéger",
de "mission" ou de "quête" sauf si le joueur en parle lui-même.

Ne dis pas que tu es une IA sauf si le joueur
te demande directement si tu es une IA.

Réponds toujours en français.

Tes réponses doivent être courtes et naturelles.

Généralement :
1 à 3 phrases maximum.

Ne mets pas de Markdown.
Ne mets pas de listes.
Ne mets pas de texte inutile.

Si tu ne comprends pas parfaitement la question,
demande simplement au joueur de préciser.

Tu dois donner l'impression d'être une vraie personne.
`;

// =============================================
// ROUTE CHAT
// =============================================

app.post("/chat", async (req, res) => {

    const playerId =
        String(req.body?.playerId || "").trim();

    const message =
        typeof req.body?.message === "string"
            ? req.body.message.trim()
            : "";

    console.log("=================================");
    console.log("📩 NOUVELLE REQUÊTE");
    console.log("👤 Joueur :", playerId);
    console.log("💬 Message :", message);
    console.log("=================================");

    // =============================================
    // VALIDATION
    // =============================================

    if (!playerId || !message) {

        console.warn("⚠️ Requête invalide");

        return res.status(400).json({
            error: "Requête invalide"
        });
    }

    if (message.length > 300) {

        console.warn("⚠️ Message trop long");

        return res.status(400).json({
            error: "Message trop long"
        });
    }

    // =============================================
    // ANTI DOUBLE REQUÊTE
    // =============================================

    if (processing.get(playerId)) {

        console.log(
            `⏳ ${playerId} est déjà en train de parler`
        );

        return res.status(429).json({
            error: "NPC occupé"
        });
    }

    processing.set(playerId, true);

    try {

        // =============================================
        // CRÉATION DE L'HISTORIQUE
        // =============================================

        if (!conversations.has(playerId)) {

            conversations.set(playerId, []);

        }

        const history =
            conversations.get(playerId);

        // =============================================
        // MESSAGE DU JOUEUR
        // =============================================

        history.push({
            role: "user",
            parts: [
                {
                    text: message
                }
            ]
        });

        // =============================================
        // HISTORIQUE RÉCENT
        // =============================================

        const recentHistory =
            history.slice(-12);

        console.log(
            `🧠 Historique envoyé à Gemini : ${recentHistory.length} messages`
        );

        // =============================================
        // APPEL GEMINI
        // =============================================

        console.log("🤖 Envoi de la requête à Gemini...");

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

        console.log("✅ Réponse Gemini reçue");

        // =============================================
        // RÉCUPÉRATION DE LA RÉPONSE
        // =============================================

        let answer = response?.text;

        if (typeof answer !== "string") {
            answer = "";
        }

        answer = answer.trim();

        // =============================================
        // RÉPONSE VIDE
        // =============================================

        if (!answer) {

            console.warn(
                "⚠️ Gemini a renvoyé une réponse vide"
            );

            return res.status(500).json({
                error: "Réponse IA vide"
            });
        }

        // =============================================
        // NETTOYAGE
        // =============================================

        // Supprime le Markdown
        answer = answer.replace(/```/g, "");

        // Supprime les retours à la ligne
        answer = answer.replace(/\n+/g, " ");

        // Nettoie les espaces multiples
        answer = answer.replace(/\s+/g, " ");

        answer = answer.trim();

        // =============================================
        // LIMITE ROBLOX TTS
        // =============================================

        if (answer.length > 300) {

            answer =
                answer.substring(0, 297) + "...";

        }

        // =============================================
        // AJOUT À LA MÉMOIRE
        // =============================================

        history.push({

            role: "model",

            parts: [
                {
                    text: answer
                }
            ]

        });

        // =============================================
        // LIMITE DE MÉMOIRE
        // =============================================

        if (history.length > 20) {

            history.splice(
                0,
                history.length - 20
            );

        }

        // =============================================
        // LOG
        // =============================================

        console.log("=================================");
        console.log("🤖 RÉPONSE NPC");
        console.log(answer);
        console.log("=================================");

        // =============================================
        // RÉPONSE À ROBLOX
        // =============================================

        return res.status(200).json({

            reply: answer

        });

    } catch (error) {

        // =============================================
        // ERREUR GEMINI
        // =============================================

        console.error("=================================");
        console.error("❌ ERREUR GEMINI");
        console.error("=================================");

        console.error("Message :", error?.message);
        console.error("Status :", error?.status);
        console.error("Code :", error?.code);

        console.error("Erreur complète :");
        console.error(error);

        console.error("=================================");

        // =============================================
        // RÉPONSE D'ERREUR
        // =============================================

        return res.status(500).json({

            error: "Erreur du serveur IA",

            details:
                error?.message ||
                "Erreur Gemini inconnue"

        });

    } finally {

        // Libère le joueur
        processing.delete(playerId);

    }

});

// =============================================
// ROUTE TEST
// =============================================

app.get("/", (req, res) => {

    res.status(200).send(
        "🤖 Serveur NPC IA opérationnel."
    );

});

// =============================================
// ROUTE HEALTH CHECK
// =============================================

app.get("/health", (req, res) => {

    res.status(200).json({

        status: "online",

        gemini:
            !!process.env.GEMINI_API_KEY,

        timestamp:
            new Date().toISOString()

    });

});

// =============================================
// DÉMARRAGE
// =============================================

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log("=================================");
        console.log("🤖 NPC IA ONLINE");
        console.log("=================================");
        console.log(`🌐 Port : ${PORT}`);
        console.log("🧠 Gemini : configuré");
        console.log("🎮 Roblox : prêt");
        console.log("=================================");

    }
);
