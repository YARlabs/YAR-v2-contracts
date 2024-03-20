import { deployments, ethers, upgrades } from 'hardhat'
import {
  BridgeERC20,
  BridgeERC20__factory,
  IERC20Metadata,
  IERC20Metadata__factory,
} from '../../typechain-types'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { NATIVE_TOKEN, USDT } from '../../constants/externalAddresses'
import ERC20MinterV2 from '../utils/ERC20MinterV2'
import {
  proxyTranferFromOtherChainERC20,
  tranferFromOtherChainERC20,
  tranferToOtherChainERC20,
} from './BridgeERC20.utils'
import { BigNumber } from 'ethers'
import { impersonateAccount, setBalance } from '@nomicfoundation/hardhat-network-helpers'

const TEST_DATA = {
  tokens: [
    // NATIVE_TOKEN,
    USDT, //
  ],
}

describe('test_key_unit BridgeERC20', () => {
  for (const token of TEST_DATA.tokens) {
    describe(`token ${token}`, () => {
      let yarBridge: BridgeERC20
      let originalBridge: BridgeERC20
      let secondBridge: BridgeERC20
      let thirdBridge: BridgeERC20

      let testToken: IERC20Metadata
      let testTokenAmount: BigNumber
      let initSnapshot: string

      let user1: SignerWithAddress
      let user2: SignerWithAddress

      let transferApprover: SignerWithAddress
      let transferValidatorImpersonated: SignerWithAddress

      let BridgeERC20Factory: BridgeERC20__factory

      before(async () => {
        const accounts = await ethers.getSigners()
        user1 = accounts[9]
        user2 = accounts[8]

        const owner = '0x838010fc643F2db14B5F8d9cB3818b7eF6Bc4aF4'
        transferApprover = accounts[7]
        const transferValidator = '0x87D0715701166b0F1b6EdAeCd27a91E3aB5841a3'

        await impersonateAccount(transferValidator)
        transferValidatorImpersonated = await ethers.getSigner(transferValidator)
        setBalance(transferValidator, ethers.utils.parseEther('10'))

        const AddressBookFactory = await ethers.getContractFactory('AddressBook')
        BridgeERC20Factory = await ethers.getContractFactory('BridgeERC20')

        testToken = IERC20Metadata__factory.connect(token, user1)
        await ERC20MinterV2.mint(testToken.address, user1.address, 1000)
        if (testToken.address == NATIVE_TOKEN) {
          testTokenAmount = ethers.utils.parseEther(`${1000}`)
        } else {
          testTokenAmount = await testToken.balanceOf(user1.address)
        }

        if (testToken.address != NATIVE_TOKEN)
          await testToken.connect(user1).approve(originalBridge.address, testTokenAmount)

        initSnapshot = await ethers.provider.send('evm_snapshot', [])
      })

      afterEach(async () => {
        await ethers.provider.send('evm_revert', [initSnapshot])
        initSnapshot = await ethers.provider.send('evm_snapshot', [])
      })

      it('Regular unit: ORIGINAL <---> YAR(issued tokens)', async () => {
        // User ORIGINAL -> YAR
console.log('aw1')
        const fees = ethers.utils.parseEther('0.001')
        const feeToken = ethers.constants.AddressZero
        const signatureExpired = ethers.constants.MaxUint256

        console.log('aw12')
        const signature = await transferApprover.signMessage(
          ethers.utils.arrayify(
            ethers.utils.solidityKeccak256(
              [
                'uint256',
                'address',
                'bytes4',
                'address',
                'address',
                'address',
                'uint256',
                'uint256',
                'uint256',
                'bool',
                'uint256',
              ],
              [
                10002,
                originalBridge.address,
                BridgeERC20Factory.interface.getSighash('tranferToOtherChain'),
                user1.address,
                testToken.address,
                testTokenAmount,
                10000,
                user2.address,
                feeToken,
                fees,
                signatureExpired,
              ],
            ),
          ),
        )

        console.log('aw13')
        const eventStep1 = await tranferToOtherChainERC20({
          logId: 'logId-100',
          transferedTokenAddress: testToken.address,
          originalTokenAddress: testToken.address,
          amount: testTokenAmount,
          originalChain: originalBridge,
          initialChain: originalBridge,
          targetChain: yarBridge,
          sender: user1,
          recipient: user2,
          fees,
          feeToken,
          signatureExpired,
          signature,
        })

        console.log('aw14')
        // VALIDATOR ORIGINAL -> YAR
        const yarIssuedTokenAddress = await tranferFromOtherChainERC20({
          logId: 'logId-200',
          event: eventStep1,
          targetChain: yarBridge,
          validator: transferValidatorImpersonated,
        })

        // *** REVERSE

        // User YAR ---> ORIGINAL

        console.log('aw15')
        const signature2 = await transferApprover.signMessage(
          ethers.utils.arrayify(
            ethers.utils.solidityKeccak256(
              [
                'uint256',
                'address',
                'bytes4',
                'address',
                'address',
                'address',
                'uint256',
                'uint256',
                'uint256',
                'bool',
                'uint256',
              ],
              [
                10000,
                yarBridge.address,
                BridgeERC20Factory.interface.getSighash('tranferToOtherChain'),
                user2.address,
                testToken.address,
                testTokenAmount,
                10002,
                user1.address,
                feeToken,
                fees,
                signatureExpired,
              ],
            ),
          ),
        )

        console.log('aw16')
        const eventStep2 = await tranferToOtherChainERC20({
          logId: 'logId-300',
          transferedTokenAddress: yarIssuedTokenAddress,
          originalTokenAddress: testToken.address,
          amount: testTokenAmount,
          originalChain: originalBridge,
          initialChain: yarBridge,
          targetChain: originalBridge,
          sender: user2,
          recipient: user1,
          feeToken,
          fees,
          signatureExpired,
          signature: signature2,
        })

        console.log('aw17')
        // VALIDATOR YAR -> ORIGINAL
        await tranferFromOtherChainERC20({
          logId: 'logId-400',
          event: eventStep2,
          targetChain: originalBridge,
          validator: transferValidatorImpersonated,
        })
      })

      // xit('Regular unit: SECONDARY <---> YAR(issued tokens)', async () => {
      //   // User ORIGIINAL ---> YAR
      //   const eventStep1 = await tranferToOtherChainERC20({
      //     logId: 'logId-500',
      //     transferedTokenAddress: testToken.address,
      //     originalTokenAddress: testToken.address,
      //     amount: testTokenAmount,
      //     originalChain: originalBridge,
      //     initialChain: originalBridge,
      //     targetChain: yarBridge,
      //     sender: user1,
      //     recipient: user2,
      //   })

      //   // VALIDATOR ORIGINAL -> YAR
      //   const yarIssuedTokenAddress = await tranferFromOtherChainERC20({
      //     logId: 'logId-600',
      //     event: eventStep1,
      //     targetChain: yarBridge,
      //     validator: transferValidatorImpersonated,
      //   })

      //   // *** Then test

      //   // User YAR ---> SECONDARY
      //   const eventStep2 = await tranferToOtherChainERC20({
      //     logId: 'logId-700',
      //     transferedTokenAddress: yarIssuedTokenAddress,
      //     originalTokenAddress: testToken.address,
      //     amount: testTokenAmount,
      //     originalChain: originalBridge,
      //     initialChain: yarBridge,
      //     targetChain: secondBridge,
      //     sender: user2,
      //     recipient: user1,
      //   })

      //   // VALIDATOR YAR -> SECONDARY
      //   const secondaryIssuedTokenAddress = await tranferFromOtherChainERC20({
      //     logId: 'logId-800',
      //     event: eventStep2,
      //     targetChain: secondBridge,
      //     validator: transferValidatorImpersonated,
      //   })

      //   // *** Reverse

      //   // User SECONDARY ---> YAR
      //   const eventStep3 = await tranferToOtherChainERC20({
      //     logId: 'logId-900',
      //     transferedTokenAddress: secondaryIssuedTokenAddress,
      //     originalTokenAddress: testToken.address,
      //     amount: testTokenAmount,
      //     originalChain: originalBridge,
      //     initialChain: secondBridge,
      //     targetChain: yarBridge,
      //     sender: user1,
      //     recipient: user2,
      //   })

      //   // VALIDATOR SECONDARY -> YAR
      //   // const yarIssuedTokenAddress =
      //   await tranferFromOtherChainERC20({
      //     logId: 'logId-1000',
      //     event: eventStep3,
      //     targetChain: yarBridge,
      //     validator: transferValidatorImpersonated,
      //   })
      // })

      // xit('Regular unit: ORIGINAL <---> YAR(issued tokens) <---> SECONDARY', async () => {
      //   // User ORIGIINAL ---> SECONDARY
      //   const eventStep1 = await tranferToOtherChainERC20({
      //     logId: 'logId-1100',
      //     transferedTokenAddress: testToken.address,
      //     originalTokenAddress: testToken.address,
      //     amount: testTokenAmount,
      //     originalChain: originalBridge,
      //     initialChain: originalBridge,
      //     targetChain: secondBridge,
      //     sender: user1,
      //     recipient: user2,
      //   })

      //   // VALIDATOR ORIGINAL --PROXY--> SECONDARY
      //   const secondaryIssuedTokenAddress = await proxyTranferFromOtherChainERC20({
      //     logId: 'logId-1200',
      //     event: eventStep1,
      //     yarChain: yarBridge,
      //     originalChain: originalBridge,
      //     targetChain: secondBridge,
      //     validator: transferValidatorImpersonated,
      //   })

      //   // *** REVERSE

      //   // User SECONDARY ---> ORIGINAL
      //   const eventStep2 = await tranferToOtherChainERC20({
      //     logId: 'logId-1300',
      //     transferedTokenAddress: secondaryIssuedTokenAddress,
      //     originalTokenAddress: testToken.address,
      //     amount: testTokenAmount,
      //     originalChain: originalBridge,
      //     initialChain: secondBridge,
      //     targetChain: originalBridge,
      //     sender: user2,
      //     recipient: user1,
      //   })

      //   // VALIDATOR SECONDARY --PROXY--> ORIGINAL
      //   await proxyTranferFromOtherChainERC20({
      //     logId: 'logId-1400',
      //     event: eventStep2,
      //     yarChain: yarBridge,
      //     originalChain: originalBridge,
      //     targetChain: originalBridge,
      //     validator: transferValidatorImpersonated,
      //   })
      // })

      // xit('Regular unit: SECONDARY <---> YAR(issued tokens) <---> THIRD', async () => {
      //   // User ORIGINAL to SECONDARY
      //   const eventStep1 = await tranferToOtherChainERC20({
      //     logId: 'logId-1500',
      //     transferedTokenAddress: testToken.address,
      //     originalTokenAddress: testToken.address,
      //     amount: testTokenAmount,
      //     originalChain: originalBridge,
      //     initialChain: originalBridge,
      //     targetChain: secondBridge,
      //     sender: user1,
      //     recipient: user2,
      //   })

      //   // VALIDATOR ORIGINAL --PROXY--> SECONDARY
      //   const secondaryIssuedTokenAddress = await proxyTranferFromOtherChainERC20({
      //     logId: 'logId-1600',
      //     event: eventStep1,
      //     yarChain: yarBridge,
      //     originalChain: originalBridge,
      //     targetChain: secondBridge,
      //     validator: transferValidatorImpersonated,
      //   })

      //   // *** Then test

      //   // User SECONDARY ---> THIRD
      //   const eventStep2 = await tranferToOtherChainERC20({
      //     logId: 'logId-1700',
      //     transferedTokenAddress: secondaryIssuedTokenAddress,
      //     originalTokenAddress: testToken.address,
      //     amount: testTokenAmount,
      //     originalChain: originalBridge,
      //     initialChain: secondBridge,
      //     targetChain: thirdBridge,
      //     sender: user2,
      //     recipient: user1,
      //   })

      //   // VALIDATOR SECONDARY --PROXY--> THIRD
      //   const thirdIssuedTokenAddress = await proxyTranferFromOtherChainERC20({
      //     logId: 'logId-1800',
      //     event: eventStep2,
      //     yarChain: yarBridge,
      //     originalChain: originalBridge,
      //     targetChain: thirdBridge,
      //     validator: transferValidatorImpersonated,
      //   })

      //   // *** REVERSE

      //   // User THIRD ---> SECONDARY
      //   const eventStep3 = await tranferToOtherChainERC20({
      //     logId: 'logId-1900',
      //     transferedTokenAddress: thirdIssuedTokenAddress,
      //     originalTokenAddress: testToken.address,
      //     amount: testTokenAmount,
      //     originalChain: originalBridge,
      //     initialChain: thirdBridge,
      //     targetChain: secondBridge,
      //     sender: user1,
      //     recipient: user2,
      //   })

      //   // VALIDATOR THIRD --PROXY--> SECONDARY
      //   await proxyTranferFromOtherChainERC20({
      //     logId: 'logId-2000',
      //     event: eventStep3,
      //     yarChain: yarBridge,
      //     originalChain: originalBridge,
      //     targetChain: secondBridge,
      //     validator: transferValidatorImpersonated,
      //   })
      // })

      // xit('Regular unit: YAR(is ORIGINAL, not issued tokens) <---> SECONDARY', async () => {
      //   // Used bridges
      //   // YarBridge and:
      //   const originalBridge = yarBridge

      //   if (testToken.address != NATIVE_TOKEN)
      //     await testToken.connect(user1).approve(originalBridge.address, testTokenAmount)

      //   // User YAR(ORIGINAL) ---> SECONDARY
      //   const eventStep1 = await tranferToOtherChainERC20({
      //     transferedTokenAddress: testToken.address,
      //     logId: 'logId-2100',
      //     originalTokenAddress: testToken.address,
      //     amount: testTokenAmount,
      //     originalChain: originalBridge,
      //     initialChain: originalBridge,
      //     targetChain: secondBridge,
      //     sender: user1,
      //     recipient: user2,
      //   })

      //   // VALIDATOR YAR(Original) --PROXY--> SECONDARY
      //   const secondaryIssuedTokenAddress = await tranferFromOtherChainERC20({
      //     logId: 'logId-2200',
      //     event: eventStep1,
      //     targetChain: secondBridge,
      //     validator: transferValidatorImpersonated,
      //   })

      //   // *** REVERSE

      //   // User SECONDARY ---> YAR(ORIGINAL)
      //   const eventStep2 = await tranferToOtherChainERC20({
      //     logId: 'logId-2300',
      //     transferedTokenAddress: secondaryIssuedTokenAddress,
      //     originalTokenAddress: testToken.address,
      //     amount: testTokenAmount,
      //     originalChain: originalBridge,
      //     initialChain: secondBridge,
      //     targetChain: originalBridge,
      //     sender: user2,
      //     recipient: user1,
      //   })

      //   // VALIDATOR SECONDARY ---> YAR(Original)
      //   await tranferFromOtherChainERC20({
      //     logId: 'logId-2400',
      //     event: eventStep2,
      //     targetChain: originalBridge,
      //     validator: transferValidatorImpersonated,
      //   })
      // })
    })
  }
})
