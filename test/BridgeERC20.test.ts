import { deployments, ethers, network, upgrades } from 'hardhat'
import {
  AddressBook,
  AddressBook__factory,
  BridgeERC20,
  BridgeERC20__factory,
  IERC20Metadata,
  IERC20Metadata__factory,
  MultisigWallet,
  MultisigWallet__factory,
} from '../typechain-types'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { NATIVE_TOKEN, USDT } from '../constants/externalAddresses'
import ERC20MinterV2 from './utils/ERC20MinterV2'
import { BigNumber } from 'ethers'
import { impersonateAccount, setBalance } from '@nomicfoundation/hardhat-network-helpers'
import { SignatureUtils } from './utils/SignatureUtils'
import { expect, assert } from 'chai'

describe('test_key_unit BridgeERC20', () => {
  let mockTransferApprover: SignerWithAddress
  let impersonatedOwner: SignerWithAddress
  let user: SignerWithAddress
  let user2: SignerWithAddress
  let bridge: BridgeERC20
  let addressBook: AddressBook
  let transferValidator: MultisigWallet
  let transferValidatorImpersonated: SignerWithAddress
  let currentChainId: number
  let initSnapshot: string

  before(async () => {
    currentChainId = (await ethers.provider.getNetwork()).chainId
    const signers = await ethers.getSigners()
    mockTransferApprover = signers[8]
    user = signers[9]
    user2 = signers[8]
    await deployments.fixture()

    bridge = BridgeERC20__factory.connect(
      (await deployments.get('BridgeERC20')).address,
      ethers.provider,
    )

    addressBook = AddressBook__factory.connect(
      (await deployments.get('AddressBook')).address,
      ethers.provider,
    )

    transferValidator = MultisigWallet__factory.connect(
      (await deployments.get('TransferValidator')).address,
      ethers.provider,
    )

    const { owner } = await addressBook.admins()
    await impersonateAccount(owner)
    impersonatedOwner = await ethers.getSigner(owner)
    await setBalance(owner, ethers.utils.parseEther('10'))

    await impersonateAccount(transferValidator.address)
    transferValidatorImpersonated = await ethers.getSigner(transferValidator.address)
    await setBalance(transferValidatorImpersonated.address, ethers.utils.parseEther('10'))

    await addressBook.connect(impersonatedOwner).setTransferApprover(mockTransferApprover.address)

    initSnapshot = await ethers.provider.send('evm_snapshot', [])
  })

  afterEach(async () => {
    await ethers.provider.send('evm_revert', [initSnapshot])
    initSnapshot = await ethers.provider.send('evm_snapshot', [])
  })

  describe('Proxy chain', () => {
    beforeEach(async () => {
      if ((await bridge.isProxyChain()) == false)
        await bridge.connect(impersonatedOwner).setIsProxyChain(true)
    })

    xit('tranferToOtherChain original -> secondary', async () => {
      const token = IERC20Metadata__factory.connect(USDT, ethers.provider)
      await ERC20MinterV2.mint(token.address, user.address, 1000)
      const userBalance = await token.balanceOf(user.address)
      await token.connect(user).approve(bridge.address, userBalance)

      const targetChain = 199
      const recipient = user2
      const feeToken = await addressBook.feeToken()
      const fees = ethers.utils.parseEther('0.001')
      const signatureExpired = ethers.constants.MaxInt256
      const signature = await SignatureUtils.signMessage(
        mockTransferApprover,
        ethers.utils.solidityKeccak256(
          [
            'uint256',
            'address',
            'bytes4',
            'address',
            'address',
            'uint256',
            'uint256',
            'address',
            'address',
            'uint256',
            'uint256',
          ],
          [
            currentChainId,
            bridge.address,
            bridge.interface.getSighash('tranferToOtherChain'),
            user.address,
            token.address,
            userBalance,
            targetChain,
            recipient.address,
            feeToken,
            fees,
            signatureExpired,
          ],
        ),
      )

      const userBalanceBefore = await token.balanceOf(user.address)
      const bridgeBalanceBefore = await token.balanceOf(bridge.address)

      let nonce = 1
      await expect(
        bridge
          .connect(user)
          .tranferToOtherChain(
            token.address,
            userBalance,
            targetChain,
            recipient.address,
            feeToken,
            fees,
            signatureExpired,
            signature,
            {
              value: fees,
            },
          ),
      )
        .to.emit(bridge, 'TransferToOtherChain')
        .withArgs(
          await bridge.getTransferId(nonce, currentChainId),
          nonce,
          currentChainId,
          currentChainId,
          token.address,
          targetChain,
          userBalance,
          user.address,
          recipient.address,
          'Tether USD',
          'USDT',
          6,
        )

      const userBalanceAfter = await token.balanceOf(user.address)
      const bridgeBalanceAfter = await token.balanceOf(bridge.address)

      assert(userBalanceAfter.eq(userBalanceBefore.sub(userBalance)), 'user tokens not transfered!')
      assert(
        bridgeBalanceAfter.eq(bridgeBalanceBefore.add(userBalance)),
        'bridge not recieve tokens!',
      )
    })

    xit('tranferFromOtherChain original -> proxy', async () => {
      const proxyChain = currentChainId
      const originalChain = 199
      const initialChain = originalChain

      const token = IERC20Metadata__factory.connect(USDT, ethers.provider)
      await ERC20MinterV2.mint(token.address, user.address, 1000)
      const userBalance = await token.balanceOf(user.address)

      const recipient = user2
      const externalNonce = 19
      await expect(
        bridge
          .connect(transferValidatorImpersonated)
          .tranferFromOtherChain(
            externalNonce,
            originalChain,
            token.address,
            initialChain,
            proxyChain,
            userBalance,
            user.address,
            recipient.address,
            {
              name: 'Tether USD',
              symbol: 'USDT',
              decimals: 6,
            },
          ),
      )
        .to.emit(bridge, 'TransferFromOtherChain')
        .withArgs(
          await bridge.getTransferId(externalNonce, initialChain),
          externalNonce,
          originalChain,
          token.address,
          initialChain,
          proxyChain,
          userBalance,
          user.address,
          recipient.address,
        )

      const issuedToken = IERC20Metadata__factory.connect(
        await bridge.getIssuedTokenAddress(originalChain, token.address),
        ethers.provider,
      )

      assert(
        (await issuedToken.balanceOf(recipient.address)).eq(userBalance),
        'recipient not recivev tokens!',
      )
    })

    xit('tranferFromOtherChain secondary -> proxy', async () => {
      const proxyChain = currentChainId
      const originalChain = 199
      const initialChain = 777
      const targetChain = proxyChain

      const token = IERC20Metadata__factory.connect(USDT, ethers.provider)
      await ERC20MinterV2.mint(token.address, user.address, 1000)
      const userBalance = await token.balanceOf(user.address)

      const recipient = user2
      const externalNonce = 19
      await expect(
        bridge
          .connect(transferValidatorImpersonated)
          .tranferFromOtherChain(
            externalNonce,
            originalChain,
            token.address,
            initialChain,
            targetChain,
            userBalance,
            user.address,
            recipient.address,
            {
              name: 'Tether USD',
              symbol: 'USDT',
              decimals: 6,
            },
          ),
      )
        .to.emit(bridge, 'TransferFromOtherChain')
        .withArgs(
          await bridge.getTransferId(externalNonce, initialChain),
          externalNonce,
          originalChain,
          token.address,
          initialChain,
          targetChain,
          userBalance,
          user.address,
          recipient.address,
        )

      const issuedToken = IERC20Metadata__factory.connect(
        await bridge.getIssuedTokenAddress(originalChain, token.address),
        ethers.provider,
      )

      assert(
        (await issuedToken.balanceOf(recipient.address)).eq(userBalance),
        'recipient not recived tokens!',
      )
    })

    xit('tranferToOtherChain issued proxy -> secondary', async () => {})

    it('tranferToOtherChain issued proxy -> original', async () => {
      const proxyChain = currentChainId
      const originalChain = 199
      const initialChain = 777
      const targetChain = proxyChain

      const token = IERC20Metadata__factory.connect(USDT, ethers.provider)
      await ERC20MinterV2.mint(token.address, user.address, 1000)
      const userBalance = await token.balanceOf(user.address)

      const externalNonce = 19
      await bridge
        .connect(transferValidatorImpersonated)
        .tranferFromOtherChain(
          externalNonce,
          originalChain,
          token.address,
          initialChain,
          targetChain,
          userBalance,
          user.address,
          user.address,
          {
            name: 'Tether USD',
            symbol: 'USDT',
            decimals: 6,
          },
        )

      const issuedToken = IERC20Metadata__factory.connect(
        await bridge.getIssuedTokenAddress(originalChain, token.address),
        ethers.provider,
      )

      await issuedToken.connect(user).approve(bridge.address, userBalance)

      const recipient = user2
      const feeToken = await addressBook.feeToken()
      const fees = ethers.utils.parseEther('0.001')
      const signatureExpired = ethers.constants.MaxInt256
      const signature = await SignatureUtils.signMessage(
        mockTransferApprover,
        ethers.utils.solidityKeccak256(
          [
            'uint256',
            'address',
            'bytes4',
            'address',
            'address',
            'uint256',
            'uint256',
            'address',
            'address',
            'uint256',
            'uint256',
          ],
          [
            currentChainId,
            bridge.address,
            bridge.interface.getSighash('tranferToOtherChain'),
            user.address,
            issuedToken.address,
            userBalance,
            originalChain,
            recipient.address,
            feeToken,
            fees,
            signatureExpired,
          ],
        ),
      )

      let nonce = 1
      await expect(
        bridge
          .connect(user)
          .tranferToOtherChain(
            issuedToken.address,
            userBalance,
            originalChain,
            recipient.address,
            feeToken,
            fees,
            signatureExpired,
            signature,
            {
              value: fees,
            },
          ),
      )
        .to.emit(bridge, 'TransferToOtherChain')
        .withArgs(
          await bridge.getTransferId(nonce, currentChainId),
          nonce,
          currentChainId,
          originalChain,
          token.address,
          originalChain,
          userBalance,
          user.address,
          recipient.address,
          'Tether USD',
          'USDT',
          6,
        )

    })
  })

  // describe('Not proxy chain', () => {
  //   beforeEach(async () => {
  //     await bridge.connect(impersonatedOwner).setIsProxyChain(false)
  //   })
  // })
})
