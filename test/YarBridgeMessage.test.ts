import { assert, expect, use } from 'chai'
import { deployments, ethers, network } from 'hardhat'
import {
  YarBridgeMessage,
  YarBridgeMessageMock,
  YarBridgeMessage__factory,
  YarBridgeMessageMock__factory,
  BridgeEIP1155,
  BridgeEIP1155__factory,
  YarHub,
  YarHub__factory,
  YarRequest,
  YarRequest__factory,
  YarResponse,
  YarResponse__factory,
  YarERC1155,
  YarERC1155__factory,
} from '../typechain-types'
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'
import { BigNumberish } from 'ethers'
import ERC1155Minter from './utils/ERC1155Minter'


describe('YarBridgeMessage', function () {
    let deployer: SignerWithAddress
    let oracle: SignerWithAddress
    let relayer: SignerWithAddress
    let user: SignerWithAddress
    let user2: SignerWithAddress
    let yarRequest: YarRequest
    let yarResponse: YarResponse
    let yarHub: YarHub
    let yarBridgeMessage: YarBridgeMessage
    let yarBridgeMessageMock: YarBridgeMessageMock
    let bridgeEIP1155: BridgeEIP1155
    let yarErc1155: YarERC1155
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

        yarBridgeMessage = YarBridgeMessage__factory.connect(
            (await deployments.get('YarBridgeMessage')).address,
            ethers.provider,
        )

        yarBridgeMessageMock = YarBridgeMessageMock__factory.connect(
            (await deployments.get('YarBridgeMessageMock')).address,
            ethers.provider,
        )

        chainId = (await ethers.provider.getNetwork()).chainId

        await yarBridgeMessage.connect(deployer).setPeer(111, await yarBridgeMessageMock.getAddress())
        await yarBridgeMessageMock.connect(deployer).setPeer(chainId, await yarBridgeMessage.getAddress())

        initSnapshot = await ethers.provider.send('evm_snapshot', [])
    })

    afterEach(async () => {
        await ethers.provider.send('evm_revert', [initSnapshot])
        initSnapshot = await ethers.provider.send('evm_snapshot', [])
    })

    it('Example: send message', async () => {
        // ---------------------------
        const message = 'Hello world!';
        const targetChainId = 111;
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
        .approve(await yarBridgeMessage.getAddress(), approveAmount)

        // Только для тестов
        // Проверяем получение ивента Approve
        await expect(txApprove)
        .to.emit(yarRequest, 'Approve')
        .withArgs(user.address, chainId, await yarBridgeMessage.getAddress(), approveAmount)

        // После получения ивента Approve
        // Relayers вызывает транзакцию approve в yarHub
        const txApproveYarHub = yarHub
        .connect(relayer)
        .approve(user.address, chainId, await yarBridgeMessage.getAddress(), approveAmount)

        // Только для тестов
        // Проверяем получение ивента Approve в yarHub
        await expect(txApproveYarHub)
        .to.emit(yarHub, 'Approve')
        .withArgs(user.address, chainId, await yarBridgeMessage.getAddress(), approveAmount)

        // Только для тестов
        // Проверяем средства разрешены к списанию
        assert(
        (await yarHub.allowance(user.address, chainId, await yarBridgeMessage.getAddress())) ==
            approveAmount,
        'approveAmount!',
        )

        // ---------------------------

        // Только для тестов
        // Модель транзакции которую Relayers будут доставлять в YarHub и target сеть
        const yarTx = await yarBridgeMessage.connect(user).sendTo.staticCall(
            targetChainId,
            user2.address,
            message,
        );

        const txTransferTo = await yarBridgeMessage.connect(user).sendTo(
            targetChainId,
            user2.address,
            message,
        )
        await txTransferTo.wait();

        const txCreateTransactionTransfer = await yarHub
        .connect(relayer)
        .createTransaction(Object.values(yarTx) as any, txTransferTo.hash)
        await txCreateTransactionTransfer.wait();

        const txExecuteTransactionTransfer = await yarHub
        .connect(relayer)
        .executeTransaction(Object.values(yarTx) as any, 0)
        await txExecuteTransactionTransfer.wait();

        const txDeliverTransfer = await yarResponse.connect(relayer).deliver(Object.values(yarTx) as any)
        await txDeliverTransfer.wait();

        const messageInChain = await yarBridgeMessageMock.connect(user2).getMessages.staticCall(user2.address, ethers.ZeroAddress, 0, 1);
        console.log({ messageInChain });
        assert(messageInChain?.[0].sender === user.address, 'message!');
        assert(messageInChain?.[0].receiver === user2.address, 'message!');
        assert(messageInChain?.[0].message === message, 'message!');

        const messageInChain2 = await yarBridgeMessageMock.connect(user2).getMessages.staticCall(ethers.ZeroAddress, user.address, 0, 1);
        console.log({ messageInChain2 });
        assert(messageInChain2?.[0].sender === user.address, 'message!');
        assert(messageInChain2?.[0].receiver === user2.address, 'message!');
        assert(messageInChain2?.[0].message === message, 'message!');
    })
})