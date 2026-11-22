import 'dotenv/config';

const port = Number(process.env.PORT || 8787);

export const cfg = {
  port,
  webUrl: process.env.PUBLIC_WEB_URL || 'http://localhost:5173',
  /** Public URL of this server (used for audio/image links inside chat messages). */
  serverUrl: process.env.PUBLIC_SERVER_URL || `http://localhost:${port}`,
  jwtSecret: process.env.JWT_SECRET || 'change-me-local-dev-secret',
  demoOtp: process.env.DEMO_OTP || '123456',
  nexconn: {
    appKey: (process.env.NEXCONN_APP_KEY || '').trim(),
    appSecret: (process.env.NEXCONN_APP_SECRET || '').trim(),
    area: ((process.env.NEXCONN_AREA || 'SG').trim().toUpperCase()) as 'SG' | 'NA' | 'SA',
  },
  openrouterKey: (process.env.OPENROUTER_API_KEY || process.env.openrouter || '').trim(),
  mongoUri: (process.env.MONGODB_URI || process.env.mongodb || '').trim(),
  sarvamKey: (process.env.SARVAM_API_KEY || '').trim(),
};

export const features = {
  nexconn: Boolean(cfg.nexconn.appKey && cfg.nexconn.appSecret),
  llm: Boolean(cfg.openrouterKey),
  sarvam: Boolean(cfg.sarvamKey),
  /** Supply-chain module (docs/supply-chain). Off unless SC_ENABLED=1; then on only for businesses with flags.sc. */
  supplyChain: process.env.SC_ENABLED === '1',
};

/** Fixed chat identities used by the platform. */
export const BOT = {
  claire: 'claire',
  updates: 'claire_updates',
  desk: 'trade_desk',
} as const;
