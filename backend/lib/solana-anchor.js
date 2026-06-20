const bs58Module = require('bs58');
const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
} = require('@solana/web3.js');

const bs58 = bs58Module.default || bs58Module;
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

class SolanaAnchor {
  constructor(options = {}) {
    this.cluster = options.cluster || 'devnet';
    this.rpcUrl = options.rpcUrl || clusterApiUrl(this.cluster);
    this.signer = parseSigner(options.secretKey);
    this.connection = new Connection(this.rpcUrl, 'confirmed');
  }

  status() {
    return {
      cluster: this.cluster,
      rpc_url: this.rpcUrl,
      configured: Boolean(this.signer),
      signer: this.signer ? this.signer.publicKey.toBase58() : null,
      memo_program: MEMO_PROGRAM_ID.toBase58(),
    };
  }

  async anchor(proof) {
    if (!this.signer) throw new Error('Solana anchor signer is not configured.');
    const memo = `IGNIS:${proof.id}:${proof.proof_hash}`;
    const instruction = new TransactionInstruction({
      keys: [],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(memo, 'utf8'),
    });
    const transaction = new Transaction().add(instruction);
    transaction.feePayer = this.signer.publicKey;
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.sign(this.signer);
    const signature = await this.connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });
    await this.connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
    return {
      signature,
      explorer_url: `https://explorer.solana.com/tx/${signature}?cluster=${encodeURIComponent(this.cluster)}`,
      anchored_at: new Date().toISOString(),
    };
  }
}

function parseSigner(value) {
  if (!value) return null;
  try {
    const trimmed = String(value).trim();
    const bytes = trimmed.startsWith('[')
      ? Uint8Array.from(JSON.parse(trimmed))
      : bs58.decode(trimmed);
    return Keypair.fromSecretKey(bytes);
  } catch (error) {
    console.error('[SOLANA] invalid SOLANA_ANCHOR_SECRET_KEY:', error.message);
    return null;
  }
}

module.exports = { SolanaAnchor };
