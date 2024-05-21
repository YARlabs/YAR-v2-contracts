import { ethers, network } from 'hardhat'
import { setBalance } from '@nomicfoundation/hardhat-network-helpers'
import { YarERC1155__factory } from '../../typechain-types'

export default class ERC721Minter {
  public static async mint(
    tokenAddress: string,
    recipient: string,
    tokenId: number,
    value: number,
    url: string = 'http://localhost:23131',
  ) {
    const signers = await ethers.getSigners()

    await setBalance(signers[0].address, ethers.parseEther('1'))

    const token = YarERC1155__factory.connect(tokenAddress, signers[0])
    await (await token.mint(recipient, tokenId, value, url)).wait()

    return tokenId;
  }

  public static async mintBatch(
    tokenAddress: string,
    recipient: string,
    tokenIds: number[],
    values: number[],
    url: string[] = ['http://localhost:23131'],
  ) {
    const signers = await ethers.getSigners()

    await setBalance(signers[0].address, ethers.parseEther('1'))

    const token = YarERC1155__factory.connect(tokenAddress, signers[0])
    await (await token.mintBatch(recipient, tokenIds, values, url)).wait()

    return tokenIds;
  }
}
