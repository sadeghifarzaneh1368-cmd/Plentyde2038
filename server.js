// Plenty Telegram Signal Bot
// Empfängt TradingView-Alerts per Webhook und postet sie in deinen Telegram-Kanal

const express = require("express");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());
app.use(express.text()); // falls TradingView als "text/plain" sendet

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET; // frei wählbares Passwort für Sicherheit

if (!BOT_TOKEN || !CHAT_ID) {
  console.error("FEHLER: TELEGRAM_BOT_TOKEN oder TELEGRAM_CHAT_ID fehlt in den Umgebungsvariablen.");
  process.exit(1);
}

// Health-Check (praktisch für Railway/Render, damit der Server als "läuft" erkannt wird)
app.get("/", (req, res) => {
  res.send("Plenty Telegram Bot läuft ✅");
});

// Einfacher Test-Endpoint, per Browser (GET) direkt aufrufbar - kein CORS-Problem
app.get("/test-signal", async (req, res) => {
  try {
    const message = formatMessage({
      symbol: "EURUSD",
      signal: "TEST",
      price: "1.13704",
      time: new Date().toISOString(),
    });
    await sendToTelegram(message);
    res.send("✅ Test-Nachricht wurde an Telegram gesendet! Check deinen Kanal 'Plenty Signals'.");
  } catch (err) {
    res.status(500).send("❌ Fehler beim Senden: " + err.message);
  }
});

// Der eigentliche Webhook-Endpoint für TradingView
app.post("/webhook", async (req, res) => {
  try {
    // Optionaler Secret-Check, falls du ?secret=... an die Webhook-URL anhängst
    if (WEBHOOK_SECRET && req.query.secret !== WEBHOOK_SECRET) {
      console.warn("Abgelehnt: falsches/fehlendes Secret");
      return res.status(401).send("Unauthorized");
    }

    let data = req.body;

    // TradingView schickt manchmal reinen Text statt JSON -> versuchen zu parsen
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        // bleibt als reiner Text-String, wird unten direkt durchgereicht
      }
    }

    const message = formatMessage(data);
    await sendToTelegram(message);

    console.log("Signal gesendet:", message);
    res.status(200).send("OK");
  } catch (err) {
    console.error("Fehler beim Verarbeiten des Webhooks:", err);
    res.status(500).send("Error");
  }
});

function formatMessage(data) {
  // Fall 1: TradingView schickt strukturiertes JSON
  if (typeof data === "object" && data !== null) {
    const symbol = data.symbol || data.ticker || "—";
    const signal = (data.signal || data.action || "SIGNAL").toString().toUpperCase();
    const price = data.price || data.close || "—";
    const time = data.time || new Date().toISOString();

    const emoji = signal.includes("BUY") ? "🟢" : signal.includes("SELL") ? "🔴" : "⚪️";

    return (
      `${emoji} *${signal}* — ${symbol}\n` +
      `Preis: \`${price}\`\n` +
      `Zeit: ${time}\n\n` +
      `_Plenty Signal Bot_`
    );
  }

  // Fall 2: reiner Text (z.B. wenn im TradingView Alert-Feld nur Freitext steht)
  return `📊 *Neues Signal*\n${data}`;
}

async function sendToTelegram(text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: text,
      parse_mode: "Markdown",
    }),
  });

  const result = await response.json();
  if (!result.ok) {
    throw new Error(`Telegram API Fehler: ${JSON.stringify(result)}`);
  }
  return result;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
