import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SwapSynto } from "../target/types/swap_synto";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
	TOKEN_PROGRAM_ID,
	createMint,
	createAssociatedTokenAccount,
	mintTo,
	getAssociatedTokenAddress
} from "@solana/spl-token";
import { assert } from "chai";

describe("swap-synto", () => {
	// Configure the client to use the local cluster
	const provider = anchor.AnchorProvider.env();
	anchor.setProvider(provider);

	const program = anchor.workspace.swapSynto as Program<SwapSynto>;

	// Comptes principaux pour les tests
	const user = Keypair.generate();
	let userTokenAccount: PublicKey;
	let vaultTokenAccount: PublicKey;
	let tokenMint: PublicKey;
	let escrowPda: PublicKey;

	// Constantes pour les tests
	const INITIAL_USER_BALANCE = 1000_000_000; // 1000 USDC (avec 6 décimales)
	const DEPOSIT_AMOUNT = 500_000_000; // 500 USDC
	const SWAP_AMOUNT = 1 * LAMPORTS_PER_SOL; // 1 SOL

	// Préparation des tests
	before(async () => {
		// Airdrop de SOL pour le user
		const airdropSignature = await provider.connection.requestAirdrop(
			user.publicKey,
			10 * LAMPORTS_PER_SOL
		);
		await provider.connection.confirmTransaction(airdropSignature);

		// Créer le PDA pour l'escrow
		[escrowPda] = PublicKey.findProgramAddressSync(
			[Buffer.from("escrow"), user.publicKey.toBuffer()],
			program.programId
		);

		console.log("User pubkey:", user.publicKey.toString());
		console.log("Escrow PDA:", escrowPda.toString());

		// Créer un mint pour simuler l'USDC
		const mintAuthority = Keypair.generate();
		tokenMint = await createMint(
			provider.connection,
			user,
			mintAuthority.publicKey,
			null,
			6 // USDC a 6 décimales
		);
		console.log("Token Mint créé:", tokenMint.toString());

		// Créer un compte de token pour l'utilisateur
		userTokenAccount = await createAssociatedTokenAccount(
			provider.connection,
			user,
			tokenMint,
			user.publicKey
		);
		console.log("Compte token utilisateur créé:", userTokenAccount.toString());

		// Mint des tokens à l'utilisateur
		await mintTo(
			provider.connection,
			user,
			tokenMint,
			userTokenAccount,
			mintAuthority,
			INITIAL_USER_BALANCE
		);
		console.log(`${INITIAL_USER_BALANCE / 1_000_000} USDC mintés à l'utilisateur`);

		// Calculer l'adresse du vault token account
		vaultTokenAccount = await getAssociatedTokenAddress(
			tokenMint,
			escrowPda,
			true // allowOwnerOffCurve
		);
		console.log("Vault token account:", vaultTokenAccount.toString());
	});

	it("Initialise un compte escrow", async () => {
		const tx = await program.methods
			.initialize()
			.accounts({
				escrow: escrowPda,
				signer: user.publicKey,
				systemProgram: anchor.web3.SystemProgram.programId,
			})
			.signers([user])
			.rpc();

		console.log("Transaction d'initialisation:", tx);

		// Vérifier que le compte escrow a été créé
		const escrowAccount = await program.account.escrow.fetch(escrowPda);
		assert.equal(escrowAccount.usdcAmount.toString(), "0");
		assert.deepEqual(escrowAccount.owner, user.publicKey);
	});

	it("Dépose des USDC dans l'escrow", async () => {
		const tx = await program.methods
			.deposit(new anchor.BN(DEPOSIT_AMOUNT))
			.accounts({
				escrow: escrowPda,
				userTokenAccount: userTokenAccount,
				vaultTokenAccount: vaultTokenAccount,
				signer: user.publicKey,
				tokenMint: tokenMint,
				tokenProgram: TOKEN_PROGRAM_ID,
				associatedTokenProgram: anchor.web3.ASSOCIATED_TOKEN_PROGRAM_ID,
				systemProgram: anchor.web3.SystemProgram.programId,
			})
			.signers([user])
			.rpc();

		console.log("Transaction de dépôt:", tx);

		// Vérifier que les USDC ont été déposés
		const escrowAccount = await program.account.escrow.fetch(escrowPda);
		assert.equal(escrowAccount.usdcAmount.toString(), DEPOSIT_AMOUNT.toString());

		// Vérifier le solde du vault
		const vaultBalance = await provider.connection.getTokenAccountBalance(vaultTokenAccount);
		assert.equal(vaultBalance.value.amount, DEPOSIT_AMOUNT.toString());
	});

	it("Échange des SOL contre des USDC", async () => {
		// Solde SOL initial de l'escrow
		const escrowInitialBalance = await provider.connection.getBalance(escrowPda);

		// Solde USDC initial de l'utilisateur
		const userInitialUsdcBalance = await provider.connection.getTokenAccountBalance(userTokenAccount);

		// Calculer le montant USDC attendu pour l'échange
		const expectedUsdcAmount = (SWAP_AMOUNT * 130_000_000) / 1_000_000_000;

		const tx = await program.methods
			.swap(new anchor.BN(SWAP_AMOUNT))
			.accounts({
				escrow: escrowPda,
				userTokenAccount: userTokenAccount,
				vaultTokenAccount: vaultTokenAccount,
				signer: user.publicKey,
				tokenMint: tokenMint,
				tokenProgram: TOKEN_PROGRAM_ID,
				systemProgram: anchor.web3.SystemProgram.programId,
			})
			.signers([user])
			.rpc();

		console.log("Transaction de swap:", tx);

		// Vérifier que les SOL ont été transférés à l'escrow
		const escrowFinalBalance = await provider.connection.getBalance(escrowPda);
		assert.equal(escrowFinalBalance - escrowInitialBalance, SWAP_AMOUNT);

		// Vérifier que les USDC ont été transférés à l'utilisateur
		const userFinalUsdcBalance = await provider.connection.getTokenAccountBalance(userTokenAccount);
		assert.equal(
			Number(userFinalUsdcBalance.value.amount) - Number(userInitialUsdcBalance.value.amount),
			expectedUsdcAmount
		);

		// Vérifier que le montant USDC dans l'escrow a été mis à jour
		const escrowAccount = await program.account.escrow.fetch(escrowPda);
		assert.equal(
			escrowAccount.usdcAmount.toString(),
			(DEPOSIT_AMOUNT - expectedUsdcAmount).toString()
		);
	});
	it("Permet au propriétaire de retirer des SOL de l'escrow", async () => {
		// Solde SOL initial de l'utilisateur
		const userInitialBalance = await provider.connection.getBalance(user.publicKey);

		// Solde SOL initial de l'escrow
		const escrowInitialBalance = await provider.connection.getBalance(escrowPda);

		const tx = await program.methods
			.withdraw()
			.accounts({
				escrow: escrowPda,
				signer: user.publicKey,
				systemProgram: anchor.web3.SystemProgram.programId,
			})
			.signers([user])
			.rpc();

		console.log("Transaction de retrait:", tx);

		// Vérifier que les SOL ont été retirés de l'escrow
		const escrowFinalBalance = await provider.connection.getBalance(escrowPda);
		assert.equal(escrowFinalBalance, 0);

		// Vérifier que les SOL ont été transférés à l'utilisateur
		const userFinalBalance = await provider.connection.getBalance(user.publicKey);
		assert.approximately(
			userFinalBalance - userInitialBalance,
			escrowInitialBalance,
			10000 // Tolérance pour les frais de transaction
		);
	});
});
