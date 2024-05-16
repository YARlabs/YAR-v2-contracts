import { assert, expect, use } from 'chai'
import { deployments, ethers, network } from 'hardhat'
import {
  IERC20Metadata__factory,
  YarBridge721,
  YarBridge721Mock,
  YarBridge721Mock__factory,
  YarBridge721__factory,
  YarBridge721,
  YarBridge721Mock,
  YarBridge721__factory,
  YarBridge721Mock__factory,
  BridgeEIP721,
  BridgeEIP721__factory,
  YarHub,
  YarHub__factory,
  YarRequest,
  YarRequest__factory,
  YarResponse,
  YarResponse__factory,
  YarERC721,
  YarERC721__factory,
} from '../typechain-types'
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'
import { BigNumberish } from 'ethers'
import { YarLib } from '../typechain-types/contracts/YarRequest'
import { USDT } from '../constants/externalAddresses'
import ERC721Minter from './utils/ERC721Minter'

describe('YarBridge721', function () {
  let deployer: SignerWithAddress
  let oracle: SignerWithAddress
  let relayer: SignerWithAddress
  let user: SignerWithAddress
  let user2: SignerWithAddress
  let yarRequest: YarRequest
  let yarResponse: YarResponse
  let yarHub: YarHub
  let yarBridge721: YarBridge721
  let yarBridge721Mock: YarBridge721Mock
  let bridgeEIP721: BridgeEIP721
  let yarErc721: YarERC721
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
    yarResponse = YarResponse__factory.connect(
      (await deployments.get('YarResponse')).address,
      ethers.provider,
    )
    yarHub = YarHub__factory.connect((await deployments.get('YarHub')).address, ethers.provider)

    yarBridge721 = YarBridge721__factory.connect(
      (await deployments.get('YarBridge721')).address,
      ethers.provider,
    )

    yarBridge721Mock = YarBridge721Mock__factory.connect(
      (await deployments.get('YarBridge721Mock')).address,
      ethers.provider,
    )

    yarErc721 = YarERC721__factory.connect(
      (await deployments.get('YarERC721')).address,
      ethers.provider,
    )

    chainId = (await ethers.provider.getNetwork()).chainId

    await yarBridge721.connect(deployer).setPeer(111, await yarBridge721Mock.getAddress())
    await yarBridge721Mock.connect(deployer).setPeer(chainId, await yarBridge721.getAddress())

    initSnapshot = await ethers.provider.send('evm_snapshot', [])
  })

  afterEach(async () => {
    await ethers.provider.send('evm_revert', [initSnapshot])
    initSnapshot = await ethers.provider.send('evm_snapshot', [])
  })

  it('Example: bridge 721', async () => {
    // ---------------------------
    const tokenId = 1;
    const targetChainId = 111;
    // ---------------------------

    // [0] STEP №0
    // Минтим NFT пользователю 1
    await ERC721Minter.mint(await yarErc721.getAddress(), user.address, tokenId);
    assert(await yarErc721.balanceOf(user.address) == 1n, 'mint!');

    // ---------------------------

    // [1] STEP №1
    // Пользователь вносит депозит

    // сумма токенов в initial сети, которая будет сконвертирована в депозит в Yar
    const depositToYar = ethers.parseEther('1')

    const txDeposit = await yarRequest.connect(user).deposit(depositToYar, { value: depositToYar })

    await expect(txDeposit)
    .to.emit(yarRequest, 'Deposit')
    .withArgs(user.address, ethers.ZeroAddress, depositToYar)

    // ---------------------------

    // [2] STEP №2
    // Relayers получив ивент Deposit из контракта yarRequest
    // Конвертирует feeToken amount к количеству токенов Yar
    const convertedDepositToYar = depositToYar * BigInt(2) // fake convert

    // ---------------------------

    // [3] STEP №3
    // Relayers отправляет транзакцию deposit в YarHub
    // Тем самым зачисляя расчетное(из шага 2) количество токенов на депозит юзера

    // Relayers зачисляет депозит юзеру
    const txDepositYarHub = await yarHub.connect(relayer).deposit(user.address, convertedDepositToYar)

    // Только для тестов
    // Проверяем получение ивента Deposit
    await expect(txDepositYarHub)
      .to.emit(yarHub, 'Deposit')
      .withArgs(user.address, convertedDepositToYar)

    // ---------------------------

    // [4] STEP №4
    // Что бы приложение могло указать пользователя в качестве плательщика комиссии
    // Пользователь должен разрешить приложению списывать баланс

    const approveAmount = ethers.MaxUint256 // сумма которую разрешаем списывать

    // Запрос на разрешение отправляется из intial сети в yarRequest
    const txApprove = yarRequest
      .connect(user)
      .approve(await yarBridge721.getAddress(), approveAmount)

    // Только для тестов
    // Проверяем получение ивента Approve
    await expect(txApprove)
      .to.emit(yarRequest, 'Approve')
      .withArgs(user.address, chainId, await yarBridge721.getAddress(), approveAmount)

    // После получения ивента Approve
    // Relayers вызывает транзакцию approve в yarHub
    const txApproveYarHub = yarHub
      .connect(relayer)
      .approve(user.address, chainId, await yarBridge721.getAddress(), approveAmount)

    // Только для тестов
    // Проверяем получение ивента Approve в yarHub
    await expect(txApproveYarHub)
      .to.emit(yarHub, 'Approve')
      .withArgs(user.address, chainId, await yarBridge721.getAddress(), approveAmount)

    // Только для тестов
    // Проверяем средства разрешены к списанию
    assert(
      (await yarHub.allowance(user.address, chainId, await yarBridge721.getAddress())) ==
        approveAmount,
      'approveAmount!',
    )

    // ---------------------------

    // [5] STEP №5
    // Чтобы приложение могло забрать NFT у пользователя, пользователь должен разрешить передачу ERC721

    const txApproveErc721 = await yarErc721.connect(user).approve(
      await yarBridge721.getAddress(),
      tokenId,
    );

    // Только для тестов
    // Проверяем получение ивента Approve в контракте с NFT
    await expect(txApproveErc721)
      .to.emit(yarErc721, 'Approval')
      .withArgs(user.address, await yarBridge721.getAddress(), tokenId)

    // Только для тестов
    // Модель транзакции которую Relayers будут доставлять в YarHub и target сеть
    const yarTxTransferTo = await yarBridge721.connect(user).transferTo.staticCall(
      await yarErc721.getAddress(),
      tokenId,
      targetChainId,
      user2.address
    );

    const txTransferTo = await yarBridge721
      .connect(user)
      .transferTo(
        await yarErc721.getAddress(),
        tokenId,
        targetChainId,
        user2.address
      )
    await txTransferTo.wait();

    const txCreateTransactionTransfer = await yarHub
    .connect(relayer)
    .createTransaction(Object.values(yarTxTransferTo) as any, txTransferTo.hash)
    await txCreateTransactionTransfer.wait();

    const txExecuteTransactionTransfer = await yarHub
    .connect(relayer)
    .executeTransaction(Object.values(yarTxTransferTo) as any, 0)
    await txExecuteTransactionTransfer.wait();

    const txDeliverTransfer = await yarResponse.connect(relayer).deliver(Object.values(yarTxTransferTo) as any)
    await txDeliverTransfer.wait();

    const nftAddress = await yarBridge721Mock.connect(user).getTokenAddress.staticCall(chainId, await yarErc721.getAddress());

    bridgeEIP721 = BridgeEIP721__factory.connect(
      nftAddress,
      ethers.provider,
    )

    assert(await bridgeEIP721.balanceOf.staticCall(user2) === 1n, 'Invalid balance on received address');
    assert(await yarErc721.balanceOf(user.address) == 0n, 'Invalid balance after send nft');
  })

  it('Example: bridge 721 with send back', async () => {
    // ---------------------------
    const tokenId = 1;
    const targetChainId = 111;
    // ---------------------------

    // [0] STEP №0
    // Минтим NFT пользователю 1
    await ERC721Minter.mint(await yarErc721.getAddress(), user.address, tokenId);
    assert(await yarErc721.balanceOf(user.address) == 1n, 'mint!');

    // ---------------------------

    // [1] STEP №1
    // Пользователь вносит депозит

    // сумма токенов в initial сети, которая будет сконвертирована в депозит в Yar
    const depositToYar = ethers.parseEther('1')

    const txDeposit = await yarRequest.connect(user).deposit(depositToYar, { value: depositToYar })

    await expect(txDeposit)
    .to.emit(yarRequest, 'Deposit')
    .withArgs(user.address, ethers.ZeroAddress, depositToYar)

    // ---------------------------

    // [2] STEP №2
    // Relayers получив ивент Deposit из контракта yarRequest
    // Конвертирует feeToken amount к количеству токенов Yar
    const convertedDepositToYar = depositToYar * BigInt(2) // fake convert

    // ---------------------------

    // [3] STEP №3
    // Relayers отправляет транзакцию deposit в YarHub
    // Тем самым зачисляя расчетное(из шага 2) количество токенов на депозит юзера

    // Relayers зачисляет депозит юзеру
    const txDepositYarHub = await yarHub.connect(relayer).deposit(user.address, convertedDepositToYar)

    // Только для тестов
    // Проверяем получение ивента Deposit
    await expect(txDepositYarHub)
      .to.emit(yarHub, 'Deposit')
      .withArgs(user.address, convertedDepositToYar)

    // ---------------------------

    // [4] STEP №4
    // Что бы приложение могло указать пользователя в качестве плательщика комиссии
    // Пользователь должен разрешить приложению списывать баланс

    const approveAmount = ethers.MaxUint256 // сумма которую разрешаем списывать

    // Запрос на разрешение отправляется из intial сети в yarRequest
    const txApprove = yarRequest
      .connect(user)
      .approve(await yarBridge721.getAddress(), approveAmount)

    // Только для тестов
    // Проверяем получение ивента Approve
    await expect(txApprove)
      .to.emit(yarRequest, 'Approve')
      .withArgs(user.address, chainId, await yarBridge721.getAddress(), approveAmount)

    // После получения ивента Approve
    // Relayers вызывает транзакцию approve в yarHub
    const txApproveYarHub = yarHub
      .connect(relayer)
      .approve(user.address, chainId, await yarBridge721.getAddress(), approveAmount)

    // Только для тестов
    // Проверяем получение ивента Approve в yarHub
    await expect(txApproveYarHub)
      .to.emit(yarHub, 'Approve')
      .withArgs(user.address, chainId, await yarBridge721.getAddress(), approveAmount)

    // Только для тестов
    // Проверяем средства разрешены к списанию
    assert(
      (await yarHub.allowance(user.address, chainId, await yarBridge721.getAddress())) ==
        approveAmount,
      'approveAmount!',
    )

    // ---------------------------

    // [5] STEP №5
    // Чтобы приложение могло забрать NFT у пользователя, пользователь должен разрешить передачу ERC721

    const txApproveErc721 = await yarErc721.connect(user).approve(
      await yarBridge721.getAddress(),
      tokenId,
    );

    // Только для тестов
    // Проверяем получение ивента Approve в контракте с NFT
    await expect(txApproveErc721)
      .to.emit(yarErc721, 'Approval')
      .withArgs(user.address, await yarBridge721.getAddress(), tokenId)

    // Только для тестов
    // Модель транзакции которую Relayers будут доставлять в YarHub и target сеть
    const yarTxTransferTo = await yarBridge721.connect(user).transferTo.staticCall(
      await yarErc721.getAddress(),
      tokenId,
      targetChainId,
      user2.address
    );

    const txTransferTo = await yarBridge721
      .connect(user)
      .transferTo(
        await yarErc721.getAddress(),
        tokenId,
        targetChainId,
        user2.address
      )
    await txTransferTo.wait();

    const txCreateTransactionTransfer = await yarHub
    .connect(relayer)
    .createTransaction(Object.values(yarTxTransferTo) as any, txTransferTo.hash)
    await txCreateTransactionTransfer.wait();

    const txExecuteTransactionTransfer = await yarHub
    .connect(relayer)
    .executeTransaction(Object.values(yarTxTransferTo) as any, 0)
    await txExecuteTransactionTransfer.wait();

    const txDeliverTransfer = await yarResponse.connect(relayer).deliver(Object.values(yarTxTransferTo) as any)
    await txDeliverTransfer.wait();

    const nftAddress = await yarBridge721Mock.connect(user).getTokenAddress.staticCall(chainId, await yarErc721.getAddress());

    bridgeEIP721 = BridgeEIP721__factory.connect(
      nftAddress,
      ethers.provider,
    )

    assert(await bridgeEIP721.balanceOf.staticCall(user2) === 1n, 'Invalid balance on received address');
    assert(await yarErc721.balanceOf(user.address) == 0n, 'Invalid balance after send nft');

    // Пробуем переслать NFT обратно

    // ---------------------------

    // [1] STEP №1
    // Пользователь вносит депозит

    // сумма токенов в initial сети, которая будет сконвертирована в депозит в Yar
    const txDeposit2 = await yarRequest.connect(user2).deposit(depositToYar, { value: depositToYar })

    await expect(txDeposit2)
    .to.emit(yarRequest, 'Deposit')
    .withArgs(user2.address, ethers.ZeroAddress, depositToYar)

    // ---------------------------

    // ---------------------------

    // [3] STEP №3
    // Relayers отправляет транзакцию deposit в YarHub
    // Тем самым зачисляя расчетное(из шага 2) количество токенов на депозит юзера

    // Relayers зачисляет депозит юзеру
    const txDepositYarHub2 = await yarHub.connect(relayer).deposit(user2.address, convertedDepositToYar)

    // Только для тестов
    // Проверяем получение ивента Deposit
    await expect(txDepositYarHub2)
      .to.emit(yarHub, 'Deposit')
      .withArgs(user2.address, convertedDepositToYar)

    // ---------------------------

    // [4] STEP №4
    // Что бы приложение могло указать пользователя в качестве плательщика комиссии
    // Пользователь должен разрешить приложению списывать баланс

    // Запрос на разрешение отправляется из intial сети в yarRequest
    const txApprove2 = yarRequest
      .connect(user2)
      .approve(await yarBridge721Mock.getAddress(), approveAmount)

    // Только для тестов
    // Проверяем получение ивента Approve
    await expect(txApprove2)
      .to.emit(yarRequest, 'Approve')
      .withArgs(user2.address, chainId, await yarBridge721Mock.getAddress(), approveAmount)

    // После получения ивента Approve
    // Relayers вызывает транзакцию approve в yarHub
    const txApproveYarHub2 = yarHub
      .connect(relayer)
      .approve(user2.address, chainId, await yarBridge721Mock.getAddress(), approveAmount)

    // Только для тестов
    // Проверяем получение ивента Approve в yarHub
    await expect(txApproveYarHub2)
      .to.emit(yarHub, 'Approve')
      .withArgs(user2.address, chainId, await yarBridge721Mock.getAddress(), approveAmount)

    // Только для тестов
    // Проверяем средства разрешены к списанию
    assert(
      (await yarHub.allowance(user2.address, chainId, await yarBridge721Mock.getAddress())) ==
        approveAmount,
      'approveAmount!',
    )
    // ---------------------------

    // [5] STEP №5
    // Чтобы приложение могло забрать NFT у пользователя, пользователь должен разрешить передачу ERC721

    const txApproveErc7212 = await bridgeEIP721.connect(user2).approve(
      await yarBridge721Mock.getAddress(),
      tokenId,
    );

    // Только для тестов
    // Проверяем получение ивента Approve в контракте с NFT
    await expect(txApproveErc7212)
      .to.emit(bridgeEIP721, 'Approval')
      .withArgs(user2.address, await yarBridge721Mock.getAddress(), tokenId)

    // Только для тестов
    // Модель транзакции которую Relayers будут доставлять в YarHub и target сеть
    // ! Чтобы этот тест работал, необходимо закоментировать проверку initialChainId & targetChainId в YarRequest.send
    const yarTxTransferTo2 = await yarBridge721Mock.connect(user2).transferTo.staticCall(
      await bridgeEIP721.getAddress(),
      tokenId,
      chainId,
      user.address,
    );

    const txTransferTo2 = await yarBridge721Mock.connect(user2).transferTo(
      await bridgeEIP721.getAddress(),
      tokenId,
      chainId,
      user.address,
    );
    await txTransferTo2.wait();

    const txCreateTransactionTransfer2 = await yarHub
    .connect(relayer)
    .createTransaction(Object.values(yarTxTransferTo2) as any, txTransferTo2.hash)
    await txCreateTransactionTransfer2.wait();

    const txExecuteTransactionTransfer2 = await yarHub
    .connect(relayer)
    .executeTransaction(Object.values(yarTxTransferTo2) as any, 0)
    await txExecuteTransactionTransfer2.wait();

    const txDeliverTransfer2 = await yarResponse.connect(relayer).deliver(Object.values(yarTxTransferTo2) as any)
    await txDeliverTransfer2.wait();

    assert(await bridgeEIP721.balanceOf.staticCall(user2) === 0n, 'BACK: Invalid balance on received address');
    assert(await yarErc721.balanceOf(user.address) == 1n, 'BACK: Invalid balance after send nft');
  })
})
