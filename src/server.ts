import dotenv from 'dotenv';
import express from 'express';
import { AgentDispatchClient, SipClient } from 'livekit-server-sdk';

dotenv.config({ path: '.env.local' });
const requiredEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const app = express();
app.use(express.json());

const sipClient = new SipClient(
  requiredEnv('LIVEKIT_URL'),
  requiredEnv('LIVEKIT_API_KEY'),
  requiredEnv('LIVEKIT_API_SECRET'),
);

const dispatchClient = new AgentDispatchClient(
  requiredEnv('LIVEKIT_URL'),
  requiredEnv('LIVEKIT_API_KEY'),
  requiredEnv('LIVEKIT_API_SECRET'),
);

app.post('/dial', async (req, res) => {
  try {
    const { to } = req.body; // e.g. +9198xxxxxxx

    if (!to) {
      res.status(400).json({ error: 'Missing "to" phone number' });
      return;
    }

    const roomName = `outbound-${Date.now()}`;
    const trunkConfig = {
      hostname: requiredEnv('SIP_TRUNK_HOSTNAME'), // e.g. yourtrunk.sip.plivo.com
      destinationCountry: 'IN',
      transport: 0,
      authUsername: requiredEnv('SIP_AUTH_USERNAME'),
      authPassword: requiredEnv('SIP_AUTH_PASSWORD'),
    } as Parameters<SipClient['createSipParticipant']>[4];

    const participant = await sipClient.createSipParticipant(
      '', // empty when using inline trunk config
      to,
      roomName,
      {
        participantIdentity: 'outbound-caller',
        participantName: 'Outbound Caller',
        fromNumber: requiredEnv('PLIVO_NUMBER'), // your Plivo number
        krispEnabled: true,
        waitUntilAnswered: true,
      },
      trunkConfig,
    );

    // Explicitly dispatch agent to this room
    await dispatchClient.createDispatch(
      roomName,
      requiredEnv('AGENT_NAME'), // must match agentName in main.ts
    );

    res.json({
      success: true,
      roomName,
      participant,
    });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.listen(3000, () => {
  console.log('Dial server running on http://localhost:3000');
});
