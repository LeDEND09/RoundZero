import { StreamClient } from "@stream-io/node-sdk";

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { uid, name, appRole, callId, members } = req.body || {};
  const normalizedUid = typeof uid === "string" ? uid.trim() : "";

  // Auth check
  if (!normalizedUid) {
    return res.status(401).json({ error: "Unauthorized: uid is required" });
  }

  const apiKey = process.env.STREAM_API_KEY;
  const apiSecret = process.env.STREAM_API_SECRET;

  if (!apiKey || !apiSecret) {
    return res.status(500).json({ error: "Stream credentials not configured" });
  }

  try {
    const client = new StreamClient(apiKey, apiSecret);
    const streamRole = appRole === "expert" ? "call_admin" : "user";

    // Upsert the user in Stream.
    // Some Stream projects don't allow custom role assignment via upsert.
    // If role assignment fails, retry without role so room join never breaks.
    try {
      await client.upsertUsers([
        {
          id: normalizedUid,
          name: name || "Anonymous",
          role: streamRole,
        },
      ]);
    } catch (roleErr) {
      console.warn("Role-aware upsert failed, retrying with default user payload:", roleErr?.message || roleErr);
      await client.upsertUsers([
        {
          id: normalizedUid,
          name: name || "Anonymous",
        },
      ]);
    }

    // Generate a JWT token for this user
    const token = client.generateUserToken({ user_id: normalizedUid });

    // Keep token delivery resilient: chat bootstrap errors must never block room join.
    if (callId && Array.isArray(members) && members.length > 0) {
      try {
        const channelMembers = Array.from(
          new Set(
            members
              .filter((memberUid) => typeof memberUid === "string")
              .map((memberUid) => memberUid.trim())
              .filter(Boolean)
          )
        );
        if (!channelMembers.includes(normalizedUid)) {
          channelMembers.push(normalizedUid);
        }

        // Ensure all channel members exist in Stream before client-side watch.
        await client.upsertUsers(
          channelMembers.map((memberUid) => ({
            id: memberUid,
            name: memberUid === normalizedUid ? name || "Anonymous" : "Participant",
          }))
        );
      } catch (bootstrapErr) {
        console.warn("Non-fatal chat bootstrap warning:", bootstrapErr);
      }
    }

    return res.status(200).json({ token, apiKey });
  } catch (err) {
    console.error("Stream token generation failed:", err);
    return res.status(500).json({ error: err?.message || "Failed to generate token" });
  }
}
