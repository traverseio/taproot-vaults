# Bitcoin Vaults

## Introduction

This document aims to describe the usecases and purpose for our Bitcoin Vaults, implemented in this repo. Our Bitcoin Vaults are a similar product with a similar implementation to our Ethereum Vaults (read more at https://github.com/traverseio/contracts-v2 and https://traverselabs.io).

Traverse vaults are a web3 security solution that strikes a balance between enhanced security and user-friendliness. Our vaults have two main features: (1) on-chain MFA verification via a centralized signer managed by Traverse and (2) vault recovery via security questions (or mnemonic, user decides) in case the user loses access to their primary wallet.

## Concept

Our Bitcoin vaults provide a layer of security for users that eliminates the reliance on a single seed phrase/private key. If a user were to leak or lose their private key, their assets remain safe via an extra signer that approves transactions upon successful MFA verification. This signer is managed by our backend servers and provides further off-chain checks to enhance security.

The recovery mechanism works by prompting the user to provide security questions and answers when setting up their vault. The security questions are stored on our servers, but the answers are not. The answers are then double hashed (not shown here) and fed into one of the P2TR tree scripts (MAST).

## Taproot Script Construction

Our Bitcoin vaults consist of a Taproot Script with 2 spending paths.

- The **first path** will be used for normal operations: that is a 2-of-2 multisig where the first signer is the user that creates the vault, and the second signer is managed by us (Traverse).

- The **second spending path** will be used to recover the user’s vault in the case they lose their wallet (signer #1). In the second spending path (recovery), the user must provide a secret bytes value that, when double hashed, will result in the value provided upon the creation of Taproot Script. On top of the hash, a signature must be provided from the second signer (Traverse) to prevent front-running and theft of funds.

## Doomsday Protection Feature (PSBT)

This is an additional feature that we are developing to provide users the ability to recover their assets in case something happens to Traverse and/or its backend. This also serves the dual purpose of restoring the decentralization that is lost due to the centralization of the MFA signer.

We want to publish signed PSBTs to a file-sharing service such as IPFS that allows users to withdraw their funds to a new P2TR address. The PSBTs should allow users to spend funds using the first spending path (2-of-2) without passing MFA verification **ONLY** to a new P2TR address that contains a similar specification as the main P2TR described here, but with a slight alteration to the second spend script (spend via secret hash): a new 30-day timelock is introduced, **and** instead of requiring the 2nd signer we change the signature requirement from the 1st signer to the 2nd signer.
