import { randomUUID } from 'node:crypto'
import { Signer, Wallet, ethers } from 'ethers'

export class SignatureUtils {
  static async signMessage(
    signer: Signer | Wallet,
    messageHash: string
  ): Promise<string> {
    const messageHashBinary = ethers.utils.arrayify(messageHash)
    return signer.signMessage(messageHashBinary)
  }
  static generateUUID(): string {
    return ethers.utils.solidityKeccak256(['string'], [randomUUID()])
  }
}
