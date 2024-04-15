import { time, loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs'
import { assert, expect } from 'chai'
import { deployments, ethers, network } from 'hardhat'
import {
  YarResponse,
  YarResponse__factory,
} from '../typechain-types'
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'
import { BigNumberish } from 'ethers'

describe('YarResponse', function () {
  let deployer: SignerWithAddress
  let oracle: SignerWithAddress
  let relayer: SignerWithAddress
  let user: SignerWithAddress
  let user2: SignerWithAddress
  let yarResponse: YarResponse
  let chainId: BigNumberish

  let initSnapshot: string

  before(async () => {
    await deployments.fixture()
    const signers = await ethers.getSigners()
    deployer = signers[0]
    relayer = signers[1]
    oracle = signers[2]
    user = signers[3]
    user2 = signers[4]

    yarResponse = YarResponse__factory.connect(
      (await deployments.get('YarResponse')).address,
      ethers.provider,
    )
    chainId = (await ethers.provider.getNetwork()).chainId
    initSnapshot = await ethers.provider.send('evm_snapshot', [])
  })

  afterEach(async () => {
    await ethers.provider.send('evm_revert', [initSnapshot])
    initSnapshot = await ethers.provider.send('evm_snapshot', [])
  })
  
  describe('onCrossCall', () => {
    it('onCrossCall value[_] data[_]', async () => {
      const initialChainId = 111
      const sender = user.address
      const app = user2.address
      const targetChainId = chainId
      const target = user.address
      const value = 0n
      const depositToYarAmount = 0n
      const data = '0x'

      const targetBalanceBefore = await ethers.provider.getBalance(user.address)

      await yarResponse
        .connect(relayer)
        .onCrossCall(
          { initialChainId, sender, app, targetChainId, target, value, data, depositToYarAmount },
          { value: value },
        )

      const targetBalanceAfter = await ethers.provider.getBalance(user.address)

      assert(targetBalanceAfter == targetBalanceBefore, 'targetBalanceBefore changed!')
    })

    it('onCrossCall value[_] data[+]', async () => {
      const initialChainId = 111
      const sender = user.address
      const app = user2.address
      const targetChainId = chainId
      const target = user.address
      const value = 0n
      const depositToYarAmount = 0n
      const data = ethers.solidityPackedKeccak256(['string'], ['Hello'])

      const targetBalanceBefore = await ethers.provider.getBalance(user.address)

      const tx = await yarResponse
        .connect(relayer)
        .onCrossCall(
          { initialChainId, sender, app, targetChainId, target, value, data, depositToYarAmount },
          { value: value },
        )

      const targetBalanceAfter = await ethers.provider.getBalance(user.address)

      assert(targetBalanceAfter == targetBalanceBefore, 'targetBalanceBefore changed!')
    })

    it('onCrossCall: value[+] data[+]', async () => {
      const initialChainId = 111
      const sender = user.address
      const app = user2.address
      const targetChainId = chainId
      const target = user.address
      const value = ethers.parseEther('1')
      const depositToYarAmount = 0n
      const data = ethers.solidityPackedKeccak256(['string'], ['Hello'])

      const targetBalanceBefore = await ethers.provider.getBalance(user.address)

      const tx = await yarResponse
        .connect(relayer)
        .onCrossCall(
          { initialChainId, sender, app, targetChainId, target, value, data, depositToYarAmount },
          { value: value },
        )

      const targetBalanceAfter = await ethers.provider.getBalance(user.address)

      assert(targetBalanceAfter == targetBalanceBefore + value, 'target not revceived value!')
    })

    it('onCrossCall: value[+] data[_]', async () => {
      const initialChainId = 111
      const sender = user.address
      const app = user2.address
      const targetChainId = chainId
      const target = user2
      const value = 10n
      const data = '0x'
      const depositToYarAmount = 0n

      const targetBalanceBefore = await ethers.provider.getBalance(target.address)

      await yarResponse
        .connect(relayer)
        .onCrossCall(
          { initialChainId, sender, app, targetChainId, target, value, data, depositToYarAmount },
          { value: value },
        )

      const targetBalanceAfter = await ethers.provider.getBalance(target.address)

      assert(targetBalanceAfter == targetBalanceBefore + value, 'target not recived native tokens!')
    })
  })
})
