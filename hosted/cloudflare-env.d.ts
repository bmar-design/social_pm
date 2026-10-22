declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    PRIVY_APP_ID?: string;
    PRIVY_APP_SECRET?: string;
    BUCKET?: R2Bucket;
  }
}
