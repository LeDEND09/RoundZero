const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const streamApiSecret = defineSecret("STREAM_API_SECRET");

exports.getStreamToken = onCall(
  {
    secrets: [streamApiSecret],
    cors: true,
  },
  async (request) => {
    // Auth check
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }

    const uid = request.auth.uid;
    const name = request.auth.token.name || "Anonymous";

    const { StreamClient } = require("@stream-io/node-sdk");
    const apiKey = process.env.STREAM_API_KEY;
    const apiSecret = streamApiSecret.value();

    if (!apiKey || !apiSecret) {
      throw new HttpsError(
        "failed-precondition",
        "Stream API key or secret is not configured."
      );
    }

    const client = new StreamClient(apiKey, apiSecret);

    // Upsert user in Stream
    await client.upsertUsers([
      {
        id: uid,
        name: name,
        role: "user",
      },
    ]);

    // Generate token (valid 1 hour by default)
    const token = client.generateUserToken({ user_id: uid });

    return { token, apiKey };
  }
);
