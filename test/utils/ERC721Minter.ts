import { ethers, network } from 'hardhat'
import { setBalance } from '@nomicfoundation/hardhat-network-helpers'
import { YarERC721__factory } from '../../typechain-types'
import { USDT } from '../../constants/externalAddresses'

export default class ERC721Minter {
  public static async mint(
    tokenAddress: string,
    recipient: string,
    tokenId: number,
  ) {
    const signers = await ethers.getSigners()

    await setBalance(signers[0].address, ethers.parseEther('1'))

    const token = YarERC721__factory.connect(tokenAddress, signers[0])

    await (await token['mint(address,uint256,string)'](recipient, tokenId, "http://localhost")).wait()

    return tokenId;
  }
}
