import { time, loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs'
import { assert, expect } from 'chai'
import { deployments, ethers, network } from 'hardhat'
import { YarRequest, YarRequest__factory } from '../typechain-types'
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'
import { BigNumberish } from 'ethers'

describe('YarRequest', function () {
  let deployer: SignerWithAddress
  let oracle: SignerWithAddress
  let relayer: SignerWithAddress
  let user: SignerWithAddress
  let user2: SignerWithAddress
  let yarRequest: YarRequest
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

    yarRequest = YarRequest__factory.connect(
      (await deployments.get('YarRequest')).address,
      ethers.provider,
    )
    chainId = (await ethers.provider.getNetwork()).chainId
    initSnapshot = await ethers.provider.send('evm_snapshot', [])
  })

  afterEach(async () => {
    await ethers.provider.send('evm_revert', [initSnapshot])
    initSnapshot = await ethers.provider.send('evm_snapshot', [])
  })

  describe('send', async () => {
    it('send: fees[_] value[_]', async () => {
      const initialChainId = chainId
      const sender = user.address
      const app = user.address
      const targetChainId = 111
      const target = user2
      const value = 0
      const data = '0x'
      const depositToYarAmount = 0

      await expect(
        yarRequest.connect(user).send({
          initialChainId,
          sender,
          app,
          targetChainId,
          target,
          value,
          data,
          depositToYarAmount,
        }),
      )
        .to.emit(yarRequest, 'Send')
        .withArgs([
          initialChainId,
          sender,
          app,
          targetChainId,
          target,
          value,
          data,
          depositToYarAmount,
        ])
        .to.not.emit(yarRequest, 'Deposit')
    })

    it('send: fees[_] value[+]', async () => {
      const initialChainId = chainId
      const sender = user.address
      const app = user.address
      const targetChainId = 111
      const target = user2
      const value = ethers.parseEther('1')
      const data = '0x'
      const depositToYarAmount = 0

      await expect(
        yarRequest.connect(user).send(
          {
            initialChainId,
            sender,
            app,
            targetChainId,
            target,
            value,
            data,
            depositToYarAmount,
          },
          {
            value,
          },
        ),
      )
        .to.emit(yarRequest, 'Send')
        .withArgs([
          initialChainId,
          sender,
          app,
          targetChainId,
          target,
          value,
          data,
          depositToYarAmount,
        ])
        .to.not.emit(yarRequest, 'Deposit')

      const relayerBalanceAfter = await ethers.provider.getBalance(await yarRequest.getAddress())
    })

    it('send: fees[+] value[_]', async () => {
      const initialChainId = chainId
      const sender = user.address
      const app = user.address
      const targetChainId = 111
      const target = user2
      const value = 0
      const data = '0x'
      const depositToYarAmount = 1n

      await expect(
        yarRequest.connect(user).send({
          initialChainId,
          sender,
          app,
          targetChainId,
          target,
          value,
          data,
          depositToYarAmount,
        }),
      ).to.be.revertedWith('amount!')

      await expect(
        yarRequest
          .connect(user)
          .send(
            { initialChainId, sender, app, targetChainId, target, value, data, depositToYarAmount },
            { value: depositToYarAmount + 1n },
          ),
      ).to.be.revertedWith('amount!')

      const relayerBalanceBefore = await ethers.provider.getBalance(relayer.address)

      await expect(
        yarRequest
          .connect(user)
          .send(
            { initialChainId, sender, app, targetChainId, target, value, data, depositToYarAmount },
            { value: depositToYarAmount },
          ),
      )
        .to.emit(yarRequest, 'Send')
        .withArgs([
          initialChainId,
          sender,
          app,
          targetChainId,
          target,
          value,
          data,
          depositToYarAmount,
        ])
        .to.emit(yarRequest, 'Deposit')
        .withArgs(user.address, await yarRequest.feeToken(), depositToYarAmount)

      const relayerBalanceAfter = await ethers.provider.getBalance(relayer.address)

      assert(
        relayerBalanceAfter == relayerBalanceBefore + depositToYarAmount,
        'relayer not recived fees!',
      )
    })

    it('send: fees[+] value[+]', async () => {
      const initialChainId = chainId
      const sender = user.address
      const app = user.address
      const targetChainId = 111
      const target = user2
      const value = ethers.parseEther('1')
      const data = '0x'
      const depositToYarAmount = 1n

      const relayerBalanceBefore = await ethers.provider.getBalance(relayer.address)

      await expect(
        yarRequest
          .connect(user)
          .send(
            { initialChainId, sender, app, targetChainId, target, value, data, depositToYarAmount },
            { value: depositToYarAmount },
          ),
      )
        .to.emit(yarRequest, 'Send')
        .withArgs([
          initialChainId,
          sender,
          app,
          targetChainId,
          target,
          value,
          data,
          depositToYarAmount,
        ])
        .to.emit(yarRequest, 'Deposit')
        .withArgs(user.address, await yarRequest.feeToken(), depositToYarAmount)

      const relayerBalanceAfter = await ethers.provider.getBalance(relayer.address)

      assert(
        relayerBalanceAfter == relayerBalanceBefore + depositToYarAmount,
        `relayer not recived fees! ${relayerBalanceAfter} != ${relayerBalanceBefore} + ${depositToYarAmount}`,
      )
    })
  })
})
