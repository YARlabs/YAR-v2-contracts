import { ethers, network } from 'hardhat'
import { setBalance } from '@nomicfoundation/hardhat-network-helpers'
import { IERC20Metadata__factory } from '../../typechain-types'
import { USDT } from '../../constants/externalAddresses'

export default class ERC20Minter {
  public static async mint(
    tokenAddress: string,
    recipient: string,
    maxAmountFormated?: number,
  ) {
    if (tokenAddress == ethers.ZeroAddress) {
      const amount = ethers.parseUnits(`${maxAmountFormated}`, 18)
      await setBalance(recipient, amount)
      return amount
    }

    const holders: any = {
      [USDT]: '0xF977814e90dA44bFA03b6295A0616a897441aceC',
    }

    const holderAddress = holders[tokenAddress]
    await network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [holderAddress],
    })
    const holder = await ethers.getSigner(holderAddress)

    await setBalance(holderAddress, ethers.parseEther('1'))

    const token = IERC20Metadata__factory.connect(tokenAddress, holder)
    const tokenDecimals = await token.decimals()
    const amount = ethers.parseUnits(`${maxAmountFormated}`, tokenDecimals)

    const holderBalance = await token.balanceOf(holderAddress)

    if (holderBalance < amount) {
      throw 'ERC20Minter: holder balance < maxAmountFormated'
    }

    await (await token.transfer(recipient, amount)).wait()

    return amount;
  }
}
